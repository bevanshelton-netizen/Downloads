import {readFile,access} from "node:fs/promises";
import {resolve} from "node:path";
const root=resolve(process.cwd());
const read=async p=>readFile(resolve(root,p),"utf8");
const exists=async p=>{try{await access(resolve(root,p));return true}catch{return false}};
const fail=m=>{console.error("WAVE2_PREMIUM_FAIL:",m);process.exitCode=2};
const manifest=JSON.parse(await read("quality/premium-wave2.json"));
if(manifest.qualityProfile!=="izakhono-premium-v1") fail("profile mismatch");
const checks=[
 ["izakhono-growth-os/app/layout.tsx","izakhono-premium-v1"],
 ["izakhono-growth-os/app/premium-v1.css","prefers-reduced-motion"],
 ["memory-mania/public/index.html","izakhono-premium-v1"],
 ["memory-mania/public/premium-v1.css","focus-visible"],
 ["crowne-hair/public/index.html","izakhono-premium-v1"],
 ["crowne-hair/public/premium-v1.css","pointer:coarse"],
 ["kora-network/public/izakhono-revenue/index.html","izakhono-premium-v1"],
 ["kora-network/public/izakhono-revenue/premium-v1.css","prefers-contrast:more"],
 ["ports/kora-gospel-tv/index.html","izakhono-premium-v1"],
 ["ports/kora-gospel-tv/premium-v1.css","--iz-premium-touch"],
 ["izakhono-one-ai/public/index.html","izakhono-premium-v1"],
 ["izakhono-one-ai/public/premium-v1.css","focus-visible"]
];
for(const [path,needle] of checks){
 if(!(await exists(path))){fail("missing "+path);continue}
 if(!(await read(path)).includes(needle)) fail(path+" missing "+needle);
}
const pay=await read("izakhono-pay/runtime.mjs");
if(!pay.includes("refuses non-loopback bind")) fail("IZAKHONO PAY loopback safety boundary missing");
const domains=await read("izakhono-owned-cloud/deploy-izakhono-domains.sh");
if(!domains.includes("Checkout safety gate did not fail closed")) fail("IZAKHONO DOMAINS fail-closed checkout proof missing");
if(!domains.includes("IZAKHONO CODE")) fail("IZAKHONO DOMAINS owned source authority missing");
const registry=JSON.parse(await read("owner-host/platforms.json"));
for(const id of ["growth-os-v2","ecd360","legacymart","izakhono-pay","izakhono-domains","memory-mania","crowne-hair","izakhono-revenue-desk","kora-gospel-tv","izakhono-one-ai"]){
 const p=registry.platforms.find(x=>x.id===id);
 if(!p) fail("registry missing "+id);
 else if(p.qualityProfile!=="izakhono-premium-v1") fail(id+" lost premium profile");
}
if(!process.exitCode) console.log("IZAKHONO_PREMIUM_WAVE2=PASS customer=8 infrastructure=2");
