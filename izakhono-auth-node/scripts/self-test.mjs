import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync,rmSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const port=19620;
const bootstrap=randomBytes(24).toString("hex");
const enc=randomBytes(32).toString("base64");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    HOST:"127.0.0.1",
    PORT:String(port),
    IZAKHONO_AUTH_DB:resolve(root,"auth.sqlite"),
    IZAKHONO_AUTH_BOOTSTRAP_KEY:bootstrap,
    IZAKHONO_AUTH_ENCRYPTION_KEY:enc,
    IZAKHONO_AUTH_LOGIN_LIMIT_PER_MIN:"20",
    IZAKHONO_AUTH_LOCK_AFTER:"5"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function decodeBase32(input){
  let bits=0,value=0;const out=[];
  for(const ch of input){
    const i=B32.indexOf(ch);
    if(i<0) throw new Error("bad base32");
    value=(value<<5)|i;bits+=5;
    if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}
  }
  return Buffer.from(out);
}
function totp(secret){
  const counter=Math.floor(Date.now()/30000);
  const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(counter));
  const h=createHmac("sha1",decodeBase32(secret)).update(b).digest();
  const o=h[h.length-1]&15;
  const n=((h[o]&0x7f)<<24)|((h[o+1]&255)<<16)|((h[o+2]&255)<<8)|(h[o+3]&255);
  return String(n%1000000).padStart(6,"0");
}

async function waitHealth(){
  for(let i=0;i<40;i++){
    await sleep(120);
    try{const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok)return;}catch{}
  }
  throw new Error("Auth node did not become healthy");
}
async function post(path,body,headers={}){
  const r=await fetch(`http://127.0.0.1:${port}${path}`,{
    method:"POST",
    headers:{"content-type":"application/json",...headers},
    body:JSON.stringify(body)
  });
  return {r,body:await r.json()};
}

try{
  await waitHealth();

  let x=await post("/v1/bootstrap",{
    email:"owner@example.com",displayName:"Owner",password:"correct horse battery staple"
  },{"x-bootstrap-key":bootstrap});
  if(x.r.status!==201 || !x.body.user.permissions.includes("auth.admin")) throw new Error("Bootstrap failed");

  x=await post("/v1/bootstrap",{
    email:"second@example.com",password:"another secure password"
  },{"x-bootstrap-key":bootstrap});
  if(x.r.status!==409) throw new Error("Bootstrap single-use gate failed");

  x=await post("/v1/login",{email:"owner@example.com",password:"wrong-password-000"});
  if(x.r.status!==401) throw new Error("Wrong password was accepted");

  x=await post("/v1/login",{email:"owner@example.com",password:"correct horse battery staple"});
  if(!x.r.ok || !x.body.token) throw new Error("Login failed");
  let token=x.body.token;

  let r=await fetch(`http://127.0.0.1:${port}/v1/me`,{headers:{authorization:"Bearer "+token}});
  let me=await r.json();
  if(!r.ok || me.user.email!=="owner@example.com") throw new Error("Session lookup failed");

  x=await post("/v1/admin/roles",{name:"marketer",description:"Marketing team"},{authorization:"Bearer "+token});
  if(!x.r.ok) throw new Error("Role create failed");
  x=await post("/v1/admin/permissions",{code:"campaign.read"},{authorization:"Bearer "+token});
  if(!x.r.ok) throw new Error("Permission create failed");
  x=await post("/v1/admin/roles/marketer/permissions",{permission:"campaign.read"},{authorization:"Bearer "+token});
  if(!x.r.ok) throw new Error("Role permission failed");

  x=await post("/v1/admin/users",{
    email:"marketer@example.com",displayName:"Marketer",password:"marketing password 1234"
  },{authorization:"Bearer "+token});
  if(!x.r.ok) throw new Error("User create failed");
  const marketerId=x.body.user.id;
  x=await post(`/v1/admin/users/${marketerId}/roles`,{role:"marketer"},{authorization:"Bearer "+token});
  if(!x.r.ok) throw new Error("User role failed");

  x=await post("/v1/mfa/setup",{}, {authorization:"Bearer "+token});
  if(!x.r.ok || !x.body.secret) throw new Error("MFA setup failed");
  const secret=x.body.secret;
  x=await post("/v1/mfa/enable",{code:totp(secret)},{authorization:"Bearer "+token});
  if(!x.r.ok) throw new Error("MFA enable failed");

  await post("/v1/logout",{}, {authorization:"Bearer "+token});
  r=await fetch(`http://127.0.0.1:${port}/v1/me`,{headers:{authorization:"Bearer "+token}});
  if(r.status!==401) throw new Error("Logout/session revocation failed");

  x=await post("/v1/login",{email:"owner@example.com",password:"correct horse battery staple"});
  if(x.r.status!==401 || x.body.code!=="MFA_REQUIRED") throw new Error("MFA login gate failed");
  x=await post("/v1/login",{email:"owner@example.com",password:"correct horse battery staple",totp:totp(secret)});
  if(!x.r.ok) throw new Error("MFA login failed");
  token=x.body.token;

  x=await post("/v1/admin/service-accounts",{
    name:"growth-os",permissions:["growth.read","growth.write"]
  },{authorization:"Bearer "+token});
  if(!x.r.ok || !x.body.apiKey) throw new Error("Service account create failed");

  r=await fetch(`http://127.0.0.1:${port}/v1/service/whoami`,{headers:{"x-api-key":x.body.apiKey}});
  const svc=await r.json();
  if(!r.ok || svc.service.name!=="growth-os") throw new Error("Service API key failed");

  console.log("IZAKHONO AUTH NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  await sleep(150);
  rmSync(root,{recursive:true,force:true});
}
