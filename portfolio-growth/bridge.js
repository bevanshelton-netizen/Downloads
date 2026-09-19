(function(){
  "use strict";
  var script=document.currentScript;
  var platform=(script&&script.dataset&&script.dataset.platform)||document.documentElement.getAttribute("data-platform")||"";
  if(!platform)return;
  var API="https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-portfolio-growth-api";
  var U=new URLSearchParams(location.search);
  var ref=U.get("ref")||U.get("referral")||"";
  var anon;
  try{anon=localStorage.getItem("iz_portfolio_anon");if(!anon){anon=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());localStorage.setItem("iz_portfolio_anon",anon)}}catch{anon=String(Date.now())+Math.random()}
  var attr={
    utm_source:U.get("utm_source")||"",
    utm_medium:U.get("utm_medium")||"",
    utm_campaign:U.get("utm_campaign")||"",
    referral_code:ref
  };
  function clean(v,n){return String(v==null?"":v).trim().slice(0,n||160)}
  function send(body){
    try{return fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),keepalive:true}).catch(function(){})}catch(e){}
  }
  function track(eventName,metadata,amountCents,currency){
    return send(Object.assign({
      action:"track",platform_slug:platform,event_name:eventName,anonymous_id:anon,
      amount_cents:Number.isFinite(Number(amountCents))?Math.max(0,Math.round(Number(amountCents))):null,
      currency:currency||undefined,
      metadata:metadata||{}
    },attr));
  }
  function lead(data){
    data=data||{};
    return send(Object.assign({
      action:"lead",platform_slug:platform,
      contact_name:clean(data.contact_name||data.name,120),
      business_name:clean(data.business_name,160),
      email:clean(data.email,180),
      phone:clean(data.phone,60),
      intent:clean(data.intent,1200),
      lead_type:clean(data.lead_type||"general",60),
      lead_quality:clean(data.lead_quality,10),
      marketing_consent:!!data.marketing_consent,
      website:clean(data.website,120)
    },attr));
  }
  function referralUrl(code){
    var x=new URL(location.href);if(code)x.searchParams.set("ref",clean(code,40));return x.toString();
  }
  function share(network,text,url){
    var target=url||location.href;
    var t=encodeURIComponent(text||document.title),u=encodeURIComponent(target),x="";
    if(network==="facebook")x="https://www.facebook.com/sharer/sharer.php?u="+u;
    else if(network==="linkedin")x="https://www.linkedin.com/sharing/share-offsite/?url="+u;
    else if(network==="whatsapp")x="https://wa.me/?text="+t+"%20"+u;
    else if(network==="x")x="https://twitter.com/intent/tweet?text="+t+"&url="+u;
    track("share",{platform:network,page:location.pathname});
    if(x)window.open(x,"_blank","noopener,noreferrer");
  }
  window.IZGrowth={platform:platform,track:track,lead:lead,share:share,referralUrl:referralUrl,attribution:attr};

  var cashPlatforms={"kora":1,"auto-ai":1,"faisready":1,"mandatory-regulatory-exams":1,"learner-driver-sa":1};
  function addCashLauncher(){
    if(!cashPlatforms[platform]||document.getElementById("iz-cash-launcher"))return;
    var root=document.createElement("aside");root.id="iz-cash-launcher";
    Object.assign(root.style,{position:"fixed",left:"14px",bottom:"14px",zIndex:"2147483000",fontFamily:"Arial,sans-serif",maxWidth:"min(340px,calc(100vw - 28px))"});
    var toggle=document.createElement("button");toggle.type="button";toggle.textContent="⚡ POPULAR SERVICES";
    toggle.setAttribute("aria-expanded","false");
    Object.assign(toggle.style,{border:"0",borderRadius:"999px",padding:"12px 15px",fontWeight:"900",cursor:"pointer",background:"#101820",color:"#fff",boxShadow:"0 12px 32px rgba(0,0,0,.32)"});
    var panel=document.createElement("div");panel.hidden=true;
    Object.assign(panel.style,{marginBottom:"8px",padding:"12px",borderRadius:"16px",background:"#fff",color:"#111",boxShadow:"0 18px 45px rgba(0,0,0,.34)",border:"1px solid rgba(0,0,0,.1)"});
    var title=document.createElement("div");title.textContent="LIVE OFFERS";Object.assign(title.style,{fontSize:"11px",fontWeight:"900",letterSpacing:"1px",marginBottom:"8px"});
    panel.appendChild(title);
    var offers=[
      ["RE5 PREP — R299","https://pay.ikhokha.com/izakhono/buy/re5completeprepara","direct_checkout_re5"],
      ["RE1 + RE5 — R549","https://pay.ikhokha.com/izakhono/buy/re5-and-re1-complete-p","direct_checkout_bundle"],
      ["BUSINESS GROWTH","https://izakhono-revenue-desk.vercel.app/?utm_source="+encodeURIComponent(platform)+"&utm_medium=portfolio_growth_bridge&utm_campaign=cash_first","growth_desk"]
    ];
    offers.forEach(function(o){
      var a=document.createElement("a");a.href=o[1];a.target="_blank";a.rel="noopener";a.textContent=o[0];
      Object.assign(a.style,{display:"block",textDecoration:"none",textAlign:"center",padding:"11px 12px",marginTop:"7px",borderRadius:"10px",fontWeight:"900",background:"#eef3f6",color:"#101820"});
      a.addEventListener("click",function(){track("cta_click",{cta:o[2],page:location.pathname,source:"cash_launcher"})});
      panel.appendChild(a);
    });
    var note=document.createElement("small");note.textContent="Payments open on the live iKhokha checkout where shown.";
    Object.assign(note.style,{display:"block",marginTop:"9px",lineHeight:"1.35",color:"#53606a"});
    panel.appendChild(note);
    toggle.addEventListener("click",function(){panel.hidden=!panel.hidden;toggle.setAttribute("aria-expanded",String(!panel.hidden));});
    root.appendChild(panel);root.appendChild(toggle);document.body.appendChild(root);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",addCashLauncher,{once:true});else addCashLauncher();

  function scrubUnresolvedDestinations(){
    try{
      document.querySelectorAll('a[href^="https://ai.izakhono.co.za/"]').forEach(function(link){link.remove()});
    }catch(e){}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",scrubUnresolvedDestinations,{once:true});else scrubUnresolvedDestinations();
  setTimeout(scrubUnresolvedDestinations,1200);

  track("page_view",{page:location.pathname});
  fetch(API+"?platform="+encodeURIComponent(platform)).then(function(r){return r.json()}).then(function(d){
    var p=d&&d.platform;if(!p)return;window.IZGrowth.config=p;
    if(p.share_enabled&&!document.querySelector("[data-growth-share],.share-widget,[class*='shareWidget'],[id*='shareWidget']")){
      var b=document.createElement("button");b.type="button";b.setAttribute("data-growth-share","auto");b.textContent="Share";
      b.setAttribute("aria-label","Share "+p.display_name);
      b.style.cssText="position:fixed;right:16px;bottom:16px;z-index:2147483000;border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:10px 14px;background:#071019;color:#fff;font:700 13px system-ui;box-shadow:0 8px 28px rgba(0,0,0,.28);cursor:pointer";
      b.onclick=function(){track("share",{platform:"native",page:location.pathname});if(navigator.share){navigator.share({title:document.title,text:p.primary_goal,url:location.href}).catch(function(){})}else{share("whatsapp",document.title,location.href)}};
      document.body.appendChild(b);
    }
  }).catch(function(){});

  document.addEventListener("click",function(e){
    var el=e.target&&e.target.closest?e.target.closest("a,button"):null;if(!el)return;
    var explicit=el.getAttribute("data-growth-cta");
    var label=clean(explicit||el.getAttribute("aria-label")||el.textContent,100);
    if(!label)return;
    var href=el.getAttribute("href")||"";
    if(explicit||/(buy|pay|start|join|apply|enrol|book|quote|register|sign up|listen|watch|learn|request|get|find|open|try|check|upload|advertise|sell)/i.test(label)){
      track("cta_click",{cta:label,page:location.pathname,source_page:href});
    }
  },true);

  document.addEventListener("submit",function(e){
    var f=e.target;if(!f||f.tagName!=="FORM")return;
    track("lead_started",{page:location.pathname,cta:clean(f.getAttribute("data-growth-intent")||f.id||f.name||"form",100)});
  },true);
})();