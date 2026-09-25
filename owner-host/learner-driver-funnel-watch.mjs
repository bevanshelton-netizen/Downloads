#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const TZ=process.env.LDSA_FUNNEL_TIMEZONE || "Africa/Johannesburg";
const CHECK_HOUR=Math.max(0,Math.min(23,Number(process.env.LDSA_FUNNEL_CHECK_HOUR||8)));
const DAYS=Math.max(9,Math.min(31,Number(process.env.LDSA_FUNNEL_DAYS||10)));
const STATE_PATH=process.env.LDSA_FUNNEL_STATE || "/var/lib/izakhono-deploy/learner-driver-funnel-watch.json";

const OWNED_URL=(process.env.LDSA_FUNNEL_OWNED_URL || "http://127.0.0.1:8787/v1/local/learner-driver/funnel").replace(/\/$/,"");
const ALLOW_EXTERNAL=String(process.env.LDSA_FUNNEL_ALLOW_EXTERNAL_FALLBACK||"true").toLowerCase()!=="false";
const RPC_URL=process.env.LDSA_FUNNEL_RPC_URL || "https://yfawrenhudjomhnglfhq.supabase.co/rest/v1/rpc/get_learner_driver_funnel";
const RPC_KEY=process.env.LDSA_FUNNEL_RPC_KEY || "sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p";

const NOTIFY_URL=(process.env.IZAKHONO_NOTIFY_URL || "http://127.0.0.1:8840").replace(/\/$/,"");
const NOTIFY_ENV=process.env.IZAKHONO_NOTIFY_ENV || "/etc/izakhono/notify-node.env";
const RECIPIENT=process.env.LDSA_FUNNEL_RECIPIENT || "owner-bevan";
const TEMPLATE="learner-driver-sa-funnel-movement";

const METRICS=[
  "campaign_visits","cta_clicks","app_visits","app_learning_starts",
  "mock_test_starts","driving_school_interest_clicks","driving_school_enquiries","shares"
];

