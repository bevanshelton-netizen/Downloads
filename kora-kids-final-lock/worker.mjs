import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

function parseArgs(){
  const out={workspace:join(homedir(),".izakhono","kora-kids-studio")};
  for(let i=2;i<process.argv.length;i++){
    const k=process.argv[i];
    if(k==="--workspace")out.workspace=process.argv[++i];
    else if(k==="--config")out.config=process.argv[++i];
    else if(k==="--finishing-result")out.finishingResult=process.argv[++i];
    else if(k==="--output")out.output=process.argv[++i];
  }
  for(const k of ["config","finishingResult","output"])if(!out[k])throw new Error("--"+k+" is required");
  return out;
}
async function json(path){return JSON.parse(await readFile(path,"utf8"))}
async function sha(path){return createHash("sha256").update(await readFile(path)).digest("hex")}
function allTrue(x){return x&&Object.values(x).length>0&&Object.values(x).every(v=>v===true)}
function need(v,msg){if(!v)throw new Error(msg)}
function isApprovedAsset(a){
  return a?.schema==="kora-kids.audio-asset/v1" &&
    a.approvedForMastering===true &&
    allTrue(a.review);
}
async function loadAssets(root){
  const dir=join(root,"audio-assets");
  await mkdir(dir,{recursive:true});
  const entries=await readdir(dir,{withFileTypes:true}),out=[];
  for(const e of entries){
    if(!e.isDirectory())continue;
    try{
      const m=await json(join(dir,e.name,"manifest.json"));
      if(m?.id===e.name)out.push(m);
    }catch{}
  }
  return out;
}
function assertVoice(a,cfg){
  need(a.type==="voice","voice asset type mismatch");
  need(a.character===cfg.required.voice.character,"voice character mismatch");
  need(a.seriesId===cfg.seriesId&&a.episodeSlug===cfg.episodeSlug&&a.language===cfg.language,"voice scope mismatch");
  need(a.rights?.performerConsentConfirmed===true,"voice performer consent missing");
  if(a.rights?.guardianConsentRequired===true)need(a.rights?.guardianConsentConfirmed===true,"voice guardian consent missing");
  const r=a.rights?.voiceRights||{};
  for(const k of ["recording","distribution","localisation"])need(r[k]===true,"voice rights incomplete: "+k);
}
function assertMusic(a,cfg){
  need(a.type==="music","music asset type mismatch");
  need(a.seriesId===cfg.seriesId&&a.episodeSlug===cfg.episodeSlug&&a.language===cfg.language,"music scope mismatch");
  need(a.rights?.originalityConfirmed===true,"music originality not confirmed");
  const r=a.rights?.musicRights||{};
  for(const k of ["master","composition","distribution","localisation"])need(r[k]===true,"music rights incomplete: "+k);
}
function assertSfx(a,cfg,cue){
  need(a.type==="sfx","sfx asset type mismatch");
  need(a.seriesId===cfg.seriesId&&a.episodeSlug===cfg.episodeSlug&&a.language===cfg.language,"sfx scope mismatch");
  need(a.cueId===cue,"sfx cue mismatch: "+cue);
  need(a.rights?.rightsCleared===true,"sfx rights not cleared: "+cue);
}
async function verifyPrivateAsset(a){
  need(a.privateAssetPath,"private asset path missing: "+a.id);
  const p=resolve(a.privateAssetPath);
  need((await stat(p)).isFile(),"private asset missing: "+a.id);
  const actual=await sha(p);
  need(actual===a.source?.sha256,"asset SHA mismatch: "+a.id);
  return {id:a.id,path:p,sha256:actual,bytes:(await stat(p)).size};
}
async function main(){
  const a=parseArgs(),workspace=resolve(a.workspace),cfg=await json(resolve(a.config)),finishing=await json(resolve(a.finishingResult));
  need(cfg.schema==="kora-kids.final-creative-lock-config/v1","invalid final creative lock config");
  need(finishing.schema==="kora-kids.finishing-result/v1","invalid finishing result");
  need(finishing.series?.id===cfg.seriesId&&finishing.episode?.slug===cfg.episodeSlug&&finishing.language?.code===cfg.language,"finishing scope mismatch");
  need(finishing.qc?.pass===true,"finishing QC did not pass");
  need(finishing.broadcastMaster===false&&finishing.releaseReady===false&&finishing.published===false,"unexpected finishing release state");

  const assets=await loadAssets(workspace);
  const approved=assets.filter(isApprovedAsset);
  const voice=approved.filter(x=>x.type==="voice"&&x.character===cfg.required.voice.character&&x.seriesId===cfg.seriesId&&x.episodeSlug===cfg.episodeSlug&&x.language===cfg.language);
  const music=approved.filter(x=>x.type==="music"&&x.seriesId===cfg.seriesId&&x.episodeSlug===cfg.episodeSlug&&x.language===cfg.language);
  need(voice.length===1,"final creative lock requires exactly one approved Lebo voice asset; found "+voice.length);
  need(music.length===1,"final creative lock requires exactly one approved music asset; found "+music.length);
  assertVoice(voice[0],cfg);assertMusic(music[0],cfg);

  const sfx={};
  for(const cue of cfg.required.sfx.cueIds){
    const matches=approved.filter(x=>x.type==="sfx"&&x.cueId===cue&&x.seriesId===cfg.seriesId&&x.episodeSlug===cfg.episodeSlug&&x.language===cfg.language);
    need(matches.length===1,"final creative lock requires exactly one approved "+cue+" asset; found "+matches.length);
    assertSfx(matches[0],cfg,cue);sfx[cue]=matches[0];
  }

  const voiceFile=await verifyPrivateAsset(voice[0]),musicFile=await verifyPrivateAsset(music[0]),sfxFiles={};
  for(const [cue,m] of Object.entries(sfx))sfxFiles[cue]=await verifyPrivateAsset(m);

  const lock={
    schema:"kora-kids.final-creative-lock/v1",
    createdAt:new Date().toISOString(),
    seriesId:cfg.seriesId,episodeSlug:cfg.episodeSlug,language:cfg.language,
    finishing:{
      qcPass:true,
      sourceResultSha256:await sha(resolve(a.finishingResult)),
      broadcastMaster:false,releaseReady:false
    },
    assets:{
      voice:{
        assetId:voice[0].id,character:voice[0].character,performerDisplayName:voice[0].performerDisplayName,
        path:voiceFile.path,sha256:voiceFile.sha256,bytes:voiceFile.bytes,approved:true
      },
      music:{
        assetId:music[0].id,title:music[0].title,composerDisplayName:music[0].composerDisplayName,
        path:musicFile.path,sha256:musicFile.sha256,bytes:musicFile.bytes,approved:true,originalityConfirmed:true
      },
      sfx:Object.fromEntries(Object.entries(sfxFiles).map(([cue,file])=>[cue,{assetId:sfx[cue].id,path:file.path,sha256:file.sha256,bytes:file.bytes,approved:true}]))
    },
    checks:{
      exactlyOneLeboVoice:true,
      exactlyOneMusicMaster:true,
      allSixJabuCues:true,
      allAssetsApprovedForMastering:true,
      allAssetReviewGatesTrue:true,
      allPrivateAssetHashesMatch:true,
      voiceRightsAndConsent:true,
      musicOriginalityAndRights:true,
      sfxRights:true
    },
    creativeLock:true,
    readyForMastering:true,
    releaseApproved:false,
    published:false,
    note:"Creative lock proves the exact approved assets to use for mastering. It does not authorize public release."
  };
  const out=resolve(a.output);await mkdir(out,{recursive:true});
  await writeFile(join(out,"creative-lock.json"),JSON.stringify(lock,null,2)+"\n");
  await writeFile(join(out,"mastering-inputs.json"),JSON.stringify({
    schema:"kora-kids.mastering-inputs/v1",
    episodeSlug:cfg.episodeSlug,language:cfg.language,
    voicePath:lock.assets.voice.path,
    musicPath:lock.assets.music.path,
    jabuSfx:Object.fromEntries(Object.entries(lock.assets.sfx).map(([k,v])=>[k,v.path])),
    creativeLockPath:join(out,"creative-lock.json")
  },null,2)+"\n");
  console.log(JSON.stringify(lock,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
