#!/usr/bin/env python3
import argparse, hashlib, json, subprocess, sys
from pathlib import Path

def run(cmd, check=True):
    p=subprocess.run(cmd,text=True,capture_output=True)
    if check and p.returncode:
        raise RuntimeError((p.stderr or p.stdout).strip() or f'command failed: {cmd}')
    return p

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def main():
    ap=argparse.ArgumentParser(description='IZAKHONO CLOUD v1.17 Owner Console cutover')
    ap.add_argument('manifest')
    ap.add_argument('--repo-root',default='.')
    ap.add_argument('--hostname')
    ap.add_argument('--receipt-dir',default='/tmp/izakhono-receipts')
    ap.add_argument('--ci-proof',action='store_true')
    args=ap.parse_args()
    root=Path(args.repo_root).resolve(); manifest=(root/args.manifest).resolve()
    if root not in manifest.parents: raise SystemExit('manifest must remain inside repository')
    out=Path(args.receipt_dir); out.mkdir(parents=True,exist_ok=True)
    plan=out/'deploy-plan.json'; receipt=out/'deployment-receipt.json'
    cmd=['python3',str(root/'izakhono-cloud/deploy-plane.py'),str(manifest),'--out',str(plan)]
    run(cmd)
    deploy=['python3',str(root/'izakhono-cloud/alpha-deploy.py'),str(manifest),'--repo-root',str(root),'--receipt',str(receipt)]
    if args.ci_proof: deploy.append('--ci-proof')
    run(deploy)
    result={'schema':'izakhono.owner-console-cutover/v1','manifest':str(manifest.relative_to(root)),'deploy_plan_sha256':sha(plan),'deployment_receipt_sha256':sha(receipt),'public_ingress_planned':False,'public_ready':False,'commercial_ready':False}
    if args.hostname:
        data=json.loads(manifest.read_text())
        ingress=out/'public-ingress-plan.json'
        run(['python3',str(root/'izakhono-cloud/public-ingress.py'),'plan','--project',data['slug'],'--hostname',args.hostname,'--upstream-port',str(data['container_port']),'--health-path',data.get('health_path','/'),'--deployment-receipt-sha256',result['deployment_receipt_sha256'],'--out',str(ingress)])
        result['public_ingress_planned']=True; result['public_ingress_plan_sha256']=sha(ingress)
    canon=json.dumps(result,sort_keys=True,separators=(',',':')).encode(); result['cutover_receipt_sha256']=hashlib.sha256(canon).hexdigest()
    final=out/'owner-console-cutover-receipt.json'; final.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
    print(final)
    return 0

if __name__=='__main__':
    try: raise SystemExit(main())
    except Exception as e: print(f'ERROR: {e}',file=sys.stderr); raise SystemExit(2)
