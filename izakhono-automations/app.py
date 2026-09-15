#!/usr/bin/env python3
import json, os, re, secrets, sqlite3, threading, time, traceback, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

BASE=Path(__file__).resolve().parent
DB_PATH=Path(os.getenv("IZA_AUTOMATIONS_DB", str(BASE/"data"/"automations.db")))
HOST=os.getenv("IZA_AUTOMATIONS_HOST","0.0.0.0")
PORT=int(os.getenv("IZA_AUTOMATIONS_PORT","8787"))
ADMIN_TOKEN=os.getenv("IZA_AUTOMATIONS_ADMIN_TOKEN","")
DEFAULT_TZ=os.getenv("IZA_AUTOMATIONS_TZ","Africa/Johannesburg")
TICK_SECONDS=max(5,int(os.getenv("IZA_AUTOMATIONS_TICK_SECONDS","15")))
MAX_OUTPUT=int(os.getenv("IZA_AUTOMATIONS_MAX_OUTPUT","12000"))

def utcnow():
    return datetime.now(timezone.utc)

def iso(dt):
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

def parse_iso(value):
    if not value: return None
    return datetime.fromisoformat(value.replace("Z","+00:00")).astimezone(timezone.utc)

def db():
    DB_PATH.parent.mkdir(parents=True,exist_ok=True)
    conn=sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory=sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    with db() as c:
        c.executescript("""
        create table if not exists tasks(
          id text primary key,
          title text not null,
          mode text not null,
          schedule_json text not null default '{}',
          condition_json text not null default '{}',
          action_json text not null default '{}',
          enabled integer not null default 1,
          next_run text,
          last_run text,
          last_status text,
          last_message text,
          webhook_token text unique,
          last_condition_state text,
          created_at text not null,
          updated_at text not null
        );
        create table if not exists runs(
          id integer primary key autoincrement,
          task_id text not null,
          started_at text not null,
          finished_at text,
          status text not null,
          message text,
          output text,
          foreign key(task_id) references tasks(id) on delete cascade
        );
        create index if not exists idx_tasks_due on tasks(enabled,next_run);
        create index if not exists idx_runs_task on runs(task_id,id desc);
        """)

def json_load(s):
    try: return json.loads(s or "{}")
    except Exception: return {}

def compute_next_run(mode, schedule, after=None):
    after=(after or utcnow()).astimezone(timezone.utc)
    tz=ZoneInfo(schedule.get("timezone") or DEFAULT_TZ)
    local=after.astimezone(tz)
    if mode in ("interval","condition"):
        mins=max(1,int(schedule.get("interval_minutes",1)))
        return after + timedelta(minutes=mins)
    if mode=="once":
        run_at=parse_iso(schedule.get("run_at"))
        return run_at if run_at and run_at>after else None
    if mode=="daily":
        hh,mm=[int(x) for x in schedule.get("time","08:00").split(":")[:2]]
        candidate=local.replace(hour=hh,minute=mm,second=0,microsecond=0)
        if candidate<=local: candidate += timedelta(days=1)
        return candidate.astimezone(timezone.utc)
    if mode=="weekly":
        hh,mm=[int(x) for x in schedule.get("time","08:00").split(":")[:2]]
        days=schedule.get("days",[0])
        days={int(x) for x in days}
        for offset in range(0,8):
            d=local+timedelta(days=offset)
            candidate=d.replace(hour=hh,minute=mm,second=0,microsecond=0)
            if candidate>local and candidate.weekday() in days:
                return candidate.astimezone(timezone.utc)
        return None
    if mode=="webhook":
        return None
    raise ValueError("Unsupported mode")

def safe_url(url):
    p=urlparse(url)
    if p.scheme not in ("http","https"): raise ValueError("Only http/https URLs are allowed")
    if not p.netloc: raise ValueError("URL host is required")
    return url

def http_call(spec):
    url=safe_url(spec.get("url",""))
    method=(spec.get("method") or "GET").upper()
    headers={"User-Agent":"IZAKHONO-Automations/1.0"}
    headers.update(spec.get("headers") or {})
    body=spec.get("body")
    data=None
    if body is not None:
        if isinstance(body,(dict,list)):
            data=json.dumps(body).encode()
            headers.setdefault("Content-Type","application/json")
        else:
            data=str(body).encode()
    req=urllib.request.Request(url,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=int(spec.get("timeout_seconds",20))) as r:
            raw=r.read(MAX_OUTPUT)
            return {"status":r.status,"text":raw.decode("utf-8","replace"),"headers":dict(r.headers)}
    except urllib.error.HTTPError as e:
        raw=e.read(MAX_OUTPUT)
        return {"status":e.code,"text":raw.decode("utf-8","replace"),"headers":dict(e.headers)}

