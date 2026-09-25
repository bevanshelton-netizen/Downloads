package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

type Config struct {
	Schema      string    `json:"schema"`
	NodeName    string    `json:"node_name"`
	HTTPListen  string    `json:"http_listen"`
	HTTPSListen string    `json:"https_listen"`
	AdminListen string    `json:"admin_listen"`
	TLS         TLSConfig `json:"tls"`
	Routes      []Route   `json:"routes"`
	Security    Security  `json:"security"`
	ACMEWebroot string    `json:"acme_webroot"`
}

type TLSConfig struct {
	CertFile string `json:"cert_file"`
	KeyFile  string `json:"key_file"`
}

type Route struct {
	Host       string `json:"host"`
	Upstream   string `json:"upstream"`
	HealthPath string `json:"health_path"`
}

type Security struct {
	HSTSSeconds      int   `json:"hsts_seconds"`
	RateLimitPerMin  int   `json:"rate_limit_per_minute"`
	MaxRequestBodyMB int64 `json:"max_request_body_mb"`
}

type routeState struct {
	route       Route
	target      *url.URL
	proxy       *httputil.ReverseProxy
	mu          sync.RWMutex
	healthy     bool
	lastDetail  string
	lastChecked time.Time
}

type limiterEntry struct {
	window time.Time
	count  int
}

type Engine struct {
	cfg    Config
	routes map[string]*routeState
	limMu  sync.Mutex
	limits map[string]limiterEntry
}

func loadConfig(path string) (Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}
	var c Config
	if err := json.Unmarshal(b, &c); err != nil {
		return Config{}, err
	}
	if err := validateConfig(c); err != nil {
		return Config{}, err
	}
	return c, nil
}

func validateConfig(c Config) error {
	if c.Schema != "izakhono.edge-engine/v1" {
		return fmt.Errorf("unsupported schema %q", c.Schema)
	}
	if c.NodeName == "" {
		return errors.New("node_name is required")
	}
	if c.HTTPListen == "" || c.HTTPSListen == "" || c.AdminListen == "" {
		return errors.New("listen addresses are required")
	}
	if !isLoopbackListen(c.AdminListen) {
		return errors.New("admin_listen must be loopback-only")
	}
	if c.TLS.CertFile == "" || c.TLS.KeyFile == "" {
		return errors.New("TLS cert_file and key_file are required")
	}
	if len(c.Routes) == 0 {
		return errors.New("at least one route is required")
	}
	seen := map[string]bool{}
	for _, r := range c.Routes {
		host := normalizeHost(r.Host)
		if host == "" {
			return errors.New("route host is required")
		}
		if seen[host] {
			return fmt.Errorf("duplicate route host %q", host)
		}
		seen[host] = true
		if r.HealthPath == "" || !strings.HasPrefix(r.HealthPath, "/") {
			return fmt.Errorf("route %s requires absolute health_path", host)
		}
		u, err := url.Parse(r.Upstream)
		if err != nil {
			return fmt.Errorf("route %s upstream: %w", host, err)
		}
		if u.Scheme != "http" {
			return fmt.Errorf("route %s upstream must use http loopback origin", host)
		}
		h := u.Hostname()
		ip := net.ParseIP(h)
		if ip == nil || !ip.IsLoopback() {
			return fmt.Errorf("route %s upstream must be loopback-only", host)
		}
		if u.Port() == "" {
			return fmt.Errorf("route %s upstream requires explicit port", host)
		}
	}
	return nil
}

