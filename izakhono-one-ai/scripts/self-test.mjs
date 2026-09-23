import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const usage=resolve("./.self-test-one.sqlite");
rmSync(usage,{force:true});

const authPort=18971,gatewayPort=18972,onePort=18970;
const sessions=new Map();
const users=new Map();

function json(res,status,body,headers={}){
  const p=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json",...headers});res.end(p);
}
async function body(req){let s="";for await(const c of req)s+=c;return s?JSON.parse(s):{};}

const authServer=createServer(async(req,res)=>{
  const u=new URL(req.url,"http://localhost");
  const b=req.method==="POST"?await body(req):{};
  if(req.method==="POST"&&u.pathname==="/v1/register"){
    users.set(b.email,{id:"user-1",email:b.email,displayName:b.displayName,emailVerified:true,permissions:["one.ai.chat"],roles:["member"]});
    return json(res,201,{registered:true,requiresVerification:false,user:users.get(b.email)});
  }
  if(req.method==="POST"&&u.pathname==="/v1/login"){
    const user=users.get(b.email);if(!user)return json(res,401,{error:"Invalid credentials"});
    sessions.set("auth-token",user);return json(res,200,{token:"auth-token",expiresInSeconds:43200,user});
  }
  if(req.method==="GET"&&u.pathname==="/v1/me"){
    const token=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
    const user=sessions.get(token);return user?json(res,200,{user,session:{id:"s1"}}):json(res,401,{error:"Authentication required"});
  }
  if(req.method==="POST"&&u.pathname==="/v1/logout")return json(res,200,{loggedOut:true});
  if(req.method==="POST"&&u.pathname==="/v1/verify-email")return json(res,200,{verified:true});
  if(req.method==="POST"&&u.pathname==="/v1/recovery/request")return json(res,202,{accepted:true});
  if(req.method==="POST"&&u.pathname==="/v1/recovery/reset")return json(res,200,{reset:true});
  return json(res,404,{error:"not found"});
}).listen(authPort,"127.0.0.1");

const gatewayServer=createServer(async(req,res)=>{
  const u=new URL(req.url,"http://localhost");
  if(req.method==="POST"&&u.pathname==="/v1/chat/completions"){
    const b=await body(req);
    return json(res,200,{id:"chat-test",object:"chat.completion",model:b.model,choices:[{index:0,message:{role:"assistant",content:"owned one ai ok"},finish_reason:"stop"}],usage:{prompt_tokens:5,completion_tokens:4,total_tokens:9}});
  }
  return json(res,404,{error:"not found"});
}).listen(gatewayPort,"127.0.0.1");

const child=spawn(process.execPath,["server.mjs"],{
  cwd:new URL("..",import.meta.url).pathname,
  env:{
    ...process.env,HOST:"127.0.0.1",PORT:String(onePort),
    IZAKHONO_ONE_AI_KEY:"test-service-key",
    IZAKHONO_ONE_AI_GATEWAY_URL:`http://127.0.0.1:${gatewayPort}`,
    IZAKHONO_ONE_AI_GATEWAY_KEY:"test-gateway-key",
    IZAKHONO_ONE_AUTH_URL:`http://127.0.0.1:${authPort}`,
    IZAKHONO_ONE_USAGE_DB:usage,
    IZAKHONO_ONE_FREE_DAILY_REQUESTS:"0"
  }
});

const wait=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${onePort}/health`);if(r.ok)break}catch{}await wait(100)}

try{
  let r=await fetch(`http://127.0.0.1:${onePort}/`);
  const html=await r.text();
  if(!r.ok||!html.includes("IZAKHONO ONE")||!html.includes("ONE AI CHAT"))throw new Error("launchpad failed");

  r=await fetch(`http://127.0.0.1:${onePort}/v1/account/register`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:"Public User",email:"public@example.com",password:"strong password 12345"})});
  if(r.status!==201)throw new Error("account register proxy failed: "+await r.text());

  r=await fetch(`http://127.0.0.1:${onePort}/v1/account/login`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"public@example.com",password:"strong password 12345"})});
  const login=await r.json();if(!r.ok||!login.user)throw new Error("account login proxy failed");
  const setCookie=r.headers.get("set-cookie");if(!setCookie?.includes("izakhono_one_session=")||!setCookie.includes("HttpOnly"))throw new Error("secure session cookie missing");
  const cookie=setCookie.split(";")[0];

  r=await fetch(`http://127.0.0.1:${onePort}/v1/account/me`,{headers:{cookie}});
  const me=await r.json();if(!r.ok||me.user.email!=="public@example.com"||me.entitlement.fairUse!==true)throw new Error("account/entitlement lookup failed");

  r=await fetch(`http://127.0.0.1:${onePort}/v1/one/chat`,{method:"POST",headers:{"content-type":"application/json",cookie},body:JSON.stringify({messages:[{role:"user",content:"hello"}]})});
  const chat=await r.json();if(!r.ok||chat.choices?.[0]?.message?.content!=="owned one ai ok")throw new Error("public chat failed");
  if(chat.entitlement?.usage?.requests!==1)throw new Error("usage accounting failed");

  r=await fetch(`http://127.0.0.1:${onePort}/v1/one/chat`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:[{role:"user",content:"hello"}]})});
  if(r.status!==401)throw new Error("anonymous chat did not fail closed");

  r=await fetch(`http://127.0.0.1:${onePort}/v1/plan`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({request:"test"})});
  if(r.status!==401)throw new Error("internal protected endpoint did not fail closed");

  console.log("IZAKHONO ONE public account + chat self-test passed.");
}finally{
  child.kill("SIGTERM");
  authServer.close();gatewayServer.close();
  await wait(100);
  rmSync(usage,{force:true});
}