def evaluate_condition(spec):
    t=spec.get("type","http")
    if t!="http": raise ValueError("Only http conditions are supported in v1")
    result=http_call(spec)
    ok=True
    if "expect_status" in spec: ok = ok and result["status"]==int(spec["expect_status"])
    if spec.get("contains") is not None: ok = ok and str(spec["contains"]) in result["text"]
    if spec.get("not_contains") is not None: ok = ok and str(spec["not_contains"]) not in result["text"]
    if spec.get("regex") is not None: ok = ok and bool(re.search(str(spec["regex"]),result["text"],re.I|re.M))
    return ok, result

def execute_action(spec, context=None):
    t=spec.get("type","log")
    if t=="log":
        return {"status":200,"text":str(spec.get("message","Task executed"))}
    if t=="http":
        payload=dict(spec)
        body=payload.get("body")
        if isinstance(body,dict) and context:
            payload["body"]={**body,"_izakhono_context":context}
        return http_call(payload)
    raise ValueError("Unsupported action type")

def row_task(r):
    return {
      "id":r["id"],"title":r["title"],"mode":r["mode"],
      "schedule":json_load(r["schedule_json"]),"condition":json_load(r["condition_json"]),
      "action":json_load(r["action_json"]),"enabled":bool(r["enabled"]),
      "next_run":r["next_run"],"last_run":r["last_run"],"last_status":r["last_status"],
      "last_message":r["last_message"],"webhook_token":r["webhook_token"],
      "created_at":r["created_at"],"updated_at":r["updated_at"]
    }

def create_task(payload):
    title=str(payload.get("title","")).strip()
    mode=str(payload.get("mode","interval")).strip()
    if not title: raise ValueError("title is required")
    if mode not in {"once","interval","daily","weekly","condition","webhook"}: raise ValueError("invalid mode")
    schedule=payload.get("schedule") or {}
    condition=payload.get("condition") or {}
    action=payload.get("action") or {"type":"log","message":title}
    task_id=payload.get("id") or secrets.token_hex(8)
    webhook_token=secrets.token_urlsafe(24) if mode=="webhook" else None
    enabled=1 if payload.get("enabled",True) else 0
    nr=compute_next_run(mode,schedule,utcnow()) if enabled else None
    now=iso(utcnow())
    with db() as c:
        c.execute("""insert into tasks(id,title,mode,schedule_json,condition_json,action_json,enabled,next_run,webhook_token,created_at,updated_at)
                     values(?,?,?,?,?,?,?,?,?,?,?)""",
                  (task_id,title,mode,json.dumps(schedule),json.dumps(condition),json.dumps(action),enabled,iso(nr) if nr else None,webhook_token,now,now))
        r=c.execute("select * from tasks where id=?",(task_id,)).fetchone()
    return row_task(r)

def update_task(task_id,payload):
    with db() as c:
        r=c.execute("select * from tasks where id=?",(task_id,)).fetchone()
        if not r: return None
        current=row_task(r)
        title=str(payload.get("title",current["title"])).strip()
        mode=payload.get("mode",current["mode"])
        schedule=payload.get("schedule",current["schedule"])
        condition=payload.get("condition",current["condition"])
        action=payload.get("action",current["action"])
        enabled=bool(payload.get("enabled",current["enabled"]))
        nr=compute_next_run(mode,schedule,utcnow()) if enabled else None
        c.execute("""update tasks set title=?,mode=?,schedule_json=?,condition_json=?,action_json=?,enabled=?,next_run=?,updated_at=? where id=?""",
                  (title,mode,json.dumps(schedule),json.dumps(condition),json.dumps(action),1 if enabled else 0,iso(nr) if nr else None,iso(utcnow()),task_id))
        r=c.execute("select * from tasks where id=?",(task_id,)).fetchone()
    return row_task(r)

def run_task(task_id, trigger="scheduler", webhook_payload=None):
    started=utcnow()
    with db() as c:
        t=c.execute("select * from tasks where id=?",(task_id,)).fetchone()
        if not t: return {"ok":False,"status":"missing","message":"task not found"}
        c.execute("insert into runs(task_id,started_at,status,message) values(?,?,?,?)",(task_id,iso(started),"running",trigger))
        run_id=c.execute("select last_insert_rowid()").fetchone()[0]
    task=row_task(t)
    status="success"; message="Executed"; output=""
    try:
        if task["mode"]=="condition":
            matched, result=evaluate_condition(task["condition"])
            previous=t["last_condition_state"] or ""
            output=json.dumps(result)[:MAX_OUTPUT]
            if matched and previous!="matched":
                action_result=execute_action(task["action"],{"trigger":trigger,"task_id":task_id,"condition":result})
                output=(output+"\nACTION\n"+json.dumps(action_result))[:MAX_OUTPUT]
                message="Condition matched; action executed"
                cond_state="matched"
            elif matched:
                message="Condition still matched; duplicate notification suppressed"
                cond_state="matched"
            else:
                message="Condition not matched"
                cond_state="clear"
        else:
            action_result=execute_action(task["action"],{"trigger":trigger,"task_id":task_id,"webhook":webhook_payload})
            output=json.dumps(action_result)[:MAX_OUTPUT]
            message="Action executed"
            cond_state=t["last_condition_state"]
    except Exception as e:
        status="error"; message=str(e); output=traceback.format_exc()[-MAX_OUTPUT:]; cond_state=t["last_condition_state"]
    finished=utcnow()
    schedule=task["schedule"]
    enabled=task["enabled"]
    if task["mode"]=="once": enabled=False
    nr=compute_next_run(task["mode"],schedule,finished) if enabled and task["mode"]!="webhook" else None
    with db() as c:
        c.execute("update runs set finished_at=?,status=?,message=?,output=? where id=?",(iso(finished),status,message,output,run_id))
        c.execute("""update tasks set last_run=?,last_status=?,last_message=?,last_condition_state=?,enabled=?,next_run=?,updated_at=? where id=?""",
                  (iso(finished),status,message,cond_state,1 if enabled else 0,iso(nr) if nr else None,iso(finished),task_id))
    return {"ok":status=="success","status":status,"message":message,"run_id":run_id}

