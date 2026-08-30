interface D1PreparedStatement { bind(...values: unknown[]): D1PreparedStatement; first<T=any>(): Promise<T|null>; all<T=any>(): Promise<{results?:T[]}>; run(): Promise<unknown>; }
interface D1Database { prepare(query:string): D1PreparedStatement; }
interface Fetcher { fetch(request:Request): Promise<Response>; }
interface R2Bucket { put(key:string,value:ReadableStream|null,options?:unknown): Promise<unknown>; get(key:string): Promise<unknown>; }
interface Env { DB:D1Database; MEDIA:R2Bucket; ASSETS:Fetcher; APP_ENV?:string; APP_NAME?:string; ADMIN_SECRET?:string; ABUSE_SALT?:string; ALLOWED_ORIGINS?:string; }

const enc=new TextEncoder();
const LEADS_PER_IP_DAY=12;
const LEADS_PER_EMAIL_DAY=6;

function cleanText(v:unknown,max:number){return typeof v==='string'?v.trim().slice(0,max):''}
function cleanEmail(v:unknown){return cleanText(v,240).toLowerCase()}
function validEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
function today(){return new Date().toISOString().slice(0,10)}
function id(prefix:string){return `${prefix}_${crypto.randomUUID().replaceAll('-','')}`}
async function sha256(v:string){const d=await crypto.subtle.digest('SHA-256',enc.encode(v));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function origins(req:Request,env:Env){const self=new URL(req.url).origin;return new Set([self,...(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean)])}
function cors(req:Request,env:Env):HeadersInit{const o=req.headers.get('origin');if(!o||!origins(req,env).has(o))return {'vary':'Origin'};return {'access-control-allow-origin':o,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-admin-secret','vary':'Origin'}}
function json(req:Request,env:Env,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...cors(req,env)}})}
function fail(req:Request,env:Env,error:string,status=400){return json(req,env,{ok:false,error},status)}
function isAdmin(req:Request,env:Env){return Boolean(env.ADMIN_SECRET&&req.headers.get('x-admin-secret')===env.ADMIN_SECRET)}
async function parseJson(req:Request){if(!(req.headers.get('content-type')||'').includes('application/json'))throw new Error('Expected application/json');return req.json() as Promise<any>}
async function bump(env:Env,key:string,limit:number){const day=today();await env.DB.prepare(`INSERT INTO rate_limits(key,window_date,count) VALUES(?,?,1) ON CONFLICT(key,window_date) DO UPDATE SET count=count+1`).bind(key,day).run();const row=await env.DB.prepare('SELECT count FROM rate_limits WHERE key=? AND window_date=?').bind(key,day).first<any>();return Number(row?.count||0)<=limit}
async function enforceLeadLimit(req:Request,env:Env,email:string){const salt=env.ABUSE_SALT||env.ADMIN_SECRET||'bootstrap';const ip=req.headers.get('cf-connecting-ip')||'unknown';const ipKey='lead-ip:'+await sha256(`${salt}:${today()}:${ip}`);const emailKey='lead-email:'+await sha256(`${salt}:${today()}:${email}`);return (await bump(env,ipKey,LEADS_PER_IP_DAY))&&(await bump(env,emailKey,LEADS_PER_EMAIL_DAY))}

async function api(req:Request,env:Env,url:URL):Promise<Response>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req,env)});
  if(url.pathname==='/api/health'&&req.method==='GET'){
    const row=await env.DB.prepare('SELECT 1 AS ok').first<any>();
    return json(req,env,{ok:row?.ok===1,app:env.APP_NAME||'IZAKHONO App',env:env.APP_ENV||'production',engine:'IZAKHONO BUILDER'});
  }
  if(url.pathname==='/api/leads'&&req.method==='POST'){
    let b:any;try{b=await parseJson(req)}catch{return fail(req,env,'Invalid JSON')}
    if(cleanText(b.website,100))return json(req,env,{ok:true},201);
    const name=cleanText(b.name,120),email=cleanEmail(b.email),phone=cleanText(b.phone,60),message=cleanText(b.message,2000);
    if(!name||!validEmail(email))return fail(req,env,'Name and valid email are required');
    if(!(await enforceLeadLimit(req,env,email)))return fail(req,env,'Too many submissions. Please try again later.',429);
    const leadId=id('lead');
    await env.DB.prepare('INSERT INTO leads(id,name,email,phone,message,status) VALUES(?,?,?,?,?,?)').bind(leadId,name,email,phone||null,message||null,'new').run();
    return json(req,env,{ok:true,id:leadId},201);
  }
  if(url.pathname==='/api/admin/leads'&&req.method==='GET'){
    if(!isAdmin(req,env))return fail(req,env,'Unauthorized',401);
    const rows=await env.DB.prepare('SELECT id,name,email,phone,message,status,created_at FROM leads ORDER BY created_at DESC LIMIT 250').all<any>();
    return json(req,env,{ok:true,leads:rows.results||[]});
  }
  return fail(req,env,'Not found',404);
}

export default {async fetch(req:Request,env:Env){const url=new URL(req.url);if(url.pathname.startsWith('/api/'))return api(req,env,url);return env.ASSETS.fetch(req)}};
