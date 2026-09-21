import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

function args(){
  const out={mode:"proof"};
  for(let i=2;i<process.argv.length;i++){
    const k=process.argv[i];
    if(k==="--input") out.input=process.argv[++i];
    else if(k==="--output") out.output=process.argv[++i];
    else if(k==="--mode") out.mode=process.argv[++i];
  }
  if(!out.input) throw new Error("--input is required");
  if(!out.output) throw new Error("--output is required");
  if(!["proof","production"].includes(out.mode)) throw new Error("--mode must be proof or production");
  return out;
}
function safeText(x){return String(x||"").replace(/[\r\n]+/g," ").trim()}
function validate(job){
  if(job?.series?.id!=="lebo-jabu") throw new Error("render worker currently accepts only lebo-jabu jobs");
  if(job?.renderTarget?.id!=="izakhono-local"||job?.renderTarget?.mode!=="owned") throw new Error("job is not bound to IZAKHONO Local Render");
  if(job?.status!=="approved"||job?.publishable!==true) throw new Error("job is not approved/publishable");
  const review=job.review||{};
  const required=["script","language","culturalContext","childSafety","brand","final"];
  const missing=required.filter(k=>review[k]!==true);
  if(missing.length) throw new Error("review gates incomplete: "+missing.join(", "));
  if(!Array.isArray(job.scenes)||!job.scenes.length) throw new Error("job has no scenes");
  if(!job.language?.code) throw new Error("job has no language");
}
function commandExists(cmd){
  const versionArg=(cmd==="ffmpeg"||cmd==="ffprobe")?"-version":"--version";
  const r=spawnSync(cmd,[versionArg],{stdio:"ignore"});
  return r.status===0;
}
function ffmpegRun(argv, opts={}){
  return new Promise((ok,fail)=>{
    const p=spawn("ffmpeg",argv,{stdio:opts.stdio||["ignore","ignore","pipe"]});
    let err="";
    if(p.stderr) p.stderr.on("data",d=>err+=d.toString());
    p.on("error",fail);
    p.on("close",code=>code===0?ok():fail(new Error("ffmpeg failed: "+err.slice(-2000))));
    if(opts.onProcess) opts.onProcess(p);
  });
}
function setPixel(buf,w,h,x,y,r,g,b){
  x=x|0;y=y|0;if(x<0||y<0||x>=w||y>=h)return;
  const i=(y*w+x)*3;buf[i]=r;buf[i+1]=g;buf[i+2]=b;
}
function rect(buf,w,h,x,y,rw,rh,c){
  const x0=Math.max(0,x|0),x1=Math.min(w,(x+rw)|0),y0=Math.max(0,y|0),y1=Math.min(h,(y+rh)|0);
  for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)setPixel(buf,w,h,xx,yy,...c);
}
function ellipse(buf,w,h,cx,cy,rx,ry,c){
  const x0=Math.max(0,(cx-rx)|0),x1=Math.min(w,(cx+rx)|0),y0=Math.max(0,(cy-ry)|0),y1=Math.min(h,(cy+ry)|0);
  const rrX=rx*rx,rrY=ry*ry;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(((x-cx)*(x-cx))/rrX+((y-cy)*(y-cy))/rrY<=1)setPixel(buf,w,h,x,y,...c);
}
function circle(buf,w,h,cx,cy,r,c){ellipse(buf,w,h,cx,cy,r,r,c)}
function drawLebo(buf,w,h,x,y,s,bob,mouthOpen=false){
  const skin=[135,84,60],hair=[36,27,33],yellow=[255,207,63],red=[236,75,65],ink=[23,52,83],white=[255,255,255];
  y+=bob;
  ellipse(buf,w,h,x,y+68*s,34*s,38*s,skin);
  circle(buf,w,h,x-27*s,y+36*s,21*s,hair);circle(buf,w,h,x+27*s,y+36*s,21*s,hair);
  circle(buf,w,h,x-12*s,y+64*s,4*s,ink);circle(buf,w,h,x+12*s,y+64*s,4*s,ink);
  rect(buf,w,h,x-30*s,y+105*s,60*s,78*s,yellow);
  circle(buf,w,h,x,y+144*s,15*s,[255,155,37]);
  rect(buf,w,h,x-22*s,y+181*s,17*s,55*s,skin);rect(buf,w,h,x+6*s,y+181*s,17*s,55*s,skin);
  rect(buf,w,h,x-28*s,y+229*s,28*s,14*s,red);rect(buf,w,h,x+4*s,y+229*s,28*s,14*s,red);
  circle(buf,w,h,x-13*s,y+86*s,3*s,white);circle(buf,w,h,x+13*s,y+86*s,3*s,white);
  if(mouthOpen) ellipse(buf,w,h,x,y+93*s,8*s,5*s,[111,46,52]); else rect(buf,w,h,x-7*s,y+92*s,14*s,2*s,[111,46,52]);
}
function drawJabu(buf,w,h,x,y,s,bob){
  const body=[185,192,198],ear=[210,215,219],leg=[160,169,176],ink=[23,52,83];
  y+=bob;
  ellipse(buf,w,h,x,y+145*s,72*s,55*s,body);
  ellipse(buf,w,h,x+52*s,y+82*s,49*s,45*s,body);
  ellipse(buf,w,h,x+19*s,y+86*s,36*s,42*s,ear);
  circle(buf,w,h,x+37*s,y+78*s,4*s,ink);circle(buf,w,h,x+64*s,y+78*s,4*s,ink);
  rect(buf,w,h,x-43*s,y+180*s,23*s,58*s,leg);rect(buf,w,h,x+20*s,y+180*s,23*s,58*s,leg);
  rect(buf,w,h,x+84*s,y+93*s,16*s,68*s,body);
  ellipse(buf,w,h,x+90*s,y+160*s,12*s,18*s,body);
}
function frame(width,height,t,sceneIndex,sceneT,leboMouthOpen=false){
  const buf=Buffer.alloc(width*height*3);
  rect(buf,width,height,0,0,width,height,[116,220,255]);
  const horizon=Math.floor(height*.63);
  rect(buf,width,height,0,horizon,width,height-horizon,[104,198,105]);
  circle(buf,width,height,width*.84,height*.18,28,[255,201,62]);
  // baobab
  rect(buf,width,height,width*.11,horizon-118,30,126,[125,89,61]);
  ellipse(buf,width,height,width*.13,horizon-122,86,43,[61,159,87]);
  // distant sand/path
  ellipse(buf,width,height,width*.55,horizon+55,width*.45,42,[232,189,108]);
  const wave=Math.sin(t*3.2);
  let leboX=width*.37, jabuX=width*.61;
  if(sceneIndex===1){leboX+=sceneT*18;jabuX+=sceneT*10}
  if(sceneIndex===2){leboX+=Math.sin(t*7)*12;jabuX+=Math.sin(t*5)*16}
  if(sceneIndex===3){leboX-=sceneT*10;jabuX+=sceneT*8}
  if(sceneIndex===4){leboX=width*.42;jabuX=width*.64}
  drawLebo(buf,width,height,leboX,horizon-183,.72,wave*4,leboMouthOpen);
  drawJabu(buf,width,height,jabuX,horizon-178,.75,-wave*3);
  // berry/jam accents
  if(sceneIndex>=1&&sceneIndex<=3){
    for(let i=0;i<9;i++)circle(buf,width,height,width*.47+(i%3)*14-14,horizon+7+Math.floor(i/3)*10,4,[111,54,124]);
  }
  return buf;
}
function sceneSchedule(job,total){
  const src=job.scenes.map(s=>Math.max(1,Number(s.durationSeconds)||1));
  const sum=src.reduce((a,b)=>a+b,0);
  let cursor=0;
  return job.scenes.map((s,i)=>{
    const dur=total*(src[i]/sum);const out={...s,start:cursor,end:cursor+dur,duration:dur,index:i};cursor+=dur;return out;
  });
}
function vttTime(sec){
  const ms=Math.max(0,Math.round(sec*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),r=ms%1000;
  return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")+"."+String(r).padStart(3,"0");
}
function dialogueSchedule(schedule,language){
  const cues=[];
  for(const scene of schedule){
    const lines=Array.isArray(scene.dialogue)&&scene.dialogue.length?scene.dialogue:[{speaker:"Narrator",text:scene.action,emotion:"guide"}];
    const usable=Math.max(.5,scene.duration*.78),pad=scene.duration*.11;
    const weights=lines.map(l=>Math.max(3,safeText(l.text).split(/\s+/).filter(Boolean).length));
    const sum=weights.reduce((a,b)=>a+b,0);
    let cursor=scene.start+pad;
    lines.forEach((line,i)=>{
      const dur=usable*(weights[i]/sum);
      cues.push({
        sceneId:scene.id,line:i+1,speaker:safeText(line.speaker)||"Narrator",text:safeText(line.text),
        emotion:safeText(line.emotion),performance:safeText(line.performance),factReviewRequired:line.factReviewRequired===true,
        startSeconds:+cursor.toFixed(3),endSeconds:+Math.min(scene.end-pad,cursor+dur).toFixed(3),
        language,finalVoiceApproved:false
      });
      cursor+=dur;
    });
  }
  return cues;
}
function makeVtt(cues){
  return "WEBVTT\n\n"+cues.map((c,i)=>`${i+1}\n${vttTime(c.startSeconds)} --> ${vttTime(c.endSeconds)}\n${c.speaker}: ${c.text}\n`).join("\n");
}
function lipSyncFromDialogue(cues){
  const mouth=[];
  for(const cue of cues){
    if(cue.speaker!=="Lebo") continue;
    const words=cue.text.split(/\s+/).filter(Boolean);
    const dur=Math.max(.1,cue.endSeconds-cue.startSeconds);
    words.forEach((word,i)=>{
      const a=cue.startSeconds+dur*(i/Math.max(1,words.length));
      const b=cue.startSeconds+dur*((i+.72)/Math.max(1,words.length));
      const end=Math.max(a+.002,Math.min(cue.endSeconds,b));
      mouth.push({speaker:"Lebo",sceneId:cue.sceneId,word,shape:"open",startSeconds:+a.toFixed(4),endSeconds:+end.toFixed(4)});
    });
  }
  return mouth;
}
function makeMixPlan(schedule,dialogue){
  return {
    schema:"kora-kids.mix-plan/v1",
    dialogueBus:{target:"final-reviewed-voice",guideOnly:true},
    musicBus:{originalMusicRequired:true,targetIntegratedLufs:-16,duckUnderDialogueDb:-7},
    sfxBus:{targetPeakDbfs:-3},
    scenes:schedule.map(s=>({sceneId:s.id,startSeconds:+s.start.toFixed(3),endSeconds:+s.end.toFixed(3),musicCue:s.musicCue||null,sfx:Array.isArray(s.sfx)?s.sfx:[]})),
    dialogueCues:dialogue.map(c=>({sceneId:c.sceneId,speaker:c.speaker,startSeconds:c.startSeconds,endSeconds:c.endSeconds}))
  };
}
function qcReport(job,schedule,dialogue,total,mode){
  const shotTiming=schedule.map(s=>{
    const shotSum=(Array.isArray(s.shots)?s.shots:[]).reduce((n,x)=>n+(Number(x.seconds)||0),0);
    return {sceneId:s.id,sceneSeconds:+s.duration.toFixed(3),shotSeconds:shotSum,withinTolerance:!s.shots||Math.abs(shotSum-(Number(s.durationSeconds)||0))<=1};
  });
  const checks={
    approvedJob:job.status==="approved"&&job.publishable===true,
    ownedRender:job.renderTarget?.id==="izakhono-local"&&job.renderTarget?.mode==="owned",
    dialoguePresent:dialogue.length>0&&dialogue.every(x=>x.speaker&&x.text),
    shotTiming:shotTiming.every(x=>x.withinTolerance),
    captionTiming:dialogue.every(x=>x.endSeconds>x.startSeconds&&x.startSeconds>=0&&x.endSeconds<=total+.01),
    culturalGate:job.review?.culturalContext===true,
    factLinesIdentified:dialogue.some(x=>x.factReviewRequired===true),
    finalVoiceApproved:job.language?.finalVoiceApproved===true,
    productionDuration:mode!=="production"||Math.abs(total-420)<=2
  };
  return {schema:"kora-kids.qc-report/v1",checks,shotTiming,passForGuide:Object.entries(checks).filter(([k])=>k!=="finalVoiceApproved").every(([,v])=>v===true),passForBroadcast:Object.values(checks).every(Boolean)};
}
function wavTone(path,duration=3){
  const rate=22050,samples=Math.floor(rate*duration),data=Buffer.alloc(samples*2);
  for(let i=0;i<samples;i++){
    const env=Math.min(1,i/(rate*.1),Math.max(0,(samples-i)/(rate*.2)));
    const v=Math.sin(2*Math.PI*220*i/rate)*.12*env;
    data.writeInt16LE(Math.round(v*32767),i*2);
  }
  const h=Buffer.alloc(44);h.write("RIFF",0);h.writeUInt32LE(36+data.length,4);h.write("WAVE",8);h.write("fmt ",12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write("data",36);h.writeUInt32LE(data.length,40);
  return writeFile(path,Buffer.concat([h,data]));
}
async function sha(path){
  const b=await readFile(path);return createHash("sha256").update(b).digest("hex");
}
async function main(){
  const a=args(),job=JSON.parse(await readFile(resolve(a.input),"utf8"));validate(job);
  if(!commandExists("ffmpeg")) throw new Error("ffmpeg is required on the render node");
  const out=resolve(a.output);await mkdir(out,{recursive:true});
  const proof=a.mode==="proof";
  const width=proof?640:1920,height=proof?360:1080,fps=proof?12:24,total=proof?6:job.scenes.reduce((n,s)=>n+(Number(s.durationSeconds)||0),0);
  if(total<=0) throw new Error("episode duration is zero");
  const schedule=sceneSchedule(job,total);
  const dialogue=dialogueSchedule(schedule,job.language.code);
  const lipSync=lipSyncFromDialogue(dialogue);
  const qc=qcReport(job,schedule,dialogue,total,a.mode);
  if(!qc.passForGuide) throw new Error("guide QC failed: "+Object.entries(qc.checks).filter(([k,v])=>k!=="finalVoiceApproved"&&v!==true).map(([k])=>k).join(", "));
  const silent=join(out,"episode-silent.mp4"),guide=join(out,"guide.wav"),final=join(out,"episode-guide.mp4"),captions=join(out,"captions.vtt"),cues=join(out,"voice-cues.json");
  await writeFile(captions,makeVtt(dialogue));
  await writeFile(cues,JSON.stringify({schema:"kora-kids.voice-cues/v2",series:job.series,episode:job.episode,guideOnly:true,cues:dialogue},null,2)+"\n");
  await writeFile(join(out,"lip-sync.json"),JSON.stringify({schema:"kora-kids.lip-sync/v1",guideOnly:true,cues:lipSync},null,2)+"\n");
  await writeFile(join(out,"mix-plan.json"),JSON.stringify(makeMixPlan(schedule,dialogue),null,2)+"\n");
  await writeFile(join(out,"qc-report.json"),JSON.stringify(qc,null,2)+"\n");

  const ff=[
    "-y","-f","rawvideo","-pixel_format","rgb24","-video_size",`${width}x${height}`,"-framerate",String(fps),"-i","pipe:0",
    "-an","-c:v","libx264","-preset",proof?"ultrafast":"medium","-crf",proof?"29":"20","-pix_fmt","yuv420p",
    "-metadata","comment=KORA KIDS guide animatic - not a final broadcast master",silent
  ];
  await ffmpegRun(ff,{stdio:["pipe","ignore","pipe"],onProcess:p=>{
    (async()=>{
      const frames=Math.round(total*fps);
      for(let i=0;i<frames;i++){
        const t=i/fps;let sc=schedule[schedule.length-1];
        for(const s of schedule)if(t>=s.start&&t<s.end){sc=s;break}
        const local=(t-sc.start)/Math.max(.001,sc.duration);
        const mouthOpen=lipSync.some(x=>t>=x.startSeconds&&t<x.endSeconds);
        const buf=frame(width,height,t,sc.index,local,mouthOpen);
        if(!p.stdin.write(buf)) await new Promise(r=>p.stdin.once("drain",r));
      }
      p.stdin.end();
    })().catch(e=>p.stdin.destroy(e));
  }});

  const speech=safeText(job.episode.title+". "+dialogue.map(c=>(c.speaker==="Lebo"?c.text:(c.performance||c.text))).join(" "));
  let guideKind="tone-fallback";
  if(commandExists("espeak-ng")){
    const r=spawnSync("espeak-ng",["-v","en","-s","160","-w",guide,speech],{stdio:"ignore"});
    if(r.status===0) guideKind="local-espeak-guide";
    else await wavTone(guide,Math.min(total,4));
  } else await wavTone(guide,Math.min(total,4));

  await ffmpegRun(["-y","-i",silent,"-i",guide,"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-af",`apad=pad_dur=${total}`,"-shortest","-metadata",`title=${safeText(job.series.title)} — ${safeText(job.episode.title)}`,"-metadata","comment=GUIDE ANIMATIC ONLY. Final voice, music, cultural review lock and broadcast QC remain required.",final]);

  const files=["episode-silent.mp4","guide.wav","episode-guide.mp4","captions.vtt","voice-cues.json","lip-sync.json","mix-plan.json","qc-report.json"];
  const outputs={};for(const name of files){const p=join(out,name);outputs[name]={bytes:(await stat(p)).size,sha256:await sha(p)}}
  const manifest={
    schema:"kora-kids.render-result/v2",createdAt:new Date().toISOString(),mode:a.mode,authoritativeTarget:"izakhono-local",
    series:job.series,episode:job.episode,language:job.language,dimensions:{width,height,fps,durationSeconds:total},
    guideAudio:{kind:guideKind,finalVoiceApproved:job.language?.finalVoiceApproved===true},broadcastMaster:qc.passForBroadcast===true,
    qc:{passForGuide:qc.passForGuide,passForBroadcast:qc.passForBroadcast},
    requiredBeforeBroadcast:["approved final voice master","approved original music master","fact lock","audio loudness QC","visual QC","caption QC"],
    outputs
  };
  await writeFile(join(out,"render-result.json"),JSON.stringify(manifest,null,2)+"\n");
  console.log(JSON.stringify(manifest,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
