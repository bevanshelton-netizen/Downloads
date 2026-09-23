import { createServer as createTcpServer } from "node:net";
import { spawn } from "node:child_process";

const smtpPort=19870,adapterPort=19871,key="adapter-test";
let message="",inData=false;
const smtp=createTcpServer(socket=>{
  socket.setEncoding("utf8");socket.write("220 smtp.test ESMTP\r\n");
  let buffer="";
  socket.on("data",chunk=>{
    buffer+=chunk;
    while(buffer.includes("\r\n")){
      const i=buffer.indexOf("\r\n"),line=buffer.slice(0,i);buffer=buffer.slice(i+2);
      if(inData){
        if(line==="."){inData=false;socket.write("250 2.0.0 queued\r\n");}
        else message+=line+"\n";
        continue;
      }
      if(/^EHLO /.test(line))socket.write("250 smtp.test\r\n");
      else if(/^MAIL FROM:/.test(line))socket.write("250 ok\r\n");
      else if(/^RCPT TO:/.test(line))socket.write("250 ok\r\n");
      else if(line==="DATA"){inData=true;socket.write("354 end with dot\r\n");}
      else if(line==="QUIT"){socket.write("221 bye\r\n");socket.end();}
      else socket.write("250 ok\r\n");
    }
  });
});
await new Promise(r=>smtp.listen(smtpPort,"127.0.0.1",r));

const child=spawn(process.execPath,["server.mjs"],{
  cwd:new URL("..",import.meta.url).pathname,
  env:{...process.env,HOST:"127.0.0.1",PORT:String(adapterPort),IZAKHONO_MAIL_ADAPTER_KEY:key,IZAKHONO_SMTP_HOST:"127.0.0.1",IZAKHONO_SMTP_PORT:String(smtpPort),IZAKHONO_SMTP_STARTTLS:"false",IZAKHONO_SMTP_FROM:"no-reply@izakhono.test",IZAKHONO_SMTP_FROM_NAME:"IZAKHONO ONE"},
  stdio:["ignore","pipe","pipe"]
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<30;i++){try{const r=await fetch(`http://127.0.0.1:${adapterPort}/health`);if(r.ok)break}catch{}await sleep(100)}
try{
  let r=await fetch(`http://127.0.0.1:${adapterPort}/health`);let h=await r.json();if(!r.ok||h.configured!==true)throw new Error("health/config failed");
  r=await fetch(`http://127.0.0.1:${adapterPort}/v1/probe`,{method:"POST",headers:{"content-type":"application/json","x-izakhono-adapter-key":key},body:"{}"});let probe=await r.json();if(!r.ok||probe.ready!==true)throw new Error("SMTP probe failed");
  r=await fetch(`http://127.0.0.1:${adapterPort}/v1/send`,{method:"POST",headers:{"content-type":"application/json","x-izakhono-adapter-key":key},body:JSON.stringify({messageId:"m1",recipientRef:"u1",channel:"email",to:"person@example.com",subject:"Verify IZAKHONO",body:"Hello\n.Link"})});
  const j=await r.json();if(r.status!==202||j.accepted!==true)throw new Error("send failed "+JSON.stringify(j));
  await sleep(100);
  if(!message.includes("To: <person@example.com>")||!message.includes("Subject: Verify IZAKHONO")||!message.includes("..Link"))throw new Error("SMTP payload mismatch");
  r=await fetch(`http://127.0.0.1:${adapterPort}/v1/send`,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});if(r.status!==401)throw new Error("adapter auth failed closed");
  console.log("IZAKHONO MAIL RELAY ADAPTER self-test passed.");
}finally{child.kill("SIGTERM");smtp.close();await sleep(100)}
