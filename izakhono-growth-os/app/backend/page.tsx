export const dynamic="force-dynamic";

function yes(v:boolean){return v?"READY":"GATED";}

export default function BackendControl(){
  const bridge=Boolean(process.env.GROWTH_OS_OWNED_BRIDGE_URL && process.env.GROWTH_OS_OWNED_BRIDGE_KEY);
  const auth=Boolean(process.env.IZAKHONO_AUTH_URL) || bridge;
  const data=Boolean(process.env.IZAKHONO_DATA_URL && process.env.IZAKHONO_DATA_KEY);
  const crm=Boolean(process.env.IZAKHONO_CRM_URL) || bridge;
  const measurement=data && Boolean(process.env.MEASUREMENT_INGEST_KEY);
  const vault=Boolean(process.env.OAUTH_TOKEN_ENCRYPTION_KEY);
  const checkout=Boolean(process.env.IKHOKHA_CHECKOUT_URL || process.env.IKHOKHA_BUY_BUTTON_URL);
  const webhook=Boolean(process.env.IKHOKHA_WEBHOOK_SECRET);
  const payments=checkout && webhook;

  const rows=[
    ["Owner access / AUTH",auth,"IZAKHONO AUTH"],
    ["CRM + protected data",crm && data,"IZAKHONO CRM / DATA"],
    ["Approval ledger",auth && data,"Human approval required"],
    ["Measurement ingestion",measurement,"Keyed ingest → IZAKHONO DATA"],
    ["OAuth token vault",vault,"AES-256-GCM server vault"],
    ["iKhokha checkout + revenue webhooks",payments,"No card data stored in Growth OS"]
  ] as const;

  return <main style={{minHeight:"100vh",padding:"42px 22px",background:"#061018",color:"#fff",fontFamily:"system-ui,-apple-system,Segoe UI,sans-serif"}}>
    <section style={{maxWidth:1050,margin:"auto"}}>
      <a href="/" style={{color:"#e5c66f",textDecoration:"none",fontWeight:800}}>← Growth OS</a>
      <div style={{margin:"28px 0",padding:"28px",border:"1px solid #29414d",borderRadius:22,background:"linear-gradient(135deg,#102733,#09141c)"}}>
        <small style={{letterSpacing:".14em",color:"#e5c66f",fontWeight:900}}>IZAKHONO BACKEND CONTROL</small>
        <h1 style={{fontSize:"clamp(38px,7vw,72px)",lineHeight:.95,margin:"12px 0"}}>Public reach. Private authority.</h1>
        <p style={{maxWidth:780,color:"#b7c4ca",lineHeight:1.65}}>This resilience route can stay public while protected authentication, customer data, approvals, measurement, OAuth credentials and payments remain under IZAKHONO control. A module marked GATED is intentionally unavailable rather than silently falling back to insecure storage.</p>
      </div>

      <div style={{display:"grid",gap:10}}>
        {rows.map(([label,state,note])=><article key={label} style={{display:"grid",gridTemplateColumns:"1.4fr auto 1fr",gap:18,alignItems:"center",padding:"16px 18px",border:"1px solid #203743",borderRadius:14,background:"#0a171f"}}>
          <strong>{label}</strong>
          <b style={{fontSize:11,letterSpacing:".1em",padding:"7px 9px",borderRadius:999,background:state?"#153b31":"#3b3016",color:state?"#75e3bd":"#f3ce76"}}>{yes(state)}</b>
          <span style={{color:"#92a4ad",fontSize:12}}>{note}</span>
        </article>)}
      </div>

      <div style={{marginTop:18,padding:18,borderRadius:14,border:"1px solid #31505d",background:"#0b1c25",color:"#b9c7cd",fontSize:13,lineHeight:1.6}}>
        <b style={{color:"#75e3bd"}}>Guardrails locked:</b> live paid-ad writes are OFF; human approval is required before any write; silent budget changes are OFF; external hosting is not the data authority; card data is never stored in Growth OS.
      </div>
    </section>
  </main>;
}
