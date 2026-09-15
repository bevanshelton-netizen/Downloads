
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const queuePort=19680;
const codePort=19681;
const ciPort=19682;
const queueKey=randomBytes(24).toString("hex");
const codeAdmin=randomBytes(24).toString("hex");
const codeEnc=randomBytes(32).toString("base64");
const ciAdmin=randomBytes(24).toString("hex");
const ciEnc=randomBytes(32).toString("base64");
const webhookSecret="ci-webhook-"+randomBytes(20).toString("hex");

rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

const queue=spawn(process.execPath,["../izakhono-queue-node/server.mjs"],{
  env:{
    ...process.env,HOST:"127.0.0.1",PORT:String(queuePort),
    IZAKHONO_QUEUE_KEY:queueKey,
    IZAKHONO_QUEUE_DB:resolve(root,"queue.sqlite")
  },
  stdio:["ignore","pipe","pipe"]
});

const code=spawn(process.execPath,["../izakhono-code-node/server.mjs"],{
  env:{
    ...process.env,HOST:"127.0.0.1",PORT:String(codePort),
    IZAKHONO_CODE_DB:resolve(root,"code.sqlite"),
    IZAKHONO_CODE_REPO_ROOT:resolve(root,"repos"),
    IZAKHONO_CODE_ADMIN_KEY:codeAdmin,
    IZAKHONO_CODE_ENCRYPTION_KEY:codeEnc,
    IZAKHONO_CODE_WEBHOOK_ALLOWLIST:"127.0.0.1,localhost"
  },
  stdio:["ignore","pipe","pipe"]
});

