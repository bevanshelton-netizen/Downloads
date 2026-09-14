const BASE="https://bevanshelton-netizen.github.io/Downloads/";
const campaigns=[
 {id:"auto-ai",name:"AUTO AI",status:"live",url:BASE+"auto-ai/",tagline:"Understand your car before you spend.",aud:"Motorists, out-of-plan vehicle owners, used-car buyers, families and fleets.",offer:"FREE safety help • R79 Vehicle Health • R99 Quote Review • R149 Used-Car Buyer Check",posts:[
  "Something wrong with your car? Ask AUTO AI before you start replacing parts. Free safety-first help, plain language and no workshop jargon.",
  "Got a mechanic’s quotation and not sure what you’re paying for? AUTO AI Repair Quote Second Opinion — R99.",
  "Buying a used car? Check the warning signs before you buy someone else’s problem. AUTO AI Used-Car Buyer Check — R149."
 ]},
 {id:"doxa-sure",name:"DOXA-SURE",status:"live",url:BASE+"doxa-sure/site/",tagline:"Protect what matters before a financial problem becomes a crisis.",aud:"Homeowners, vehicle owners, income earners and families facing asset risk.",offer:"Early-risk support, rescue guidance and protection pathways.",posts:[
  "When a home, vehicle or income is under pressure, acting early matters. DOXA-SURE helps you understand the risk and the next step.",
  "Financial trouble becomes more expensive when ignored. DOXA-SURE is built to help people act before essential assets are lost.",
  "Protect what matters most. Explore DOXA-SURE’s practical early-warning and assistance pathways."
 ]},
 {id:"faisready",name:"FAISReady",status:"live",url:BASE+"FAISReady/",tagline:"Prepare smarter for South African regulatory exams.",aud:"RE1/RE5 candidates, financial-services professionals and employers.",offer:"RE1 / RE5 preparation and paid learning bundles.",posts:[
  "Preparing for RE1 or RE5? FAISReady gives you a focused digital path to prepare with confidence.",
  "Stop studying blindly. Use FAISReady to structure your regulatory-exam preparation around what you actually need to know.",
  "Your next FAIS exam attempt should be your strongest one. Start with FAISReady."
 ]},
 {id:"fais-campaign",name:"FAISReady Campaign",status:"live",url:BASE+"faisready-campaign/",tagline:"Direct-response campaign landing page.",aud:"High-intent RE candidates ready to purchase.",offer:"Conversion-focused FAISReady campaign.",posts:[
  "RE exam coming up? Don’t leave preparation until the last minute. Start your FAISReady plan now.",
  "RE1 and RE5 candidates: turn exam anxiety into a structured preparation plan with FAISReady.",
  "Serious about passing? Open the FAISReady campaign and get started."
 ]},
 {id:"racing",name:"Bevan Shelton Racing",status:"live",url:BASE+"bevan-shelton-racing/",tagline:"African-built digital racing experience.",aud:"Gamers, young adults, racing fans and African entertainment audiences.",offer:"Play, experience and follow the Bevan Shelton racing universe.",posts:[
  "Ready to race? Step into the Bevan Shelton Racing experience — built with African ambition.",
  "Speed. Obstacles. African roads. Bevan Shelton Racing is building a new digital racing universe.",
  "Gamers: take the track and see where Bevan Shelton Racing is headed next."
 ]},
 {id:"kora",name:"KORA Network",status:"live",url:"https://kora-network.vercel.app/",tagline:"Built in Africa for the world.",aud:"Artists, audiences, creators, live-event fans and advertisers.",offer:"Music, video, creators, live events and African entertainment.",posts:[
  "African talent deserves a global screen. Discover KORA — Built in Africa for the world.",
  "Artists and creators: KORA is building a home for music, live performance, audiences and opportunity.",
  "Watch. Listen. Discover. Support African creativity on KORA."
 ]},
 {id:"izakhono-africa",name:"IZAKHONO Africa",status:"live",url:"https://izakhonoafrica.co.za/",tagline:"Manufacturing, clothing and enterprise solutions.",aud:"Schools, clubs, companies, teams and organisations.",offer:"Uniforms, sportswear, PPE, corporate wear and custom manufacturing.",posts:[
  "Need uniforms, sportswear, PPE or branded clothing? IZAKHONO Africa manufactures for schools, teams and organisations.",
  "From one team to a full organisation: custom clothing and manufacturing solutions from IZAKHONO Africa.",
  "Put your brand on quality clothing made for real work, sport and everyday wear. Talk to IZAKHONO Africa."
 ]},
 {id:"edubuild",name:"Edu-Build Shelton Campuses",status:"live",url:"https://edubuildshelton.org.za/",tagline:"Build a career in Early Childhood Development.",aud:"ECD practitioners, school leavers, working educators and community learners.",offer:"ECD NQF Level 4 & 5 programmes and campus network.",posts:[
  "Want a recognised path into Early Childhood Development? Explore Edu-Build Shelton Campuses.",
  "ECD NQF Level 4 and Level 5 learning opportunities — build your skills and your future with Edu-Build.",
  "Your community needs skilled ECD practitioners. Start your training journey with Edu-Build Shelton Campuses."
 ]},
 {id:"allegro",name:"ALLEGRO VIBEZ",status:"staged",url:"",tagline:"South African creative-economy and music ecosystem.",aud:"Musicians, rights holders, audiences and creative businesses.",offer:"Profiles, rights, royalties, radio, wallet and creative-economy tools.",posts:[]},
 {id:"ecd360",name:"EDU-BUILD 360",status:"staged",url:"",tagline:"AI Campus & Learning Management Ecosystem.",aud:"Students, facilitators, campuses and administrators.",offer:"Virtual classes, AI facilitation and campus administration.",posts:[]},
 {id:"chancellor",name:"THE CHANCELLOR",status:"staged",url:"",tagline:"AI-powered business growth desk.",aud:"Entrepreneurs, SMEs and founders.",offer:"Business readiness, growth guidance and execution support.",posts:[]},
 {id:"trade",name:"IZAKHONO Trade",status:"staged",url:"",tagline:"Services marketplace for trusted local work.",aud:"Households, SMEs, tradespeople and service providers.",offer:"Book services and connect customers with providers.",posts:[]},
 {id:"legacymart",name:"LegacyMart",status:"staged",url:"",tagline:"Digital marketplace platform.",aud:"Online buyers and sellers.",offer:"Marketplace commerce.",posts:[]},
 {id:"fortress",name:"Shelton Fortress",status:"staged",url:"",tagline:"Secure owner-controlled digital infrastructure.",aud:"Enterprise and security-conscious customers.",offer:"Security platform and controlled infrastructure.",posts:[]}
];

