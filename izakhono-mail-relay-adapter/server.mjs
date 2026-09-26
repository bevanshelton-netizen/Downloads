import { createServer } from "node:http";
import { connect as netConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8845);
const ADAPTER_KEY=process.env.IZAKHONO_MAIL_ADAPTER_KEY||"";
const SMTP_HOST=process.env.IZAKHONO_SMTP_HOST||"";
const SMTP_PORT=Number(process.env.IZAKHONO_SMTP_PORT||587);
const SMTP_SECURE=String(process.env.IZAKHONO_SMTP_SECURE||"false").toLowerCase()==="true";
const SMTP_STARTTLS=String(process.env.IZAKHONO_SMTP_STARTTLS||"true").toLowerCase()!=="false";
const SMTP_USER=process.env.IZAKHONO_SMTP_USER||"";
const SMTP_PASSWORD=process.env.IZAKHONO_SMTP_PASSWORD||"";
const SMTP_FROM=process.env.IZAKHONO_SMTP_FROM||"";
const SMTP_FROM_NAME=(process.env.IZAKHONO_SMTP_FROM_NAME||"IZAKHONO").replace(/[\r\n"]/g," ").trim();
const TIMEOUT_MS=Math.min(60000,Math.max(3000,Number(process.env.IZAKHONO_SMTP_TIMEOUT_MS||15000)));

const senderConfig=JSON.parse(readFileSync(new URL("./sender-identities.json",import.meta.url),"utf8"));
const SENDER_BY_ID=new Map((senderConfig.senders||[]).map(x=>[String(x.id),x]));
const ACTIVE_SENDERS=[...SENDER_BY_ID.values()].filter(x=>x.enabled===true && x.domain_status==="LIVE_VERIFIED");

function safeEqual(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length===y.length&&timingSafeEqual(x,y);}
function json(res,status,body){const p=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(p),"cache-control":"no-store","x-content-type-options":"nosniff"});res.end(p);}
async function readJson(req){let n=0,ch=[];for await(const c of req){n+=c.length;if(n>256*1024)throw new Error("BODY_TOO_LARGE");ch.push(c)}return ch.length?JSON.parse(Buffer.concat(ch).toString("utf8")):{};}
function validEmail(v){return typeof v==="string"&&v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);}
function configured(){return Boolean(SMTP_HOST&&(validEmail(SMTP_FROM)||ACTIVE_SENDERS.length>0));}
function b64(v){return Buffer.from(v,"utf8").toString("base64");}
function headerValue(v){return String(v||"").replace(/[\r\n]+/g," ").slice(0,500);}
function encodedHeader(v){const s=headerValue(v);return /^[\x20-\x7E]*$/.test(s)?s:"=?UTF-8?B?"+b64(s)+"?=";}
function dotStuff(body){return String(body||"").replace(/\r?\n/g,"\r\n").split("\r\n").map(x=>x.startsWith(".")?"."+x:x).join("\r\n");}

function resolveSender(senderId,transactional=false){
  if(senderId){
    const sender=SENDER_BY_ID.get(String(senderId));
    if(!sender)throw new Error("UNKNOWN_SENDER_ID");
    if(sender.enabled!==true || sender.domain_status!=="LIVE_VERIFIED")throw new Error("SENDER_NOT_LIVE");
    const address=transactional?sender.noreply:sender.address;
    if(!validEmail(address))throw new Error("INVALID_SENDER_CONFIG");
    return {id:sender.id,address,name:sender.name};
  }
  if(validEmail(SMTP_FROM))return {id:null,address:SMTP_FROM,name:SMTP_FROM_NAME};
  throw new Error("SENDER_ID_REQUIRED");
}

function makeReplyReader(socket){
  let buffer="",pending=[];
  socket.setEncoding("utf8");
  socket.on("data",chunk=>{buffer+=chunk;drain();});
  socket.on("error",err=>{while(pending.length)pending.shift().reject(err);});
  function drain(){
    while(pending.length){
      const lines=buffer.split("\r\n");
      if(lines.length<2)return;
      let consumed=0,final=-1,code=null;
      for(let i=0;i<lines.length-1;i++){
        const line=lines[i];
        if(!/^\d{3}[ -]/.test(line))continue;
        if(code==null)code=line.slice(0,3);
        consumed+=line.length+2;
        if(line.slice(3,4)===" "){final=i;break;}
      }
      if(final<0)return;
      const raw=buffer.slice(0,consumed);
      buffer=buffer.slice(consumed);
      const item=pending.shift();
      item.resolve({code:Number(code),raw});
    }
  }
  return ()=>new Promise((resolve,reject)=>{pending.push({resolve,reject});drain();});
}
async function command(socket,read,cmd,okCodes){
  if(cmd!=null)socket.write(cmd+"\r\n");
  const reply=await read();
  if(!okCodes.includes(reply.code))throw new Error("SMTP_"+reply.code);
  return reply;
}
function plainSocket(){
  return new Promise((resolve,reject)=>{
    const s=netConnect({host:SMTP_HOST,port:SMTP_PORT});
    const t=setTimeout(()=>{s.destroy();reject(new Error("SMTP_CONNECT_TIMEOUT"));},TIMEOUT_MS);
    s.once("connect",()=>{clearTimeout(t);resolve(s)});s.once("error",reject);
  });
}
function secureSocket(){
  return new Promise((resolve,reject)=>{
    const s=tlsConnect({host:SMTP_HOST,port:SMTP_PORT,servername:SMTP_HOST,rejectUnauthorized:true});
    const t=setTimeout(()=>{s.destroy();reject(new Error("SMTP_TLS_TIMEOUT"));},TIMEOUT_MS);
    s.once("secureConnect",()=>{clearTimeout(t);resolve(s)});s.once("error",reject);
  });
}
async function upgradeTls(socket){
  return new Promise((resolve,reject)=>{
    const s=tlsConnect({socket,servername:SMTP_HOST,rejectUnauthorized:true});
    const t=setTimeout(()=>{s.destroy();reject(new Error("SMTP_STARTTLS_TIMEOUT"));},TIMEOUT_MS);
    s.once("secureConnect",()=>{clearTimeout(t);resolve(s)});s.once("error",reject);
  });
}
async function openSmtpSession(){
  if(!configured())throw new Error("SMTP_NOT_CONFIGURED");
  let socket=SMTP_SECURE?await secureSocket():await plainSocket();
  socket.setTimeout(TIMEOUT_MS,()=>socket.destroy(new Error("SMTP_TIMEOUT")));
  let read=makeReplyReader(socket);
  await command(socket,read,null,[220]);
  await command(socket,read,"EHLO izakhono-mail",[250]);
  if(!SMTP_SECURE&&SMTP_STARTTLS){
    await command(socket,read,"STARTTLS",[220]);
    socket=await upgradeTls(socket);
    socket.setTimeout(TIMEOUT_MS,()=>socket.destroy(new Error("SMTP_TIMEOUT")));
    read=makeReplyReader(socket);
    await command(socket,read,"EHLO izakhono-mail",[250]);
  }
  if(SMTP_USER){
    if(!SMTP_PASSWORD)throw new Error("SMTP_PASSWORD_MISSING");
    await command(socket,read,"AUTH LOGIN",[334]);
    await command(socket,read,b64(SMTP_USER),[334]);
    await command(socket,read,b64(SMTP_PASSWORD),[235]);
  }
  return {socket,read};
}
async function probeSmtp(){
  const {socket,read}=await openSmtpSession();
  try{await command(socket,read,"QUIT",[221]).catch(()=>null);return {ready:true};}
  finally{socket.destroy();}
}

