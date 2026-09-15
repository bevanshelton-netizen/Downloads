
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes, createHmac } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const port=19660;
const hookPort=19661;
const admin=randomBytes(24).toString("hex");
const enc=randomBytes(32).toString("base64");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

let hookRaw=null;
let hookHeaders=null;
const hookServer=createServer(async(req,res)=>{
  const chunks=[];
  for await(const c of req) chunks.push(c);
  hookHeaders=req.headers;
  hookRaw=Buffer.concat(chunks).toString("utf8");
  res.writeHead(204);
  res.end();
});
await new Promise(resolve=>hookServer.listen(hookPort,"127.0.0.1",resolve));

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    HOST:"127.0.0.1",
    PORT:String(port),
    IZAKHONO_CODE_DB:resolve(root,"code.sqlite"),
    IZAKHONO_CODE_REPO_ROOT:resolve(root,"repos"),
    IZAKHONO_CODE_ADMIN_KEY:admin,
    IZAKHONO_CODE_ENCRYPTION_KEY:enc,
    IZAKHONO_CODE_WEBHOOK_ALLOWLIST:"127.0.0.1,localhost"
  },
  stdio:["ignore","pipe","pipe"]
});

let childErr="";
child.stderr.on("data",c=>childErr+=c.toString("utf8"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const adminHeaders={"x-izakhono-key":admin,"content-type":"application/json"};

async function waitHealth(){
  for(let i=0;i<50;i++){
    await sleep(100);
    try{
      const r=await fetch("http://127.0.0.1:"+port+"/health");
      if(r.ok) return;
    }catch{}
  }
  throw new Error("Code node did not become healthy: "+childErr);
}
async function adminPost(path,body){
  const r=await fetch("http://127.0.0.1:"+port+path,{
    method:"POST",
    headers:adminHeaders,
    body:JSON.stringify(body)
  });
  const payload=await r.json();
  if(!r.ok) throw new Error(path+" failed "+r.status+": "+JSON.stringify(payload));
  return payload;
}
function git(args,cwd){
  return execFileSync("git",args,{cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
function basic(token){
  return Buffer.from("git:"+token).toString("base64");
}

try{
  await waitHealth();

  const created=await adminPost("/v1/repos",{
    slug:"demo-repo",
    description:"CODE NODE self-test",
    publicRead:false
  });
  if(created.repository.slug!=="demo-repo") throw new Error("Repo create mismatch");

  const writer=await adminPost("/v1/repos/demo-repo/tokens",{scope:"write",label:"ci-writer"});
  const reader=await adminPost("/v1/repos/demo-repo/tokens",{scope:"read",label:"clone-reader"});
  if(!writer.value || !reader.value) throw new Error("Token creation failed");

  const webhook=await adminPost("/v1/repos/demo-repo/webhooks",{
    url:"http://127.0.0.1:"+hookPort+"/push"
  });
  if(!webhook.secret) throw new Error("Webhook secret missing");

  let r=await fetch("http://127.0.0.1:"+port+"/git/demo-repo.git/info/refs?service=git-upload-pack");
  if(r.status!==401) throw new Error("Private repo allowed anonymous read");

  const work=resolve(root,"work");
  mkdirSync(work,{recursive:true});
  git(["init","--initial-branch=main"],work);
  git(["config","user.name","IZAKHONO Test"],work);
  git(["config","user.email","code-node@example.test"],work);
  writeFileSync(resolve(work,"README.md"),"# CODE NODE\n");
  git(["add","README.md"],work);
  git(["commit","-m","Initial commit"],work);

  const remote="http://127.0.0.1:"+port+"/git/demo-repo.git";
  git(["-c","http.extraHeader=Authorization: Basic "+basic(writer.value),"push",remote,"main"],work);

  for(let i=0;i<40 && !hookRaw;i++) await sleep(100);
  if(!hookRaw) throw new Error("Push webhook missing");
  const hookEvent=JSON.parse(hookRaw);
  if(hookEvent.event!=="push" || hookEvent.repository?.slug!=="demo-repo") throw new Error("Push webhook payload mismatch");
  const expected="sha256="+createHmac("sha256",webhook.secret).update(hookRaw).digest("hex");
  if(hookHeaders["x-izakhono-signature"]!==expected) throw new Error("Webhook signature mismatch");

  const clone=resolve(root,"clone");
  git(["-c","http.extraHeader=Authorization: Basic "+basic(reader.value),"clone",remote,clone],root);
  if(readFileSync(resolve(clone,"README.md"),"utf8")!=="# CODE NODE\n") throw new Error("Clone contents mismatch");

  r=await fetch("http://127.0.0.1:"+port+"/v1/repos/demo-repo/refs",{
    headers:{"x-izakhono-key":admin}
  });
  let payload=await r.json();
  if(!r.ok || !payload.refs.some(x=>x.ref==="refs/heads/main")) throw new Error("Refs API failed");

  r=await fetch("http://127.0.0.1:"+port+"/v1/repos/demo-repo/commits?ref=main",{
    headers:{"x-izakhono-key":admin}
  });
  payload=await r.json();
  if(!r.ok || payload.commits[0]?.subject!=="Initial commit") throw new Error("Commits API failed");

  const revoked=await adminPost("/v1/repos/demo-repo/tokens/"+reader.token.id+"/revoke",{});
  if(!revoked.revoked) throw new Error("Token revoke failed");

  r=await fetch("http://127.0.0.1:"+port+"/git/demo-repo.git/info/refs?service=git-upload-pack",{
    headers:{authorization:"Basic "+basic(reader.value)}
  });
  if(r.status!==401) throw new Error("Revoked token still worked");

  r=await fetch("http://127.0.0.1:"+port+"/v1/audit",{
    headers:{"x-izakhono-key":admin}
  });
  payload=await r.json();
  if(!r.ok || !payload.entries.some(x=>x.action==="repo.refs.update")) throw new Error("Push audit missing");

  console.log("IZAKHONO CODE NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  hookServer.close();
  await sleep(150);
  rmSync(root,{recursive:true,force:true});
}
