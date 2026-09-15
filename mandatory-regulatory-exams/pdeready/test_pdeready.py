#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent
html=(ROOT/"index.html").read_text(encoding="utf-8")
bank=(ROOT/"bank.js").read_text(encoding="utf-8")

def require(condition,msg):
    if not condition:
        raise SystemExit(msg)

require('<script src="./bank.js"></script>' in html,"index must load bank.js")
require("pdeready.progress.v2" in html,"persistent progress key missing")
require("12 November 2026" in html,"published next sitting missing")
require("startDrill" in html and "renderDashboard" in html,"adaptive learner functions missing")
require("AI tools such as ChatGPT are prohibited" in html,"exam-integrity boundary missing")
require("PDEReady is therefore a preparation product only" in html,"preparation-only wording missing")

p4=set(re.findall(r'id:"(P4-\d{3})"',bank))
p5=set(re.findall(r'id:"(P5-\d{3})"',bank))
cases=set(re.findall(r'id:"(C-\d{3})"',bank))
require(len(p4)>=20,f"expected >=20 PDE4 questions, found {len(p4)}")
require(len(p5)>=20,f"expected >=20 PDE5 questions, found {len(p5)}")
require(len(cases)>=12,f"expected >=12 cases, found {len(cases)}")
require(len(p4)==len(re.findall(r'id:"P4-\d{3}"',bank)),"duplicate PDE4 ids")
require(len(p5)==len(re.findall(r'id:"P5-\d{3}"',bank)),"duplicate PDE5 ids")
require(len(cases)==len(re.findall(r'id:"C-\d{3}"',bank)),"duplicate case ids")

for needle in ["exam-rules","eligibility","professional-judgement","ethics","records","complaints","exam-integrity","governance","supervision","controls"]:
    require(f'topic:"{needle}"' in bank,f"topic coverage missing: {needle}")

for forbidden in ["guaranteed pass","leaked exam paper","live exam answer service"]:
    require(forbidden not in (html+bank).lower(),f"unsafe commercial/integrity claim: {forbidden}")

print(f"PDEReady gate PASS: {len(p4)} PDE4 questions, {len(p5)} PDE5 questions, {len(cases)} cases")
