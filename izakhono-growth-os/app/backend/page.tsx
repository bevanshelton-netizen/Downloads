"use client";

import {useEffect,useState} from "react";

type BackendStatus={
  authority?:string;
  externalRoute?:string;
  bridge?:{url?:string|null;configured?:boolean;reachable?:boolean;authentication?:string;policy?:string};
  modules?:Record<string,any>;
  guardrails?:Record<string,boolean>;
};

function State({ready}:{ready:boolean}) {
  return <b style={{fontSize:11,letterSpacing:".1em",padding:"7px 9px",borderRadius:999,background:ready?"#153b31":"#3b3016",color:ready?"#75e3bd":"#f3ce76"}}>{ready?"READY":"GATED"}</b>;
}

export default function BackendControl(){
  const [state,setState]=useState<BackendStatus|null>(null);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    fetch("/api/backend/status",{cache:"no-store"})
      .then(async r=>{if(!r.ok)throw new Error("Backend status unavailable");return r.json();})
      .then(v=>{if(active)setState(v);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"Backend status unavailable");});
    return()=>{active=false;};
  },[]);

  const m=state?.modules||{};
  const rows=[
    ["Owner access / AUTH",Boolean(m.ownerAuth?.ready),"IZAKHONO AUTH"],
    ["CRM + protected data",Boolean(m.crm?.ready&&m.dataAndApprovals?.ready),"IZAKHONO CRM / DATA"],
    ["Approval ledger",Boolean(m.dataAndApprovals?.ready),"Human approval required"],
    ["Measurement ingestion",Boolean(m.measurement?.ready),"Keyed ingest → IZAKHONO DATA"],
    ["OAuth token vault",Boolean(m.oauthVault?.ready),m.oauthVault?.state||"Provider credentials remain owner-side"],
    ["iKhokha via IZAKHONO PAY",Boolean(m.payments?.ready),m.payments?.state||"Protected payment adapter"]
  ];

  const bridgeText=error?error:state?
    "Owned bridge: "+(state.bridge?.reachable?"REACHABLE":"WAITING FOR NODE01")+" · Authority: "+(state.authority||"IZAKHONO"):
    "Checking owned bridge…";

  return <main style={{minHeight:"100vh",padding:"42px 22px",background:"#061018",color:"#fff",fontFamily:"system-ui,-apple-system,Segoe UI,sans-serif"}}>
    <section style={{maxWidth:1050,margin:"auto"}}>
      <a href="/" style={{color:"#e5c66f",textDecoration:"none",fontWeight:800}}>← Growth OS</a>
      <div style={{margin:"28px 0",padding:"28px",border:"1px solid #29414d",borderRadius:22,background:"linear-gradient(135deg,#102733,#09141c)"}}>
        <small style={{letterSpacing:".14em",color:"#e5c66f",fontWeight:900}}>IZAKHONO BACKEND CONTROL</small>
        <h1 style={{fontSize:"clamp(38px,7vw,72px)",lineHeight:.95,margin:"12px 0"}}>Public reach. Private authority.</h1>
        <p style={{maxWidth:780,color:"#b7c4ca",lineHeight:1.65}}>The public resilience route stays available while protected authentication, customer data, approvals, measurement, OAuth credentials and payments remain under IZAKHONO control. GATED means fail-closed—not silently moved to external storage.</p>
        <p style={{fontSize:12,color:state?.bridge?.reachable?"#75e3bd":"#f3ce76",fontWeight:800}}>{bridgeText}</p>
      </div>

      <div style={{display:"grid",gap:10}}>
        {rows.map(([label,ready,note])=><article key={String(label)} style={{display:"grid",gridTemplateColumns:"1.4fr auto 1fr",gap:18,alignItems:"center",padding:"16px 18px",border:"1px solid #203743",borderRadius:14,background:"#0a171f"}}>
          <strong>{label}</strong><State ready={Boolean(ready)}/><span style={{color:"#92a4ad",fontSize:12}}>{String(note)}</span>
        </article>)}
      </div>

      <div style={{marginTop:18,padding:18,borderRadius:14,border:"1px solid #31505d",background:"#0b1c25",color:"#b9c7cd",fontSize:13,lineHeight:1.6}}>
        <b style={{color:"#75e3bd"}}>Guardrails locked:</b> live paid-ad writes are OFF; human approval is required before writes; silent budget changes are OFF; external hosting is not the data authority; card data is never stored in Growth OS; bridge proxy and shell access are disabled.
      </div>
    </section>
  </main>;
}
