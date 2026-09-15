import { DatabaseSync } from "node:sqlite";
import { copyFileSync,mkdirSync } from "node:fs";
import { dirname,resolve } from "node:path";

const source=resolve(process.env.IZAKHONO_DATA_DB || "./data/izakhono-data.sqlite");
const backupDir=resolve(process.env.IZAKHONO_BACKUP_DIR || "./backups");
mkdirSync(backupDir,{recursive:true});

const db=new DatabaseSync(source);
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
db.close();

const stamp=new Date().toISOString().replace(/[:.]/g,"-");
const target=resolve(backupDir,`izakhono-data-${stamp}.sqlite`);
copyFileSync(source,target);
console.log(target);
