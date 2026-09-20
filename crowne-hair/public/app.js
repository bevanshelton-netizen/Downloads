const products=[
{sku:"CRN-VELVET-CURL",name:"Velvet Curl",category:"Wigs",texture:"Deep curl",price:1899,image:"https://images.pexels.com/photos/6484129/pexels-photo-6484129.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Full-volume glamour with a defined curl finish."},
{sku:"CRN-BODY-WAVE",name:"Bombshell Body",category:"Wigs",texture:"Body wave",price:2199,image:"https://images.pexels.com/photos/15868319/pexels-photo-15868319.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Long, fluid movement made for dramatic entrances."},
{sku:"CRN-BUNDLE-BAR",name:"Signature Bundles",category:"Weaves",texture:"Multi texture",price:699,image:"https://images.pexels.com/photos/14730867/pexels-photo-14730867.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Build your own length, density and colour story."},
{sku:"CRN-SLEEK-BOB",name:"After-Dark Bob",category:"Wigs",texture:"Straight",price:1499,image:"https://images.pexels.com/photos/5901063/pexels-photo-5901063.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Sharp, sleek and polished for everyday luxury."},
{sku:"CRN-CLOSURE",name:"Melted Closure",category:"Closures",texture:"Natural finish",price:749,image:"https://images.pexels.com/photos/29096366/pexels-photo-29096366.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Designed for a seamless-looking protective finish."},
{sku:"CRN-FRONTAL",name:"Spotlight Frontal",category:"Frontals",texture:"Customisable",price:999,image:"https://images.pexels.com/photos/13439624/pexels-photo-13439624.jpeg?auto=compress&cs=tinysrgb&w=900",note:"For statement styling and a versatile hairline look."},
{sku:"CRN-PONY",name:"Power Pony",category:"Ponytails",texture:"Sleek / wave",price:599,image:"https://images.pexels.com/photos/9167117/pexels-photo-9167117.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Fast glam for high ponytails, low ponies and updos."},
{sku:"CRN-TEXTURE",name:"Texture Edit",category:"Extensions",texture:"Coil / curl",price:649,image:"https://images.pexels.com/photos/5254288/pexels-photo-5254288.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Texture-forward pieces for fullness and blending."}
];
const money=n=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR",maximumFractionDigits:0}).format(n);
let active="All",cart=[],checkoutConfigured=false;\nconst LEAD_URL="https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/crowne-hair-lead";
const filters=document.querySelector("#filters"),grid=document.querySelector("#productGrid"),bagDrawer=document.querySelector("#bagDrawer"),scrim=document.querySelector("#scrim"),bagItems=document.querySelector("#bagItems"),bagCount=document.querySelector("#bagCount"),bagTotal=document.querySelector("#bagTotal"),paymentNote=document.querySelector("#paymentNote"),checkoutButton=document.querySelector("#checkoutButton"),customerName=document.querySelector("#customerName"),customerEmail=document.querySelector("#customerEmail");
function renderFilters(){const cats=["All"].concat(Array.from(new Set(products.map(p=>p.category))));filters.innerHTML=cats.map(c=>'<button class="filter '+(c===active?'active':'')+'" data-filter="'+c+'">'+c+'</button>').join("");filters.querySelectorAll("button").forEach(b=>b.onclick=()=>{active=b.dataset.filter;renderFilters();renderProducts()})}
function renderProducts(){const list=active==="All"?products:products.filter(p=>p.category===active);grid.innerHTML=list.map(p=>'<article class="product-card"><figure><img loading="lazy" src="'+p.image+'" alt="'+p.name+' hair style"></figure><div class="product-info"><div class="product-meta"><span>'+p.category+'</span><span>'+p.texture+'</span></div><h3>'+p.name+'</h3><p>'+p.note+'</p><div class="product-buy"><strong>from '+money(p.price)+'</strong><button class="add-btn" data-add="'+p.sku+'">Add to bag</button></div></div></article>').join("");grid.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addToBag(b.dataset.add))}
function addToBag(sku){const p=products.find(x=>x.sku===sku);if(!p)return;cart.push(p);renderBag();openBag()}
function removeFromBag(i){cart.splice(i,1);renderBag()}
function renderBag(){bagCount.textContent=cart.length;bagItems.innerHTML=cart.length?cart.map((p,i)=>'<div class="bag-item"><img src="'+p.image+'" alt=""><div><h4>'+p.name+'</h4><small>'+p.category+' · '+money(p.price)+'</small></div><button data-remove="'+i+'" aria-label="Remove '+p.name+'">×</button></div>').join(""):'<p class="bag-empty">Your bag is waiting for its first crown.</p>';bagTotal.textContent=money(cart.reduce((s,p)=>s+p.price,0));bagItems.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>removeFromBag(Number(b.dataset.remove)))}
function openBag(){bagDrawer.classList.add("open");scrim.classList.add("open");bagDrawer.setAttribute("aria-hidden","false")}
function closeBag(){bagDrawer.classList.remove("open");scrim.classList.remove("open");bagDrawer.setAttribute("aria-hidden","true")}
document.querySelector("#openBag").onclick=openBag;document.querySelector("#closeBag").onclick=closeBag;scrim.onclick=closeBag;
document.querySelector("#menuToggle").onclick=e=>{const open=document.querySelector("#mainNav").classList.toggle("open");e.currentTarget.setAttribute("aria-expanded",String(open))};
document.querySelectorAll(".main-nav a").forEach(a=>a.onclick=()=>document.querySelector("#mainNav").classList.remove("open"));
document.querySelector("#shareSite").onclick=async()=>{const share={title:"CROWNÉ Hair",text:"Every shade. Every texture. Every crown.",url:location.href};if(navigator.share){try{await navigator.share(share)}catch{}}else{await navigator.clipboard?.writeText(location.href);document.querySelector("#shareSite").textContent="Link copied ✓"}};
document.querySelectorAll(".quiz-chip").forEach(b=>b.onclick=()=>{document.querySelector("#quizResult").textContent=b.dataset.answer+" selected — your personalised hair-match flow is ready for catalogue linking."});
checkoutButton.onclick=async()=>{
  if(!cart.length){paymentNote.textContent="Add at least one crown to your bag first.";return}
  const name=customerName.value.trim(),email=customerEmail.value.trim();
  if(!name||!email){paymentNote.textContent="Enter your name and email first.";return}
  checkoutButton.disabled=true;
  if(checkoutConfigured){
    checkoutButton.textContent="Opening secure checkout…";paymentNote.textContent="Creating your protected order through IZAKHONO PAY.";
    try{
      const r=await fetch("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sku:cart[0].sku,customer_name:name,customer_email:email})});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||"Checkout failed");
      if(data.redirect_url){location.href=data.redirect_url;return}
      if(data.payment_reference){let msg="Order created. Payment reference: "+data.payment_reference+".";if(data.bank_details){msg+=" EFT: "+[data.bank_details.bank_name,data.bank_details.account_name,data.bank_details.account_number,"branch "+data.bank_details.branch_code].filter(Boolean).join(" · ");}paymentNote.textContent=msg;return}
      paymentNote.textContent="Order created. Follow the payment instructions returned by IZAKHONO PAY.";
    }catch(err){paymentNote.textContent=String(err.message||err)}
    finally{checkoutButton.disabled=false;checkoutButton.textContent="Secure checkout"}
    return;
  }
  checkoutButton.textContent="Reserving…";paymentNote.textContent="Saving your Crown Room request so we can confirm stock, final options and secure payment.";
  try{
    const p=cart[0];
    const r=await fetch(LEAD_URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({customer_name:name,customer_email:email,product_code:p.sku,product_name:p.name,source:location.host,website:""})});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||"Could not save request");
    paymentNote.textContent="Reserved ✓ Reference "+data.reference+". We have your request and can complete stock confirmation and secure payment next.";
    checkoutButton.textContent="Reserved ✓";
  }catch(err){
    paymentNote.textContent="We could not save the request just now. Please try again.";
    checkoutButton.textContent="Reserve this crown";
  }finally{checkoutButton.disabled=false}
};
fetch("/api/config").then(r=>{if(!r.ok)throw new Error("no local checkout");return r.json()}).then(cfg=>{checkoutConfigured=Boolean(cfg.checkoutConfigured);if(checkoutConfigured){paymentNote.textContent="Secure payment powered by iKhokha through IZAKHONO PAY.";checkoutButton.textContent="Secure checkout"}else{paymentNote.textContent="Reserve your crown now; secure payment is completed after stock confirmation.";checkoutButton.textContent="Reserve this crown"}}).catch(()=>{checkoutConfigured=false;paymentNote.textContent="Reserve your crown now; secure payment is completed after stock confirmation.";checkoutButton.textContent="Reserve this crown"});
renderFilters();renderProducts();renderBag();
const ring=document.querySelector("#spinRing"),viewport=document.querySelector("#spinViewport"),cards=[...ring.children],step=360/cards.length;let angle=0,timer,dragging=false,startX=0,startAngle=0;
function update(){ring.style.transform="rotateY("+angle+"deg)"}function layout(){const radius=Math.min(380,Math.max(230,viewport.clientWidth*.33));cards.forEach((card,i)=>card.style.transform="rotateY("+(i*step)+"deg) translateZ("+radius+"px)");update()}function rotate(dir=1){angle-=step*dir;update();restart()}function restart(){clearInterval(timer);timer=setInterval(()=>rotate(1),3200)}
document.querySelector("#spinPrev").onclick=()=>rotate(-1);document.querySelector("#spinNext").onclick=()=>rotate(1);viewport.addEventListener("pointerdown",e=>{dragging=true;startX=e.clientX;startAngle=angle;viewport.setPointerCapture(e.pointerId);clearInterval(timer)});viewport.addEventListener("pointermove",e=>{if(dragging){angle=startAngle+(e.clientX-startX)*.32;update()}});viewport.addEventListener("pointerup",()=>{dragging=false;angle=Math.round(angle/step)*step;update();restart()});window.addEventListener("resize",layout);layout();restart();
