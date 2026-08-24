import fs from 'node:fs';
import path from 'node:path';

const forbiddenPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s#]+/i,
  /DB_PASSWORD\s*=\s*[^\s#]+/i,
  /DATABASE_URL\s*=\s*postgres(?:ql)?:\/\//i,
  /BROKER_API_SECRET\s*=\s*[^\s#]+/i,
  /LIVE_TRADING_KEY\s*=\s*[^\s#]+/i
];

function walk(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => {
    const p=path.join(dir,e.name);
    if(e.isDirectory() && !['.git','node_modules'].includes(e.name)) return walk(p);
    return e.isFile() ? [p] : [];
  });
}

const hits=[];
for(const file of walk(process.cwd())) {
  if(file.endsWith('.zip')) continue;
  const text=fs.readFileSync(file,'utf8');
  for(const pattern of forbiddenPatterns) {
    if(pattern.test(text)) hits.push({file:path.relative(process.cwd(),file),pattern:String(pattern)});
  }
}
if(hits.length){console.error(JSON.stringify({ok:false,hits},null,2));process.exit(2);}
console.log(JSON.stringify({ok:true,checked:'repository text files'},null,2));
