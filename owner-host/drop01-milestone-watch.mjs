#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const CAMPAIGN=process.env.ALLEGRO_DROP01_CAMPAIGN || "AV-DROP-01";
const BRAND=process.env.ALLEGRO_DROP01_BRAND || "ALLEGRO-VIBEZ";
const TARGET=Number(process.env.ALLEGRO_DROP01_TARGET || 100000);
const STEP=Number(process.env.ALLEGRO_DROP01_STEP || 10000);
const OWNED_URL=(process.env.ALLEGRO_DROP01_OWNED_URL || "http://127.0.0.1:8787").replace(/\/$/,"");
const OWNED_AUTHORITATIVE=String(process.env.ALLEGRO_DROP01_OWNED_AUTHORITATIVE||"false").toLowerCase()==="true";
const STATE_PATH=process.env.ALLEGRO_DROP01_STATE || "/var/lib/izakhono-deploy/allegro-drop01-milestones.json";
const NOTIFY_URL=(process.env.IZAKHONO_NOTIFY_URL || "http://127.0.0.1:8840").replace(/\/$/,"");
const NOTIFY_KEY=process.env.IZAKHONO_NOTIFY_KEY || "";
const RECIPIENT=process.env.ALLEGRO_DROP01_RECIPIENT || "bevan-shelton";
const CHECK_SECONDS=Math.max(300,Number(process.env.ALLEGRO_DROP01_CHECK_SECONDS||3600));

const FALLBACK_URL=process.env.ALLEGRO_DROP01_FALLBACK_URL || "https://zoolsumifdtanycjryje.supabase.co/rest/v1/rpc/get_merch_campaign_progress";
const FALLBACK_KEY=process.env.ALLEGRO_DROP01_FALLBACK_KEY || "sb_publishable_8LBaWtgMxlewODl4STQ9YA_jMMEt5Gt";
const ALLOW_FALLBACK=String(process.env.ALLEGRO_DROP01_ALLOW_EXTERNAL_FALLBACK||"true").toLowerCase()!=="false";

