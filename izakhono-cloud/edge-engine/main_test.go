package main

import (
	"crypto/x509"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func validConfig(upstream string) Config {
	return Config{
		Schema: "izakhono.edge-engine/v1", NodeName: "ISN-01",
		HTTPListen: ":8080", HTTPSListen: ":8443", AdminListen: "127.0.0.1:19090",
		TLS:      TLSConfig{CertFile: "/tmp/cert.pem", KeyFile: "/tmp/key.pem"},
		Routes:   []Route{{Host: "kora.example.test", Upstream: upstream, HealthPath: "/api/health"}},
		Security: Security{HSTSSeconds: 31536000, RateLimitPerMin: 100, MaxRequestBodyMB: 64},
	}
}

func TestValidateRejectsExternalUpstream(t *testing.T) {
	c := validConfig("http://8.8.8.8:18080")
	if err := validateConfig(c); err == nil { t.Fatal("expected external upstream to be rejected") }
}

func TestValidateRejectsPublicAdmin(t *testing.T) {
	c := validConfig("http://127.0.0.1:18080"); c.AdminListen = "0.0.0.0:19090"
	if err := validateConfig(c); err == nil { t.Fatal("expected public admin listen to be rejected") }
}

func TestProxyRoutesHealthyLoopback(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { if r.URL.Path == "/api/health" { io.WriteString(w, "ok"); return }; io.WriteString(w, "KORA") }))
	defer upstream.Close()
	c := validConfig(upstream.URL); e, err := newEngine(c); if err != nil { t.Fatal(err) }
	e.routes["kora.example.test"].healthy = true
	req := httptest.NewRequest(http.MethodGet, "https://kora.example.test/", nil); req.Host = "kora.example.test"; req.RemoteAddr = "127.0.0.1:9999"
	rec := httptest.NewRecorder(); e.serveHTTPS(rec, req)
	if rec.Code != 200 { t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String()) }
	if strings.TrimSpace(rec.Body.String()) != "KORA" { t.Fatalf("body=%q", rec.Body.String()) }
	if rec.Header().Get("Strict-Transport-Security") == "" { t.Fatal("missing HSTS") }
}

func TestProxyFailsClosedWhenUnhealthy(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, "KORA") })); defer upstream.Close()
	c := validConfig(upstream.URL); e, _ := newEngine(c)
	req := httptest.NewRequest(http.MethodGet, "https://kora.example.test/", nil); req.Host = "kora.example.test"; req.RemoteAddr = "127.0.0.1:9999"
	rec := httptest.NewRecorder(); e.serveHTTPS(rec, req)
	if rec.Code != http.StatusServiceUnavailable { t.Fatalf("got %d", rec.Code) }
}

func TestLoadConfig(t *testing.T) {
	c := `{"schema":"izakhono.edge-engine/v1","node_name":"ISN-01","http_listen":":80","https_listen":":443","admin_listen":"127.0.0.1:19090","tls":{"cert_file":"/tmp/cert","key_file":"/tmp/key"},"routes":[{"host":"kora.example.test","upstream":"http://127.0.0.1:18080","health_path":"/api/health"}],"security":{"hsts_seconds":31536000,"rate_limit_per_minute":100,"max_request_body_mb":64}}`
	f, err := os.CreateTemp(t.TempDir(), "config-*.json"); if err != nil { t.Fatal(err) }; defer f.Close()
	if _, err := f.WriteString(c); err != nil { t.Fatal(err) }
	got, err := loadConfig(f.Name()); if err != nil { t.Fatal(err) }
	if got.NodeName != "ISN-01" { t.Fatalf("node=%s", got.NodeName) }
}

