import {readFile,access} from "node:fs/promises";
import {resolve,dirname,extname} from "node:path";

const ROOT=resolve(process.cwd());
const read=async p=>readFile(resolve(ROOT,p),"utf8");
const load=async p=>JSON.parse(await read(p));
const exists=async p=>{try{await access(resolve(ROOT,p));return true}catch{return false}};
const fail=m=>{console.error("PRODUCTION_EXCELLENCE_FAIL:",m);process.exitCode=2};
const note=m=>console.log("PRODUCTION_EXCELLENCE:",m);

const standard=await load("quality/production-excellence.json");
const visual=await load("quality/visual-regression-contract.json");
const matrix=await load("quality/public-health-matrix.json");
const rollout=await load("izakhono-one-ai/public-sellable-rollout.json");
const registry=await load("owner-host/platforms.json");

if(standard.profile!=="izakhono-premium-v1") fail("profile drift");
if(standard.visualRegressionMode!=="contract") fail("visual regression mode changed without review");
if(standard.publicHealth?.ownedLiveRequiresIndependentHttps!==true) fail("public-live HTTPS rule disabled");

function stripQuery(v){return String(v||"").split("#")[0].split("?")[0]}
function externalOrigins(text){
  const out=new Set();
  for(const m of text.matchAll(/https?:\/\/([^\/"'\s)]+)/gi)) out.add(m[1].toLowerCase());
  return out;
}
function localRefs(html){
  const out=[];
  const tag=/<(?:link|script|img|source)\b[^>]*?(?:href|src)=["']([^"']+)["'][^>]*>/gi;
  for(const m of html.matchAll(tag)){
    const raw=stripQuery(m[1]);
    if(!raw||raw.startsWith("/")||raw.startsWith("#")||/^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(raw)) continue;
    if(![".css",".js",".mjs",".json",".svg",".png",".jpg",".jpeg",".webp",".ico"].includes(extname(raw).toLowerCase())) continue;
    out.push(raw);
  }
  return out;
}
function duplicateIds(html){
  const seen=new Set(),dup=new Set();
  for(const m of html.matchAll(/\bid=["']([^"']+)["']/gi)){
    if(seen.has(m[1])) dup.add(m[1]); else seen.add(m[1]);
  }
  return [...dup];
}
function imagesMissingAlt(html){
  const missing=[];
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    if(!/\balt\s*=\s*["'][^"']*["']/i.test(m[0])) missing.push(m[0].slice(0,120));
  }
  return missing;
}

for(const surface of visual.surfaces){
  if(!(await exists(surface.html))){fail(surface.id+" missing "+surface.html);continue}
  const html=await read(surface.html);
  if(Buffer.byteLength(html)>standard.budgets.staticHtmlBytes) fail(surface.id+" HTML exceeds budget");
  if(!/<meta\b[^>]*name=["']viewport["']/i.test(html)) fail(surface.id+" missing viewport");
  if(!/<title>[^<]+<\/title>/i.test(html)) fail(surface.id+" missing title");
  if(!/<meta\b[^>]*name=["']description["']/i.test(html)) fail(surface.id+" missing meta description");
  for(const text of surface.landmarks||[]) if(!html.includes(text)) fail(surface.id+" visual landmark drift: "+text);
  const dup=duplicateIds(html); if(dup.length) fail(surface.id+" duplicate ids: "+dup.join(","));
  const missingAlt=imagesMissingAlt(html); if(missingAlt.length) fail(surface.id+" image(s) missing alt text");
  const cssTexts=[];
  let cssBytes=0;
  for(const css of surface.css||[]){
    if(!(await exists(css))){fail(surface.id+" missing CSS "+css);continue}
    const body=await read(css); cssTexts.push(body); cssBytes+=Buffer.byteLength(body);
  }
  for(const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) cssTexts.push(m[1]);
  if(cssBytes>standard.budgets.aggregateCssBytes) fail(surface.id+" CSS exceeds budget");
  const css=cssTexts.join("\n");
  if(!css.includes("@media")) fail(surface.id+" has no responsive media contract");
  if(!css.includes("focus-visible")) fail(surface.id+" lacks visible keyboard focus contract");
  if(!css.includes("prefers-reduced-motion")) fail(surface.id+" lacks reduced-motion contract");
  if(!css.includes("--iz-premium-touch:44px")&&!css.includes("min-height:44px")) fail(surface.id+" lacks 44px touch baseline");
  if(surface.id!=="kora-kids" && !html.includes('data-quality-profile="izakhono-premium-v1"')) fail(surface.id+" missing premium body marker");
  if(surface.id==="kora-kids"){
    const release=await load(surface.release);
    if(release.qualityProfile!=="izakhono-premium-v1") fail("KORA KIDS premium release marker missing");
  }
  const base=dirname(surface.html);
  for(const rel of localRefs(html)){
    const path=resolve(ROOT,base,rel);
    try{await access(path)}catch{fail(surface.id+" broken local asset "+rel)}
  }
  const origins=externalOrigins(html);
  if(origins.size>standard.budgets.externalOrigins) fail(surface.id+" external-origin budget exceeded: "+origins.size);
}

for(const app of visual.applicationSurfaces){
  if(!(await exists(app.entry))){fail(app.id+" missing app entry");continue}
  const entry=await read(app.entry);
  if(!entry.includes(app.marker)) fail(app.id+" missing premium profile marker");
  let css="";
  let bytes=0;
  for(const p of app.css){
    if(!(await exists(p))){fail(app.id+" missing CSS "+p);continue}
    const part=await read(p);css+=part+"\n";bytes+=Buffer.byteLength(part);
  }
  if(bytes>standard.budgets.aggregateCssBytes*2) fail(app.id+" application CSS exceeds budget");
  for(const needle of ["focus-visible","prefers-reduced-motion","pointer:coarse"]) if(!css.includes(needle)) fail(app.id+" missing "+needle+" production primitive");
  if(!css.includes("@media")) fail(app.id+" missing responsive CSS");
}

const servers=[
  "ports/kora-kids/server.mjs",
  "memory-mania/server.mjs",
  "kora-network/public/izakhono-revenue/server.mjs",
  "ports/kora-gospel-tv/server.mjs",
  "izakhono-one-ai/server.mjs",
  "crowne-hair/server.mjs"
];
for(const file of servers){
  const src=await read(file);
  for(const header of ["x-content-type-options","referrer-policy","permissions-policy"]){
    if(!src.toLowerCase().includes(header)) fail(file+" missing security header "+header);
  }
}
const gospel=await read("ports/kora-gospel-tv/server.mjs");
if(!gospel.toLowerCase().includes("content-security-policy")) fail("Gospel runtime missing CSP");
const one=await read("izakhono-one-ai/server.mjs");
if(!one.toLowerCase().includes("content-security-policy")) fail("ONE AI runtime missing CSP");

const pay=await read("izakhono-pay/runtime.mjs");
if(!pay.includes("refuses non-loopback bind")) fail("IZAKHONO PAY non-loopback safety boundary missing");
const domains=await read("izakhono-owned-cloud/deploy-izakhono-domains.sh");
if(!domains.includes("Checkout safety gate did not fail closed")) fail("IZAKHONO Domains checkout fail-closed proof missing");

const registryIds=new Set((registry.platforms||[]).map(x=>x.id));
for(const id of ["izakhono-pay","izakhono-domains"]) if(!registryIds.has(id)) fail("registry missing infrastructure product "+id);

const products=new Map((rollout.products||[]).map(x=>[x.id,x]));
for(const probe of matrix.probes){
  const p=products.get(probe.product);
  if(!p) fail("health matrix product absent from rollout: "+probe.product);
  if(probe.mode==="required-resilience"){
    if(p?.public_status!=="temporary-public") fail(probe.id+" resilience probe does not map to temporary-public product");
    if(p?.fallback!==probe.url) fail(probe.id+" fallback URL drift");
  }
  if(probe.mode==="observe" && p?.owned_target && p.owned_target!==probe.url) fail(probe.id+" owned target drift");
}
for(const p of rollout.products||[]){
  if(p.public_status==="owned-public-verified"){
    const matching=matrix.probes.find(x=>x.product===p.id&&x.url===p.owned_target&&x.mode==="required");
    if(!matching) fail(p.id+" is marked owned-public-verified without a required HTTPS probe");
  }
}

if((visual.dedicatedRepositories||[]).length!==4) fail("dedicated repository coverage drift");
for(const p of visual.dedicatedRepositories||[]){
  if(!p.repository) fail(p.id+" dedicated repository missing");
  if(!p.releaseCommit && p.qualityProfile!=="izakhono-premium-v1") fail(p.id+" lacks release or quality baseline");
}

if(!process.exitCode){
  note("PASS static="+visual.surfaces.length+" apps="+visual.applicationSurfaces.length+" servers="+servers.length+" healthProbes="+matrix.probes.length);
}
