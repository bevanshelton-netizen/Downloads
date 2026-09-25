import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(){
 const o={};
 for(let i=2;i<process.argv.length;i++){
  const k=process.argv[i];
  if(k==="--session")o.session=process.argv[++i];
  else if(k==="--output")o.output=process.argv[++i];
 }
 if(!o.session||!o.output)throw new Error("--session and --output are required");return o;
}
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:32*1024*1024});if(r.error)throw r.error;if(r.status!==0)throw new Error(cmd+" failed: "+String(r.stderr||r.stdout||"").slice(-4000));return r}
async function sha(path){return createHash("sha256").update(await readFile(path)).digest("hex")}
function need(v,msg){if(!v)throw new Error(msg)}
async function main(){
 const a=parseArgs(),s=JSON.parse(await readFile(resolve(a.session),"utf8"));
 need(s?.schema==="kora-kids.recording-session/v1","invalid recording session");
 need(s.seriesId==="lebo-jabu"&&s.episodeSlug==="jam-day-under-the-baobab"&&s.character==="Lebo","session scope mismatch");
 need(s.selectedPerformer?.approved===true,"selected performer is not approved");
 need(Array.isArray(s.lines)&&s.lines.length===17,"Episode 1 requires 17 Lebo lines");
 for(const l of s.lines){
   need(l.take?.approved===true,"approved take missing for "+l.id);
   need(l.take?.privatePath,"take path missing for "+l.id);
   need(await sha(resolve(l.take.privatePath))===l.take.sha256,"take hash mismatch for "+l.id);
   need(Number(l.endSeconds)>Number(l.startSeconds),"invalid timing for "+l.id);
 }
 const out=resolve(a.output);await mkdir(out,{recursive:true});
 const args=["-y"];for(const l of s.lines)args.push("-i",resolve(l.take.privatePath));
 const filters=[];const labels=[];
 for(let i=0;i<s.lines.length;i++){
   const l=s.lines[i],delay=Math.max(0,Math.round(Number(l.startSeconds)*1000));
   filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${delay}:all=1,volume=1[line${i}]`);
   labels.push(`[line${i}]`);
 }
 filters.push(`${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=0,apad,atrim=0:420,loudnorm=I=-18:TP=-2:LRA=7[voice]`);
 const master=join(out,"lebo-episode1-voice-master.wav");
 args.push("-filter_complex",filters.join(";"),"-map","[voice]","-ar","48000","-ac","1","-c:a","pcm_s24le",master);
 run("ffmpeg",args);
 const result={
   schema:"kora-kids.voice-master-result/v1",createdAt:new Date().toISOString(),
   seriesId:s.seriesId,episodeSlug:s.episodeSlug,language:s.language,character:"Lebo",
   performerDisplayName:s.selectedPerformer.performerDisplayName,
   lineCount:s.lines.length,durationSeconds:420,
   sourceTakeHashes:Object.fromEntries(s.lines.map(l=>[l.id,l.take.sha256])),
   output:{path:master,sha256:await sha(master),bytes:(await stat(master)).size,format:"48 kHz / 24-bit / mono WAV"},
   approvedForAudioIntake:false,finalPerformanceApproved:false,
   note:"The master is assembled from individually approved takes. It still requires final performance/technical/rights review in the Audio Desk."
 };
 await writeFile(join(out,"voice-master-result.json"),JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
