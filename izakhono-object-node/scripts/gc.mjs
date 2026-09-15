import { DatabaseSync } from "node:sqlite";
import { existsSync,rmSync } from "node:fs";
import { resolve } from "node:path";

const ROOT=resolve(process.env.IZAKHONO_OBJECT_ROOT || "./objects");
const DB_PATH=resolve(process.env.IZAKHONO_OBJECT_DB || "./data/object-node.sqlite");
const db=new DatabaseSync(DB_PATH);

const dead=db.prepare("SELECT sha256 FROM blobs WHERE ref_count<=0").all();
let deleted=0;
for(const {sha256} of dead){
  const path=resolve(ROOT,sha256.slice(0,2),sha256.slice(2,4),sha256);
  if(existsSync(path)) rmSync(path,{force:true});
  db.prepare("DELETE FROM blobs WHERE sha256=? AND ref_count<=0").run(sha256);
  deleted++;
}
console.log(JSON.stringify({garbageCollected:deleted}));
