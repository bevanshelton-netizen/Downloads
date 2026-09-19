import { readFileSync } from "node:fs";
import { verify } from "node:crypto";

const MODES=new Set(["off","observe","enforce"]);
const WRITE_METHODS=new Set(["POST","PUT","PATCH","DELETE"]);

function asMode(value){
  const mode=String(value||"observe").toLowerCase();
  if(!MODES.has(mode)) throw new Error("IZAKHONO_WITNESS_MODE must be off, observe, or enforce");
  return mode;
}

export function isWriteMethod(method){
  return WRITE_METHODS.has(String(method||"GET").toUpperCase());
}

export function createWitnessLeaseGuard(component){
  const mode=asMode(process.env.IZAKHONO_WITNESS_MODE);
  const url=String(process.env.IZAKHONO_WITNESS_URL||"").replace(/\/$/,"");
  const clusterId=String(process.env.IZAKHONO_WITNESS_CLUSTER_ID||"");
  const memberKey=String(process.env.IZAKHONO_WITNESS_MEMBER_KEY||"");
  const memberId=String(process.env.IZAKHONO_WITNESS_MEMBER_ID||"");
  const publicKeyFile=String(process.env.IZAKHONO_WITNESS_PUBLIC_KEY_FILE||"");
  const renewMs=Math.min(60000,Math.max(250,Number(process.env.IZAKHONO_WITNESS_RENEW_MS||5000)));
  const configured=Boolean(url&&clusterId&&memberKey&&publicKeyFile);
  let publicKey=null;

  const state={
    component,
    mode,
    configured,
    leaseValid:false,
    fencingToken:null,
    leaseUntil:null,
    memberId:memberId||null,
    receiptVerified:false,
    lastSuccessAt:null,
    lastAttemptAt:null,
    lastError:configured?null:"witness-not-configured"
  };

  if(configured){
    try{
      publicKey=readFileSync(publicKeyFile,"utf8");
    }catch(error){
      state.lastError="public-key-unavailable";
    }
  }

  function validNow(){
    const valid=Boolean(
      state.receiptVerified
      && Number.isInteger(state.fencingToken)
      && state.fencingToken>0
      && Number(state.leaseUntil)>Math.floor(Date.now()/1000)
    );
    state.leaseValid=valid;
    return valid;
  }

  function snapshot(){
    validNow();
    return {...state};
  }

  function verifyReceipt(receipt){
    if(!receipt || receipt.algorithm!=="Ed25519") throw new Error("unsupported-receipt-algorithm");
    const {
      signature,algorithm,
      v,clusterId:receiptClusterId,cluster,
      memberId:receiptMemberId,member,
      fencingToken,leaseUntil,issuedAt
    }=receipt;

    if(v!==1 || receiptClusterId!==clusterId) throw new Error("receipt-cluster-mismatch");
    if(memberId && receiptMemberId!==memberId) throw new Error("receipt-member-mismatch");
    if(!Number.isInteger(fencingToken) || fencingToken<=0) throw new Error("invalid-fencing-token");
    const now=Math.floor(Date.now()/1000);
    if(!Number.isInteger(leaseUntil) || leaseUntil<=now || leaseUntil>now+600) throw new Error("invalid-lease-expiry");
    if(!Number.isInteger(issuedAt) || issuedAt>now+60 || issuedAt<now-600) throw new Error("invalid-receipt-time");
    if(typeof signature!=="string" || !signature) throw new Error("missing-receipt-signature");
    if(!publicKey) throw new Error("witness-public-key-unavailable");

    const body={v,clusterId:receiptClusterId,cluster,memberId:receiptMemberId,member,fencingToken,leaseUntil,issuedAt};
    const ok=verify(null,Buffer.from(JSON.stringify(body)),publicKey,Buffer.from(signature,"base64"));
    if(!ok) throw new Error("invalid-receipt-signature");
    return {body,algorithm};
  }

  async function renew(){
    if(mode==="off" || !configured || !publicKey) return snapshot();
    state.lastAttemptAt=new Date().toISOString();
    try{
      const response=await fetch(url+"/v1/clusters/"+encodeURIComponent(clusterId)+"/lease/acquire",{
        method:"POST",
        headers:{
          "content-type":"application/json",
          "x-witness-member-key":memberKey
        },
        body:"{}",
        cache:"no-store",
        signal:AbortSignal.timeout(Math.min(4000,Math.max(500,renewMs-50)))
      });
      if(!response.ok) throw new Error("witness-http-"+response.status);
      const payload=await response.json();
      const verified=verifyReceipt(payload?.receipt);
      state.receiptVerified=true;
      state.fencingToken=Number(verified.body.fencingToken);
      state.leaseUntil=Number(verified.body.leaseUntil);
      state.memberId=verified.body.memberId;
      state.lastSuccessAt=new Date().toISOString();
      state.lastError=null;
      validNow();
      return snapshot();
    }catch(error){
      state.lastError=String(error?.message||error).slice(0,300);
      validNow();
      return snapshot();
    }
  }

  function canWrite(){
    if(mode!=="enforce") return true;
    return validNow();
  }

  function requestHeaders(){
    const current=snapshot();
    const headers={
      "x-izakhono-witness-mode":current.mode,
      "x-izakhono-witness-lease":current.leaseValid?"valid":"invalid"
    };
    if(current.leaseValid){
      headers["x-izakhono-fencing-token"]=String(current.fencingToken);
      headers["x-izakhono-witness-lease-until"]=String(current.leaseUntil);
    }
    return headers;
  }

  function applyResponseHeaders(res){
    for(const [name,value] of Object.entries(requestHeaders())) res.setHeader(name,value);
  }

  function start(){
    if(mode==="off" || !configured || !publicKey) return;
    void renew();
    setInterval(()=>{void renew();},renewMs).unref();
  }

  return {mode,configured,start,renew,snapshot,canWrite,requestHeaders,applyResponseHeaders};
}
