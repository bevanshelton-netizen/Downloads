"use client";

export default function LearnerDriverPromo(){
  const href="https://learner-driver-sa-bevan2.vercel.app/?utm_source="+encodeURIComponent(typeof window!=="undefined"?window.location.hostname:"owned-network")+"&utm_medium=owned_network&utm_campaign=learner_driver_sa_launch&utm_content=portfolio_promo";
  return <aside style={{position:"fixed",left:14,bottom:106,zIndex:9997,width:"min(370px,calc(100vw - 28px))",padding:"14px 15px",borderRadius:18,background:"linear-gradient(135deg,#071d45,#0d5e73 72%,#13a873)",border:"1px solid rgba(255,255,255,.22)",boxShadow:"0 18px 45px rgba(0,0,0,.35)",color:"#fff",fontFamily:"system-ui,-apple-system,Segoe UI,sans-serif"}}>
    <a href={href} target="_blank" rel="noopener noreferrer" style={{color:"inherit",textDecoration:"none",display:"block"}}>
      <strong style={{display:"block",fontSize:12,letterSpacing:".12em",color:"#ffd85d",marginBottom:5}}>🇿🇦 LEARNER DRIVER SA</strong>
      <span style={{display:"block",fontWeight:900,fontSize:16,lineHeight:1.2}}>Preparing for your learner&apos;s licence?</span>
      <small style={{display:"block",marginTop:6,lineHeight:1.4,color:"#dceeff"}}>Motorcycles • Code 08 • 10 • 14 • Mock tests • Live simulators • 12 official languages</small>
      <em style={{display:"block",marginTop:9,fontSize:12,fontStyle:"normal",fontWeight:950,color:"#7fffd4"}}>START PREPARING →</em>
    </a>
  </aside>;
}
