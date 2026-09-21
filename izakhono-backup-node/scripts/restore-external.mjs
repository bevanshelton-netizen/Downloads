import {
  createDecipheriv, createHash
} from "node:crypto";
import {
  closeSync, createReadStream, existsSync, mkdirSync, openSync,
  readFileSync, readSync, realpathSync, rmSync, statSync
} from "node:fs";
import { basename, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

const MAGIC=Buffer.from("IZBK1");

function fail(message,code=2){
  console.error(message);
  process.exit(code);
}
function arg(name){
  const i=process.argv.indexOf(name);
  return i>=0?process.argv[i+1]:null;
}
function within(root,path){
  return path===root || path.startsWith(root.endsWith(sep)?root:root+sep);
}
async function sha256File(path){
  const h=createHash("sha256");
  for await(const chunk of createReadStream(path)) h.update(chunk);
  return h.digest("hex");
}
function readRecoveryKey(path){
  const lines=readFileSync(path,"utf8").split(/\r?\n/);
  const line=lines.find(x=>x.startsWith("IZAKHONO_BACKUP_ENCRYPTION_KEY="));
  if(!line) fail("Recovery-key file does not contain IZAKHONO_BACKUP_ENCRYPTION_KEY.",3);
  const key=Buffer.from(line.slice(line.indexOf("=")+1),"base64");
  if(key.length!==32) fail("Recovery key must decode to exactly 32 bytes.",4);
  return key;
}
function parts(path){
  const size=statSync(path).size;
  if(size<MAGIC.length+12+16+1) fail("Archive is too small.",5);
  const fd=openSync(path,"r");
  try{
    const magic=Buffer.alloc(MAGIC.length);
    readSync(fd,magic,0,magic.length,0);
    if(!magic.equals(MAGIC)) fail("Invalid IZAKHONO backup archive magic.",6);
    const iv=Buffer.alloc(12);
    readSync(fd,iv,0,12,MAGIC.length);
    const tag=Buffer.alloc(16);
    readSync(fd,tag,0,16,size-16);
    return {size,iv,tag,start:MAGIC.length+12,end:size-17};
  }finally{closeSync(fd);}
}
function childExit(child){
  return new Promise((resolvePromise,reject)=>{
    let stderr="";
    child.stderr?.on("data",c=>{if(stderr.length<12000) stderr+=c.toString();});
    child.on("error",reject);
    child.on("close",code=>code===0?resolvePromise():reject(new Error(stderr.trim()||("tar exited "+code))));
  });
}

const archiveArg=arg("--archive");
const expected=(arg("--expected-sha256")||"").toLowerCase();
const recoveryArg=arg("--recovery-key-file");
const destinationName=arg("--destination-name");
const root=resolve(process.env.IZAKHONO_STANDBY_RESTORE_ROOT || "/var/lib/izakhono-standby/restores");

if(!archiveArg||!recoveryArg||!destinationName){
  fail("Usage: node restore-external.mjs --archive <file.izbk> --expected-sha256 <64hex> --recovery-key-file <env-file> --destination-name <name>");
}
if(!/^[0-9a-f]{64}$/.test(expected)) fail("A 64-character expected SHA-256 is required.",7);
if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(destinationName)) fail("Invalid destination name.",8);

const archive=realpathSync(resolve(archiveArg));
if(!archive.endsWith(".izbk")) fail("Only .izbk archives are accepted.",9);
const recovery=realpathSync(resolve(recoveryArg));
const dest=resolve(root,destinationName);
if(!within(root,dest)) fail("Restore destination escapes staging root.",10);
if(existsSync(dest)) fail("Restore destination already exists.",11);

mkdirSync(root,{recursive:true,mode:0o700});
mkdirSync(dest,{recursive:false,mode:0o700});

try{
  const actual=await sha256File(archive);
  if(actual!==expected) fail("Replica archive SHA-256 does not match expected digest.",12);

  const p=parts(archive);
  const key=readRecoveryKey(recovery);
  const decipher=createDecipheriv("aes-256-gcm",key,p.iv);
  decipher.setAuthTag(p.tag);

  const tar=spawn("tar",["-xf","-","-C",dest,"--no-same-owner","--no-same-permissions"],{
    stdio:["pipe","ignore","pipe"]
  });
  await Promise.all([
    pipeline(createReadStream(archive,{start:p.start,end:p.end}),decipher,tar.stdin),
    childExit(tar)
  ]);

  const receipt={
    product:"IZAKHONO STANDBY RESTORE STAGING",
    status:"STAGED",
    archive:basename(archive),
    sha256:actual,
    destination:dest,
    liveDirectoriesModified:false,
    promotionPerformed:false,
    stagedAt:new Date().toISOString()
  };
  console.log(JSON.stringify(receipt,null,2));
}catch(error){
  rmSync(dest,{recursive:true,force:true});
  console.error(String(error?.message||error));
  process.exit(13);
}