def scheduler_loop():
    while True:
        try:
            now=iso(utcnow())
            with db() as c:
                rows=c.execute("select id from tasks where enabled=1 and next_run is not null and next_run<=? order by next_run limit 100",(now,)).fetchall()
            for r in rows:
                run_task(r["id"],"scheduler")
        except Exception:
            traceback.print_exc()
        time.sleep(TICK_SECONDS)

class Handler(SimpleHTTPRequestHandler):
    def log_message(self,fmt,*args):
        print("%s - %s" % (self.address_string(),fmt%args))
    def _json(self,status,obj):
        raw=json.dumps(obj).encode()
        self.send_response(status); self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def _body(self):
        n=int(self.headers.get("Content-Length","0") or 0)
        if n>2_000_000: raise ValueError("request too large")
        raw=self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode() or "{}")
    def _auth(self):
        if not ADMIN_TOKEN: return True
        return self.headers.get("Authorization","")==f"Bearer {ADMIN_TOKEN}"
    def _need_auth(self):
        if self._auth(): return False
        self._json(401,{"error":"unauthorized"}); return True
    def do_GET(self):
        p=urlparse(self.path).path
        if p=="/health": return self._json(200,{"ok":True,"service":"IZAKHONO AUTOMATIONS","time":iso(utcnow())})
        if p=="/api/tasks":
            if self._need_auth(): return
            with db() as c: rows=c.execute("select * from tasks order by created_at desc").fetchall()
            return self._json(200,{"tasks":[row_task(r) for r in rows]})
        if p=="/api/runs":
            if self._need_auth(): return
            with db() as c: rows=c.execute("select * from runs order by id desc limit 200").fetchall()
            return self._json(200,{"runs":[dict(r) for r in rows]})
        if p=="/":
            self.path="/static/index.html"
        return super().do_GET()
    def do_POST(self):
        p=urlparse(self.path).path
        if p.startswith("/hook/"):
            token=p.split("/",2)[2]
            with db() as c: r=c.execute("select id from tasks where webhook_token=? and enabled=1",(token,)).fetchone()
            if not r: return self._json(404,{"error":"webhook not found"})
            try: payload=self._body()
            except Exception: payload={}
            return self._json(200,run_task(r["id"],"webhook",payload))
        if self._need_auth(): return
        try: body=self._body()
        except Exception as e: return self._json(400,{"error":str(e)})
        if p=="/api/tasks":
            try: return self._json(201,create_task(body))
            except Exception as e: return self._json(400,{"error":str(e)})
        m=re.fullmatch(r"/api/tasks/([^/]+)/run",p)
        if m: return self._json(200,run_task(m.group(1),"manual"))
        return self._json(404,{"error":"not found"})
    def do_PATCH(self):
        if self._need_auth(): return
        p=urlparse(self.path).path
        m=re.fullmatch(r"/api/tasks/([^/]+)",p)
        if not m: return self._json(404,{"error":"not found"})
        try: body=self._body(); item=update_task(m.group(1),body)
        except Exception as e: return self._json(400,{"error":str(e)})
        return self._json(200,item) if item else self._json(404,{"error":"task not found"})
    def do_DELETE(self):
        if self._need_auth(): return
        p=urlparse(self.path).path
        m=re.fullmatch(r"/api/tasks/([^/]+)",p)
        if not m: return self._json(404,{"error":"not found"})
        with db() as c:
            n=c.execute("delete from tasks where id=?",(m.group(1),)).rowcount
        return self._json(200,{"deleted":bool(n)})

def main():
    os.chdir(BASE)
    init_db()
    t=threading.Thread(target=scheduler_loop,name="scheduler",daemon=True); t.start()
    print(f"IZAKHONO AUTOMATIONS listening on http://{HOST}:{PORT}")
    print(f"Database: {DB_PATH}")
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()

if __name__=="__main__":
    main()
