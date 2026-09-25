import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(){
  const out={};
  for(let i=2;i<process.argv.length;i++){
    const k=process.argv[i];
    if(k==="--job") out.job=process.argv[++i];
    else if(k==="--picture") out.picture=process.argv[++i];
    else if(k==="--config") out.config=process.argv[++i];
    else if(k==="--output") out.output=process.argv[++i];
  }
  for(const k of ["job","picture","config","output"]) if(!out[k]) throw new Error("--"+k+" is required");
  return out;
}
function run(cmd,args,{capture=true}={}){
  const r=spawnSync(cmd,args,{encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",maxBuffer:32*1024*1024});
  if(r.error) throw r.error;
  if(r.status!==0) throw new Error(cmd+" failed: "+String(r.stderr||r.stdout||"").slice(-4000));
  return {stdout:r.stdout||"",stderr:r.stderr||""};
}
function probe(path){
  return JSON.parse(run("ffprobe",["-v","error","-show_entries","format=duration:stream=codec_type,codec_name,width,height,sample_rate,channels","-of","json",path]).stdout);
}
function duration(p){return Number(p?.format?.duration||0)}
async function sha(path){return createHash("sha256").update(await readFile(path)).digest("hex")}
function validate(job,config,pictureProbe){
  if(job?.series?.id!==config.seriesId||job?.episode?.slug!==config.episodeSlug) throw new Error("job/config mismatch");
  if(job?.status!=="approved"||job?.publishable!==true) throw new Error("job is not approved");
  if(job?.renderTarget?.id!=="izakhono-local"||job?.renderTarget?.mode!=="owned") throw new Error("job is not bound to IZAKHONO Local Render");
  const gates=["script","language","culturalContext","childSafety","brand","final"];
  const missing=gates.filter(k=>job.review?.[k]!==true);
  if(missing.length) throw new Error("job review gates incomplete: "+missing.join(", "));
  if(!job.productionPack?.qualityBibles?.voice||!job.productionPack?.qualityBibles?.sound||!job.productionPack?.qualityBibles?.animation) throw new Error("quality bibles not bound");
  const video=pictureProbe.streams?.find(s=>s.codec_type==="video");
  if(!video||duration(pictureProbe)<=0) throw new Error("picture has no usable video");
}
function wavHeader(dataBytes,rate=48000,channels=2,bits=16){
  const h=Buffer.alloc(44),block=channels*bits/8,byteRate=rate*block;
  h.write("RIFF",0);h.writeUInt32LE(36+dataBytes,4);h.write("WAVE",8);h.write("fmt ",12);h.writeUInt32LE(16,16);
  h.writeUInt16LE(1,20);h.writeUInt16LE(channels,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(byteRate,28);
  h.writeUInt16LE(block,32);h.writeUInt16LE(bits,34);h.write("data",36);h.writeUInt32LE(dataBytes,40);return h;
}
function noteFreq(n){return 440*Math.pow(2,(n-69)/12)}
function addTone(buf,rate,channels,start,dur,freq,amp,pan=0,pluck=true){
  const s0=Math.max(0,Math.floor(start*rate)),s1=Math.min(buf.length/(2*channels),Math.floor((start+dur)*rate));
  for(let i=s0;i<s1;i++){
    const t=(i-s0)/rate,phase=2*Math.PI*freq*t;
    const env=pluck?Math.min(1,t/.02)*Math.exp(-3.4*t/dur):Math.min(1,t/.04)*Math.min(1,(dur-t)/.08);
    const v=(Math.sin(phase)+.22*Math.sin(phase*2)+.08*Math.sin(phase*3))*amp*env;
    const l=v*(pan<=0?1:1-pan*.45),r=v*(pan>=0?1:1+pan*.45);
    const idx=i*channels*2;
    const curL=buf.readInt16LE(idx),curR=buf.readInt16LE(idx+2);
    buf.writeInt16LE(Math.max(-32768,Math.min(32767,curL+Math.round(l*32767))),idx);
    buf.writeInt16LE(Math.max(-32768,Math.min(32767,curR+Math.round(r*32767))),idx+2);
  }
}
async function writeTheme(path,bpm,dur){
  const rate=48000,channels=2,frames=Math.floor(rate*dur),pcm=Buffer.alloc(frames*channels*2);
  const beat=60/bpm;
  const melody=[60,64,67,69,67,64,62,67,65,69,72,71,69,67,64,62,60,67,64,60];
  for(let i=0;i<melody.length;i++){
    const start=i*beat*.5;
    addTone(pcm,rate,channels,start,beat*.42,noteFreq(melody[i]),.16,(i%4-1.5)/3,true);
  }
  for(let t=0;t<dur;t+=beat){
    addTone(pcm,rate,channels,t,.08,92,.12,0,false);
    addTone(pcm,rate,channels,t+beat*.5,.05,180,.055,.15,false);
  }
  for(let t=0;t<dur;t+=beat*2) addTone(pcm,rate,channels,t,beat*1.7,noteFreq(48+(Math.floor(t/(beat*2))%4)*2),.045,-.25,false);
  await writeFile(path,Buffer.concat([wavHeader(pcm.length,rate,channels),pcm]));
}
function lcg(seed){let x=seed>>>0;return()=>((x=(1664525*x+1013904223)>>>0)/4294967296)*2-1}
async function writeJabu(path,type){
  const rate=48000,channels=1;
  const durations={hello:1.25,question:1.3,proud:.75,happy:1.2,sneeze:1.5,goodbye:1.7};
  const dur=durations[type]||1.1,frames=Math.floor(rate*dur),pcm=Buffer.alloc(frames*2),noise=lcg(type.split("").reduce((n,c)=>n+c.charCodeAt(0),17));
  for(let i=0;i<frames;i++){
    const t=i/rate,p=t/dur;
    let f=type==="question"?145+95*p:type==="proud"?210:type==="happy"?155+35*Math.sin(p*Math.PI):type==="goodbye"?145-35*p:165;
    let v=Math.sin(2*Math.PI*f*t)+.28*Math.sin(2*Math.PI*f*2.03*t);
    if(type==="sneeze"){
      const build=Math.min(1,p/.55),burst=Math.exp(-Math.pow((p-.68)/.09,2));
      f=120+80*build;v=.45*Math.sin(2*Math.PI*f*t)*build+noise()*2.1*burst;
    }
    const env=Math.min(1,t/.04)*Math.min(1,(dur-t)/.12);
    const sample=Math.max(-1,Math.min(1,v*.22*env));
    pcm.writeInt16LE(Math.round(sample*32767),i*2);
  }
  await writeFile(path,Buffer.concat([wavHeader(pcm.length,rate,channels),pcm]));
}
async function main(){
  const a=parseArgs(),job=JSON.parse(await readFile(resolve(a.job),"utf8")),config=JSON.parse(await readFile(resolve(a.config),"utf8"));
  const picture=resolve(a.picture),p=probe(picture);validate(job,config,p);
  const out=resolve(a.output);await mkdir(out,{recursive:true});await mkdir(join(out,"audio"),{recursive:true});await mkdir(join(out,"sfx"),{recursive:true});await mkdir(join(out,"social"),{recursive:true});
  const theme=join(out,"audio","kora-kids-theme-guide.wav");await writeTheme(theme,config.theme.bpm,config.theme.durationSeconds);
  for(const id of config.jabuGuidePalette) await writeJabu(join(out,"sfx","jabu-"+id+".wav"),id);

  const sourceHasAudio=p.streams.some(s=>s.codec_type==="audio"),dur=duration(p);
  const mixed=join(out,"episode-polished-guide.mp4");
  const mixArgs=sourceHasAudio
    ? ["-y","-i",picture,"-stream_loop","-1","-i",theme,"-filter_complex","[0:a]volume=1[a0];[1:a]volume=0.10[theme];[a0][theme]amix=inputs=2:duration=first:dropout_transition=2[a]","-map","0:v:0","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-t",String(dur),"-metadata","comment=KORA KIDS POLISHED GUIDE. Final cast/music/SFX approvals still required.",mixed]
    : ["-y","-i",picture,"-stream_loop","-1","-i",theme,"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","192k","-t",String(dur),"-metadata","comment=KORA KIDS POLISHED GUIDE. Final cast/music/SFX approvals still required.",mixed];
  run("ffmpeg",mixArgs);

  const short=join(out,"social","episode1-short-guide.mp4");
  const shortDur=Math.min(config.short.durationSeconds,dur);
  run("ffmpeg",["-y","-i",mixed,"-t",String(shortDur),"-filter_complex",
    "[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=28[blur];[fg]scale=1000:-2[front];[blur][front]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]",
    "-map","[v]","-map","0:a?","-c:v","libx264","-preset","veryfast","-crf","21","-c:a","aac","-b:a","160k","-movflags","+faststart",
    "-metadata","comment=KORA KIDS 9:16 GUIDE SHORT. Not approved for public release.",short]);

  const thumb=join(out,"social","episode1-thumbnail-guide.jpg");
  run("ffmpeg",["-y","-ss",String(config.thumbnail.sourceSecond),"-i",mixed,"-frames:v","1","-vf","scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2","-q:v","2",thumb]);

  const mixedProbe=probe(mixed),shortProbe=probe(short);
  const outputs={};
  const paths={
    "episode-polished-guide.mp4":mixed,
    "audio/kora-kids-theme-guide.wav":theme,
    "social/episode1-short-guide.mp4":short,
    "social/episode1-thumbnail-guide.jpg":thumb
  };
  for(const id of config.jabuGuidePalette) paths["sfx/jabu-"+id+".wav"]=join(out,"sfx","jabu-"+id+".wav");
  for(const [name,path] of Object.entries(paths)) outputs[name]={bytes:(await stat(path)).size,sha256:await sha(path)};

  const shortVideo=shortProbe.streams.find(s=>s.codec_type==="video");
  const checks={
    sourceApproved:job.status==="approved"&&job.publishable===true,
    ownedRender:job.renderTarget?.id==="izakhono-local",
    qualityBiblesBound:Boolean(job.productionPack?.qualityBibles?.voice&&job.productionPack?.qualityBibles?.sound&&job.productionPack?.qualityBibles?.animation),
    polishedGuideHasVideo:mixedProbe.streams.some(s=>s.codec_type==="video"),
    polishedGuideHasAudio:mixedProbe.streams.some(s=>s.codec_type==="audio"),
    shortIsVertical:shortVideo?.width===1080&&shortVideo?.height===1920,
    themeGuideCreated:outputs["audio/kora-kids-theme-guide.wav"].bytes>1000,
    jabuPaletteComplete:config.jabuGuidePalette.every(id=>outputs["sfx/jabu-"+id+".wav"]?.bytes>500),
    thumbnailCreated:outputs["social/episode1-thumbnail-guide.jpg"].bytes>500
  };
  const qcPass=Object.values(checks).every(Boolean);
  const result={
    schema:"kora-kids.finishing-result/v1",
    createdAt:new Date().toISOString(),
    series:job.series,episode:job.episode,language:job.language,
    qc:{pass:qcPass,checks},
    outputs,
    creativeGuide:{
      originalThemeGuide:true,
      jabuGuidePalette:config.jabuGuidePalette,
      shortAspect:"9:16",
      thumbnailResolution:"1280x720"
    },
    approvals:{
      finalVoice:false,finalJabuSfx:false,finalMusicPerformance:false,humanVisualQc:false,shortFinal:false,thumbnailFinal:false
    },
    broadcastMaster:false,releaseReady:false,published:false,
    note:"Finishing stack complete for guide assets only. Final human performance, sound design, visual QC, mastering and explicit release approval remain required."
  };
  await writeFile(join(out,"finishing-result.json"),JSON.stringify(result,null,2)+"\n");
  if(!qcPass) throw new Error("finishing QC failed");
  console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
