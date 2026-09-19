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
  window.IZGrowth={platform:platform,track:track,lead:lead,share:share,attribution:attr};

  track("page_view",{page:location.pathname});

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