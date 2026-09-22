#!/usr/bin/env node
import { appendFile, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "https://yfawrenhudjomhnglfhq.supabase.co").replace(/\/$/,"");
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const DATA_DIR = process.env.GOSPEL_TV_DATA_DIR || "/var/lib/izakhono-runtime/data/kora-gospel-tv";
const SUBMISSIONS = join(DATA_DIR,"submissions.ndjson");
const RECEIPT = process.env.GOSPEL_RECONCILE_RECEIPT || "/var/lib/izakhono-deploy/kora-gospel-reconcile.json";
const LOCK = process.env.GOSPEL_RECONCILE_LOCK || "/run/kora-gospel-reconcile.lock";
const WORKER = process.env.GOSPEL_RECONCILE_WORKER || "izakhono-owned-gospel-reconciler";
const LIMIT = Math.max(1,Math.min(Number(process.env.GOSPEL_RECONCILE_LIMIT || 50),200));

function fail(message,code=2){ console.error("FAIL:",message); process.exit(code); }
function clean(v,max=160){ return String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max); }
function safeObject(v){
  if(!v || typeof v!=="object" || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).slice(0,20).map(([k,val])=>[clean(k,60),clean(val,240)]));
}
function headers(extra={}){
  return {
    "apikey":SUPABASE_KEY,
    "authorization":"Bearer "+SUPABASE_KEY,
    "accept":"application/json",
    "user-agent":"izakhono-gospel-reconciler/1.0",
    ...extra
  };
}
async function api(path,options={}){
  const response=await fetch(SUPABASE_URL+path,{...options,headers:headers(options.headers||{})});
  const text=await response.text();
  let body=null;
  try{body=text?JSON.parse(text):null}catch{body=text}
  if(!response.ok){
    const error=new Error("Supabase request failed with HTTP "+response.status);
    error.status=response.status; error.body=body; throw error;
  }
  return body;
}
async function existingExternalRefs(){
  try{
    const raw=await readFile(SUBMISSIONS,"utf8");
    const refs=new Set();
    for(const line of raw.split("\n")){
      if(!line.trim()) continue;
      try{
        const row=JSON.parse(line);
        if(row.external_reference) refs.add(String(row.external_reference));
      }catch{}
    }
    return refs;
  }catch{return new Set()}
}
function ownedRecord(row){
  return {
    schema:"kora.gospel-tv.submission/v2",
    reference:"KGT-EXT-"+clean(row.reference,80),
    external_reference:clean(row.reference,100),
    external_id:clean(row.id,80),
    category:["content","partner","prayer"].includes(row.category)?row.category:"partner",
    type:clean(row.type,50),
    name:clean(row.name,120),
    contact:clean(row.contact,160),
    message:clean(row.message,1600),
    on_air:false,
    territory:clean(row.territory,80),
    language:clean(row.language,50),
    rights_attested:Boolean(row.rights_attested),
    source_channel:"external-reconciled",
    source_origin:clean(row.source_origin,180),
    details:safeObject(row.details),
    external_created_at:clean(row.created_at,80),
    reconciled_at:new Date().toISOString(),
    reconciliation_worker:WORKER,
    authoritative:true
  };
}
async function markImported(reference){
  const now=new Date().toISOString();
  const path="/rest/v1/kora_gospel_external_intake?reference=eq."+encodeURIComponent(reference);
  await api(path,{
    method:"PATCH",
    headers:{"content-type":"application/json","prefer":"return=minimal"},
    body:JSON.stringify({status:"imported",imported_at:now,imported_by:WORKER})
  });
}
async function main(){
  if(!SUPABASE_KEY || SUPABASE_KEY.includes("REPLACE-WITH")) fail("SUPABASE_SECRET_KEY is not configured in the protected owner-host environment.",3);
  await mkdir(DATA_DIR,{recursive:true});
  await mkdir(dirname(RECEIPT),{recursive:true});

  let lock;
  try{
    lock=await open(LOCK,"wx",0o600);
    await lock.writeFile(JSON.stringify({pid:process.pid,started_at:new Date().toISOString()})+"\n");
  }catch(err){
    if(err?.code==="EEXIST"){ console.log("Reconciliation already running; exiting safely."); return; }
    throw err;
  }

  let imported=0,duplicates=0,failed=0,scanned=0;
  const failures=[];
  try{
    const path="/rest/v1/kora_gospel_external_intake?status=eq.buffered&select=id,created_at,reference,category,type,name,contact,message,on_air,source_channel,source_origin,territory,language,rights_attested,details,status&order=created_at.asc&limit="+LIMIT;
    const rows=await api(path);
    if(!Array.isArray(rows)) fail("Unexpected Supabase response shape.",4);
    scanned=rows.length;
    const known=await existingExternalRefs();

    for(const row of rows){
      const ref=clean(row.reference,100);
      if(!ref){ failed++; failures.push({reference:null,error:"missing_reference"}); continue; }
      try{
        if(known.has(ref)){
          duplicates++;
          await markImported(ref);
          continue;
        }
        const record=ownedRecord(row);
        await appendFile(SUBMISSIONS,JSON.stringify(record)+"\n",{encoding:"utf8",mode:0o600});
        known.add(ref);
        imported++;
        await markImported(ref);
      }catch(err){
        failed++;
        failures.push({reference:ref,error:clean(err?.message||"unknown_error",180)});
      }
    }

    const receipt={
      schema:"izakhono.kora-gospel-reconciliation/v1",
      authority:"IZAKHONO",
      source:"Supabase external resilience buffer",
      source_authoritative:false,
      worker:WORKER,
      scanned,imported,duplicates,failed,
      failures:failures.slice(0,20),
      owned_store:SUBMISSIONS,
      completed_at:new Date().toISOString()
    };
    await writeFile(RECEIPT,JSON.stringify(receipt,null,2)+"\n",{encoding:"utf8",mode:0o640});
    console.log("KORA GOSPEL RECONCILIATION: PASS");
    console.log("SCANNED="+scanned);
    console.log("IMPORTED="+imported);
    console.log("DUPLICATES="+duplicates);
    console.log("FAILED="+failed);
    console.log("RECEIPT="+RECEIPT);
    if(failed>0) process.exitCode=5;
  }finally{
    try{await lock?.close()}catch{}
    await rm(LOCK,{force:true}).catch(()=>{});
  }
}
main().catch(err=>fail(clean(err?.message||String(err),240),10));
