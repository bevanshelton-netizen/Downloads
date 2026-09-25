import http from "node:http";

const HOST=process.env.HOST || "127.0.0.1";
const PORT=Number(process.env.PORT || 18092);
const UPSTREAM_HOST=process.env.IZAKHONO_COMMAND_GATEWAY_HOST || "127.0.0.1";
const UPSTREAM_PORT=Number(process.env.IZAKHONO_COMMAND_GATEWAY_PORT || 8091);

function send(res,status,body,headers={}){
  const payload=Buffer.from(body);
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "content-length":payload.length,
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    ...headers
  });
  res.end(payload);
}

async function health(res){
  try{
    const r=await fetch(`http://${UPSTREAM_HOST}:${UPSTREAM_PORT}/healthz`,{signal:AbortSignal.timeout(2500),cache:"no-store"});
    const text=await r.text();
    if(!r.ok) return send(res,503,JSON.stringify({ok:false,service:"izakhono-command-centre-edge",gateway_status:r.status}));
    let gateway={}; try{gateway=JSON.parse(text)}catch{}
    return send(res,200,JSON.stringify({
      ok:true,
      service:"izakhono-command-centre-edge",
      runtime:"izakhono-owned",
      gateway:"ready",
      authority:gateway.authority || "IZAKHONO CONTROL -> NODE",
      external_resilience:gateway.external_resilience || null
    }));
  }catch(error){
    return send(res,503,JSON.stringify({ok:false,service:"izakhono-command-centre-edge",gateway:"unreachable"}));
  }
}

const server=http.createServer((req,res)=>{
  const path=(req.url||"/").split("?")[0];
  if(req.method==="GET" && path==="/health") return void health(res);

  const headers={...req.headers};
  delete headers.connection;
  delete headers["proxy-connection"];
  headers.host=`${UPSTREAM_HOST}:${UPSTREAM_PORT}`;
  headers["x-forwarded-host"]=req.headers.host || "";
  headers["x-forwarded-proto"]="https";

  const upstream=http.request({
    hostname:UPSTREAM_HOST,
    port:UPSTREAM_PORT,
    method:req.method,
    path:req.url,
    headers
  },up=>{
    const out={...up.headers};
    delete out.connection;
    res.writeHead(up.statusCode||502,out);
    up.pipe(res);
  });

  upstream.on("error",()=>{
    if(!res.headersSent) send(res,502,JSON.stringify({ok:false,error:"IZAKHONO Command Gateway unavailable"}));
    else res.end();
  });

  req.pipe(upstream);
});

server.listen(PORT,HOST,()=>{
  console.log(`IZAKHONO Command Centre EDGE adapter listening on ${HOST}:${PORT}`);
  console.log(`Gateway upstream http://${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
});
