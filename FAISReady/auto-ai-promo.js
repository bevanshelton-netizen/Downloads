(()=>{if(window.__autoAiPromo)return;window.__autoAiPromo=true;
const source=(document.documentElement.dataset.autoAiSource||location.hostname||"izakhono").replace(/[^a-z0-9-]+/gi,"-").toLowerCase();
const url=new URL("https://bevanshelton-netizen.github.io/Downloads/auto-ai/");
url.searchParams.set("utm_source",source);url.searchParams.set("utm_medium","cross_promo");url.searchParams.set("utm_campaign","auto_ai_cash_sprint");url.searchParams.set("utm_content","r99_quote");
function mount(){if(document.querySelector("[data-auto-ai-promo]"))return;
 const a=document.createElement("a");a.href=url.toString();a.target="_blank";a.rel="noopener";a.setAttribute("data-auto-ai-promo","1");
 a.innerHTML='<strong>AUTO AI</strong><span>Mechanic quote? Get a second opinion for <b>R99</b>.</span><em>Check it now →</em>';
 Object.assign(a.style,{position:"fixed",left:"14px",bottom:"14px",zIndex:"9998",width:"min(360px,calc(100vw - 28px))",padding:"13px 15px",borderRadius:"16px",textDecoration:"none",background:"linear-gradient(135deg,#0e1f30,#132f43)",border:"1px solid #3e6279",boxShadow:"0 18px 45px rgba(0,0,0,.42)",color:"#f7fbff",fontFamily:"system-ui,-apple-system,Segoe UI,sans-serif"});
 a.querySelector("strong").style.cssText="display:block;font-size:12px;letter-spacing:.13em;color:#55e3cf;margin-bottom:4px";
 a.querySelector("span").style.cssText="display:block;font-size:13px;line-height:1.35;font-weight:700";
 a.querySelector("em").style.cssText="display:block;margin-top:7px;font-size:11px;font-style:normal;font-weight:900;color:#f2cf6b";
 document.body.appendChild(a);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();