func isLoopbackListen(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func normalizeHost(h string) string {
	h = strings.ToLower(strings.TrimSpace(h))
	if strings.HasSuffix(h, ".") {
		h = strings.TrimSuffix(h, ".")
	}
	if host, _, err := net.SplitHostPort(h); err == nil {
		return host
	}
	return h
}

func scrubForwardingHeaders(h http.Header) {
	for _, name := range []string{
		"Forwarded",
		"X-Forwarded-For",
		"X-Forwarded-Host",
		"X-Forwarded-Proto",
		"X-Forwarded-Port",
		"X-Forwarded-Server",
		"X-Real-IP",
		"CF-Connecting-IP",
		"True-Client-IP",
		"Fly-Client-IP",
		"X-Vercel-Forwarded-For",
		"X-IZAKHONO-Edge",
	} {
		h.Del(name)
	}
}

func validateTLSMaterial(c Config) error {
	pair, err := tls.LoadX509KeyPair(c.TLS.CertFile, c.TLS.KeyFile)
	if err != nil {
		return fmt.Errorf("load TLS keypair: %w", err)
	}
	if len(pair.Certificate) == 0 {
		return errors.New("TLS certificate chain is empty")
	}
	leaf, err := x509.ParseCertificate(pair.Certificate[0])
	if err != nil {
		return fmt.Errorf("parse TLS leaf certificate: %w", err)
	}
	now := time.Now()
	if now.Before(leaf.NotBefore) {
		return fmt.Errorf("TLS certificate is not valid before %s", leaf.NotBefore.UTC().Format(time.RFC3339))
	}
	if !now.Before(leaf.NotAfter) {
		return fmt.Errorf("TLS certificate expired at %s", leaf.NotAfter.UTC().Format(time.RFC3339))
	}
	for _, r := range c.Routes {
		host := normalizeHost(r.Host)
		if err := leaf.VerifyHostname(host); err != nil {
			return fmt.Errorf("TLS certificate does not cover route host %s: %w", host, err)
		}
	}
	return nil
}

func newEngine(c Config) (*Engine, error) {
	e := &Engine{cfg: c, routes: map[string]*routeState{}, limits: map[string]limiterEntry{}}
	for _, r := range c.Routes {
		t, _ := url.Parse(r.Upstream)
		p := httputil.NewSingleHostReverseProxy(t)
		p.Transport = &http.Transport{
			Proxy:                 nil,
			DialContext:           (&net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
			ForceAttemptHTTP2:     false,
			MaxIdleConns:          128,
			MaxIdleConnsPerHost:   32,
			IdleConnTimeout:       90 * time.Second,
			ResponseHeaderTimeout: 30 * time.Second,
		}
		original := p.Director
		p.Director = func(req *http.Request) {
			publicHost := normalizeHost(req.Host)
			original(req)
			req.Host = t.Host
			scrubForwardingHeaders(req.Header)
			req.Header.Set("X-Forwarded-Host", publicHost)
			req.Header.Set("X-Forwarded-Proto", "https")
			req.Header.Set("X-Real-IP", clientIP(req))
			req.Header.Set("X-IZAKHONO-Edge", c.NodeName)
		}
		p.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
			log.Printf("proxy error host=%s path=%s err=%v", req.Host, req.URL.Path, err)
			http.Error(w, "IZAKHONO EDGE upstream unavailable", http.StatusBadGateway)
		}
		e.routes[normalizeHost(r.Host)] = &routeState{route: r, target: t, proxy: p}
	}
	return e, nil
}

func (e *Engine) allow(ip string) bool {
	limit := e.cfg.Security.RateLimitPerMin
	if limit <= 0 {
		return true
	}
	now := time.Now().UTC().Truncate(time.Minute)
	e.limMu.Lock()
	defer e.limMu.Unlock()
	ent := e.limits[ip]
	if !ent.window.Equal(now) {
		ent = limiterEntry{window: now, count: 0}
	}
	ent.count++
	e.limits[ip] = ent
	if len(e.limits) > 10000 {
		for k, v := range e.limits {
			if v.window.Before(now.Add(-time.Minute)) {
				delete(e.limits, k)
			}
		}
	}
	return ent.count <= limit
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (e *Engine) serveHTTPS(w http.ResponseWriter, r *http.Request) {
	if !e.allow(clientIP(r)) {
		w.Header().Set("Retry-After", "60")
		http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
		return
	}
	host := normalizeHost(r.Host)
	rs := e.routes[host]
	if rs == nil {
		http.NotFound(w, r)
		return
	}
	rs.mu.RLock()
	healthy := rs.healthy
	rs.mu.RUnlock()
	if !healthy {
		http.Error(w, "IZAKHONO EDGE route unhealthy", http.StatusServiceUnavailable)
		return
	}
	if e.cfg.Security.MaxRequestBodyMB > 0 && r.Body != nil {
		r.Body = http.MaxBytesReader(w, r.Body, e.cfg.Security.MaxRequestBodyMB*1024*1024)
	}
	if e.cfg.Security.HSTSSeconds > 0 {
		w.Header().Set("Strict-Transport-Security", fmt.Sprintf("max-age=%d; includeSubDomains", e.cfg.Security.HSTSSeconds))
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("X-Frame-Options", "SAMEORIGIN")
	rs.proxy.ServeHTTP(w, r)
}

func (e *Engine) serveHTTP(w http.ResponseWriter, r *http.Request) {
	host := normalizeHost(r.Host)
	if e.routes[host] == nil {
		http.NotFound(w, r)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/.well-known/acme-challenge/") {
		if e.cfg.ACMEWebroot == "" {
			http.NotFound(w, r)
			return
		}
		token := strings.TrimPrefix(r.URL.Path, "/.well-known/acme-challenge/")
		if token == "" || strings.ContainsAny(token, "/\\") || strings.Contains(token, "..") {
			http.NotFound(w, r)
			return
		}
		data, err := os.ReadFile(filepath.Join(e.cfg.ACMEWebroot, token))
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(data)
		return
	}
	target := "https://" + host + r.URL.RequestURI()
	http.Redirect(w, r, target, http.StatusPermanentRedirect)
}

func (e *Engine) healthLoop(ctx context.Context) {
	healthTransport := &http.Transport{
		Proxy:       nil,
		DialContext: (&net.Dialer{Timeout: 3 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
	}
	defer healthTransport.CloseIdleConnections()
	cli := &http.Client{Transport: healthTransport, Timeout: 5 * time.Second}
	check := func(rs *routeState) {
		u := strings.TrimRight(rs.route.Upstream, "/") + rs.route.HealthPath
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		resp, err := cli.Do(req)
		detail := "ok"
		healthy := err == nil && resp.StatusCode >= 200 && resp.StatusCode < 400
		if err != nil {
			detail = err.Error()
		} else {
			detail = resp.Status
			resp.Body.Close()
		}
		rs.mu.Lock()
		rs.healthy = healthy
		rs.lastDetail = detail
		rs.lastChecked = time.Now().UTC()
		rs.mu.Unlock()
	}
	for _, rs := range e.routes {
		check(rs)
	}
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for _, rs := range e.routes {
				go check(rs)
			}
		}
	}
}

func (e *Engine) adminHandler(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/health":
		ok := true
		for _, rs := range e.routes {
			rs.mu.RLock()
			ok = ok && rs.healthy
			rs.mu.RUnlock()
		}
		w.Header().Set("Content-Type", "application/json")
		if !ok {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		json.NewEncoder(w).Encode(map[string]any{"schema": "izakhono.edge-health/v1", "node_name": e.cfg.NodeName, "healthy": ok})
	case "/status":
		out := map[string]any{"schema": "izakhono.edge-status/v1", "node_name": e.cfg.NodeName, "routes": map[string]any{}}
		routes := out["routes"].(map[string]any)
		for host, rs := range e.routes {
			rs.mu.RLock()
			routes[host] = map[string]any{"upstream": rs.route.Upstream, "healthy": rs.healthy, "last_detail": rs.lastDetail, "last_checked": rs.lastChecked}
			rs.mu.RUnlock()
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	default:
		http.NotFound(w, r)
	}
}

func main() {
	configPath := flag.String("config", "/etc/izakhono-edge/config.json", "config path")
	checkOnly := flag.Bool("check", false, "validate config and exit")
	flag.Parse()

	cfg, err := loadConfig(*configPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	if err := validateTLSMaterial(cfg); err != nil {
		log.Fatalf("TLS: %v", err)
	}
	if *checkOnly {
		fmt.Println("IZAKHONO EDGE CONFIG + TLS: PASS")
		return
	}

	engine, err := newEngine(cfg)
	if err != nil {
		log.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go engine.healthLoop(ctx)

	httpSrv := &http.Server{Addr: cfg.HTTPListen, Handler: http.HandlerFunc(engine.serveHTTP), ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 120 * time.Second}
	httpsSrv := &http.Server{Addr: cfg.HTTPSListen, Handler: http.HandlerFunc(engine.serveHTTPS), ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 120 * time.Second, TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12}}
	adminSrv := &http.Server{Addr: cfg.AdminListen, Handler: http.HandlerFunc(engine.adminHandler), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second}

	errs := make(chan error, 3)
	go func() {
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errs <- err
		}
	}()
	go func() {
		if err := httpsSrv.ListenAndServeTLS(cfg.TLS.CertFile, cfg.TLS.KeyFile); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errs <- err
		}
	}()
	go func() {
		if err := adminSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errs <- err
		}
	}()

	sig := make(chan os.Signal, 2)
	signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
	select {
	case s := <-sig:
		log.Printf("shutdown signal=%s", s)
	case err := <-errs:
		log.Printf("server error=%v", err)
	}
	cancel()
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()
	httpSrv.Shutdown(shutdownCtx)
	httpsSrv.Shutdown(shutdownCtx)
	adminSrv.Shutdown(shutdownCtx)
}
