import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
const root=resolve(process.cwd());
const read=async p=>readFile(resolve(root,p),"utf8");
const exists=async p=>{try{await access(resolve(root,p));return true}catch{return false}};
const fail=m=>{console.error("WAVE1_PREMIUM_FAIL:",m);process.exitCode=2};
const manifest=JSON.parse(await read("quality/premium-wave1.json"));
if(manifest.qualityProfile!=="izakhono-premium-v1") fail("quality profile mismatch");
const localChecks=[
  ["izakhono-group/index.html","data-quality-profile=\"izakhono-premium-v1\""],
  ["izakhono-group/premium-v1.css","prefers-reduced-motion"],
  ["auto-ai/public/index.html","data-quality-profile=\"izakhono-premium-v1\""],
  ["auto-ai/public/premium-v1.css","focus-visible"],
  ["FAISReady/index.html","data-quality-profile=\"izakhono-premium-v1\""],
  ["FAISReady/premium-v1.css","pointer:coarse"],
  ["kora-network/app/layout.tsx","data-quality-profile=\"izakhono-premium-v1\""],
  ["kora-network/app/premium-v1.css","prefers-contrast:more"],
  ["IZAKHONO-STUDIO/src/main.jsx","izakhono-premium-v1"],
  ["IZAKHONO-STUDIO/src/premium-v1.css","--iz-premium-touch"],
  ["ports/kora-kids/release.json","\"qualityProfile\": \"izakhono-premium-v1\""],
  ["kora-network/public/tumi-tala/release.json","\"qualityProfile\": \"izakhono-premium-v1\""]
];
for(const [path,needle] of localChecks){
  if(!(await exists(path))){fail("missing "+path);continue}
  if(!(await read(path)).includes(needle)) fail(path+" missing "+needle);
}
const a=JSON.parse(await read("ports/kora-kids/release.json"));
const b=JSON.parse(await read("kora-network/public/tumi-tala/release.json"));
if(JSON.stringify(a)!==JSON.stringify(b)) fail("KORA KIDS owned/external release parity drift");
const external=manifest.products.filter(p=>String(p.source).startsWith("external:"));
if(external.length!==2) fail("expected two dedicated-repository products");
if(!process.exitCode) console.log("IZAKHONO_PREMIUM_WAVE1=PASS local=6 external=2");
