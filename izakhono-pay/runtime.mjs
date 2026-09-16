import { spawn } from "node:child_process";
import process from "node:process";

const host=process.env.HOST || "127.0.0.1";
const port=Number(process.env.PORT || 18100);

if(host!=="127.0.0.1" && host!=="localhost"){
  throw new Error("IZAKHONO PAY runtime wrapper refuses non-loopback bind");
}
if(!Number.isInteger(port) || port<1024 || port>65535){
  throw new Error("Invalid IZAKHONO PAY runtime port");
}

const child=spawn("python3",[
  "shared_gateway.py",
  "serve",
  "--host","127.0.0.1",
  "--port",String(port)
],{
  cwd:new URL(".",import.meta.url).pathname,
  env:{...process.env},
  stdio:"inherit"
});

function stop(signal){
  if(!child.killed) child.kill(signal);
}

for(const signal of ["SIGTERM","SIGINT"]){
  process.on(signal,()=>stop(signal));
}

child.on("exit",(code,signal)=>{
  if(signal) process.kill(process.pid,signal);
  process.exit(code ?? 1);
});
