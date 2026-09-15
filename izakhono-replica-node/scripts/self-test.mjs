
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root=resolve("./.self-test");
const sourceRoot=resolve(root,"backup-archives");
const receiverRoot=resolve(root,"receiver-storage");
const senderPort=19690;
const receiverPort=19691;

const senderAdmin=randomBytes(24).toString("hex");
const senderReceive=randomBytes(32).toString("hex");
const senderEnc=randomBytes(32).toString("base64");
const receiverAdmin=randomBytes(24).toString("hex");
const receiverReceive=randomBytes(32).toString("hex");
const receiverEnc=randomBytes(32).toString("base64");

rmSync(root,{recursive:true,force:true});
mkdirSync(join(sourceRoot,"owned-cloud-core"),{recursive:true});
mkdirSync(receiverRoot,{recursive:true});
const firstBytes=randomBytes(8192);
const firstPath=join(sourceRoot,"owned-cloud-core","snapshot-one.izbk");
writeFileSync(firstPath,firstBytes);

function start(port,env){
  return spawn(process.execPath,["server.mjs"],{
    env:{...process.env,HOST:"127.0.0.1",PORT:String(port),...env},
    stdio:["ignore","pipe","pipe"]
  });
}
const receiver=start(receiverPort,{
  IZAKHONO_REPLICA_DB:resolve(root,"receiver.sqlite"),
  IZAKHONO_REPLICA_ROOT:receiverRoot,
  IZAKHONO_REPLICA_SOURCE_ARCHIVE_ROOT:resolve(root,"receiver-no-source"),
  IZAKHONO_REPLICA_NODE_ID:"recovery-1",
  IZAKHONO_REPLICA_ADMIN_KEY:receiverAdmin,
  IZAKHONO_REPLICA_RECEIVE_KEY:receiverReceive,
  IZAKHONO_REPLICA_ENCRYPTION_KEY:receiverEnc,
  IZAKHONO_REPLICA_TARGET_ALLOWLIST:"127.0.0.1,localhost"
});
const sender=start(senderPort,{
  IZAKHONO_REPLICA_DB:resolve(root,"sender.sqlite"),
  IZAKHONO_REPLICA_ROOT:resolve(root,"sender-received"),
  IZAKHONO_REPLICA_SOURCE_ARCHIVE_ROOT:sourceRoot,
  IZAKHONO_REPLICA_NODE_ID:"primary",
  IZAKHONO_REPLICA_ADMIN_KEY:senderAdmin,
  IZAKHONO_REPLICA_RECEIVE_KEY:senderReceive,
  IZAKHONO_REPLICA_ENCRYPTION_KEY:senderEnc,
  IZAKHONO_REPLICA_TARGET_ALLOWLIST:"127.0.0.1,localhost"
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitHealth(port){
  for(let i=0;i<60;i++){
    await sleep(100);
    try{
      const r=await fetch("http://127.0.0.1:"+port+"/health");
      if(r.ok) return await r.json();
    }catch{}
  }
  throw new Error("Replica node did not become healthy on "+port);
}
async function post(port,path,body,adminKey){
  const r=await fetch("http://127.0.0.1:"+port+path,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-key":adminKey},
    body:JSON.stringify(body||{})
  });
  return {r,body:await r.json()};
}
async function get(port,path,adminKey){
  const r=await fetch("http://127.0.0.1:"+port+path,{headers:{"x-izakhono-key":adminKey}});
  return {r,body:await r.json()};
}
function sha(buf){return createHash("sha256").update(buf).digest("hex");}

try{
  const rh=await waitHealth(receiverPort);
  const sh=await waitHealth(senderPort);
  if(rh.backupRecoveryKeyRequiredForReplication!==false || sh.thirdPartyReplicationRequired!==false){
    throw new Error("Health sovereignty flags mismatch");
  }

  let x=await post(senderPort,"/v1/peers",{
    name:"recovery-1",
    baseUrl:"http://127.0.0.1:"+receiverPort,
    receiveKey:receiverReceive
  },senderAdmin);
  if(!x.r.ok) throw new Error("Peer create failed: "+JSON.stringify(x.body));
  const peerId=x.body.peer.id;

  let listed=await get(senderPort,"/v1/peers",senderAdmin);
  if(!listed.r.ok || listed.body.peers.length!==1) throw new Error("Peer list failed");
  if(JSON.stringify(listed.body).includes(receiverReceive)) throw new Error("Peer receive key leaked through API");

  x=await post(senderPort,"/v1/replicate",{peerId,archivePath:firstPath},senderAdmin);
  if(!x.r.ok || x.body.replication.state!=="complete") throw new Error("First replication failed: "+JSON.stringify(x.body));

  let objects=await get(receiverPort,"/v1/objects",receiverAdmin);
  if(!objects.r.ok || objects.body.objects.length!==1) throw new Error("Receiver object missing");
  const object=objects.body.objects[0];
  if(object.sha256!==sha(firstBytes) || Number(object.size_bytes)!==firstBytes.length) throw new Error("Receiver metadata mismatch");

  const stored=join(receiverRoot,"primary",object.object_key);
  if(!readFileSync(stored).equals(firstBytes)) throw new Error("Receiver bytes mismatch");

  x=await post(receiverPort,"/v1/objects/"+object.id+"/verify",{},receiverAdmin);
  if(!x.r.ok || x.body.verified!==true || x.body.sha256!==sha(firstBytes)) throw new Error("Receiver verify failed");

  x=await post(senderPort,"/v1/replicate",{peerId,archivePath:firstPath},senderAdmin);
  if(!x.r.ok || x.body.replication.state!=="duplicate") throw new Error("Idempotent duplicate failed: "+JSON.stringify(x.body));

  const badBody=randomBytes(16);
  let r=await fetch("http://127.0.0.1:"+receiverPort+"/v1/receive/primary/manual-object",{
    method:"PUT",
    headers:{
      "content-type":"application/octet-stream",
      "content-length":String(badBody.length),
      "x-replica-key":"wrong-key",
      "x-content-sha256":sha(badBody)
    },
    body:badBody
  });
  if(r.status!==401) throw new Error("Bad receive key was accepted");

  const outside=resolve(root,"outside.izbk");
  writeFileSync(outside,randomBytes(32));
  x=await post(senderPort,"/v1/replicate",{peerId,archivePath:outside},senderAdmin);
  if(x.r.status!==400 || x.body.error!=="ARCHIVE_OUTSIDE_SOURCE_ROOT") throw new Error("Source root gate failed: "+JSON.stringify(x.body));

  x=await post(senderPort,"/v1/peers",{
    name:"not-allowed",
    baseUrl:"https://not-allowed.example",
    receiveKey:randomBytes(32).toString("hex")
  },senderAdmin);
  if(x.r.status!==400 || x.body.error!=="PEER_HOST_NOT_ALLOWED") throw new Error("Peer host allowlist failed: "+JSON.stringify(x.body));

  const secondBytes=randomBytes(4096);
  const secondPath=join(sourceRoot,"owned-cloud-core","snapshot-two.izbk");
  writeFileSync(secondPath,secondBytes);
  x=await post(senderPort,"/v1/peers/"+peerId+"/sync",{},senderAdmin);
  if(!x.r.ok || x.body.archives!==2) throw new Error("Peer sync failed: "+JSON.stringify(x.body));
  if(!x.body.results.some(v=>v.path===secondPath && v.state==="complete")) throw new Error("Second archive was not replicated");

  objects=await get(receiverPort,"/v1/objects",receiverAdmin);
  if(objects.body.objects.length!==2) throw new Error("Receiver did not retain two immutable objects");

  const reps=await get(senderPort,"/v1/replications?limit=20",senderAdmin);
  if(!reps.r.ok || !reps.body.replications.some(v=>v.state==="duplicate") || !reps.body.replications.some(v=>v.state==="complete")){
    throw new Error("Replication ledger states missing");
  }

  console.log("IZAKHONO REPLICA NODE SELF TEST: PASS");
}finally{
  sender.kill("SIGTERM");
  receiver.kill("SIGTERM");
  await sleep(200);
  rmSync(root,{recursive:true,force:true});
}
