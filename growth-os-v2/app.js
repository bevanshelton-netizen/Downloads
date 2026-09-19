const pageTitles={command:"Command Centre",campaign:"AI Campaign Studio",creative:"Creative Factory",social:"Social Autopilot",landing:"Landing Pages",leads:"Leads & CRM",revenue:"Revenue Desk",connections:"Connections"};
const toast=(msg)=>{const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400)};
function openPage(id){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===id));document.getElementById("pageTitle").textContent=pageTitles[id]||"Growth OS";window.scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>openPage(b.dataset.page)));
document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>openPage(b.dataset.open)));
document.getElementById("newCampaignBtn").addEventListener("click",()=>openPage("campaign"));
document.getElementById("scanBrandBtn").addEventListener("click",()=>{toast("Brand scan complete: offer, tone, audience and channels mapped.");});
document.getElementById("shareBtn").addEventListener("click",async()=>{const data={title:"IZAKHONO GROWTH OS",text:"AI-powered growth engine for ads, content, leads and revenue.",url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast("Link copied.");}}catch(e){}});
document.getElementById("generateCampaign").addEventListener("click",()=>{
  const offer=document.getElementById("offerInput").value.trim()||"your offer";
  const audience=document.getElementById("audienceInput").value.trim()||"your ideal customers";
  const price=document.getElementById("priceInput").value.trim();
  document.getElementById("campaignOutput").innerHTML=
    "<h4>Hook</h4><p>What if "+offer+" could reach the right people every day without you living inside Ads Manager?</p>"+
    "<h4>Primary copy</h4><p>Built for "+audience+" This campaign leads with a clear problem, a specific outcome and a simple next step"+(price?" at "+price+".":".")+"</p>"+
    "<h4>CTA</h4><p>Get started today</p>"+
    "<div class='variant-tags'><span>Direct response</span><span>Founder-led</span><span>Problem/Solution</span><span>Proof-led</span><span>Offer-led</span><span>FAQ</span></div>";
  document.getElementById("campaignStatus").textContent="GENERATED";
  const d=document.getElementById("draftCount");d.textContent=String(Number(d.textContent)+1);
  toast("Campaign pack generated. Paid publishing remains approval-gated.");
});
document.getElementById("generateCreatives").addEventListener("click",()=>toast("Creative batch generated: 4 statics, 3 reels, 2 UGC scripts and 1 offer card."));
document.getElementById("buildCalendar").addEventListener("click",()=>toast("30-day channel calendar generated."));
document.getElementById("generateLanding").addEventListener("click",()=>toast("Landing page draft generated with lead capture and checkout slot."));
document.getElementById("addLead").addEventListener("click",()=>{
  const row=document.createElement("div");row.className="lead-row";row.innerHTML="<span>Demo Lead</span><span>Growth OS</span><span class='stage new'>NEW</span><span>Qualify now</span>";
  document.getElementById("leadTable").appendChild(row);
  const l=document.getElementById("leadCount");l.textContent=String(Number(l.textContent)+1);toast("Demo lead added to CRM.");
});
document.getElementById("brandSelect").addEventListener("change",e=>toast("Workspace switched to "+e.target.value));
document.querySelectorAll(".connections button").forEach(b=>b.addEventListener("click",()=>toast("Connection flow prepared. OAuth credentials are required to activate this channel.")));