function now(){return new Date().toISOString();}
function readEnvKey(path,key){
  try{
    const line=readFileSync(path,"utf8").split(/\r?\n/).find(x=>x.trim().startsWith(key+"="));
    return line?line.slice(line.indexOf("=")+1).trim().replace(/^['"]|['"]$/g,""):"";
  }catch{return "";}
}
function notifyKey(){return process.env.IZAKHONO_NOTIFY_KEY || readEnvKey(NOTIFY_ENV,"IZAKHONO_NOTIFY_KEY");}
function localClock(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{
    timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"
  }).formatToParts(date).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return {day:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)};
}
function shiftDay(day,delta){
  const d=new Date(day+"T12:00:00Z");
  d.setUTCDate(d.getUTCDate()+delta);
  return d.toISOString().slice(0,10);
}
function loadState(){
  try{return JSON.parse(readFileSync(STATE_PATH,"utf8"));}
  catch{return {schema:"izakhono.learner-driver-funnel-watch/v1",last_checked_local_day:null,last_target_day:null,updated_at:null};}
}
function saveState(state){
  mkdirSync(dirname(STATE_PATH),{recursive:true});
  const tmp=STATE_PATH+".tmp";
  writeFileSync(tmp,JSON.stringify(state,null,2)+"\n","utf8");
  renameSync(tmp,STATE_PATH);
}
async function jsonFetch(url,options={},timeoutMs=6000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,headers:{"accept":"application/json",...(options.headers||{})}});
    const text=await response.text();
    let body={}; try{body=text?JSON.parse(text):{};}catch{}
    if(!response.ok) throw new Error("HTTP_"+response.status);
    return body;
  }finally{clearTimeout(timer);}
}
function normalizeRows(data){
  const rows=Array.isArray(data)?data:(Array.isArray(data?.rows)?data.rows:[]);
  return rows.map(r=>{
    const out={day:String(r.day||"").slice(0,10),source:String(r.source||"(direct)").slice(0,180)};
    for(const m of METRICS)out[m]=Math.max(0,Number(r[m]||0));
    return out;
  }).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.day));
}
async function ownedRows(){
  const data=await jsonFetch(OWNED_URL+"?days="+encodeURIComponent(DAYS),{},1800);
  const rows=normalizeRows(data);
  if(!rows.length && data?.ok!==true) throw new Error("owned_invalid_payload");
  return {source:"owned-data-node",rows};
}
async function externalRows(){
  if(!ALLOW_EXTERNAL) throw new Error("external_fallback_disabled");
  const data=await jsonFetch(RPC_URL,{
    method:"POST",
    headers:{"content-type":"application/json","apikey":RPC_KEY},
    body:JSON.stringify({p_days:DAYS})
  });
  return {source:"external-resilience-supabase",rows:normalizeRows(data)};
}
async function resolveRows(){
  try{return await ownedRows();}
  catch(ownedError){
    const fallback=await externalRows();
    return {...fallback,owned_error:String(ownedError?.message||ownedError)};
  }
}
function emptyMetrics(){
  return Object.fromEntries(METRICS.map(m=>[m,0]));
}
function add(a,b){for(const m of METRICS)a[m]+=Number(b[m]||0);return a;}
function metricsForDay(rows,day){
  const out=emptyMetrics();
  for(const r of rows)if(r.day===day)add(out,r);
  return out;
}
function sourceMetricsForDay(rows,day){
  const map=new Map();
  for(const r of rows){
    if(r.day!==day)continue;
    if(!map.has(r.source))map.set(r.source,emptyMetrics());
    add(map.get(r.source),r);
  }
  return [...map.entries()].map(([source,metrics])=>({source,...metrics}));
}
function avgDays(rows,days){
  const out=emptyMetrics();
  for(const d of days)add(out,metricsForDay(rows,d));
  for(const m of METRICS)out[m]=days.length?out[m]/days.length:0;
  return out;
}
function pct(n,d){return d>0?(100*n/d):0;}
function round1(n){return Number(Number(n||0).toFixed(1));}
function topSource(rows,targetDay,baselineDays){
  const today=sourceMetricsForDay(rows,targetDay).sort((a,b)=>b.campaign_visits-a.campaign_visits);
  const total=today.reduce((n,r)=>n+r.campaign_visits,0);
  if(!today.length||total<=0)return null;
  const top=today[0],second=today[1]||{campaign_visits:0};
  let baseTop=0,baseTotal=0;
  for(const d of baselineDays){
    const daySources=sourceMetricsForDay(rows,d);
    baseTotal+=daySources.reduce((n,r)=>n+r.campaign_visits,0);
    baseTop+=daySources.find(r=>r.source===top.source)?.campaign_visits||0;
  }
  return {
    source:top.source,
    visits:top.campaign_visits,
    total,
    share:pct(top.campaign_visits,total),
    second_visits:second.campaign_visits,
    baseline_share:pct(baseTop,baseTotal)
  };
}
function evaluate(current,baseline,rows,targetDay,baselineDays){
  const reasons=[];
  if(current.driving_school_enquiries>0)reasons.push("new driving-school enquiries");

  const trafficSpike=current.campaign_visits>=10 && (
    (baseline.campaign_visits<1 && current.campaign_visits>=10) ||
    (baseline.campaign_visits>=1 && current.campaign_visits>=baseline.campaign_visits*1.25 && current.campaign_visits-baseline.campaign_visits>=5)
  );
  if(trafficSpike)reasons.push("campaign traffic spike");

  const mockSpike=current.mock_test_starts>=3 && (
    (baseline.mock_test_starts<1 && current.mock_test_starts>=3) ||
    (baseline.mock_test_starts>=1 && current.mock_test_starts>=baseline.mock_test_starts*1.20 && current.mock_test_starts-baseline.mock_test_starts>=2)
  );
  if(mockSpike)reasons.push("mock-test activity increased");

  const currentCtaRate=pct(current.cta_clicks,current.campaign_visits);
  const baselineCtaRate=pct(baseline.cta_clicks,baseline.campaign_visits);
  if(current.campaign_visits>=10 && baseline.campaign_visits>=5 && Math.abs(currentCtaRate-baselineCtaRate)>=10){
    reasons.push("CTA conversion moved materially");
  }

  const leader=topSource(rows,targetDay,baselineDays);
  if(leader && leader.total>=10 && leader.visits>=5 && leader.share>=35 &&
     (leader.second_visits===0 || leader.visits>=leader.second_visits*1.25) &&
     (leader.baseline_share<30 || leader.share-leader.baseline_share>=10)){
    reasons.push("one source is beginning to outperform");
  }

  return {reasons,leader,currentCtaRate,baselineCtaRate};
}
function actionFor(evaluation,current){
  const source=evaluation.leader?.source;
  if(evaluation.reasons.includes("new driving-school enquiries")){
    return source?`Prioritise follow-up on the new enquiries and keep the next promotion wave concentrated on ${source}.`:
      "Prioritise follow-up on the new driving-school enquiries before widening promotion.";
  }
  if(evaluation.reasons.includes("one source is beginning to outperform")&&source){
    return `Concentrate the next owned promotion wave on ${source}; keep other channels as control traffic rather than spreading effort evenly.`;
  }
  if(evaluation.reasons.includes("campaign traffic spike")){
    return source?`Repeat the placement or creative that is sending traffic from ${source}, while keeping the same CTA.`:
      "Repeat the campaign placement that produced the traffic spike while keeping the CTA unchanged.";
  }
  if(evaluation.reasons.includes("mock-test activity increased")){
    return source?`Push the mock-test message harder on ${source}; it is the strongest current path into active learning.`:
      "Push the mock-test message harder on the best attributed owned channel.";
  }
  if(current.shares>0&&source)return `Keep the next promotion wave on ${source} and reuse the shareable campaign creative.`;
  return "Keep the current campaign running until a channel produces a clear signal.";
}
async function notifyOwner(targetDay,current,evaluation,action){
  const key=notifyKey();
  if(!key)return {attempted:false,reason:"notify_key_missing"};
  const headers={"content-type":"application/json","x-izakhono-key":key};
  const template=await jsonFetch(NOTIFY_URL+"/v1/templates/"+TEMPLATE,{
    method:"PUT",headers,body:JSON.stringify({
      channel:"in_app",
      subject:"Learner Driver SA funnel movement — {{day}}",
      body:"{{reasons}}. Visits {{visits}} → START LEARNING TODAY {{cta}} ({{cta_rate}}%) → mock tests {{mock}} ({{mock_rate}}%) → driving-school enquiries {{enquiries}}. Shares {{shares}}. Leading source: {{source}} ({{source_share}}% of campaign visits). Next action: {{action}}"
    })
  },5000);
  const templateId=String(template?.template?.id||TEMPLATE);
  const mockRate=pct(current.mock_test_starts,current.cta_clicks);
  const source=evaluation.leader?.source||"not enough attributable traffic";
  const sourceShare=evaluation.leader?round1(evaluation.leader.share):0;
  const result=await jsonFetch(NOTIFY_URL+"/v1/send",{
    method:"POST",headers,body:JSON.stringify({
      recipientRef:RECIPIENT,
      channel:"in_app",
      templateId,
      idempotencyKey:"learner-driver-funnel:"+targetDay,
      variables:{
        day:targetDay,
        reasons:evaluation.reasons.join("; "),
        visits:String(current.campaign_visits),
        cta:String(current.cta_clicks),
        cta_rate:round1(evaluation.currentCtaRate).toFixed(1),
        mock:String(current.mock_test_starts),
        mock_rate:round1(mockRate).toFixed(1),
        enquiries:String(current.driving_school_enquiries),
        shares:String(current.shares),
        source,
        source_share:sourceShare.toFixed(1),
        action
      },
      payload:{
        platform:"learner-driver-sa",
        target_day:targetDay,
        metrics:current,
        leading_source:evaluation.leader,
        reasons:evaluation.reasons
      },
      maxAttempts:3
    })
  },5000);
  return {attempted:true,message_id:result?.message?.id||null};
}
function windowsFallback(targetDay,current,evaluation){
  const msgExe="/mnt/c/Windows/System32/msg.exe";
  if(!existsSync(msgExe))return {attempted:false,reason:"windows_msg_unavailable"};
  const source=evaluation.leader?.source||"no clear leader";
  const message=`Learner Driver SA ${targetDay}: ${evaluation.reasons.join(", ")}. Visits ${current.campaign_visits}, CTA ${current.cta_clicks}, mock tests ${current.mock_test_starts}, enquiries ${current.driving_school_enquiries}, shares ${current.shares}. Lead source: ${source}.`;
  const run=spawnSync(msgExe,["*","/time:90",message],{encoding:"utf8",timeout:5000});
  return {attempted:true,status:run.status,stderr:String(run.stderr||"").trim().slice(0,200)};
}
async function run(){
  const force=process.argv.includes("--force");
  const state=loadState();
  const clock=localClock();
  if(!force && clock.hour<CHECK_HOUR){
    process.stdout.write(JSON.stringify({ok:true,skipped:true,reason:"before_daily_window",local_day:clock.day,check_hour:CHECK_HOUR,state_path:STATE_PATH})+"\n");
    return;
  }
  if(!force && state.last_checked_local_day===clock.day){
    process.stdout.write(JSON.stringify({ok:true,skipped:true,reason:"already_checked_today",local_day:clock.day,state_path:STATE_PATH})+"\n");
    return;
  }

  const resolved=await resolveRows();
  const targetDay=shiftDay(clock.day,-1);
  const baselineDays=Array.from({length:7},(_,i)=>shiftDay(targetDay,-(i+1)));
  const current=metricsForDay(resolved.rows,targetDay);
  const baseline=avgDays(resolved.rows,baselineDays);
  const evaluation=evaluate(current,baseline,resolved.rows,targetDay,baselineDays);
  const action=actionFor(evaluation,current);

  let notification={attempted:false,reason:"no_meaningful_movement"};
  let windows={attempted:false};
  if(evaluation.reasons.length){
    try{notification=await notifyOwner(targetDay,current,evaluation,action);}
    catch(error){notification={attempted:true,error:String(error?.message||error)};}
    if(!notification.message_id)windows=windowsFallback(targetDay,current,evaluation);
  }

  const snapshot={
    schema:"izakhono.learner-driver-funnel-watch/v1",
    ok:true,
    runtime:"NODE01",
    data_source:resolved.source,
    owned_data_error:resolved.owned_error||null,
    target_day:targetDay,
    baseline_days:baselineDays,
    metrics:current,
    baseline:Object.fromEntries(METRICS.map(m=>[m,round1(baseline[m])])),
    conversions:{
      visit_to_cta_pct:round1(evaluation.currentCtaRate),
      cta_to_mock_pct:round1(pct(current.mock_test_starts,current.cta_clicks)),
      mock_to_enquiry_pct:round1(pct(current.driving_school_enquiries,current.mock_test_starts))
    },
    leading_source:evaluation.leader,
    meaningful_movement:evaluation.reasons.length>0,
    reasons:evaluation.reasons,
    recommended_action:action,
    notification,
    windows_fallback:windows,
    checked_at:now()
  };

  state.schema=snapshot.schema;
  state.last_checked_local_day=clock.day;
  state.last_target_day=targetDay;
  state.last_snapshot=snapshot;
  state.updated_at=snapshot.checked_at;
  saveState(state);
  process.stdout.write(JSON.stringify(snapshot)+"\n");
}

