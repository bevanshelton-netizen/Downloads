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
  if(!["lebo-jabu","tumi-tala"].includes(job?.series?.id)) throw new Error("render worker accepts only approved KORA KIDS series jobs");
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
function drawLebo(buf,w,h,x,y,s,bob,mouthOpen=false,emotion="neutral"){
  const skin=[135,84,60],hair=[36,27,33],yellow=[255,207,63],red=[236,75,65],ink=[23,52,83],white=[255,255,255];
  y+=bob;
  ellipse(buf,w,h,x,y+68*s,34*s,38*s,skin);
  circle(buf,w,h,x-27*s,y+36*s,21*s,hair);circle(buf,w,h,x+27*s,y+36*s,21*s,hair);
  const wide=["delighted","curious","surprised","announcer-playful","joyful"].includes(emotion);
  const happy=["laughing","playful","joyful"].includes(emotion);
  const focused=["determined","thoughtful","confident"].includes(emotion);
  if(happy){
    rect(buf,w,h,x-18*s,y+64*s,12*s,2*s,ink);rect(buf,w,h,x+6*s,y+64*s,12*s,2*s,ink);
  }else{
    circle(buf,w,h,x-12*s,y+64*s,(wide?5:4)*s,ink);circle(buf,w,h,x+12*s,y+64*s,(wide?5:4)*s,ink);
  }
  if(focused){
    rect(buf,w,h,x-21*s,y+52*s,16*s,2*s,ink);rect(buf,w,h,x+5*s,y+52*s,16*s,2*s,ink);
  }
  rect(buf,w,h,x-30*s,y+105*s,60*s,78*s,yellow);
  circle(buf,w,h,x,y+144*s,15*s,[255,155,37]);
  rect(buf,w,h,x-22*s,y+181*s,17*s,55*s,skin);rect(buf,w,h,x+6*s,y+181*s,17*s,55*s,skin);
  rect(buf,w,h,x-28*s,y+229*s,28*s,14*s,red);rect(buf,w,h,x+4*s,y+229*s,28*s,14*s,red);
  circle(buf,w,h,x-13*s,y+86*s,3*s,white);circle(buf,w,h,x+13*s,y+86*s,3*s,white);
  if(mouthOpen||["surprised","laughing","joyful","delighted"].includes(emotion)) ellipse(buf,w,h,x,y+93*s,(emotion==="surprised"?6:8)*s,(emotion==="surprised"?7:5)*s,[111,46,52]); else rect(buf,w,h,x-7*s,y+92*s,14*s,2*s,[111,46,52]);
}
function drawJabu(buf,w,h,x,y,s,bob,emotion="neutral"){
  const body=[185,192,198],ear=[210,215,219],leg=[160,169,176],ink=[23,52,83];
  y+=bob;
  ellipse(buf,w,h,x,y+145*s,72*s,55*s,body);
  ellipse(buf,w,h,x+52*s,y+82*s,49*s,45*s,body);
  const earScale=["proud","happy","joyful"].includes(emotion)?1.12:(emotion==="mock-offended"?.88:1);
  ellipse(buf,w,h,x+19*s,y+86*s,36*s*earScale,42*s*earScale,ear);
  circle(buf,w,h,x+37*s,y+78*s,4*s,ink);circle(buf,w,h,x+64*s,y+78*s,4*s,ink);
  rect(buf,w,h,x-43*s,y+180*s,23*s,58*s,leg);rect(buf,w,h,x+20*s,y+180*s,23*s,58*s,leg);
  const trunkLift=["proud","happy","joyful","curious"].includes(emotion)?-18:0;
  rect(buf,w,h,x+84*s,y+(93+trunkLift)*s,16*s,68*s,body);
  ellipse(buf,w,h,x+90*s,y+(160+trunkLift)*s,12*s,18*s,body);
}
const CAMERA_SCALE={wide:.82,medium:1,close:1.24,tracking:.94,"wide-push":.9,"close-montage":1.18,"medium-comedy":1.05,overhead:.9,"two-shot":1.02,"wide-comedy":.84,montage:1.02,"wide-sunset":.8,"map-motif":.88,"close-to-wide":1};
function shotSchedule(schedule){
  const out=[];
  for(const scene of schedule){
    const shots=Array.isArray(scene.shots)&&scene.shots.length?scene.shots:[{id:scene.id+"-guide",seconds:scene.durationSeconds||scene.duration,framing:"medium",action:scene.action}];
    const sourceTotal=shots.reduce((n,s)=>n+Math.max(.01,Number(s.seconds)||0),0);
    let cursor=scene.start;
    for(const shot of shots){
      const dur=scene.duration*(Math.max(.01,Number(shot.seconds)||0)/sourceTotal);
      out.push({...shot,sceneId:scene.id,start:+cursor.toFixed(4),end:+(cursor+dur).toFixed(4),duration:+dur.toFixed(4)});
      cursor+=dur;
    }
  }
  return out;
}
function activeAt(items,t){return items.find(x=>t>=x.start&&t<x.end)||items[items.length-1]}
function frameLeboJabu(width,height,t,sceneIndex,sceneT,leboMouthOpen=false,shot=null,dialogueCue=null){
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
  const framing=shot?.framing||"medium";
  let cameraScale=CAMERA_SCALE[framing]||1;
  if(framing==="wide-push"&&shot?.duration) cameraScale=.82+.18*Math.max(0,Math.min(1,(t-shot.start)/shot.duration));
  if(framing==="close-to-wide"&&shot?.duration) cameraScale=1.18-.36*Math.max(0,Math.min(1,(t-shot.start)/shot.duration));
  let leboX=width*.37, jabuX=width*.61;
  if(sceneIndex===1){leboX+=sceneT*18;jabuX+=sceneT*10}
  if(sceneIndex===2){leboX+=Math.sin(t*7)*12;jabuX+=Math.sin(t*5)*16}
  if(sceneIndex===3){leboX-=sceneT*10;jabuX+=sceneT*8}
  if(sceneIndex===4){leboX=width*.42;jabuX=width*.64}
  if(framing==="tracking"&&shot?.duration){
    const p=Math.max(0,Math.min(1,(t-shot.start)/shot.duration));
    leboX+=(p-.5)*28;jabuX+=(p-.5)*28;
  }
  const leboEmotion=dialogueCue?.speaker==="Lebo"?dialogueCue.emotion:(shot?.expressionFocus?.find?.(x=>x.speaker==="Lebo")?.emotion||"neutral");
  const jabuEmotion=dialogueCue?.speaker==="Jabu"?dialogueCue.emotion:(shot?.expressionFocus?.find?.(x=>x.speaker==="Jabu")?.emotion||"neutral");
  drawLebo(buf,width,height,leboX,horizon-183,.72*cameraScale,wave*4,leboMouthOpen,leboEmotion);
  drawJabu(buf,width,height,jabuX,horizon-178,.75*cameraScale,-wave*3,jabuEmotion);
  // berry/jam accents
  if(sceneIndex>=1&&sceneIndex<=3){
    for(let i=0;i<9;i++)circle(buf,width,height,width*.47+(i%3)*14-14,horizon+7+Math.floor(i/3)*10,4,[111,54,124]);
  }
  return buf;
}