const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
const live=campaigns.filter(c=>c.status==="live");
qs("#liveCount").textContent=live.length; qs("#stagedCount").textContent=campaigns.length-live.length;

function utm(c,slot){
 const u=new URL(c.url);
 u.searchParams.set("utm_source","izakhono_signal");
 u.searchParams.set("utm_medium","social");
 u.searchParams.set("utm_campaign",c.id+"_revenue");
 u.searchParams.set("utm_content",slot);
 return u.toString();
}
function render(filter="all"){
 qs("#campaigns").innerHTML=campaigns.filter(c=>filter==="all"||c.status===filter).map(c=>`
 <article class="campaign ${c.status}">
  <span class="status ${c.status}">${c.status==="live"?"RUN NOW":"STAGED"}</span>
  <span class="eyebrow">${c.id.toUpperCase()}</span>
  <h3>${c.name}</h3><div class="tagline">${c.tagline}</div>
  <p class="aud"><strong>Audience:</strong> ${c.aud}</p><div class="offer">${c.offer}</div>
  <div class="campaign-actions">
    ${c.status==="live"?`<button class="run" data-run="${c.id}">Add ×3 today</button><a href="${c.url}" target="_blank" rel="noopener">Open ↗</a>`:'<button disabled>Await public launch</button>'}
  </div>
 </article>`).join("");
 qsa("[data-run]").forEach(b=>b.onclick=()=>queueOne(b.dataset.run));
}
function queueOne(id){
 const c=campaigns.find(x=>x.id===id); if(!c||c.status!=="live")return;
 const q=JSON.parse(localStorage.getItem("izakhono.signal.queue")||"[]").filter(x=>x.campaign!==id);
 ["08:00","13:00","19:00"].forEach((t,i)=>q.push({campaign:id,time:t,slot:["morning","midday","evening"][i],text:c.posts[i],url:utm(c,["morning","midday","evening"][i])}));
 localStorage.setItem("izakhono.signal.queue",JSON.stringify(q)); updateStatus(); showBoard();
}
function queueAll(){
 const q=[];
 live.forEach(c=>["08:00","13:00","19:00"].forEach((t,i)=>q.push({campaign:c.id,time:t,slot:["morning","midday","evening"][i],text:c.posts[i],url:utm(c,["morning","midday","evening"][i])})));
 localStorage.setItem("izakhono.signal.queue",JSON.stringify(q)); updateStatus(); showBoard();
}
function updateStatus(){
 const q=JSON.parse(localStorage.getItem("izakhono.signal.queue")||"[]");
 qs("#queueStatus").textContent=q.length?q.length+" posts queued on this device for the campaign board.":"Nothing queued on this device yet.";
}
function shareLinks(item){
 const full=item.text+"\n\n"+item.url;
 return {
  x:"https://twitter.com/intent/tweet?text="+encodeURIComponent(item.text)+"&url="+encodeURIComponent(item.url),
  fb:"https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(item.url),
  li:"https://www.linkedin.com/sharing/share-offsite/?url="+encodeURIComponent(item.url),
  wa:"https://wa.me/?text="+encodeURIComponent(full)
 };
}
function showBoard(){
 const q=JSON.parse(localStorage.getItem("izakhono.signal.queue")||"[]");
 if(!q.length) queueAll();
 const data=JSON.parse(localStorage.getItem("izakhono.signal.queue")||"[]").sort((a,b)=>a.time.localeCompare(b.time)||a.campaign.localeCompare(b.campaign));
 qs("#schedule").innerHTML=data.map((item,i)=>{
  const c=campaigns.find(x=>x.id===item.campaign), links=shareLinks(item);
  return `<article class="slot"><div class="slot-top"><h3>${c.name} • ${item.slot}</h3><div class="slot-time">${item.time}</div></div>
  <div class="post-text">${item.text}\n\n${item.url}</div>
  <div class="share-row"><button class="share" data-share="${i}">Share</button><button data-copy="${i}">Copy</button>
  <a href="${links.x}" target="_blank">X</a><a href="${links.fb}" target="_blank">Facebook</a><a href="${links.li}" target="_blank">LinkedIn</a><a href="${links.wa}" target="_blank">WhatsApp</a></div></article>`;
 }).join("");
 qs("#board").hidden=false; qs("#connections").hidden=true; qs("#board").scrollIntoView({behavior:"smooth"});
 qsa("[data-copy]").forEach(b=>b.onclick=async()=>{const item=data[Number(b.dataset.copy)];await navigator.clipboard.writeText(item.text+"\n\n"+item.url);b.textContent="Copied ✓"});
 qsa("[data-share]").forEach(b=>b.onclick=async()=>{const item=data[Number(b.dataset.share)];if(navigator.share)await navigator.share({title:"IZAKHONO SIGNAL",text:item.text,url:item.url});else await navigator.clipboard.writeText(item.text+"\n\n"+item.url)});
}
qs("#queueAll").onclick=queueAll; qs("#todayBoard").onclick=showBoard; qs("#connectionsBtn").onclick=()=>{qs("#connections").hidden=false;qs("#board").hidden=true;qs("#connections").scrollIntoView({behavior:"smooth"})};
qsa("[data-close]").forEach(b=>b.onclick=()=>qs("#"+b.dataset.close).hidden=true);
qsa(".filter").forEach(b=>b.onclick=()=>{qsa(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render(b.dataset.filter)});
render();updateStatus();
function loadSignalEvents(){
  try{
    const ev=JSON.parse(localStorage.getItem("izakhono.signal.events")||"[]").filter(x=>x.platform==="auto-ai");
    const visits=ev.filter(x=>x.event==="landing").length;
    const checkouts=ev.filter(x=>x.event==="checkout_start").length;
    document.querySelector("#attribVisits").textContent=visits;
    document.querySelector("#attribCheckouts").textContent=checkouts;
    document.querySelector("#attribRate").textContent=visits?((checkouts/visits)*100).toFixed(1)+"%":"0%";
  }catch(_){}
}
loadSignalEvents();
window.addEventListener("focus",loadSignalEvents);

const videoScripts={
 "auto-ai":["WARNING LIGHT? STRANGE NOISE?","ASK AUTO AI FIRST","R79 Health • R99 Quote • R149 Buyer Check","DON'T GUESS. KNOW. — AUTO AI"],
 "doxa-sure":["ASSET UNDER PRESSURE?","ACT BEFORE THE CRISIS","Protect homes, vehicles and income","DOXA-SURE — Protect What Matters"],
 "faisready":["RE1 OR RE5 COMING UP?","STOP STUDYING BLINDLY","Focused exam preparation","FAISREADY — PREPARE SMARTER"],
 "fais-campaign":["READY TO PASS YOUR RE EXAM?","START A STRUCTURED PLAN","RE1 + RE5 preparation","OPEN FAISREADY TODAY"],
 "racing":["READY TO RACE?","AFRICAN ROADS. REAL ATTITUDE.","Speed • Obstacles • Competition","BEVAN SHELTON RACING"],
 "kora":["AFRICAN TALENT DESERVES A GLOBAL SCREEN","WATCH • LISTEN • DISCOVER","Artists, live events and creators","KORA — BUILT IN AFRICA FOR THE WORLD"],
 "izakhono-africa":["NEED QUALITY CUSTOM CLOTHING?","SCHOOLS • TEAMS • COMPANIES","Uniforms • PPE • Sportswear • Corporate","IZAKHONO AFRICA — MADE TO WORK"],
 "edubuild":["BUILD A CAREER IN ECD","NQF LEVEL 4 + LEVEL 5","Learn • Qualify • Serve your community","EDU-BUILD SHELTON CAMPUSES"]
};
function renderVideoAds(){
 const grid=document.querySelector("#videoGrid"); if(!grid)return;
 grid.innerHTML=live.map(c=>{
   const s=videoScripts[c.id]||[c.tagline,c.offer,"Built for the right audience","OPEN "+c.name];
   return `<article class="video-card"><span class="format">15 SEC • 9:16</span><h3>${c.name}</h3>
   <ol><li><b>0–3s:</b> ${s[0]}</li><li><b>3–7s:</b> ${s[1]}</li><li><b>7–12s:</b> ${s[2]}</li><li><b>12–15s:</b> ${s[3]}</li></ol>
   <div class="video-actions"><button class="primary-video" data-video-copy="${c.id}">Copy script</button><button data-video-share="${c.id}">Share brief</button></div></article>`;
 }).join("");
 qsa("[data-video-copy]").forEach(b=>b.onclick=async()=>{const c=campaigns.find(x=>x.id===b.dataset.videoCopy),s=videoScripts[c.id];const txt=`${c.name} — 15s vertical video\n0–3s: ${s[0]}\n3–7s: ${s[1]}\n7–12s: ${s[2]}\n12–15s: ${s[3]}\nCTA: ${c.url}`;await navigator.clipboard.writeText(txt);b.textContent="Copied ✓"});
 qsa("[data-video-share]").forEach(b=>b.onclick=async()=>{const c=campaigns.find(x=>x.id===b.dataset.videoShare),s=videoScripts[c.id];const txt=`${c.name} video ad: ${s.join(" • ")}`;if(navigator.share)await navigator.share({title:c.name+" Video Ad",text:txt,url:c.url});else await navigator.clipboard.writeText(txt+"\n"+c.url)});
}
document.querySelector("#videoAdsBtn").onclick=()=>{renderVideoAds();qs("#videoAds").hidden=false;qs("#board").hidden=true;qs("#connections").hidden=true;qs("#videoAds").scrollIntoView({behavior:"smooth"})};
