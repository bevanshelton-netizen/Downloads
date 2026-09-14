#!/usr/bin/env python3
import argparse, datetime as dt, hashlib, hmac, json, os, pathlib, urllib.parse, urllib.request

ROOT=pathlib.Path(__file__).resolve().parent
CONFIG=json.loads((ROOT/"campaigns.json").read_text(encoding="utf-8"))
PROVIDERS=["facebook","instagram","linkedin","tiktok","x","threads","youtube","google_business"]

def slot_from_utc():
    h=dt.datetime.now(dt.timezone.utc).hour
    return {6:"morning",11:"midday",17:"evening"}.get(h,"morning")

def tracked_url(campaign,slot,provider):
    u=urllib.parse.urlsplit(campaign["url"])
    q=dict(urllib.parse.parse_qsl(u.query,keep_blank_values=True))
    q.update({"utm_source":provider,"utm_medium":"social","utm_campaign":campaign["id"]+"_revenue","utm_content":slot})
    return urllib.parse.urlunsplit((u.scheme,u.netloc,u.path,urllib.parse.urlencode(q),u.fragment))

def outbound(provider,payload):
    prefix="SIGNAL_"+provider.upper().replace("-","_")
    endpoint=os.environ.get(prefix+"_WEBHOOK_URL","").strip()
    token=os.environ.get(prefix+"_TOKEN","").strip()
    if not endpoint:
        return {"status":"READY_FOR_CONNECTION","provider":provider}
    body=json.dumps(payload,separators=(",",":")).encode()
    headers={"Content-Type":"application/json","User-Agent":"IZAKHONO-SIGNAL/1.0"}
    if token: headers["Authorization"]="Bearer "+token
    secret=os.environ.get(prefix+"_SIGNING_SECRET","").strip()
    if secret: headers["X-IZAKHONO-Signature"]="sha256="+hmac.new(secret.encode(),body,hashlib.sha256).hexdigest()
    try:
        req=urllib.request.Request(endpoint,data=body,headers=headers,method="POST")
        with urllib.request.urlopen(req,timeout=25) as r:
            raw=r.read(2048).decode("utf-8","replace")
            return {"status":"POSTED","provider":provider,"http_status":r.status,"response":raw[:500]}
    except Exception as e:
        return {"status":"FAILED","provider":provider,"error":str(e)[:500]}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--slot",choices=["morning","midday","evening"])
    ap.add_argument("--dry-run",action="store_true")
    args=ap.parse_args()
    slot=args.slot or slot_from_utc()
    now=dt.datetime.now(dt.timezone.utc)
    run={"schema":"izakhono.signal.dispatch/v1","slot":slot,"generated_at_utc":now.isoformat(),"campaigns":[]}
    for c in CONFIG["campaigns"]:
        post=c["posts"][slot]
        entry={"id":c["id"],"name":c["name"],"providers":[]}
        for p in PROVIDERS:
            payload={"platform":c["id"],"campaign_name":c["name"],"slot":slot,"provider":p,"text":post,"url":tracked_url(c,slot,p),"generated_at_utc":now.isoformat()}
            result={"status":"DRY_RUN","provider":p} if args.dry_run else outbound(p,payload)
            entry["providers"].append({**payload,**result})
        run["campaigns"].append(entry)
    runtime=ROOT/"runtime"; runtime.mkdir(exist_ok=True)
    (runtime/"latest.json").write_text(json.dumps(run,indent=2,ensure_ascii=False)+"
",encoding="utf-8")
    dated=runtime/(now.strftime("%Y%m%dT%H%M%SZ")+"-"+slot+".json")
    dated.write_text(json.dumps(run,indent=2,ensure_ascii=False)+"
",encoding="utf-8")
    print(json.dumps(run,indent=2,ensure_ascii=False))
    failed=sum(1 for c in run["campaigns"] for p in c["providers"] if p["status"]=="FAILED")
    if failed: raise SystemExit(2)

if __name__=="__main__": main()
