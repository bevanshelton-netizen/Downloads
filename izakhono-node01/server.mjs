import http from 'node:http';
import os from 'node:os';
import { readFile, statfs } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const HOST = process.env.IZAKHONO_NODE01_HOST || '127.0.0.1';
const PORT = Number(process.env.IZAKHONO_NODE01_PORT || 8940);
const CONFIG = process.env.IZAKHONO_NODE01_CONFIG || '/etc/izakhono/node01.json';
const TEST_MODE = process.env.IZAKHONO_NODE01_TEST_MODE === '1';

const services = [
  ['data','IZAKHONO DATA NODE','http://127.0.0.1:8787/health',true],
  ['runtime','IZAKHONO RUNTIME NODE','http://127.0.0.1:8790/health',true],
  ['object','IZAKHONO OBJECT NODE','http://127.0.0.1:8800/health',true],
  ['queue','IZAKHONO QUEUE NODE','http://127.0.0.1:8810/health',true],
  ['auth','IZAKHONO AUTH NODE','http://127.0.0.1:8820/health',true],
  ['analytics','IZAKHONO ANALYTICS NODE','http://127.0.0.1:8830/health',true],
  ['notify','IZAKHONO NOTIFY NODE','http://127.0.0.1:8840/health',true],
  ['mail_relay','IZAKHONO MAIL RELAY ADAPTER','http://127.0.0.1:8845/health',true],
  ['ai_gateway','IZAKHONO AI GATEWAY NODE','http://127.0.0.1:8850/health',true],
  ['gpu_compute','IZAKHONO GPU COMPUTE NODE','http://127.0.0.1:8865/health',true],
  ['model_worker','IZAKHONO MODEL WORKER NODE','http://127.0.0.1:8866/health',true],
  ['code','IZAKHONO CODE NODE','http://127.0.0.1:8860/health',true],
  ['backup','IZAKHONO BACKUP NODE','http://127.0.0.1:8870/health',true],
  ['ci_worker','IZAKHONO CI WORKER NODE','http://127.0.0.1:8880/health',true],
  ['replica','IZAKHONO REPLICA NODE','http://127.0.0.1:8890/health',true],
  ['dns','IZAKHONO DNS NODE','http://127.0.0.1:8900/health',true],
  ['package','IZAKHONO PACKAGE NODE','http://127.0.0.1:8910/health',true],
  ['failover','IZAKHONO FAILOVER NODE','http://127.0.0.1:8920/health',true],
  ['edge','IZAKHONO EDGE NODE','http://127.0.0.1:8795/health',false],
  ['fortress','FORTRESS PROTECTOR','http://127.0.0.1:18109/health',false]
];

async function readJson(path, fallback = {}) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

async function probe([id,name,url,required]) {
  if (TEST_MODE) return {id,name,required,ok:true,http_status:200,latency_ms:1};
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1600);
  try {
    const res = await fetch(url,{cache:'no-store',signal:controller.signal});
    const body = await res.json().catch(()=>null);
    const ok = res.ok && body !== null;
    return {id,name,required,ok,http_status:res.status,latency_ms:Date.now()-start};
  } catch {
    return {id,name,required,ok:false,http_status:null,latency_ms:Date.now()-start};
  } finally {
    clearTimeout(timer);
  }
}

async function diskSnapshot() {
  try {
    const s = await statfs('/var/lib');
    const block = Number(s.bsize || 0);
    return {
      total_bytes:Number(s.blocks || 0) * block,
      free_bytes:Number(s.bavail || 0) * block
    };
  } catch {
    return {total_bytes:null,free_bytes:null};
  }
}

export async function buildSnapshot() {
  const config = await readJson(CONFIG,{
    schema:'izakhono.node01-config/v1',
    node_id:'NODE01',
    node_instance:'NODE01-unconfigured',
    role:'primary'
  });
  const componentResults = await Promise.all(services.map(probe));
  const required = componentResults.filter(x=>x.required);
  const healthyRequired = required.filter(x=>x.ok).length;
  const requiredHealthy = healthyRequired === required.length;
  const degraded = !requiredHealthy;
  const memory = {
    total_bytes:os.totalmem(),
    free_bytes:os.freemem()
  };
  return {
    ok:requiredHealthy,
    service:'izakhono-node01',
    product:'IZAKHONO NODE01',
    version:'1.0.0',
    status:degraded?'degraded':'healthy',
    authority:'IZAKHONO',
    node_id:'NODE01',
    node_instance:config.node_instance || 'NODE01-unconfigured',
    role:config.role || 'primary',
    execution_class:'IZAKHONO_SOVEREIGN_NODE',
    owned_first:true,
    external_runtime_dependency:false,
    external_provider_authority:false,
    public_ingress:'IZAKHONO EDGE',
    control_bind:HOST+':'+PORT,
    privacy:{
      behavioural_tracking:false,
      profiling:false,
      silent_analytics:false,
      advertising_identifiers:false
    },
    host:{
      platform:os.platform(),
      arch:os.arch(),
      cpu_count:os.cpus().length,
      uptime_seconds:Math.floor(os.uptime()),
      load_average:os.loadavg(),
      memory,
      disk:await diskSnapshot()
    },
    components:{
      required_total:required.length,
      required_healthy:healthyRequired,
      all:componentResults
    },
    public_live_claim:false,
    independent_public_https_verification_required:true,
    generated_at:new Date().toISOString()
  };
}

function reply(res,status,body){
  const data=JSON.stringify(body);
  res.writeHead(status,{
    'content-type':'application/json; charset=utf-8',
    'content-length':Buffer.byteLength(data),
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'x-izakhono-authority':'NODE01'
  });
  res.end(data);
}

export function startServer(){
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url||'/', 'http://node01.local');
      if(req.method!=='GET') return reply(res,405,{ok:false,error:'method_not_allowed'});
      if(url.pathname==='/health'){
        const s=await buildSnapshot();
        return reply(res,s.ok?200:503,s);
      }
      if(url.pathname==='/v1/status'){
        return reply(res,200,await buildSnapshot());
      }
      if(url.pathname==='/'){
        return reply(res,200,{
          ok:true,
          product:'IZAKHONO NODE01',
          authority:'IZAKHONO',
          health:'/health',
          status:'/v1/status'
        });
      }
      return reply(res,404,{ok:false,error:'not_found'});
    }catch{
      return reply(res,500,{ok:false,error:'internal_error'});
    }
  });
  server.listen(PORT,HOST,()=>{
    console.log('IZAKHONO NODE01 controller listening on '+HOST+':'+PORT);
  });
  return server;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  startServer();
}
