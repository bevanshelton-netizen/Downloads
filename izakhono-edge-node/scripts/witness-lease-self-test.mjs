import { createServer } from "node:http";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync,rmSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createWitnessLeaseGuard } from "../witness-lease.mjs";

const root=resolve("./.witness-self-test");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

const {privateKey,publicKey}=generateKeyPairSync("ed25519");
const publicFile=resolve(root,"public.pem");
writeFileSync(publicFile,publicKey.export({type:"spki",format:"pem"}));

const clusterId="cluster-test";
const memberId="member-primary";
const memberKey="member-secret";
let token=7;

const witness=createServer(async(req,res)=>{
  if(req.method!=="POST" || req.url!==`/v1/clusters/${clusterId}/lease/acquire`){
    res.writeHead(404);return res.end();
  }
  if(req.headers["x-witness-member-key"]!==memberKey){
    res.writeHead(401);return res.end();
  }
  const now=Math.floor(Date.now()/1000);
  const body={
    v:1,
    clusterId,
    cluster:"test",
    memberId,
    member:"primary",
    fencingToken:token,
    leaseUntil:now+2,
    issuedAt:now
  };
  const signature=sign(null,Buffer.from(JSON.stringify(body)),privateKey).toString("base64");
  const payload=JSON.stringify({lease:{fencingToken:token,leaseUntil:body.leaseUntil},receipt:{...body,signature,algorithm:"Ed25519"}});
  res.writeHead(200,{"content-type":"application/json","content-length":Buffer.byteLength(payload)});
  res.end(payload);
});
await new Promise(resolvePromise=>witness.listen(0,"127.0.0.1",resolvePromise));
const port=witness.address().port;

process.env.IZAKHONO_WITNESS_MODE="enforce";
process.env.IZAKHONO_WITNESS_URL=`http://127.0.0.1:${port}`;
process.env.IZAKHONO_WITNESS_CLUSTER_ID=clusterId;
process.env.IZAKHONO_WITNESS_MEMBER_ID=memberId;
process.env.IZAKHONO_WITNESS_MEMBER_KEY=memberKey;
process.env.IZAKHONO_WITNESS_PUBLIC_KEY_FILE=publicFile;
process.env.IZAKHONO_WITNESS_RENEW_MS="500";

const guard=createWitnessLeaseGuard("self-test");
await guard.renew();
let state=guard.snapshot();
if(!state.leaseValid || state.fencingToken!==7 || !state.receiptVerified) throw new Error("Valid witness lease was not accepted");
if(!guard.canWrite()) throw new Error("Enforce mode blocked a valid lease");
if(guard.requestHeaders()["x-izakhono-fencing-token"]!=="7") throw new Error("Fencing token header missing");

await new Promise(resolvePromise=>witness.close(resolvePromise));
await new Promise(resolvePromise=>setTimeout(resolvePromise,2300));
state=guard.snapshot();
if(state.leaseValid) throw new Error("Expired witness lease remained valid");
if(guard.canWrite()) throw new Error("Enforce mode did not fail closed after lease expiry");

process.env.IZAKHONO_WITNESS_MODE="observe";
process.env.IZAKHONO_WITNESS_URL="http://127.0.0.1:1";
const observer=createWitnessLeaseGuard("observe-test");
await observer.renew();
if(!observer.canWrite()) throw new Error("Observe mode must never block writes");

delete process.env.IZAKHONO_WITNESS_MEMBER_ID;
process.env.IZAKHONO_WITNESS_MODE="enforce";
process.env.IZAKHONO_WITNESS_URL=`http://127.0.0.1:${port}`;
const bad=createWitnessLeaseGuard("bad-signature-test");
if(bad.canWrite()) throw new Error("Enforce mode must fail closed before a verified lease");

rmSync(root,{recursive:true,force:true});
console.log("WITNESS LEASE GUARD SELF TEST: PASS");