func TestDirectorScrubsForwardingHeaders(t *testing.T) {
	var gotXFF, gotProto, gotHost, gotRealIP, gotCF, gotTrueClient, gotEdge string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotXFF = r.Header.Get("X-Forwarded-For")
		gotProto = r.Header.Get("X-Forwarded-Proto")
		gotHost = r.Header.Get("X-Forwarded-Host")
		gotRealIP = r.Header.Get("X-Real-IP")
		gotCF = r.Header.Get("CF-Connecting-IP")
		gotTrueClient = r.Header.Get("True-Client-IP")
		gotEdge = r.Header.Get("X-IZAKHONO-Edge")
		io.WriteString(w, "ok")
	}))
	defer upstream.Close()
	c := validConfig(upstream.URL)
	e, _ := newEngine(c)
	e.routes["kora.example.test"].healthy = true
	req := httptest.NewRequest(http.MethodGet, "https://kora.example.test/", nil)
	req.Host = "kora.example.test"
	req.RemoteAddr = "127.0.0.1:3210"
	req.Header.Set("X-Forwarded-For", "203.0.113.9")
	req.Header.Set("X-Forwarded-Proto", "http")
	req.Header.Set("X-Real-IP", "198.51.100.10")
	req.Header.Set("CF-Connecting-IP", "198.51.100.11")
	req.Header.Set("True-Client-IP", "198.51.100.12")
	req.Header.Set("X-IZAKHONO-Edge", "spoofed")
	rec := httptest.NewRecorder()
	e.serveHTTPS(rec, req)
	if gotXFF != "127.0.0.1" { t.Fatalf("xff=%q", gotXFF) }
	if gotProto != "https" { t.Fatalf("proto=%q", gotProto) }
	if gotHost != "kora.example.test" { t.Fatalf("host=%q", gotHost) }
	if gotRealIP != "127.0.0.1" { t.Fatalf("real-ip=%q", gotRealIP) }
	if gotCF != "" { t.Fatalf("cf-connecting-ip leaked=%q", gotCF) }
	if gotTrueClient != "" { t.Fatalf("true-client-ip leaked=%q", gotTrueClient) }
	if gotEdge != "ISN-01" { t.Fatalf("edge identity=%q", gotEdge) }
}

func TestACMEChallengeUsesOwnedWebroot(t *testing.T) {
	dir := t.TempDir(); if err := os.WriteFile(dir+"/token123", []byte("proof"), 0600); err != nil { t.Fatal(err) }
	c := validConfig("http://127.0.0.1:18080"); c.ACMEWebroot = dir; e, _ := newEngine(c)
	req := httptest.NewRequest(http.MethodGet, "http://kora.example.test/.well-known/acme-challenge/token123", nil); req.Host = "kora.example.test"
	rec := httptest.NewRecorder(); e.serveHTTP(rec, req)
	if rec.Code != 200 || strings.TrimSpace(rec.Body.String()) != "proof" { t.Fatalf("status=%d body=%q", rec.Code, rec.Body.String()) }
}

func TestACMEChallengeRejectsUnknownHost(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(dir+"/token123", []byte("proof"), 0600); err != nil { t.Fatal(err) }
	c := validConfig("http://127.0.0.1:18080")
	c.ACMEWebroot = dir
	e, _ := newEngine(c)
	req := httptest.NewRequest(http.MethodGet, "http://other.example.test/.well-known/acme-challenge/token123", nil)
	req.Host = "other.example.test"
	rec := httptest.NewRecorder()
	e.serveHTTP(rec, req)
	if rec.Code != http.StatusNotFound { t.Fatalf("got %d", rec.Code) }
}


func TestTLSMaterialCoversConfiguredHost(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()
	leaf := srv.Certificate()
	host := ""
	if len(leaf.DNSNames) > 0 {
		host = leaf.DNSNames[0]
	} else if len(leaf.IPAddresses) > 0 {
		host = leaf.IPAddresses[0].String()
	}
	if host == "" {
		t.Fatal("test certificate has no SAN host")
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srv.TLS.Certificates[0].Certificate[0]})
	keyDER, err := x509.MarshalPKCS8PrivateKey(srv.TLS.Certificates[0].PrivateKey)
	if err != nil { t.Fatal(err) }
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})
	certPath := t.TempDir() + "/cert.pem"
	keyPath := t.TempDir() + "/key.pem"
	if err := os.WriteFile(certPath, certPEM, 0600); err != nil { t.Fatal(err) }
	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil { t.Fatal(err) }
	c := validConfig("http://127.0.0.1:18080")
	c.Routes[0].Host = host
	c.TLS = TLSConfig{CertFile: certPath, KeyFile: keyPath}
	if err := validateTLSMaterial(c); err != nil { t.Fatalf("valid TLS material rejected: %v", err) }
	c.Routes[0].Host = "not-covered.invalid"
	if err := validateTLSMaterial(c); err == nil { t.Fatal("expected hostname mismatch to be rejected") }
}
