import http from 'node:http';
import { Readable } from 'node:stream';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import worker from '../src/index.ts';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const PUBLIC_ROOT=path.join(ROOT,'public');
const MIGRATIONS=path.join(ROOT,'migrations');
const DATA_ROOT=path.resolve(process.env.VIDEONOMY_DATA_DIR||path.join(ROOT,'.owned-data'));
const MEDIA_ROOT=path.join(DATA_ROOT,'media');
const DB_PATH=path.join(DATA_ROOT,'videonomy.sqlite');
await mkdir(MEDIA_ROOT,{recursive:true});

const db=new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec('CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
for(const name of readdirSync(MIGRATIONS).filter(x=>x.endsWith('.sql')).sort()){
  const done=db.prepare('SELECT 1 FROM _migrations WHERE name=?').get(name);
  if(done) continue;
  const sql=readFileSync(path.join(MIGRATIONS,name),'utf8');
  const apply=db.transaction(()=>{db.exec(sql);db.prepare('INSERT INTO _migrations(name) VALUES(?)').run(name)});
  apply();
  console.log('[VIDEONOMY] applied migration',name);
}

class LocalPrepared{
  constructor(database,sql){this.database=database;this.sql=sql;this.args=[]}
  bind(...values){const p=new LocalPrepared(this.database,this.sql);p.args=values;return p}
  async first(){return this.database.prepare(this.sql).get(...this.args)||null}
  async all(){return {results:this.database.prepare(this.sql).all(...this.args)}}
  async run(){return this.database.prepare(this.sql).run(...this.args)}
}
class LocalD1{
  constructor(database){this.database=database}
  prepare(sql){return new LocalPrepared(this.database,sql)}
  async batch(statements){
    const tx=this.database.transaction((items)=>items.map(s=>this.database.prepare(s.sql).run(...s.args)));
    return tx(statements);
  }
}

function safeMediaPath(key){
  const clean=String(key).replaceAll('\\','/').replace(/^\/+/, '');
  const full=path.resolve(MEDIA_ROOT,clean);
  if(!full.startsWith(MEDIA_ROOT+path.sep)) throw new Error('Invalid media key');
  return full;
}
class LocalMedia{
  async put(key,value){
    const full=safeMediaPath(key);await mkdir(path.dirname(full),{recursive:true});
    const bytes=value?new Uint8Array(await new Response(value).arrayBuffer()):new Uint8Array();
    await writeFile(full,bytes);return {};
  }
  async get(key,options={}){
    const full=safeMediaPath(key);if(!existsSync(full)) return null;
    const info=await stat(full);let start=0,end=info.size-1;
    const h=options?.range instanceof Headers?options.range.get('range'):null;
    if(h&&/^bytes=/.test(h)){
      const spec=h.slice(6).split(',')[0].trim();
      const [a,b]=spec.split('-');
      if(a===''){const suffix=Math.max(0,Number(b)||0);start=Math.max(0,info.size-suffix)}
      else start=Math.max(0,Math.min(info.size-1,Number(a)||0));
      if(b!==''&&a!=='') end=Math.max(start,Math.min(info.size-1,Number(b)||end));
    }
    const all=await readFile(full);const slice=all.subarray(start,end+1);
    return {
      body:new Blob([slice]).stream(),
      size:info.size,
      httpEtag:`"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`,
      range:h?{offset:start,length:slice.length}:undefined,
      writeHttpMetadata(headers){headers.set('content-type','video/mp4')}
    };
  }
}

const MIME={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'
};
const assets={
  async fetch(request){
    const u=new URL(request.url);let rel=decodeURIComponent(u.pathname);
    if(rel==='/'||rel==='') rel='/index.html'; else if(rel.endsWith('/')) rel+='index.html';
    const full=path.resolve(PUBLIC_ROOT,'.'+rel);
    if(!full.startsWith(PUBLIC_ROOT+path.sep)||!existsSync(full)) return new Response('Not found',{status:404});
    const info=await stat(full);if(!info.isFile()) return new Response('Not found',{status:404});
    const headers={'content-type':MIME[path.extname(full).toLowerCase()]||'application/octet-stream','cache-control':rel.endsWith('.html')?'no-cache':'public, max-age=300'};
    if(request.method==='HEAD') return new Response(null,{status:200,headers});
    return new Response(await readFile(full),{status:200,headers});
  }
};

const env={
  DB:new LocalD1(db),MEDIA:new LocalMedia(),ASSETS:assets,
  ADMIN_SECRET:process.env.ADMIN_SECRET,
  ABUSE_SALT:process.env.ABUSE_SALT,
  APP_ENV:process.env.APP_ENV||'production',
  PUBLIC_BASE_URL:process.env.PUBLIC_BASE_URL,
  ALLOWED_ORIGINS:process.env.ALLOWED_ORIGINS,
  PAYFAST_MERCHANT_ID:process.env.PAYFAST_MERCHANT_ID,
  PAYFAST_MERCHANT_KEY:process.env.PAYFAST_MERCHANT_KEY,
  PAYFAST_PASSPHRASE:process.env.PAYFAST_PASSPHRASE,
  PAYFAST_MODE:process.env.PAYFAST_MODE,
  PAYFAST_ALLOWED_CIDRS:process.env.PAYFAST_ALLOWED_CIDRS,
  IKHOKHA_APP_ID:process.env.IKHOKHA_APP_ID,
  IKHOKHA_APP_SECRET:process.env.IKHOKHA_APP_SECRET,
  IKHOKHA_MODE:process.env.IKHOKHA_MODE
};

const PORT=Number(process.env.PORT||18081),HOST=process.env.HOST||'0.0.0.0';
const server=http.createServer(async(req,res)=>{
  try{
    const headers=new Headers();
    for(const [k,v] of Object.entries(req.headers)){if(Array.isArray(v))v.forEach(x=>headers.append(k,x));else if(v!==undefined)headers.set(k,String(v))}
    const host=headers.get('host')||`127.0.0.1:${PORT}`;
    const init={method:req.method,headers};
    if(req.method!=='GET'&&req.method!=='HEAD'){init.body=Readable.toWeb(req);init.duplex='half'}
    const request=new Request(`http://${host}${req.url||'/'}`,init);
    const response=await worker.fetch(request,env);
    res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));
    if(!response.body){res.end();return}
    Readable.fromWeb(response.body).pipe(res);
  }catch(err){
    console.error('[VIDEONOMY] request failure',err);res.statusCode=500;res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:'Request failed'}));
  }
});
server.listen(PORT,HOST,()=>console.log(`[VIDEONOMY] owned engine listening on ${HOST}:${PORT}`));
for(const sig of ['SIGINT','SIGTERM']) process.on(sig,()=>server.close(()=>{db.close();process.exit(0)}));
