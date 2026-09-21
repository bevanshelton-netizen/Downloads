import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

function parseArgs(){
  const out={};
  for(let i=2;i<process.argv.length;i++){
    const k=process.argv[i];
    if(k==="--job")out.job=process.argv[++i];
    else if(k==="--animatic")out.animatic=process.argv[++i];
    else if(k==="--voice")out.voice=process.argv[++i];
    else if(k==="--music")out.music=process.argv[++i];
    else if(k==="--approval")out.approval=process.argv[++i];
    else if(k==="--captions")out.captions=process.argv[++i];
    else if(k==="--output")out.output=process.argv[++i];
  }
  for(const k of ["job","animatic","voice","music","approval","output"])if(!out[k])throw new Error("--"+k+" is required");
  return out;
}
function run(cmd,args,{capture=true}={}){
  const r=spawnSync(cmd,args,{encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",maxBuffer:16*1024*1024});
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error(cmd+" failed: "+String(r.stderr||r.stdout||"").slice(-3000));
  return {stdout:r.stdout||"",stderr:r.stderr||""};
}
function ffprobeJson(path){
  return JSON.parse(run("ffprobe",["-v","error","-show_entries","format=duration:stream=index,codec_type,codec_name,sample_rate,channels,width,height","-of","json",path]).stdout);
}
function duration(probe){return Number(probe?.format?.duration||0)}
function commandExists(cmd){const a=(cmd==="ffmpeg"||cmd==="ffprobe")?["-version"]:["--version"];const r=spawnSync(cmd,a,{stdio:"ignore"});return r.status===0}
async function sha(path){return createHash("sha256").update(await readFile(path)).digest("hex")}
function assertApproval(a,job){
  if(a?.schema!=="kora-kids.mastering-approval/v1")throw new Error("invalid mastering approval schema");
  if(a.seriesId!==job.series?.id||a.episodeSlug!==job.episode?.slug||a.language!==job.language?.code)throw new Error("mastering approval does not match job");
  const required=[
    ["voice",a.voice?.approved===true&&a.voice?.rightsCleared===true&&a.voice?.reviewer],
    ["music",a.music?.approved===true&&a.music?.originalityConfirmed===true&&a.music?.rightsCleared===true&&a.music?.reviewer],
    ["factLock",a.factLock?.approved===true&&a.factLock?.reviewer],
    ["culturalContext",a.culturalContext?.approved===true&&a.culturalContext?.reviewer],
    ["captionLock",a.captionLock?.approved===true&&a.captionLock?.reviewer],
    ["visualQc",a.visualQc?.approved===true&&a.visualQc?.reviewer]
  ];
  const missing=required.filter(([,v])=>!v).map(([k])=>k);
  if(missing.length)throw new Error("mastering locks incomplete: "+missing.join(", "));
}
function parseLoudnorm(stderr){
  const blocks=[...stderr.matchAll(/\{[\s\S]*?"input_i"[\s\S]*?"target_offset"[\s\S]*?\}/g)];
  if(!blocks.length)throw new Error("loudness report missing");
  return JSON.parse(blocks[blocks.length-1][0]);
}
function analyzeLoudness(path){
  const r=run("ffmpeg",["-hide_banner","-nostats","-i",path,"-af","loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json","-f","null","-"]);
  return parseLoudnorm(r.stderr);
}
async function main(){
  const a=parseArgs();
  if(!commandExists("ffmpeg")||!commandExists("ffprobe"))throw new Error("ffmpeg and ffprobe are required");
  const job=JSON.parse(await readFile(resolve(a.job),"utf8"));
  const approval=JSON.parse(await readFile(resolve(a.approval),"utf8"));
  if(job.series?.id!=="lebo-jabu")throw new Error("mastering lane currently supports lebo-jabu");
  if(job.status!=="approved"||job.publishable!==true)throw new Error("job is not approved for guide render");
  if(job.renderTarget?.id!=="izakhono-local"||job.renderTarget?.mode!=="owned")throw new Error("job is not owned-render bound");
  assertApproval(approval,job);

  const anim=resolve(a.animatic),voice=resolve(a.voice),music=resolve(a.music),out=resolve(a.output);
  await mkdir(out,{recursive:true});
  const animProbe=ffprobeJson(anim),voiceProbe=ffprobeJson(voice),musicProbe=ffprobeJson(music);
  const animDur=duration(animProbe),voiceDur=duration(voiceProbe),musicDur=duration(musicProbe);
  if(!(animDur>0&&voiceDur>0&&musicDur>0))throw new Error("invalid media duration");
  if(voiceDur>animDur+1)throw new Error("voice master exceeds picture duration");

  const candidate=join(out,"master-candidate.mp4");
  const args=[
    "-y","-i",anim,"-i",voice,"-stream_loop","-1","-i",music,
    "-filter_complex",
    "[1:a]loudnorm=I=-18:TP=-2:LRA=7,apad[voice];[2:a]volume=0.16[music];[voice][music]amix=inputs=2:duration=longest:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=11[a]",
    "-map","0:v:0","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-t",String(animDur),
    "-metadata","title="+String(job.series.title)+" — "+String(job.episode.title),
    "-metadata","comment=KORA KIDS MASTER CANDIDATE. Explicit release approval still required.",
    candidate
  ];
  run("ffmpeg",args);
  const candProbe=ffprobeJson(candidate);
  const loud=analyzeLoudness(candidate);
  const measuredI=Number(loud.input_i),measuredTP=Number(loud.input_tp);
  const technical={
    pictureDurationSeconds:animDur,
    voiceDurationSeconds:voiceDur,
    musicDurationSeconds:musicDur,
    candidateDurationSeconds:duration(candProbe),
    integratedLufs:measuredI,
    truePeakDbtp:measuredTP,
    durationMatch:Math.abs(duration(candProbe)-animDur)<=.15,
    loudnessAcceptable:Number.isFinite(measuredI)&&measuredI>=-18.5&&measuredI<=-13.5,
    truePeakAcceptable:Number.isFinite(measuredTP)&&measuredTP<=-1.0,
    h264Video:candProbe.streams?.some(s=>s.codec_type==="video"&&s.codec_name==="h264")===true,
    aacAudio:candProbe.streams?.some(s=>s.codec_type==="audio"&&s.codec_name==="aac")===true
  };
  technical.pass=Object.entries(technical).filter(([k])=>!k.endsWith("Seconds")&&!["integratedLufs","truePeakDbtp"].includes(k)).every(([,v])=>v===true);

  const captions=a.captions?resolve(a.captions):null;
  if(captions){const txt=await readFile(captions,"utf8");if(!txt.startsWith("WEBVTT"))throw new Error("captions are not WebVTT")}

  const files={};
  for(const [name,path] of [["master-candidate.mp4",candidate],...(captions?[["captions.vtt",captions]]:[])]){
    files[name]={bytes:(await stat(path)).size,sha256:await sha(path)};
  }
  const result={
    schema:"kora-kids.mastering-result/v1",
    createdAt:new Date().toISOString(),
    series:job.series,episode:job.episode,language:job.language,
    approvalLocks:{
      voice:true,music:true,factLock:true,culturalContext:true,captionLock:true,visualQc:true,
      release:approval.release?.approved===true
    },
    technical,
    masterCandidate:technical.pass===true,
    broadcastMaster:false,
    releaseApprovalRequired:approval.release?.approved!==true,
    note:"This lane creates a technically QC'd master candidate. It never self-authorizes public release.",
    files
  };
  await writeFile(join(out,"mastering-result.json"),JSON.stringify(result,null,2)+"\n");
  if(!technical.pass)throw new Error("technical mastering QC failed");
  console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
