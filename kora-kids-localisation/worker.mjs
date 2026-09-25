import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

function parseArgs(){
  const out={mode:"draft"};
  for(let i=2;i<process.argv.length;i++){
    const k=process.argv[i];
    if(k==="--source")out.source=process.argv[++i];
    else if(k==="--pack")out.pack=process.argv[++i];
    else if(k==="--output")out.output=process.argv[++i];
    else if(k==="--mode")out.mode=process.argv[++i];
  }
  for(const k of ["source","pack","output"])if(!out[k])throw new Error("--"+k+" is required");
  if(!["draft","production"].includes(out.mode))throw new Error("--mode must be draft or production");
  return out;
}
function vttTime(sec){
  const ms=Math.max(0,Math.round(sec*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),r=ms%1000;
  return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")+"."+String(r).padStart(3,"0");
}
function clean(x){return String(x||"").replace(/[\r\n]+/g," ").trim()}
function validate(source,pack,mode){
  if(source?.schema!=="kora-kids.localisation-source/v1")throw new Error("invalid source schema");
  if(pack?.schema!=="kora-kids.localisation-pack/v1")throw new Error("invalid pack schema");
  if(source.seriesId!==pack.seriesId||source.episodeSlug!==pack.episodeSlug||source.language!==pack.sourceLanguage)throw new Error("source/pack mismatch");
  if(!Array.isArray(source.lines)||!Array.isArray(pack.lines)||source.lines.length!==pack.lines.length)throw new Error("line count mismatch");
  const ids=new Set();
  for(const src of source.lines){
    if(ids.has(src.id))throw new Error("duplicate source line id "+src.id);ids.add(src.id);
    const loc=pack.lines.find(x=>x.id===src.id);
    if(!loc)throw new Error("missing localisation line "+src.id);
    if(loc.sceneId!==src.sceneId||loc.speaker!==src.speaker)throw new Error("line metadata mismatch "+src.id);
    if(!clean(loc.text))throw new Error("empty localisation line "+src.id);
    if(src.source.includes("Jabu")&&!loc.text.includes("Jabu"))throw new Error("Jabu brand name not preserved in "+src.id);
    if(src.source.includes("Lebo")&&!loc.text.includes("Lebo"))throw new Error("Lebo brand name not preserved in "+src.id);
    if(Boolean(src.factReviewRequired)!==Boolean(loc.factReviewRequired))throw new Error("fact-review flag mismatch "+src.id);
  }
  if(pack.brandNames?.translateNames!==false)throw new Error("brand-name policy must preserve Lebo and Jabu");
  if(!["ltr","rtl"].includes(pack.textDirection))throw new Error("invalid text direction");
  if(mode==="production"){
    const review=pack.review||{};
    const required=["nativeLanguage","culturalContext","comicTiming","childSafety","factAccuracy","finalEditorial"];
    const missing=required.filter(k=>review[k]!==true);
    if(missing.length)throw new Error("production localisation review incomplete: "+missing.join(", "));
    if(pack.approvedForDubbing!==true)throw new Error("pack is not approved for dubbing");
  }
}
function buildTiming(lines,total=420){
  const sceneDur={s01:55,s02:80,s03:105,s04:105,s05:75};
  const sceneStart={s01:0,s02:55,s03:135,s04:240,s05:345};
  const out=[];
  for(const sceneId of Object.keys(sceneDur)){
    const sceneLines=lines.filter(x=>x.sceneId===sceneId);
    if(!sceneLines.length)continue;
    const pad=sceneDur[sceneId]*.11,usable=sceneDur[sceneId]*.78;
    const weights=sceneLines.map(x=>Math.max(2,[...clean(x.text)].length));
    const sum=weights.reduce((a,b)=>a+b,0);let cursor=sceneStart[sceneId]+pad;
    sceneLines.forEach((line,i)=>{
      const dur=usable*(weights[i]/sum);
      out.push({...line,startSeconds:+cursor.toFixed(3),endSeconds:+Math.min(sceneStart[sceneId]+sceneDur[sceneId]-pad,cursor+dur).toFixed(3)});
      cursor+=dur;
    });
  }
  if(out.some(x=>x.endSeconds<=x.startSeconds||x.startSeconds<0||x.endSeconds>total+.01))throw new Error("invalid localisation timing");
  return out;
}
async function main(){
  const a=parseArgs(),source=JSON.parse(await readFile(resolve(a.source),"utf8")),pack=JSON.parse(await readFile(resolve(a.pack),"utf8"));
  validate(source,pack,a.mode);
  const out=resolve(a.output);await mkdir(out,{recursive:true});
  const cues=buildTiming(pack.lines);
  const script={
    schema:"kora-kids.dubbing-script/v1",mode:a.mode,seriesId:pack.seriesId,episodeSlug:pack.episodeSlug,
    sourceLanguage:pack.sourceLanguage,targetLanguage:pack.targetLanguage,targetName:pack.targetName,voice:pack.voice,
    textDirection:pack.textDirection,brandNames:pack.brandNames,humanReviewRequired:pack.humanReviewRequired,
    approvedForDubbing:a.mode==="production"&&pack.approvedForDubbing===true,
    lines:cues.map(x=>({id:x.id,sceneId:x.sceneId,speaker:x.speaker,text:x.text,startSeconds:x.startSeconds,endSeconds:x.endSeconds,factReviewRequired:x.factReviewRequired}))
  };
  const vtt="WEBVTT\n\n"+cues.map((x,i)=>`${i+1}\n${vttTime(x.startSeconds)} --> ${vttTime(x.endSeconds)}\n${x.speaker}: ${x.text}\n`).join("\n");
  const result={
    schema:"kora-kids.localisation-build/v1",mode:a.mode,targetLanguage:pack.targetLanguage,lineCount:cues.length,
    textDirection:pack.textDirection,approvedForDubbing:script.approvedForDubbing,
    publicationAllowed:a.mode==="production"&&pack.approvedForPublication===true,
    note:a.mode==="draft"?"Machine-draft localisation output. Human review required before dubbing or publication.":"Human-reviewed localisation production output."
  };
  await writeFile(join(out,"dubbing-script.json"),JSON.stringify(script,null,2)+"\n");
  await writeFile(join(out,"captions.vtt"),vtt);
  await writeFile(join(out,"localisation-result.json"),JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
