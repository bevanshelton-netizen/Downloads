import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const contract=JSON.parse(await readFile(new URL('../port-contract.json',import.meta.url),'utf8'));
const seen=new Map();
for(const row of contract.ports||[]){
  if(seen.has(row.port)) throw new Error('port collision '+row.port+' between '+seen.get(row.port)+' and '+row.id);
  seen.set(row.port,row.id);
}
if(seen.get(8845)!=='mail-relay'||seen.get(8870)!=='backup') throw new Error('mail relay / backup port contract mismatch');

const port=18940;
const child=spawn(process.execPath,['server.mjs'],{
  cwd:new URL('..',import.meta.url).pathname,
  env:{...process.env,IZAKHONO_NODE01_PORT:String(port),IZAKHONO_NODE01_TEST_MODE:'1'},
  stdio:['ignore','pipe','pipe']
});

async function wait(){
  let last;
  for(let i=0;i<30;i++){
    try{
      const r=await fetch('http://127.0.0.1:'+port+'/health');
      if(r.ok)return await r.json();
      last=new Error('HTTP '+r.status);
    }catch(e){last=e}
    await new Promise(r=>setTimeout(r,100));
  }
  throw last||new Error('NODE01 test server did not start');
}

try{
  const h=await wait();
  if(h.service!=='izakhono-node01') throw new Error('service identity mismatch');
  if(h.product!=='IZAKHONO NODE01') throw new Error('product identity mismatch');
  if(h.authority!=='IZAKHONO') throw new Error('authority mismatch');
  if(h.execution_class!=='IZAKHONO_SOVEREIGN_NODE') throw new Error('execution class mismatch');
  if(h.external_runtime_dependency!==false) throw new Error('external runtime dependency must be false');
  if(h.privacy?.behavioural_tracking!==false||h.privacy?.profiling!==false||h.privacy?.silent_analytics!==false) throw new Error('privacy contract mismatch');
  if(h.public_live_claim!==false) throw new Error('NODE01 must not invent a public-live claim');
  if(h.components?.required_healthy!==h.components?.required_total) throw new Error('simulated component proof failed');
  console.log('IZAKHONO NODE01 SELF-TEST: PASS');
}finally{
  child.kill('SIGTERM');
}
