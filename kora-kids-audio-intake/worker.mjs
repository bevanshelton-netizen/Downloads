import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { resolve, join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

function parseArgs(){
  const out={workspace:join(homedir(),".izakhono","kora-kids-studio")};
  for(let i=2;i<process.argv.length;i++){
    const k=process.argv[i];
    if(k==="--type") out.type=process.argv[++i];
    else if(k==="--input") out.input=process.argv[++i];
    else if(k==="--metadata") out.metadata=process.argv[++i];
    else if(k==="--workspace") out.workspace=process.argv[++i];
  }
  for(const k of ["type","input","metadata"]) if(!out[k]) throw new Error("--"+k+" is required");
  if(!["voice","music","sfx"].includes(out.type)) throw new Error("--type must be voice, music or sfx");
  return out;
}
function run(cmd,args){
  const r=spawnSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:8*1024*1024});
  if(r.error) throw r.error;
  if(r.status!==0) throw new Error(cmd+" failed: "+String(r.stderr||r.stdout||"").slice(-2500));
  return r.stdout;
}
function probe(path){
  return JSON.parse(run("ffprobe",["-v","error","-show_entries","format=duration:stream=codec_type,codec_name,sample_rate,channels","-of","json",path]));
}
async function sha(path){return createHash("sha256").update(await readFile(path)).digest("hex")}
function requireText(v,name){if(typeof v!=="string"||!v.trim())throw new Error("metadata missing "+name);return v.trim()}
function validateMetadata(type,m){
  if(m?.schema!=="kora-kids.audio-intake/v1") throw new Error("invalid metadata schema");
  if(m.type!==type) throw new Error("metadata type mismatch");
  requireText(m.seriesId,"seriesId");requireText(m.episodeSlug,"episodeSlug");requireText(m.language,"language");
  if(type==="voice"){
    requireText(m.character,"character");
    requireText(m.performerDisplayName,"performerDisplayName");
    if(m.guardianConsentRequired===true && m.guardianConsentConfirmed!==true) throw new Error("guardian consent not confirmed");
    if(m.performerConsentConfirmed!==true) throw new Error("performer consent not confirmed");
    if(m.voiceRights?.recording!==true||m.voiceRights?.distribution!==true||m.voiceRights?.localisation!==true) throw new Error("voice rights incomplete");
    if(!Array.isArray(m.voiceRights?.territories)||m.voiceRights.territories.length<1) throw new Error("voice territories missing");
  }
  if(type==="music"){
    requireText(m.title,"title");requireText(m.composerDisplayName,"composerDisplayName");
    if(m.originalityConfirmed!==true) throw new Error("music originality not confirmed");
    if(m.musicRights?.master!==true||m.musicRights?.composition!==true||m.musicRights?.distribution!==true||m.musicRights?.localisation!==true) throw new Error("music rights incomplete");
  }
  if(type==="sfx"){
    requireText(m.cueId,"cueId");
    if(m.rightsCleared!==true) throw new Error("sfx rights not cleared");
  }
}
async function main(){
  const a=parseArgs(),input=resolve(a.input),metadata=JSON.parse(await readFile(resolve(a.metadata),"utf8"));
  validateMetadata(a.type,metadata);
  const p=probe(input),audio=p.streams?.find(s=>s.codec_type==="audio");
  if(!audio) throw new Error("input has no audio stream");
  const duration=Number(p.format?.duration||0);
  if(!(duration>0)) throw new Error("invalid audio duration");
  const sampleRate=Number(audio.sample_rate||0);
  if(sampleRate<22050) throw new Error("sample rate too low");
  const id=randomUUID(),workspace=resolve(a.workspace),root=join(workspace,"audio-assets",id);
  await mkdir(root,{recursive:true});
  const ext=extname(input).toLowerCase()||".bin",assetPath=join(root,"asset"+ext);
  await copyFile(input,assetPath);
  const manifest={
    schema:"kora-kids.audio-asset/v1",
    id,type:a.type,createdAt:new Date().toISOString(),
    seriesId:metadata.seriesId,episodeSlug:metadata.episodeSlug,language:metadata.language,
    character:metadata.character||null,cueId:metadata.cueId||null,title:metadata.title||null,
    performerDisplayName:metadata.performerDisplayName||null,composerDisplayName:metadata.composerDisplayName||null,
    rights:{
      performerConsentConfirmed:metadata.performerConsentConfirmed===true,
      guardianConsentRequired:metadata.guardianConsentRequired===true,
      guardianConsentConfirmed:metadata.guardianConsentConfirmed===true,
      voiceRights:metadata.voiceRights||null,
      originalityConfirmed:metadata.originalityConfirmed===true,
      musicRights:metadata.musicRights||null,
      rightsCleared:metadata.rightsCleared===true
    },
    technical:{codec:audio.codec_name,sampleRate,channels:Number(audio.channels||0),durationSeconds:duration},
    source:{originalName:metadata.originalName||null,sha256:await sha(input),bytes:(await stat(input)).size},
    privateAssetPath:assetPath,
    approvedForMastering:false,
    review:{performance:false,technical:false,rights:true,final:false}
  };
  await writeFile(join(root,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  console.log(JSON.stringify(manifest,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
