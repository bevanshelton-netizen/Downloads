import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT=resolve(process.cwd());
const load=async p=>JSON.parse(await readFile(resolve(ROOT,p),"utf8"));
const exists=async p=>{try{await access(resolve(ROOT,p));return true}catch{return false}};
const fail=(m)=>{console.error("PREMIUM_GATE_FAIL:",m);process.exitCode=2};

const standard=await load("quality/izakhono-premium-standard.json");
const registry=await load("owner-host/platforms.json");

if(standard.profile!=="izakhono-premium-v1") fail("premium profile id mismatch");
if(standard.architecture?.authority!=="izakhono-owned") fail("IZAKHONO must remain authoritative");
if(standard.architecture?.delivery!=="hybrid") fail("hybrid delivery must remain enabled");
if(standard.architecture?.externalMayBecomeSystemOfRecord!==false) fail("external infrastructure must remain non-authoritative");
if(standard.architecture?.liveStatusRequiresIndependentHttpsVerification!==true) fail("independent HTTPS verification must remain mandatory");
if(standard.securityPrivacy?.publicAdminInterfacesAllowed!==false) fail("public admin interfaces are prohibited");
if(standard.media?.finalVideoMinimum!=="1920x1080") fail("premium video baseline must remain 1080p or higher");

const platforms=registry.platforms||[];
if(platforms.length<18) fail("portfolio registry unexpectedly lost platforms");
const ids=new Set();
for(const p of platforms){
  if(!p.id) { fail("platform missing id"); continue; }
  if(ids.has(p.id)) fail("duplicate platform id "+p.id);
  ids.add(p.id);
  if(p.qualityProfile!=="izakhono-premium-v1") fail(p.id+" is not bound to premium-v1");
  if(!p.hostnameEnv) fail(p.id+" has no hostname environment contract");
  if(!p.deploy) fail(p.id+" has no deployment contract");
  else if(!(await exists(p.deploy))) fail(p.id+" deploy target missing: "+p.deploy);
}

const required=["izakhono-flagship","growth-os-v2","creative-suite","kora-network","auto-ai","faisready","ecd360","allegro-vibez","the-chancellor","legacymart","izakhono-pay","izakhono-domains","memory-mania","crowne-hair","izakhono-revenue-desk","kora-kids","kora-gospel-tv","izakhono-one-ai"];
for(const id of required) if(!ids.has(id)) fail("required product missing from owner-host registry: "+id);

// KORA KIDS premium media/product boundary.
const koraRelease=await load("ports/kora-kids/release.json");
const season=await load("ports/kora-kids/season-1.json");
const template=await load("kora-kids-studio/templates/episode-template.json");
if(koraRelease.authority!=="izakhono-owned"||koraRelease.publicStrategy!=="hybrid") fail("KORA KIDS hybrid authority drift");
if(season.episodes?.length!==10) fail("KORA KIDS Season 1 must contain 10 episodes");
for(const gate of ["script","language","culturalContext","childSafety","brand","final"]) if(!(gate in (template.review||{}))) fail("KORA KIDS missing review gate "+gate);
for(const p of [
  "kora-kids-studio/bibles/tumi-tala-voice-bible.json",
  "kora-kids-studio/bibles/tumi-tala-animation-bible.json",
  "kora-kids-studio/bibles/kora-kids-sound-bible.json",
  "kora-kids-render-worker/worker.mjs"
]) if(!(await exists(p))) fail("KORA KIDS premium production asset missing: "+p);

if(!process.exitCode) console.log("IZAKHONO_PREMIUM_PRODUCT_GATE=PASS platforms="+platforms.length);