function drawTumi(buf,w,h,x,y,s,bob,mouthOpen=false,emotion="neutral"){
  const skin=[140,89,62],hair=[43,33,49],purple=[134,103,232],blue=[63,101,174],ink=[23,52,83],white=[255,255,255];
  y+=bob;
  ellipse(buf,w,h,x,y+66*s,34*s,38*s,skin);
  ellipse(buf,w,h,x,y+38*s,35*s,22*s,hair);
  circle(buf,w,h,x-12*s,y+64*s,4*s,ink);circle(buf,w,h,x+12*s,y+64*s,4*s,ink);
  if(["curious","warm-informative"].includes(emotion)) rect(buf,w,h,x-20*s,y+52*s,14*s,2*s,ink);
  rect(buf,w,h,x-30*s,y+105*s,60*s,78*s,purple);
  rect(buf,w,h,x-23*s,y+181*s,18*s,56*s,blue);rect(buf,w,h,x+5*s,y+181*s,18*s,56*s,blue);
  rect(buf,w,h,x-28*s,y+230*s,27*s,13*s,ink);rect(buf,w,h,x+2*s,y+230*s,27*s,13*s,ink);
  circle(buf,w,h,x-12*s,y+86*s,3*s,white);circle(buf,w,h,x+12*s,y+86*s,3*s,white);
  if(mouthOpen||["delighted","joyful","playful"].includes(emotion)) ellipse(buf,w,h,x,y+94*s,8*s,5*s,[111,46,52]); else rect(buf,w,h,x-7*s,y+94*s,14*s,2*s,[111,46,52]);
}
function drawTala(buf,w,h,x,y,s,bob,mouthOpen=false,emotion="neutral"){
  const skin=[199,131,91],hair=[43,33,49],pink=[255,121,176],violet=[73,63,134],ink=[23,52,83],white=[255,255,255];
  y+=bob;
  ellipse(buf,w,h,x,y+66*s,34*s,38*s,skin);
  circle(buf,w,h,x-25*s,y+33*s,14*s,hair);circle(buf,w,h,x+25*s,y+33*s,14*s,hair);ellipse(buf,w,h,x,y+36*s,30*s,20*s,hair);
  circle(buf,w,h,x-12*s,y+64*s,4*s,ink);circle(buf,w,h,x+12*s,y+64*s,4*s,ink);
  rect(buf,w,h,x-30*s,y+105*s,60*s,78*s,pink);
  rect(buf,w,h,x-23*s,y+181*s,18*s,56*s,violet);rect(buf,w,h,x+5*s,y+181*s,18*s,56*s,violet);
  rect(buf,w,h,x-28*s,y+230*s,27*s,13*s,ink);rect(buf,w,h,x+2*s,y+230*s,27*s,13*s,ink);
  circle(buf,w,h,x-12*s,y+86*s,3*s,white);circle(buf,w,h,x+12*s,y+86*s,3*s,white);
  if(mouthOpen||["musical","joyful","bright"].includes(emotion)) ellipse(buf,w,h,x,y+94*s,8*s,5*s,[111,46,52]); else rect(buf,w,h,x-7*s,y+94*s,14*s,2*s,[111,46,52]);
}
function drawPiko(buf,w,h,x,y,s,bob){
  const green=[84,199,123],sky=[95,215,232],purple=[134,103,232],pink=[255,121,176],yellow=[255,207,63],ink=[23,52,83];
  y+=bob;
  ellipse(buf,w,h,x,y+48*s,30*s,40*s,green);
  circle(buf,w,h,x+7*s,y+8*s,23*s,sky);
  circle(buf,w,h,x+14*s,y+4*s,3*s,ink);
  rect(buf,w,h,x+28*s,y+8*s,25*s,5*s,yellow);
  ellipse(buf,w,h,x-28*s,y+45*s,18*s,28*s,purple);
  ellipse(buf,w,h,x+28*s,y+45*s,18*s,28*s,purple);
  rect(buf,w,h,x-12*s,y+82*s,9*s,28*s,pink);rect(buf,w,h,x+3*s,y+82*s,9*s,28*s,pink);
}
function drawBusiBus(buf,w,h,x,y,s,bob){
  const yellow=[255,207,63],sky=[110,212,255],ink=[23,52,83],white=[255,255,255];
  y+=bob;
  rect(buf,w,h,x-96*s,y,192*s,88*s,yellow);
  ellipse(buf,w,h,x-72*s,y+88*s,19*s,19*s,ink);ellipse(buf,w,h,x+60*s,y+88*s,19*s,19*s,ink);
  rect(buf,w,h,x-68*s,y+16*s,92*s,34*s,sky);rect(buf,w,h,x+34*s,y+16*s,30*s,44*s,sky);
  circle(buf,w,h,x-17*s,y+64*s,4*s,ink);circle(buf,w,h,x+7*s,y+64*s,4*s,ink);
  rect(buf,w,h,x-14*s,y+76*s,18*s,2*s,ink);
  circle(buf,w,h,x-72*s,y+88*s,7*s,white);circle(buf,w,h,x+60*s,y+88*s,7*s,white);
}
function frameTumiTala(width,height,t,sceneIndex,sceneT,mouthOpen=false,shot=null,dialogueCue=null){
  const buf=Buffer.alloc(width*height*3);
  rect(buf,width,height,0,0,width,height,[120,220,255]);
  const horizon=Math.floor(height*.66);
  rect(buf,width,height,0,horizon,width,height-horizon,[104,201,119]);
  circle(buf,width,height,width*.83,height*.17,30,[255,207,63]);
  // Rainbow Town homes
  rect(buf,width,height,width*.06,horizon-95,96,95,[255,239,198]);
  rect(buf,width,height,width*.07,horizon-124,78,30,[255,121,176]);
  rect(buf,width,height,width*.78,horizon-82,100,82,[238,232,255]);
  rect(buf,width,height,width*.79,horizon-110,82,28,[134,103,232]);
  // friendly walking path
  ellipse(buf,width,height,width*.53,horizon+58,width*.55,48,[237,201,135]);
  const framing=shot?.framing||"medium";
  let cameraScale=CAMERA_SCALE[framing]||1;
  if(framing==="wide-push"&&shot?.duration) cameraScale=.82+.18*Math.max(0,Math.min(1,(t-shot.start)/shot.duration));
  if(framing==="close-to-wide"&&shot?.duration) cameraScale=1.18-.36*Math.max(0,Math.min(1,(t-shot.start)/shot.duration));
  const wave=Math.sin(t*3.4);
  let tumiX=width*.34,talaX=width*.53,pikoX=width*.68,busX=width*.77;
  if(sceneIndex===1){tumiX+=Math.sin(t*2)*12;talaX-=Math.sin(t*2)*8;}
  if(sceneIndex===2){pikoX=width*.58;}
  if(sceneIndex===3){tumiX+=sceneT*18;talaX+=sceneT*15;busX=width*.80;}
  if(sceneIndex===4){tumiX=width*.37;talaX=width*.55;busX=width*.77;}
  const speaker=dialogueCue?.speaker||"";
  const tumiEmotion=speaker==="Tumi"?dialogueCue.emotion:(shot?.expressionFocus?.find?.(x=>x.speaker==="Tumi")?.emotion||"neutral");
  const talaEmotion=speaker==="Tala"?dialogueCue.emotion:(shot?.expressionFocus?.find?.(x=>x.speaker==="Tala")?.emotion||"neutral");
  drawTumi(buf,width,height,tumiX,horizon-178,.72*cameraScale,wave*3,mouthOpen&&speaker==="Tumi",tumiEmotion);
  drawTala(buf,width,height,talaX,horizon-178,.72*cameraScale,-wave*3,mouthOpen&&speaker==="Tala",talaEmotion);
  if(sceneIndex!==1) drawPiko(buf,width,height,pikoX,horizon-160,.65*cameraScale,Math.sin(t*5)*7);
  if(sceneIndex>=3) drawBusiBus(buf,width,height,busX,horizon-96,.78*cameraScale,Math.sin(t*1.7)*2);
  // five-step learning markers
  if(sceneIndex===1||sceneIndex===3){
    for(let i=0;i<5;i++){
      circle(buf,width,height,width*.18+i*30,horizon+20,10,[255,255,255]);
      rect(buf,width,height,width*.18+i*30-3,horizon+15,6,10,[23,52,83]);
    }
  }
  return buf;
}
function frame(seriesId,width,height,t,sceneIndex,sceneT,mouthOpen=false,shot=null,dialogueCue=null){
  if(seriesId==="tumi-tala") return frameTumiTala(width,height,t,sceneIndex,sceneT,mouthOpen,shot,dialogueCue);
  return frameLeboJabu(width,height,t,sceneIndex,sceneT,mouthOpen,shot,dialogueCue);
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
function lipSyncFromDialogue(cues,seriesId){
  const mouth=[];
  const speakers=seriesId==="tumi-tala"?new Set(["Tumi","Tala"]):new Set(["Lebo"]);
  for(const cue of cues){
    if(!speakers.has(cue.speaker)) continue;
    const words=cue.text.split(/\s+/).filter(Boolean);
    const dur=Math.max(.1,cue.endSeconds-cue.startSeconds);
    words.forEach((word,i)=>{
      const a=cue.startSeconds+dur*(i/Math.max(1,words.length));
      const b=cue.startSeconds+dur*((i+.72)/Math.max(1,words.length));
      const end=Math.max(a+.002,Math.min(cue.endSeconds,b));
      mouth.push({speaker:cue.speaker,sceneId:cue.sceneId,word,shape:"open",startSeconds:+a.toFixed(4),endSeconds:+end.toFixed(4)});
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
function qcReport(job,schedule,dialogue,shots,total,mode){
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
    productionDuration:mode!=="production"||Math.abs(total-420)<=2,
    shotPlanPresent:shots.length>=20,
    framingVariety:new Set(shots.map(s=>s.framing)).size>=6,
    expressionDirection:shots.some(s=>Array.isArray(s.expressionFocus)&&s.expressionFocus.length>0),
    qualityBiblesBound:Boolean(job.productionPack?.qualityBibles?.voice&&job.productionPack?.qualityBibles?.sound&&job.productionPack?.qualityBibles?.animation)
  };
  return {schema:"kora-kids.qc-report/v2",checks,shotTiming,shotCount:shots.length,framingTypes:[...new Set(shots.map(s=>s.framing))],passForGuide:Object.entries(checks).filter(([k])=>k!=="finalVoiceApproved").every(([,v])=>v===true),passForBroadcast:Object.values(checks).every(Boolean)};
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
  const shots=shotSchedule(schedule);
  const lipSync=lipSyncFromDialogue(dialogue,job.series.id);
  const qc=qcReport(job,schedule,dialogue,shots,total,a.mode);
  if(!qc.passForGuide) throw new Error("guide QC failed: "+Object.entries(qc.checks).filter(([k,v])=>k!=="finalVoiceApproved"&&v!==true).map(([k])=>k).join(", "));
  const silent=join(out,"episode-silent.mp4"),guide=join(out,"guide.wav"),final=join(out,"episode-guide.mp4"),captions=join(out,"captions.vtt"),cues=join(out,"voice-cues.json");
  await writeFile(captions,makeVtt(dialogue));
  await writeFile(cues,JSON.stringify({schema:"kora-kids.voice-cues/v2",series:job.series,episode:job.episode,guideOnly:true,cues:dialogue},null,2)+"\n");
  await writeFile(join(out,"lip-sync.json"),JSON.stringify({schema:"kora-kids.lip-sync/v1",guideOnly:true,cues:lipSync},null,2)+"\n");
  await writeFile(join(out,"mix-plan.json"),JSON.stringify(makeMixPlan(schedule,dialogue),null,2)+"\n");
  await writeFile(join(out,"shot-plan.json"),JSON.stringify({schema:"kora-kids.shot-plan/v1",guideOnly:true,shots},null,2)+"\n");
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
        const shot=activeAt(shots,t);
        const dialogueCue=dialogue.find(x=>t>=x.startSeconds&&t<x.endSeconds)||null;
        const buf=frame(job.series.id,width,height,t,sc.index,local,mouthOpen,shot,dialogueCue);
        if(!p.stdin.write(buf)) await new Promise(r=>p.stdin.once("drain",r));
      }
      p.stdin.end();
    })().catch(e=>p.stdin.destroy(e));
  }});

  const speech=safeText(job.episode.title+". "+dialogue.map(c=>(c.performance||c.text)).join(" "));
  let guideKind="tone-fallback";
  if(commandExists("espeak-ng")){
    const r=spawnSync("espeak-ng",["-v","en","-s","160","-w",guide,speech],{stdio:"ignore"});
    if(r.status===0) guideKind="local-espeak-guide";
    else await wavTone(guide,Math.min(total,4));
  } else await wavTone(guide,Math.min(total,4));

  await ffmpegRun(["-y","-i",silent,"-i",guide,"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-af",`apad=pad_dur=${total}`,"-shortest","-metadata",`title=${safeText(job.series.title)} — ${safeText(job.episode.title)}`,"-metadata","comment=GUIDE ANIMATIC ONLY. Final voice, music, cultural review lock and broadcast QC remain required.",final]);

  const files=["episode-silent.mp4","guide.wav","episode-guide.mp4","captions.vtt","voice-cues.json","lip-sync.json","mix-plan.json","shot-plan.json","qc-report.json"];
  const outputs={};for(const name of files){const p=join(out,name);outputs[name]={bytes:(await stat(p)).size,sha256:await sha(p)}}
  const manifest={
    schema:"kora-kids.render-result/v3",createdAt:new Date().toISOString(),mode:a.mode,authoritativeTarget:"izakhono-local",
    series:job.series,episode:job.episode,language:job.language,dimensions:{width,height,fps,durationSeconds:total},
    guideAudio:{kind:guideKind,finalVoiceApproved:job.language?.finalVoiceApproved===true},broadcastMaster:qc.passForBroadcast===true,
    qc:{passForGuide:qc.passForGuide,passForBroadcast:qc.passForBroadcast,shotCount:qc.shotCount,framingTypes:qc.framingTypes},
    requiredBeforeBroadcast:["approved final voice master","approved original music master","fact lock","audio loudness QC","visual QC","caption QC"],
    outputs
  };
  await writeFile(join(out,"render-result.json"),JSON.stringify(manifest,null,2)+"\n");
  console.log(JSON.stringify(manifest,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
