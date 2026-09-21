import {
  createCipheriv, createHash, randomBytes
} from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  createReadStream, createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync
} from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const root=resolve("./.external-restore-test");
rmSync(root,{recursive:true,force:true});
mkdirSync(resolve(root,"source/etc/izakhono"),{recursive:true});
writeFileSync(resolve(root,"source/etc/izakhono/demo.env"),"OWNED=YES\n");

const key=randomBytes(32);
const keyFile=resolve(root,"recovery.env");
writeFileSync(keyFile,"IZAKHONO_BACKUP_ENCRYPTION_KEY="+key.toString("base64")+"\n",{mode:0o600});

const archive=resolve(root,"snapshot.izbk");
const iv=randomBytes(12);
const cipher=createCipheriv("aes-256-gcm",key,iv);
const out=createWriteStream(archive,{mode:0o600});
out.write(Buffer.from("IZBK1"));
out.write(iv);
const tar=spawn("tar",["-C",resolve(root,"source"),"-cf","-","etc"],{stdio:["ignore","pipe","inherit"]});
await pipeline(tar.stdout,cipher,out);
await new Promise((resolvePromise,reject)=>tar.on("close",code=>code===0?resolvePromise():reject(new Error("tar failed"))));
await new Promise(resolvePromise=>setImmediate(resolvePromise));
const tag=cipher.getAuthTag();
const append=createWriteStream(archive,{flags:"a"});
append.end(tag);
await new Promise((resolvePromise,reject)=>{append.on("finish",resolvePromise);append.on("error",reject);});

const h=createHash("sha256");
for await(const chunk of createReadStream(archive)) h.update(chunk);
const sha=h.digest("hex");
const restoreRoot=resolve(root,"restores");

const ok=spawnSync(process.execPath,[
  "scripts/restore-external.mjs",
  "--archive",archive,
  "--expected-sha256",sha,
  "--recovery-key-file",keyFile,
  "--destination-name","proof"
],{
  cwd:resolve("izakhono-backup-node"),
  env:{...process.env,IZAKHONO_STANDBY_RESTORE_ROOT:restoreRoot},
  encoding:"utf8"
});
if(ok.status!==0) throw new Error("External restore failed: "+ok.stderr+" "+ok.stdout);
const restored=readFileSync(resolve(restoreRoot,"proof/etc/izakhono/demo.env"),"utf8");
if(restored!=="OWNED=YES\n") throw new Error("Restored content mismatch");
const receipt=JSON.parse(ok.stdout);
if(receipt.liveDirectoriesModified!==false||receipt.promotionPerformed!==false) throw new Error("Restore safety receipt invalid");

const bad=spawnSync(process.execPath,[
  "scripts/restore-external.mjs",
  "--archive",archive,
  "--expected-sha256","0".repeat(64),
  "--recovery-key-file",keyFile,
  "--destination-name","bad-sha"
],{
  cwd:resolve("izakhono-backup-node"),
  env:{...process.env,IZAKHONO_STANDBY_RESTORE_ROOT:restoreRoot},
  encoding:"utf8"
});
if(bad.status===0) throw new Error("Bad SHA-256 was accepted");

console.log("IZAKHONO EXTERNAL BACKUP STAGING SELF TEST: PASS");
rmSync(root,{recursive:true,force:true});
