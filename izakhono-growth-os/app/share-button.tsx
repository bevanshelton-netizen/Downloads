"use client";

export default function ShareButton(){
  async function share(){
    const url=window.location.href;
    const title=document.title||"Share this platform";
    const text=document.querySelector('meta[name="description"]')?.getAttribute('content')||title;
    try{
      if(navigator.share){ await navigator.share({title,text,url}); return; }
      if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(url); alert("Link copied."); return; }
    }catch(e:any){ if(e?.name==="AbortError") return; }
    window.prompt("Copy this link",url);
  }
  return <button type="button" onClick={share} aria-label="Share this platform" style={{
    position:"fixed",right:16,bottom:18,zIndex:99999,border:"1px solid rgba(255,255,255,.28)",
    borderRadius:999,padding:"12px 16px",fontWeight:800,fontSize:14,cursor:"pointer",
    background:"linear-gradient(135deg,#21e5ad,#2f9cff)",color:"#04131d",
    boxShadow:"0 14px 34px rgba(0,0,0,.32)"
  }}>↗ Share</button>;
}