if(process.argv.includes("--self-test")){
  const rows=[
    {day:"2026-09-24",source:"kora",campaign_visits:20,cta_clicks:10,app_visits:10,app_learning_starts:8,mock_test_starts:5,driving_school_interest_clicks:2,driving_school_enquiries:1,shares:3},
    {day:"2026-09-23",source:"kora",campaign_visits:5,cta_clicks:2,app_visits:2,app_learning_starts:1,mock_test_starts:1,driving_school_interest_clicks:0,driving_school_enquiries:0,shares:0}
  ];
  const current=metricsForDay(rows,"2026-09-24");
  const baselineDays=["2026-09-23","2026-09-22","2026-09-21","2026-09-20","2026-09-19","2026-09-18","2026-09-17"];
  const baseline=avgDays(rows,baselineDays);
  const ev=evaluate(current,baseline,rows,"2026-09-24",baselineDays);
  if(!ev.reasons.includes("new driving-school enquiries"))throw new Error("self-test enquiry trigger failed");
  if(current.campaign_visits!==20||current.mock_test_starts!==5)throw new Error("self-test aggregation failed");
  process.stdout.write(JSON.stringify({ok:true,self_test:true,reasons:ev.reasons})+"\n");
}else{
  run().catch(error=>{
    process.stderr.write(JSON.stringify({ok:false,error:String(error?.message||error),checked_at:now()})+"\n");
    process.exitCode=1;
  });
}
