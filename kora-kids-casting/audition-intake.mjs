import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { resolve, join, extname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

function parseArgs(){
  const o={workspace:join(homedir(),".izakhono","kora-kids-studio")};
  for(let i=2;i<process.argv.length;i++){
    const k=process.argv[i];
    if(k==="--metadata")o.metadata=process.argv[++i];
    else if(k==="--workspace")o.workspace=process.argv[++i];
  }
  if(!o.metadata)throw new Error("--metadata is required");
  return o;
}
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]});if(r.error)throw r.error;if(r.status!==0)throw new Error(cmd+" failed: "+String(r.stderr||"").slice(-2000));return r.stdout}
function probe(path){return JSON.parse(run("ffprobe",["-v","error","-show_entries","format=duration:stream=codec_type,codec_name,sample_rate,channels","-of","json",path]))}
async function sha(path){return createHash("sha256").update(await readFile(path)).digest("hex")}
function need(v,msg){if(!v)throw new Error(msg)}
async function main(){
 const a=parseArgs(),m=JSON.parse(await readFile(resolve(a.metadata),"utf8"));
 need(m?.schema==="kora-kids.audition-submission/v1","invalid audition metadata");
 need(m.role==="Lebo","only Lebo auditions are supported");
 need(m.seriesId==="lebo-jabu"&&m.episodeSlug==="jam-day-under-the-baobab","audition scope mismatch");
 need(typeof m.performerDisplayName==="string"&&m.performerDisplayName.trim(),"performer display name required");
 need(m.performerConsentConfirmed===true,"performer consent not confirmed");
 if(m.guardianConsentRequired===true)need(m.guardianConsentConfirmed===true,"guardian consent not confirmed");
 const sides=["A","B","C","D","E","F"];
 need(m.files&&sides.every(x=>m.files[x]),"all six audition sides are required");
 const id=randomUUID(),root=join(resolve(a.workspace),"casting","lebo",id);await mkdir(root,{recursive:true});
 const files={};
 for(const side of sides){
   const src=resolve(m.files[side]),p=probe(src),audio=p.streams?.find(x=>x.codec_type==="audio");
   need(audio,"audition file has no audio: "+side);
   const sr=Number(audio.sample_rate||0),channels=Number(audio.channels||0),dur=Number(p.format?.duration||0);
   need(sr>=44100,"sample rate too low: "+side);need(channels===1||channels===2,"unsupported channel count: "+side);need(dur>0&&dur<45,"unexpected audition duration: "+side);
   const ext=extname(src).toLowerCase()||".wav",dst=join(root,"side-"+side+ext);await copyFile(src,dst);
   files[side]={privatePath:dst,sha256:await sha(dst),bytes:(await stat(dst)).size,codec:audio.codec_name,sampleRate:sr,channels,durationSeconds:dur,originalName:basename(src)};
 }
 const manifest={
   schema:"kora-kids.audition/v1",id,createdAt:new Date().toISOString(),seriesId:m.seriesId,episodeSlug:m.episodeSlug,role:"Lebo",
   performerDisplayName:m.performerDisplayName.trim(),language:m.language||"en-ZA",
   consent:{performer:true,guardianRequired:m.guardianConsentRequired===true,guardianConfirmed:m.guardianConsentConfirmed===true},
   rightsReadiness:{recordingEvaluation:m.recordingEvaluationRights===true,productionRightsContracted:m.productionRightsContracted===true},
   files,
   review:{naturalPerformance:false,diction:false,emotionalRange:false,comicTiming:false,southAfricanRhythm:false,childFriendly:false,technical:false,rightsReady:false},
   score:null,selected:false,selectedAt:null
 };
 await writeFile(join(root,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
 const safe={...manifest,files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,{sha256:v.sha256,bytes:v.bytes,codec:v.codec,sampleRate:v.sampleRate,channels:v.channels,durationSeconds:v.durationSeconds}]))};
 console.log(JSON.stringify(safe,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
