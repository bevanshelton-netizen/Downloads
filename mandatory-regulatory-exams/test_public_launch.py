#!/usr/bin/env python3
from pathlib import Path
import re, json

ROOT=Path(__file__).resolve().parent
HOME=(ROOT/"index.html").read_text(encoding="utf-8")
PDE=(ROOT/"pdeready"/"index.html").read_text(encoding="utf-8")
BANK=(ROOT/"pdeready"/"bank.js").read_text(encoding="utf-8")

def req(v,msg):
    if not v: raise SystemExit(msg)

for f in ["terms.html","privacy.html","sources.html","404.html","robots.txt","vercel.json"]:
    req((ROOT/f).exists(),f"missing public launch file: {f}")

req('href="./pdeready/"' in HOME,"umbrella must link to PDEReady")
req("PUBLIC PREP" in HOME,"PDEReady must be visibly public on umbrella")
for link in ["terms.html","privacy.html","sources.html"]:
    req(link in HOME,f"home footer missing {link}")
    req("../"+link in PDE,f"PDEReady footer missing {link}")

req("12 NOV 2026" in PDE and "1–31 October 2026" in PDE,"current published PDE date/registration copy missing")
req("Official PDE calendar" in PDE and "Official eligibility" in PDE,"official PDE verification links missing")
req("preparation product only" in PDE,"exam-integrity boundary missing")
req("not an official ppra mark or pass prediction" in PDE.lower(),"readiness disclaimer missing")

p4=set(re.findall(r'id:"(P4-\d{3})"',BANK))
p5=set(re.findall(r'id:"(P5-\d{3})"',BANK))
cases=set(re.findall(r'id:"(C-\d{3})"',BANK))
req(len(p4)>=20 and len(p5)>=20 and len(cases)>=12,"question/case bank below launch floor")

cfg=json.loads((ROOT/"vercel.json").read_text(encoding="utf-8"))
req(cfg.get("cleanUrls") is True,"cleanUrls must be enabled")
headers={h["key"] for group in cfg.get("headers",[]) for h in group.get("headers",[])}
req({"X-Content-Type-Options","Referrer-Policy","Permissions-Policy","X-Frame-Options"}.issubset(headers),"security headers incomplete")

terms=(ROOT/"terms.html").read_text(encoding="utf-8").lower()
privacy=(ROOT/"privacy.html").read_text(encoding="utf-8").lower()
sources=(ROOT/"sources.html").read_text(encoding="utf-8").lower()
req("live examination integrity" in terms,"terms missing exam-integrity rule")
req("local storage" in privacy,"privacy missing local-storage disclosure")
req("theppra.org.za" in sources and "fsca.co.za" in sources,"official source register incomplete")

print(f"PUBLIC LAUNCH GATE PASS: {len(p4)} PDE4, {len(p5)} PDE5, {len(cases)} cases; legal and navigation checks passed")