async function sendMail({to,subject,body,senderId,transactional=false}){
  if(!configured())throw new Error("SMTP_NOT_CONFIGURED");
  if(!validEmail(to))throw new Error("INVALID_RECIPIENT");
  const sender=resolveSender(senderId,transactional);
  const session=await openSmtpSession();
  const socket=session.socket,read=session.read;
  try{
    await command(socket,read,"MAIL FROM:<"+sender.address+">",[250]);
    await command(socket,read,"RCPT TO:<"+to+">",[250,251]);
    await command(socket,read,"DATA",[354]);
    const message=[
      "From: "+(sender.name?encodedHeader(sender.name)+" ":"")+"<"+sender.address+">",
      "To: <"+to+">",
      "Subject: "+encodedHeader(subject||sender.name||"IZAKHONO"),
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "Date: "+new Date().toUTCString(),
      "",
      dotStuff(body),
      "."
    ].join("\r\n");
    socket.write(message+"\r\n");
    const accepted=await read();
    if(accepted.code!==250)throw new Error("SMTP_"+accepted.code);
    await command(socket,read,"QUIT",[221]).catch(()=>null);
    return {accepted:true,senderId:sender.id};
  }finally{socket.destroy();}
}

createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||"/","http://localhost");
    if(req.method==="GET"&&u.pathname==="/health")return json(res,200,{service:"IZAKHONO MAIL RELAY ADAPTER",status:"healthy",configured:configured(),smtpSecure:SMTP_SECURE,starttls:SMTP_STARTTLS,senderIdentities:SENDER_BY_ID.size,activeSenderIdentities:ACTIVE_SENDERS.length,tracking:false,messagePersistence:false});
    if(!ADAPTER_KEY||!safeEqual(req.headers["x-izakhono-adapter-key"],ADAPTER_KEY))return json(res,401,{error:"Unauthorized"});
    if(req.method==="POST"&&u.pathname==="/v1/probe"){
      const result=await probeSmtp();
      return json(res,200,result);
    }
    if(req.method==="POST"&&u.pathname==="/v1/send"){
      const payload=await readJson(req);
      if(payload?.channel!=="email")return json(res,400,{error:"Email channel required"});
      if(payload.from||payload.fromName)return json(res,400,{error:"ARBITRARY_FROM_NOT_ALLOWED"});
      const sent=await sendMail({
        to:String(payload.to||""),
        subject:String(payload.subject||""),
        body:String(payload.body||""),
        senderId:payload.senderId==null?null:String(payload.senderId),
        transactional:Boolean(payload.transactional)
      });
      return json(res,202,{accepted:true,messageId:payload.messageId||null,senderId:sent.senderId});
    }
    return json(res,404,{error:"Not found"});
  }catch(e){
    const m=String(e?.message||e);
    const status=m==="BODY_TOO_LARGE"?413:["INVALID_RECIPIENT","UNKNOWN_SENDER_ID","SENDER_ID_REQUIRED","INVALID_SENDER_CONFIG","ARBITRARY_FROM_NOT_ALLOWED"].includes(m)?400:m==="SENDER_NOT_LIVE"?409:m==="SMTP_NOT_CONFIGURED"?503:502;
    console.error("mail relay",m);
    return json(res,status,{error:m});
  }
}).listen(PORT,HOST,()=>{
  console.log(`IZAKHONO MAIL RELAY ADAPTER listening on http://${HOST}:${PORT}`);
  console.log(`Loaded ${SENDER_BY_ID.size} platform sender identities; ${ACTIVE_SENDERS.length} LIVE_VERIFIED.`);
  if(!ADAPTER_KEY)console.warn("WARNING: IZAKHONO_MAIL_ADAPTER_KEY missing.");
});