const ci=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    NODE_ENV:"test",
    HOST:"127.0.0.1",PORT:String(ciPort),
    IZAKHONO_CI_DB:resolve(root,"ci.sqlite"),
    IZAKHONO_CI_WORKSPACE_ROOT:resolve(root,"workspaces"),
    IZAKHONO_CI_LOG_ROOT:resolve(root,"logs"),
    IZAKHONO_CI_ADMIN_KEY:ciAdmin,
    IZAKHONO_CI_ENCRYPTION_KEY:ciEnc,
    IZAKHONO_QUEUE_URL:"http://127.0.0.1:"+queuePort,
    IZAKHONO_QUEUE_KEY:queueKey,
    IZAKHONO_CODE_GIT_BASE:"http://127.0.0.1:"+codePort+"/git",
    IZAKHONO_CI_EXECUTOR:"direct-test",
    IZAKHONO_CI_ALLOW_INSECURE_TEST_EXECUTOR:"YES_I_UNDERSTAND",
    IZAKHONO_CI_POLL_MS:"60",
    IZAKHONO_CI_COMMAND_ALLOWLIST:"node,npm"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(url){
  for(let i=0;i<70;i++){
    await sleep(100);
    try{const r=await fetch(url);if(r.ok)return;}catch{}
  }
  throw new Error("Service not healthy: "+url);
}
function git(args,cwd){
  return execFileSync("git",args,{cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
function basic(token){return Buffer.from("git:"+token).toString("base64");}
async function post(base,path,body,headers={}){
  const r=await fetch(base+path,{
    method:"POST",
    headers:{"content-type":"application/json",...headers},
    body:JSON.stringify(body)
  });
  return {r,body:await r.json()};
}
async function waitRun(id,state){
  for(let i=0;i<100;i++){
    await sleep(100);
    const r=await fetch("http://127.0.0.1:"+ciPort+"/v1/runs/"+id,{
      headers:{"x-izakhono-key":ciAdmin}
    });
    const body=await r.json();
    if(body.run?.state===state) return body;
    if(["failed","infra_failed","cancelled"].includes(body.run?.state) && body.run.state!==state){
      throw new Error("Run ended "+body.run.state+": "+JSON.stringify(body));
    }
  }
  throw new Error("Run did not reach "+state);
}

try{
  await wait("http://127.0.0.1:"+queuePort+"/health");
  await wait("http://127.0.0.1:"+codePort+"/health");
  await wait("http://127.0.0.1:"+ciPort+"/health");

  let x=await post("http://127.0.0.1:"+codePort,"/v1/repos",{
    slug:"ci-demo",description:"CI WORKER self-test"
  },{"x-izakhono-key":codeAdmin});
  if(!x.r.ok) throw new Error("Repo create failed: "+JSON.stringify(x.body));

  x=await post("http://127.0.0.1:"+codePort,"/v1/repos/ci-demo/tokens",{
    scope:"write",label:"test-writer"
  },{"x-izakhono-key":codeAdmin});
  const writer=x.body.value;
  x=await post("http://127.0.0.1:"+codePort,"/v1/repos/ci-demo/tokens",{
    scope:"read",label:"ci-reader"
  },{"x-izakhono-key":codeAdmin});
  const reader=x.body.value;
  if(!writer || !reader) throw new Error("CODE tokens missing");

  const work=resolve(root,"source");
  mkdirSync(work,{recursive:true});
  git(["init","--initial-branch=main"],work);
  git(["config","user.name","IZAKHONO CI Test"],work);
  git(["config","user.email","ci@example.test"],work);

  writeFileSync(resolve(work,"test.mjs"),`
const forbidden=["IZAKHONO_QUEUE_KEY","IZAKHONO_CODE_ADMIN_KEY","IZAKHONO_CI_ADMIN_KEY","IZAKHONO_CI_ENCRYPTION_KEY"];
for(const key of forbidden){
  if(process.env[key]) throw new Error("secret inherited: "+key);
}
console.log("CI_REPO_TEST_PASS");
`);
  git(["add","test.mjs"],work);
  git(["commit","-m","CI test one"],work);
  const firstSha=git(["rev-parse","HEAD"],work);
  const remote="http://127.0.0.1:"+codePort+"/git/ci-demo.git";
  git(["-c","http.extraHeader=Authorization: Basic "+basic(writer),"push",remote,"main"],work);

  x=await post("http://127.0.0.1:"+ciPort,"/v1/pipelines",{
    name:"ci-demo-main",
    repoSlug:"ci-demo",
    repoToken:reader,
    ref:"main",
    steps:[["node","test.mjs"]],
    network:false,
    webhookSecret
  },{"x-izakhono-key":ciAdmin});
  if(!x.r.ok) throw new Error("Pipeline create failed: "+JSON.stringify(x.body));
  const pipelineId=x.body.pipeline.id;

  x=await post("http://127.0.0.1:"+ciPort,"/v1/pipelines/"+pipelineId+"/run",{
    sha:firstSha
  },{"x-izakhono-key":ciAdmin});
  if(x.r.status!==202) throw new Error("Manual run enqueue failed: "+JSON.stringify(x.body));
  const firstRun=x.body.run.id;
  const result1=await waitRun(firstRun,"success");
  if(result1.steps[0]?.state!=="success") throw new Error("First build step not successful");

  let r=await fetch("http://127.0.0.1:"+ciPort+"/v1/runs/"+firstRun+"/log",{
    headers:{"x-izakhono-key":ciAdmin}
  });
  let log=await r.json();
  if(!r.ok || !log.log.includes("CI_REPO_TEST_PASS")) throw new Error("Build log missing proof");
  for(const secret of [reader,writer,queueKey,ciAdmin,codeAdmin]){
    if(log.log.includes(secret)) throw new Error("Secret leaked into CI log");
  }

  x=await post("http://127.0.0.1:"+ciPort,"/v1/pipelines",{
    name:"bad-pipeline",
    repoSlug:"ci-demo",
    repoToken:reader,
    ref:"main",
    steps:[["bash","-c","echo unsafe"]]
  },{"x-izakhono-key":ciAdmin});
  if(x.r.status!==400 || x.body.error!=="COMMAND_NOT_ALLOWED") throw new Error("Command allowlist failed");

  writeFileSync(resolve(work,"second.txt"),"second\n");
  git(["add","second.txt"],work);
  git(["commit","-m","CI test two"],work);
  const secondSha=git(["rev-parse","HEAD"],work);
  git(["-c","http.extraHeader=Authorization: Basic "+basic(writer),"push",remote,"main"],work);

  const webhookBody=JSON.stringify({
    event:"push",
    repository:{slug:"ci-demo"},
    changes:[{ref:"refs/heads/main",oldOid:firstSha,newOid:secondSha}],
    occurredAt:new Date().toISOString()
  });
  let wr=await fetch("http://127.0.0.1:"+ciPort+"/v1/webhooks/code/"+pipelineId,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-signature":"sha256=bad"},
    body:webhookBody
  });
  if(wr.status!==401) throw new Error("Bad webhook signature accepted");

  const signature="sha256="+createHmac("sha256",webhookSecret).update(webhookBody).digest("hex");
  wr=await fetch("http://127.0.0.1:"+ciPort+"/v1/webhooks/code/"+pipelineId,{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-signature":signature},
    body:webhookBody
  });
  const wb=await wr.json();
  if(wr.status!==202 || !wb.accepted || !wb.runId) throw new Error("Signed webhook enqueue failed: "+JSON.stringify(wb));
  await waitRun(wb.runId,"success");

  const health=await fetch("http://127.0.0.1:"+ciPort+"/health").then(r=>r.json());
  if(health.executor!=="direct-test" || health.thirdPartyCIRequired!==false) throw new Error("CI health mismatch");

  console.log("IZAKHONO CI WORKER NODE SELF TEST: PASS");
}finally{
  ci.kill("SIGTERM");
  code.kill("SIGTERM");
  queue.kill("SIGTERM");
  await sleep(200);
  rmSync(root,{recursive:true,force:true});
}
