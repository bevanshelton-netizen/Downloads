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

  var cashPlatforms={"kora":1,"auto-ai":1,"faisready":1,"mandatory-regulatory-exams":1,"learner-driver-sa":1,"crowne-hair":1};
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
      ["CROWNÉ HAIR — SHOP","https://bevanshelton-netizen.github.io/Downloads/hair/?utm_source="+encodeURIComponent(platform)+"&utm_medium=portfolio_growth_bridge&utm_campaign=crowne_launch","crowne_hair"],
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

  var portfolioAdPlatforms={"kora":1,"learner-driver-sa":1,"mandatory-regulatory-exams":1,"faisready":1,"auto-ai":1,"crowne-hair":1,"allegro":1,"the-chancellor":1};
  function addPortfolioAdRail(){
    if(!portfolioAdPlatforms[platform]||document.getElementById("iz-portfolio-ad-rail"))return;
    var campaign="portfolio_live_20260921";
    function trackedUrl(url){
      try{
        var x=new URL(url);
        x.searchParams.set("utm_source",platform);
        x.searchParams.set("utm_medium","owned_crosspromo");
        x.searchParams.set("utm_campaign",campaign);
        return x.toString();
      }catch(e){return url}
    }
    var ads=[
      {id:"mandatory-regulatory-exams",eyebrow:"PROFESSIONAL PREP",title:"Mandatory Regulatory Exams",body:"Find the regulatory exam that applies to you and start preparing.",cta:"FIND YOUR EXAM",url:"https://mandatory-regulatory-exams.vercel.app/"},
      {id:"learner-driver-sa",eyebrow:"GET ROAD READY",title:"Learner Driver SA",body:"Explore learner-driver preparation for Codes 08, 10, 14 and motorcycles.",cta:"START LEARNING",url:"https://bevanshelton-netizen.github.io/Downloads/learner-driver-sa-campaign"},
      {id:"allegro",eyebrow:"MUSIC WITHOUT BORDERS",title:"ALLEGRO VIBEZ",body:"Discover music across cultures and support the artists behind it.",cta:"EXPLORE ALLEGRO",url:"https://allegro-vibez.vercel.app/"},
      {id:"kora",eyebrow:"AFRICA TO THE WORLD",title:"KORA",body:"African digital entertainment, music, creators and live experiences in one network.",cta:"EXPLORE KORA",url:"https://kora-network.vercel.app/"},
      {id:"the-chancellor",eyebrow:"BUILD A STRONGER BUSINESS",title:"The Chancellor",body:"Start with the R500 Business Readiness Audit and identify your next growth step.",cta:"START R500 AUDIT",url:"https://the-chancellor.vercel.app/"}
    ];
    var root=document.createElement("aside");root.id="iz-portfolio-ad-rail";
    root.setAttribute("aria-label","Featured IZAKHONO services");
    Object.assign(root.style,{position:"fixed",left:"50%",bottom:"76px",transform:"translateX(-50%)",zIndex:"2147482500",width:"min(760px,calc(100vw - 24px))",fontFamily:"Inter,Arial,sans-serif"});
    var card=document.createElement("div");
    Object.assign(card.style,{display:"grid",gridTemplateColumns:"auto 1fr auto auto",gap:"12px",alignItems:"center",padding:"12px 14px",borderRadius:"18px",background:"linear-gradient(135deg,#fff8e8,#ffffff 48%,#eef9ff)",color:"#101820",boxShadow:"0 16px 48px rgba(0,0,0,.24)",border:"1px solid rgba(16,24,32,.12)"});
    var badge=document.createElement("div");badge.textContent="FEATURED";
    Object.assign(badge.style,{fontSize:"10px",fontWeight:"1000",letterSpacing:"1.2px",padding:"7px 9px",borderRadius:"999px",background:"#101820",color:"#fff"});
    var copy=document.createElement("div");
    var eyebrow=document.createElement("div");Object.assign(eyebrow.style,{fontSize:"10px",fontWeight:"900",letterSpacing:".9px",color:"#7a5a11"});
    var title=document.createElement("div");Object.assign(title.style,{fontSize:"16px",fontWeight:"1000",lineHeight:"1.15"});
    var body=document.createElement("div");Object.assign(body.style,{fontSize:"12px",lineHeight:"1.3",color:"#4d5861",marginTop:"2px"});
    copy.appendChild(eyebrow);copy.appendChild(title);copy.appendChild(body);
    var cta=document.createElement("a");cta.target="_blank";cta.rel="noopener";
    Object.assign(cta.style,{textDecoration:"none",whiteSpace:"nowrap",borderRadius:"12px",padding:"10px 12px",fontSize:"12px",fontWeight:"1000",background:"#f4bf32",color:"#101820"});
    var close=document.createElement("button");close.type="button";close.textContent="×";close.setAttribute("aria-label","Close featured adverts");
    Object.assign(close.style,{border:"0",background:"transparent",color:"#5d6670",fontSize:"22px",lineHeight:"1",cursor:"pointer",padding:"4px"});
    card.appendChild(badge);card.appendChild(copy);card.appendChild(cta);card.appendChild(close);root.appendChild(card);
    var index=0;
    function render(){
      var a=ads[index%ads.length];
      eyebrow.textContent=a.eyebrow;title.textContent=a.title;body.textContent=a.body;cta.textContent=a.cta;cta.href=trackedUrl(a.url);
      cta.setAttribute("data-growth-cta","portfolio_ad_"+a.id);
      track("ad_impression",{campaign:campaign,creative:a.id,placement:"portfolio_ad_rail",page:location.pathname});
      index=(index+1)%ads.length;
    }
    cta.addEventListener("click",function(){
      var shown=ads[(index+ads.length-1)%ads.length];
      track("ad_click",{campaign:campaign,creative:shown.id,placement:"portfolio_ad_rail",page:location.pathname});
    });
    close.addEventListener("click",function(){root.remove();track("ad_dismiss",{campaign:campaign,placement:"portfolio_ad_rail",page:location.pathname})});
    render();document.body.appendChild(root);
    var timer=setInterval(function(){if(!document.body.contains(root)){clearInterval(timer);return}render()},12000);
    if(window.matchMedia&&window.matchMedia("(max-width:640px)").matches){
      card.style.gridTemplateColumns="1fr auto";badge.style.display="none";body.style.display="none";cta.style.gridColumn="1 / 2";close.style.gridColumn="2 / 3";root.style.bottom="74px";
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",addPortfolioAdRail,{once:true});else addPortfolioAdRail();

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
    if(/^https:\/\/pay\.ikhokha\.com\//i.test(href)){
      var amount=0,offer="ikhokha_checkout";
      if(/re5-and-re1-complete-p/i.test(href)){amount=54900;offer="re1_re5_bundle"}
      else if(/re5completeprepara/i.test(href)){amount=29900;offer="re5_complete"}
      track("checkout_start",{offer:offer,cta:label,page:location.pathname,checkout_host:"pay.ikhokha.com"},amount,"ZAR");
    }
  },true);

  document.addEventListener("submit",function(e){
    var f=e.target;if(!f||f.tagName!=="FORM")return;
    track("lead_started",{page:location.pathname,cta:clean(f.getAttribute("data-growth-intent")||f.id||f.name||"form",100)});
  },true);
})();