function now(){ return new Date().toISOString(); }
function loadState(){
  try{return JSON.parse(readFileSync(STATE_PATH,"utf8"));}
  catch{return {campaign:CAMPAIGN,target:TARGET,notified:[],last_paid_sales:0,updated_at:null};}
}
function saveState(state){
  mkdirSync(dirname(STATE_PATH),{recursive:true});
  const tmp=STATE_PATH+".tmp";
  writeFileSync(tmp,JSON.stringify(state,null,2)+"\n","utf8");
  renameSync(tmp,STATE_PATH);
}
async function jsonFetch(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,headers:{"accept":"application/json",...(options.headers||{})}});
    const text=await response.text();
    let body={}; try{body=text?JSON.parse(text):{};}catch{}
    if(!response.ok) throw new Error("HTTP_"+response.status);
    return body;
  }finally{clearTimeout(timer);}
}
async function ownedProgress(){
  const url=OWNED_URL+"/v1/local/campaigns/"+encodeURIComponent(CAMPAIGN)+"/sales?brand="+encodeURIComponent(BRAND);
  const data=await jsonFetch(url);
  return {
    source:"owned-data-node",
    paid_sales:Number(data.paid_sales||0),
    payment_count:Number(data.payment_count||0),
    units:Number(data.units||0)
  };
}
async function fallbackProgress(){
  if(!ALLOW_FALLBACK) throw new Error("fallback_disabled");
  const data=await jsonFetch(FALLBACK_URL,{
    method:"POST",
    headers:{"content-type":"application/json","apikey":FALLBACK_KEY},
    body:JSON.stringify({p_campaign_code:CAMPAIGN})
  });
  const row=Array.isArray(data)?data[0]:data;
  if(!row || typeof row!=="object") throw new Error("fallback_invalid_payload");
  return {
    source:"external-resilience",
    paid_sales:Number(row.paid_sales||0),
    payment_count:Number(row.payment_count||0),
    units:Number(row.units||0)
  };
}
async function resolveProgress(){
  let owned=null,ownedError=null;
  try{owned=await ownedProgress();}catch(error){ownedError=String(error?.message||error);}
  if(OWNED_AUTHORITATIVE && owned) return {...owned,owned_error:null};
  if(ALLOW_FALLBACK){
    try{
      const fallback=await fallbackProgress();
      if(!owned || fallback.paid_sales!==owned.paid_sales){
        return {...fallback,owned_snapshot:owned,owned_error:ownedError};
      }
    }catch(error){
      if(owned) return {...owned,fallback_error:String(error?.message||error),owned_error:ownedError};
      throw error;
    }
  }
  if(owned) return {...owned,owned_error:ownedError};
  throw new Error(ownedError||"progress_unavailable");
}
function crossedMilestones(paid,notified){
  const seen=new Set((notified||[]).map(Number));
  const out=[];
  for(let m=STEP;m<=TARGET;m+=STEP){
    if(paid>=m && !seen.has(m)) out.push(m);
  }
  return out;
}
function randIdem(m){return "allegro-drop01-milestone-"+m;}
async function notifyNode(milestone,progress){
  if(!NOTIFY_KEY) return {attempted:false,reason:"notify_key_missing"};
  const headers={"content-type":"application/json","x-izakhono-key":NOTIFY_KEY};
  await jsonFetch(NOTIFY_URL+"/v1/templates/allegro-drop01-milestone",{
    method:"PUT",headers,body:JSON.stringify({
      channel:"in_app",
      subject:"ALLEGRO-VIBEZ DROP 01 reached R{{milestone}}",
      body:"DROP 01 has reached R{{milestone}} in verified paid sales. Current verified sales: R{{sales}}. Target progress: {{percent}}%. Remaining: R{{remaining}}."
    })
  });
  const remaining=Math.max(0,TARGET-progress.paid_sales);
  const result=await jsonFetch(NOTIFY_URL+"/v1/send",{
    method:"POST",headers,body:JSON.stringify({
      recipientRef:RECIPIENT,
      channel:"in_app",
      templateId:"allegro-drop01-milestone",
      idempotencyKey:randIdem(milestone),
      variables:{
        milestone:milestone.toLocaleString("en-ZA"),
        sales:Math.round(progress.paid_sales).toLocaleString("en-ZA"),
        percent:Math.min(100,(progress.paid_sales/TARGET)*100).toFixed(1),
        remaining:Math.round(remaining).toLocaleString("en-ZA")
      },
      payload:{campaign:CAMPAIGN,milestone,paid_sales:progress.paid_sales,source:progress.source}
    })
  });
  return {attempted:true,message_id:result?.message?.id||null};
}
function windowsOwnerAlert(milestone,progress){
  const msgExe="/mnt/c/Windows/System32/msg.exe";
  if(!existsSync(msgExe)) return {attempted:false,reason:"windows_msg_unavailable"};
  const remaining=Math.max(0,TARGET-progress.paid_sales);
  const text="ALLEGRO-VIBEZ DROP 01: R"+milestone.toLocaleString("en-ZA")+" milestone reached. Verified sales R"+Math.round(progress.paid_sales).toLocaleString("en-ZA")+"; R"+Math.round(remaining).toLocaleString("en-ZA")+" remaining.";
  const run=spawnSync(msgExe,["*","/time:60",text],{encoding:"utf8",timeout:5000});
  return {attempted:true,status:run.status,stderr:String(run.stderr||"").trim().slice(0,200)};
}
async function run(){
  const state=loadState();
  const last=Date.parse(state.updated_at||"");
  const force=process.argv.includes("--force");
  if(!force && Number.isFinite(last) && Date.now()-last < CHECK_SECONDS*1000){
    process.stdout.write(JSON.stringify({
      ok:true,skipped:true,reason:"interval_not_due",campaign:CAMPAIGN,
      next_check_after:new Date(last+CHECK_SECONDS*1000).toISOString(),state_path:STATE_PATH
    })+"\n");
    return;
  }
  const progress=await resolveProgress();
  const paid=Math.max(0,Number(progress.paid_sales||0));
  const milestones=crossedMilestones(paid,state.notified);

  const alerts=[];
  for(const milestone of milestones){
    let notify={attempted:false};
    try{notify=await notifyNode(milestone,progress);}catch(error){notify={attempted:true,error:String(error?.message||error)};}
    const windows=windowsOwnerAlert(milestone,progress);
    alerts.push({milestone,notify,windows});
    state.notified=[...(state.notified||[]),milestone].sort((a,b)=>a-b);
  }

  state.campaign=CAMPAIGN;
  state.target=TARGET;
  state.last_paid_sales=paid;
  state.last_payment_count=progress.payment_count;
  state.last_units=progress.units;
  state.last_source=progress.source;
  state.updated_at=now();
  state.alerts_emitted=alerts.length;
  saveState(state);

  const output={
    ok:true,
    campaign:CAMPAIGN,
    target:TARGET,
    paid_sales:paid,
    remaining:Math.max(0,TARGET-paid),
    percent:Number(Math.min(100,(paid/TARGET)*100).toFixed(1)),
    payment_count:progress.payment_count,
    units:progress.units,
    source:progress.source,
    owned_authoritative:OWNED_AUTHORITATIVE,
    milestones_emitted:alerts.map(a=>a.milestone),
    alerts,
    state_path:STATE_PATH,
    checked_at:state.updated_at
  };
  process.stdout.write(JSON.stringify(output)+"\n");
}

if(process.argv.includes("--self-test")){
  const fake={notified:[10000,20000]};
  const crossed=crossedMilestones(45500,fake.notified);
  if(JSON.stringify(crossed)!==JSON.stringify([30000,40000])) throw new Error("milestone self-test failed");
  process.stdout.write(JSON.stringify({ok:true,self_test:true,crossed})+"\n");
}else{
  run().catch(error=>{
    process.stderr.write(JSON.stringify({ok:false,error:String(error?.message||error),checked_at:now()})+"\n");
    process.exitCode=1;
  });
}
