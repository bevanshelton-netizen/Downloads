import { createHash, generateKeyPairSync, verify } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync,rmSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const root=resolve("./.self-test");
const port=19930;
const admin=randomBytes(24).toString("hex");
rmSync(root,{recursive:true,force:true});
mkdirSync(resolve(root,"keys"),{recursive:true});

const {privateKey,publicKey}=generateKeyPairSync("ed25519");
writeFileSync(resolve(root,"keys/private.pem"),privateKey.export({type:"pkcs8",format:"pem"}));
writeFileSync(resolve(root,"keys/public.pem"),publicKey.export({type:"spki",format:"pem"}));

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    NODE_ENV:"test",
    HOST:"127.0.0.1",
    PORT:String(port),
    IZAKHONO_WITNESS_ADMIN_KEY:admin,
    IZAKHONO_WITNESS_DB:resolve(root,"witness.sqlite"),
    IZAKHONO_WITNESS_PRIVATE_KEY_FILE:resolve(root,"keys/private.pem"),
    IZAKHONO_WITNESS_PUBLIC_KEY_FILE:resolve(root,"keys/public.pem")
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitHealth(){
  for(let i=0;i<40;i++){
    await sleep(100);
    try{const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok)return;}catch{}
  }
  throw new Error("Witness did not become healthy");
}
async function adminPost(path,body){
  const r=await fetch(`http://127.0.0.1:${port}${path}`,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-key":admin},
    body:JSON.stringify(body)
  });
  return {r,body:await r.json()};
}
async function memberPost(path,key,body={}){
  const r=await fetch(`http://127.0.0.1:${port}${path}`,{
    method:"POST",
    headers:{"content-type":"application/json","x-witness-member-key":key},
    body:JSON.stringify(body)
  });
  return {r,body:await r.json()};
}
function verifyReceipt(receipt){
  const {signature,algorithm,...body}=receipt;
  if(algorithm!=="Ed25519") return false;
  return verify(null,Buffer.from(JSON.stringify(body)),publicKey,Buffer.from(signature,"base64"));
}

try{
  await waitHealth();

  let x=await adminPost("/v1/clusters",{name:"owned-cloud",leaseTtlSeconds:2});
  if(x.r.status!==201) throw new Error("Cluster create failed");
  const clusterId=x.body.cluster.id;

  x=await adminPost(`/v1/clusters/${clusterId}/members`,{name:"primary"});
  const primaryKey=x.body.memberKey;
  if(!primaryKey) throw new Error("Primary key missing");

  x=await adminPost(`/v1/clusters/${clusterId}/members`,{name:"standby"});
  const standbyKey=x.body.memberKey;
  if(!standbyKey) throw new Error("Standby key missing");

  x=await memberPost(`/v1/clusters/${clusterId}/lease/acquire`,primaryKey);
  if(!x.r.ok || x.body.lease.fencingToken!==1 || !verifyReceipt(x.body.receipt)) throw new Error("Primary lease failed");
  const firstUntil=x.body.lease.leaseUntil;

  x=await memberPost(`/v1/clusters/${clusterId}/lease/acquire`,primaryKey);
  if(!x.r.ok || x.body.lease.fencingToken!==1 || !verifyReceipt(x.body.receipt)) throw new Error("Primary renew failed");
  if(x.body.lease.leaseUntil<firstUntil) throw new Error("Renew shortened lease");

  x=await memberPost(`/v1/clusters/${clusterId}/lease/acquire`,standbyKey);
  if(x.r.status!==409) throw new Error("Concurrent leader was not blocked");

  await sleep(2300);
  x=await memberPost(`/v1/clusters/${clusterId}/lease/acquire`,standbyKey);
  if(!x.r.ok || x.body.lease.fencingToken!==2 || !verifyReceipt(x.body.receipt)) throw new Error("Standby did not receive higher fencing token");

  x=await memberPost(`/v1/clusters/${clusterId}/lease/acquire`,primaryKey);
  if(x.r.status!==409) throw new Error("Old primary reacquired while standby lease active");

  x=await adminPost(`/v1/clusters/${clusterId}/freeze`,{frozen:true});
  if(!x.r.ok) throw new Error("Freeze failed");

  await sleep(2300);
  x=await memberPost(`/v1/clusters/${clusterId}/lease/acquire`,primaryKey);
  if(x.r.status!==423) throw new Error("Frozen cluster accepted lease acquisition");

  const h=await fetch(`http://127.0.0.1:${port}/health`);
  const health=await h.json();
  if(health.automaticFailover!==false || health.independentFailureDomainRequired!==true) throw new Error("Witness safety flags missing");

  console.log("IZAKHONO WITNESS NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  await sleep(100);
  rmSync(root,{recursive:true,force:true});
}
