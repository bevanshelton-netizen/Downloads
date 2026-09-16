import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync,rmSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve("./.self-test");
const upstreamPort=19700;
const mirrorPort=19710;
const key=randomBytes(24).toString("hex");
rmSync(root,{recursive:true,force:true});
mkdirSync(root,{recursive:true});

let metadataHits=0;
let tarballHits=0;
const upstream=createServer((req,res)=>{
  if(req.url==="/demo"){
    metadataHits++;
    const body=JSON.stringify({
      name:"demo",
      versions:{
        "1.0.0":{
          name:"demo",version:"1.0.0",
          dist:{tarball:`http://127.0.0.1:${upstreamPort}/demo/-/demo-1.0.0.tgz`}
        }
      },
      "dist-tags":{latest:"1.0.0"}
    });
    res.writeHead(200,{"content-type":"application/json","etag":"\"demo-v1\"","content-length":Buffer.byteLength(body)});
    return res.end(body);
  }
  if(req.url==="/demo/-/demo-1.0.0.tgz"){
    tarballHits++;
    const body=Buffer.from("owned-package-artifact");
    res.writeHead(200,{"content-type":"application/octet-stream","content-length":body.length});
    return res.end(body);
  }
  res.writeHead(404);res.end();
});
await new Promise(resolvePromise=>upstream.listen(upstreamPort,"127.0.0.1",resolvePromise));

const child=spawn(process.execPath,["server.mjs"],{
  env:{
    ...process.env,
    HOST:"127.0.0.1",
    PORT:String(mirrorPort),
    IZAKHONO_PACKAGE_UPSTREAM:`http://127.0.0.1:${upstreamPort}`,
    IZAKHONO_PACKAGE_PUBLIC_URL:`http://127.0.0.1:${mirrorPort}`,
    IZAKHONO_PACKAGE_KEY:key,
    IZAKHONO_PACKAGE_CACHE:resolve(root,"cache"),
    IZAKHONO_PACKAGE_DB:resolve(root,"package.sqlite"),
    IZAKHONO_PACKAGE_TMP:resolve(root,"tmp"),
    IZAKHONO_PACKAGE_METADATA_TTL_SECONDS:"60",
    IZAKHONO_PACKAGE_TARBALL_TTL_SECONDS:"3600"
  },
  stdio:["ignore","pipe","pipe"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitHealth(){
  for(let i=0;i<40;i++){
    await sleep(120);
    try{const r=await fetch(`http://127.0.0.1:${mirrorPort}/health`);if(r.ok)return;}catch{}
  }
  throw new Error("Package node did not become healthy");
}

try{
  await waitHealth();

  let r=await fetch(`http://127.0.0.1:${mirrorPort}/demo`);
  if(!r.ok) throw new Error("Metadata fetch failed");
  let meta=await r.json();
  if(meta.versions["1.0.0"].dist.tarball!==`http://127.0.0.1:${mirrorPort}/demo/-/demo-1.0.0.tgz`) throw new Error("Tarball URL was not rewritten");

  r=await fetch(`http://127.0.0.1:${mirrorPort}/demo`);
  if(r.headers.get("x-izakhono-package-cache")!=="HIT") throw new Error("Metadata cache hit missing");
  if(metadataHits!==1) throw new Error("Metadata upstream hit count incorrect");

  r=await fetch(`http://127.0.0.1:${mirrorPort}/demo/-/demo-1.0.0.tgz`);
  if(!r.ok || await r.text()!=="owned-package-artifact") throw new Error("Tarball fetch failed");

  r=await fetch(`http://127.0.0.1:${mirrorPort}/demo/-/demo-1.0.0.tgz`);
  if(r.headers.get("x-izakhono-package-cache")!=="HIT") throw new Error("Tarball cache hit missing");
  if(tarballHits!==1) throw new Error("Tarball upstream hit count incorrect");

  r=await fetch(`http://127.0.0.1:${mirrorPort}/_izakhono/stats`,{headers:{"x-izakhono-key":key}});
  const stats=await r.json();
  if(!r.ok || stats.entries!==2 || stats.hits<2) throw new Error("Stats failed");

  upstream.close();
  await sleep(100);

  r=await fetch(`http://127.0.0.1:${mirrorPort}/demo`);
  if(!r.ok) throw new Error("Fresh cached metadata unavailable after upstream stop");

  r=await fetch(`http://127.0.0.1:${mirrorPort}/_izakhono/purge`,{method:"POST",headers:{"x-izakhono-key":key}});
  const purge=await r.json();
  if(!r.ok || purge.purged!==2) throw new Error("Purge failed");

  console.log("IZAKHONO PACKAGE NODE SELF TEST: PASS");
}finally{
  child.kill("SIGTERM");
  try{upstream.close();}catch{}
  await sleep(150);
  rmSync(root,{recursive:true,force:true});
}
