import { readFile, writeFile, mkdir, copyFile, stat, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join, basename } from "node:path";

function args(){
 const o={};
 for(let i=2;i<process.argv.length;i++){
  const k=process.argv[i];
  if(k==="--master")o.master=process.argv[++i];
  else if(k==="--mastering-result")o.masteringResult=process.argv[++i];
  else if(k==="--approval")o.approval=process.argv[++i];
  else if(k==="--captions")o.captions=process.argv[++i];
  else if(k==="--localisations")o.localisations=process.argv[++i];
  else if(k==="--output")o.output=process.argv[++i];
 }
 for(const k of ["master","masteringResult","approval","output"])if(!o[k])throw new Error("--"+k+" is required");
 return o;
}
async function sha(path){return createHash("sha256").update(await readFile(path)).digest("hex")}
async function json(path){return JSON.parse(await readFile(path,"utf8"))}
function need(v,msg){if(!v)throw new Error(msg)}
function clean(x){return String(x||"").replace(/[\r\n]+/g," ").trim()}
function validate(mastering,approval,masterSha){
 need(mastering?.schema==="kora-kids.mastering-result/v1","invalid mastering result schema");
 need(mastering.masterCandidate===true,"mastering result is not a master candidate");
 need(mastering.technical?.pass===true,"master candidate technical QC did not pass");
 need(mastering.broadcastMaster===false,"unexpected pre-authorized broadcast master");
 need(approval?.schema==="kora-kids.release-approval/v1","invalid release approval schema");
 need(approval.seriesId===mastering.series?.id,"series mismatch");
 need(approval.episodeSlug===mastering.episode?.slug,"episode mismatch");
 need(approval.language===mastering.language?.code,"language mismatch");
 need(approval.masterSha256===masterSha,"release approval does not match master SHA-256");
 need(approval.masterCandidateApproved===true,"master candidate not approved");
 need(approval.release?.approved===true,"explicit release approval missing");
 need(clean(approval.release?.reviewer),"release reviewer missing");
 need(clean(approval.release?.approvedAt),"release approval timestamp missing");
 for(const k of ["voice","music","visuals","captions"])need(approval.rights?.[k]===true,"rights incomplete: "+k);
 need(Array.isArray(approval.rights?.territories)&&approval.rights.territories.length>0,"release territories missing");
 for(const k of ["factLock","culturalContext","language","brand"])need(approval.editorial?.[k]===true,"editorial lock incomplete: "+k);
 need(approval.childSafety?.madeForKids===true,"made-for-kids flag required");
 need(approval.childSafety?.personalisedAds===false,"personalised ads must be disabled");
 need(approval.childSafety?.childCommerce===false,"child-commerce CTA must be disabled");
 need(approval.childSafety?.behaviouralTracking===false,"behavioural tracking must be disabled");
 need(approval.childSafety?.externalLinksInChildCreative===false,"external links in child creative must be disabled");
}
async function loadLocalisations(dir){
 if(!dir)return [];
 const root=resolve(dir),names=await readdir(root);
 const out=[];
 for(const name of names.filter(x=>x.endsWith(".json"))){
  try{
   const p=await json(join(root,name));
   if(p?.schema!=="kora-kids.release-language/v1")continue;
   if(p.approvedForRelease!==true)continue;
   if(!p.language||!p.audioPath||!p.captionsPath)continue;
   out.push(p);
  }catch{}
 }
 return out;
}
async function main(){
 const a=args(),master=resolve(a.master),mastering=await json(resolve(a.masteringResult)),approval=await json(resolve(a.approval)),out=resolve(a.output);
 const masterSha=await sha(master);validate(mastering,approval,masterSha);
 await mkdir(join(out,"media"),{recursive:true});await mkdir(join(out,"captions"),{recursive:true});await mkdir(join(out,"metadata"),{recursive:true});await mkdir(join(out,"languages"),{recursive:true});
 const masterOut=join(out,"media","episode-master.mp4");await copyFile(master,masterOut);
 if(a.captions){
  const cap=resolve(a.captions),txt=await readFile(cap,"utf8");need(txt.startsWith("WEBVTT"),"captions are not WebVTT");
  await copyFile(cap,join(out,"captions",approval.language+".vtt"));
 }
 const languageAssets=await loadLocalisations(a.localisations);
 for(const lang of languageAssets){
  const ldir=join(out,"languages",lang.language);await mkdir(ldir,{recursive:true});
  await copyFile(resolve(lang.audioPath),join(ldir,"audio"+(lang.audioExtension||".wav")));
  await copyFile(resolve(lang.captionsPath),join(ldir,"captions.vtt"));
  await writeFile(join(ldir,"metadata.json"),JSON.stringify({language:lang.language,title:lang.title,description:lang.description,reviewedBy:lang.reviewedBy},null,2)+"\n");
 }
 const title="Lebo & Jabu — Jam Day Under the Baobab";
 const description="Lebo and Jabu turn a berry-jam mix-up into a funny adventure about curiosity, teamwork and discovering Africa. KORA KIDS — Africa's Stories for the World's Children.";
 const common={
  series:"Lebo & Jabu",episodeNumber:1,episodeSlug:approval.episodeSlug,title,description,
  audience:{madeForKids:true,ageRange:"3-7"},
  safety:{personalisedAds:false,behaviouralTracking:false,childCommerce:false,externalLinksInChildCreative:false},
  primaryLanguage:approval.language,territories:approval.rights.territories
 };
 const kora={schema:"kora-kids.kora-release/v1",...common,network:"KORA KIDS",route:"/kids/lebo-jabu",tracking:false,directPurchase:false,childAccountRequired:false};
 const youtube={schema:"kora-kids.youtube-export/v1",...common,category:"Education",madeForKids:true,monetisation:{personalisedAds:false},comments:"platform-policy-for-made-for-kids",uploadAction:"not-executed",multiLanguageTracks:languageAssets.map(x=>x.language)};
 const shorts={schema:"kora-kids.shorts-export/v1",...common,format:"9:16",sourceRequired:"approved-short-master",uploadAction:"not-executed",cta:"watch-more-on-kora-kids-parent-facing-only"};
 await writeFile(join(out,"metadata","kora.json"),JSON.stringify(kora,null,2)+"\n");
 await writeFile(join(out,"metadata","youtube.json"),JSON.stringify(youtube,null,2)+"\n");
 await writeFile(join(out,"metadata","shorts.json"),JSON.stringify(shorts,null,2)+"\n");
 const files={};
 async function add(path,key){files[key]={bytes:(await stat(path)).size,sha256:await sha(path)}}
 await add(masterOut,"media/episode-master.mp4");
 if(a.captions)await add(join(out,"captions",approval.language+".vtt"),"captions/"+approval.language+".vtt");
 for(const name of ["kora.json","youtube.json","shorts.json"])await add(join(out,"metadata",name),"metadata/"+name);
 const result={
  schema:"kora-kids.release-package/v1",createdAt:new Date().toISOString(),series:mastering.series,episode:mastering.episode,
  primaryLanguage:approval.language,releaseApproved:true,packagedForDistribution:true,published:false,
  childSafety:approval.childSafety,territories:approval.rights.territories,
  targets:[{id:"kora",ready:true,published:false},{id:"youtube",ready:true,published:false},{id:"shorts",ready:false,reason:"approved 9:16 short master required"}],
  approvedLanguageTracks:languageAssets.map(x=>x.language),files,
  note:"Packaging does not publish. A platform uploader/owner action must consume this bundle separately."
 };
 await writeFile(join(out,"release-package.json"),JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
