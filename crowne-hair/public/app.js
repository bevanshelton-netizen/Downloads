const products=[
{sku:"CRN-VELVET-CURL",name:"Velvet Curl",category:"Wigs",texture:"Deep curl",price:1899,image:"https://images.pexels.com/photos/6484129/pexels-photo-6484129.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Full-volume glamour with a defined curl finish."},
{sku:"CRN-BODY-WAVE",name:"Bombshell Body",category:"Wigs",texture:"Body wave",price:2199,image:"https://images.pexels.com/photos/15868319/pexels-photo-15868319.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Long, fluid movement made for dramatic entrances."},
{sku:"CRN-BUNDLE-BAR",name:"Signature Bundles",category:"Weaves",texture:"Multi texture",price:699,image:"https://images.pexels.com/photos/14730867/pexels-photo-14730867.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Build your own length, density and colour story."},
{sku:"CRN-BUNDLE-VN",name:"Vietnamese Bundles",category:"Weaves",texture:"Natural straight / body wave",price:null,image:"https://images.pexels.com/photos/14730867/pexels-photo-14730867.jpeg?auto=compress&cs=tinysrgb&w=900",note:'Available from 8" to 32". Supplier provenance and final specification are confirmed before payment.'},
{sku:"CRN-BUNDLE-BR",name:"Brazilian Bundles",category:"Weaves",texture:"Body wave / straight / curl",price:null,image:"https://images.pexels.com/photos/13439624/pexels-photo-13439624.jpeg?auto=compress&cs=tinysrgb&w=900",note:'Available from 8" to 32". Supplier provenance and final specification are confirmed before payment.'},
{sku:"CRN-BUNDLE-PE",name:"Peruvian Bundles",category:"Weaves",texture:"Body wave / straight / curl",price:null,image:"https://images.pexels.com/photos/6484129/pexels-photo-6484129.jpeg?auto=compress&cs=tinysrgb&w=900",note:'Available from 8" to 32". Supplier provenance and final specification are confirmed before payment.'},
{sku:"CRN-SLEEK-BOB",name:"After-Dark Bob",category:"Wigs",texture:"Straight",price:1499,image:"https://images.pexels.com/photos/5901063/pexels-photo-5901063.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Sharp, sleek and polished for everyday luxury."},
{sku:"CRN-CLOSURE",name:"Melted Closure",category:"Closures",texture:"Natural finish",price:749,image:"https://images.pexels.com/photos/29096366/pexels-photo-29096366.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Designed for a seamless-looking protective finish."},
{sku:"CRN-FRONTAL",name:"Spotlight Frontal",category:"Frontals",texture:"Customisable",price:999,image:"https://images.pexels.com/photos/13439624/pexels-photo-13439624.jpeg?auto=compress&cs=tinysrgb&w=900",note:"For statement styling and a versatile hairline look."},
{sku:"CRN-PONY",name:"Power Pony",category:"Ponytails",texture:"Sleek / wave",price:599,image:"https://images.pexels.com/photos/9167117/pexels-photo-9167117.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Fast glam for high ponytails, low ponies and updos."},
{sku:"CRN-TEXTURE",name:"Texture Edit",category:"Extensions",texture:"Coil / curl",price:649,image:"https://images.pexels.com/photos/5254288/pexels-photo-5254288.jpeg?auto=compress&cs=tinysrgb&w=900",note:"Texture-forward pieces for fullness and blending."},
{sku:"CRN-GOLF-LADIES",name:"CROWNÉ Hair by Netty Ladies Golf Shirt",category:"CROWNÉ Lifestyle",texture:"Cream / Black / Gold",price:null,image:"./crowne-ladies-golf-shirt.svg",note:"Elegant branded ladies golf shirt in the CROWNÉ cream, black and gold signature palette."},
{sku:"CRN-TEE-LADIES",name:"CROWNÉ Hair by Netty Ladies T-Shirt",category:"CROWNÉ Lifestyle",texture:"Black / Champagne / Cream / Black-Gold",price:null,image:"./crowne-ladies-tshirts.svg",note:"Ladies branded T-shirt with four royal CROWNÉ colourways."}
];
const LEAD_URL="https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/crowne-hair-lead";
const money=n=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR",maximumFractionDigits:0}).format(n);
const priceLabel=p=>Number.isFinite(p.price)?"guide from "+money(p.price):"price on confirmation";
const isBundleProduct=p=>Boolean(p)&&p.sku.startsWith("CRN-BUNDLE-");
let active="All",cart=[];
const $=s=>document.querySelector(s);
const filters=$("#filters"),grid=$("#productGrid"),bagDrawer=$("#bagDrawer"),scrim=$("#scrim"),bagItems=$("#bagItems"),bagCount=$("#bagCount"),bagTotal=$("#bagTotal"),paymentNote=$("#paymentNote"),checkoutButton=$("#checkoutButton");
function renderFilters(){const hairProducts=products.filter(p=>p.category!=="CROWNÉ Lifestyle");const cats=["All",...new Set(hairProducts.map(p=>p.category))];filters.innerHTML=cats.map(c=>'<button class="filter '+(c===active?'active':'')+'" data-filter="'+c+'">'+c+'</button>').join("");filters.querySelectorAll("button").forEach(b=>b.onclick=()=>{active=b.dataset.filter;renderFilters();renderProducts()})}
function renderProducts(){const hairProducts=products.filter(p=>p.category!=="CROWNÉ Lifestyle");const list=active==="All"?hairProducts:hairProducts.filter(p=>p.category===active);grid.innerHTML=list.map(p=>'<article class="product-card"><figure><img loading="lazy" src="'+p.image+'" alt="'+p.name+' hair style"></figure><div class="product-info"><div class="product-meta"><span>'+p.category+'</span><span>'+p.texture+'</span></div><h3>'+p.name+'</h3><p>'+p.note+'</p><div class="product-buy"><strong>'+priceLabel(p)+'</strong><button class="add-btn" data-add="'+p.sku+'">Reserve options</button></div></div></article>').join("");grid.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addToBag(b.dataset.add))}
function addToBag(sku){const p=products.find(x=>x.sku===sku);if(!p)return;cart=[p];renderBag();const apparel=p.category==="CROWNÉ Lifestyle",bundle=isBundleProduct(p);document.querySelectorAll(".hair-only").forEach(el=>el.hidden=apparel);$("#preferredSizeWrap").hidden=!apparel;$("#bundleCountWrap").hidden=!bundle;if(apparel){$("#preferredLength").value="";$("#preferredTexture").value="";$("#bundleCount").value="";$("#preferredColour").value=p.sku==="CRN-GOLF-LADIES"?"Cream / Black / Gold":"";paymentNote.textContent=p.sku==="CRN-TEE-LADIES"?"Select your size and enter Black, Champagne, Cream or Black / Gold Accent as your preferred colour. Stock and final price are confirmed before payment.":"Select your size. Garment specification, stock and final price are confirmed before payment."}else{$("#preferredSize").value="";if(!bundle)$("#bundleCount").value="";paymentNote.textContent=bundle?"Choose the bundle quantity, length and texture. Supplier provenance, stock, exact specification, delivery and final price are confirmed before payment.":"One style per reservation during launch. We confirm stock, exact specification, delivery and final price before payment."}openBag()}
function removeFromBag(){cart=[];renderBag()}
function renderBag(){bagCount.textContent=cart.length;bagItems.innerHTML=cart.length?cart.map(p=>'<div class="bag-item"><img src="'+p.image+'" alt=""><div><h4>'+p.name+'</h4><small>'+p.category+' · '+priceLabel(p)+'</small></div><button data-remove="1" aria-label="Remove '+p.name+'">×</button></div>').join(""):'<p class="bag-empty">Your bag is waiting for its first crown.</p>';bagTotal.textContent=cart.length?(Number.isFinite(cart[0].price)?money(cart[0].price):"On confirmation"):money(0);bagItems.querySelectorAll("[data-remove]").forEach(b=>b.onclick=removeFromBag)}
function openBag(){bagDrawer.classList.add("open");scrim.classList.add("open");bagDrawer.setAttribute("aria-hidden","false")}
function closeBag(){bagDrawer.classList.remove("open");scrim.classList.remove("open");bagDrawer.setAttribute("aria-hidden","true")}
$("#openBag").onclick=openBag;$("#closeBag").onclick=closeBag;scrim.onclick=closeBag;const lifestyleReserveGolf=$("#lifestyleReserveGolf");if(lifestyleReserveGolf)lifestyleReserveGolf.onclick=()=>addToBag("CRN-GOLF-LADIES");const lifestyleReserveTee=$("#lifestyleReserveTee");if(lifestyleReserveTee)lifestyleReserveTee.onclick=()=>addToBag("CRN-TEE-LADIES");
$("#menuToggle").onclick=e=>{const open=$("#mainNav").classList.toggle("open");e.currentTarget.setAttribute("aria-expanded",String(open))};
document.querySelectorAll(".main-nav a").forEach(a=>a.onclick=()=>$("#mainNav").classList.remove("open"));
$("#shareSite").onclick=async()=>{const share={title:"CROWNE HAIR BY NETTY",text:"Every shade. Every texture. Every crown.",url:location.href};if(navigator.share){try{await navigator.share(share)}catch{}}else{await navigator.clipboard?.writeText(location.href);$("#shareSite").textContent="Link copied ✓"}};
document.querySelectorAll(".quiz-chip").forEach(b=>b.onclick=()=>{$("#quizResult").textContent=b.dataset.answer+" selected — add a style to your reservation and include this preference in your notes."});
checkoutButton.onclick=async()=>{
  if(!cart.length){paymentNote.textContent="Choose one crown first.";return}
  const name=$("#customerName").value.trim(),email=$("#customerEmail").value.trim(),phone=$("#customerPhone").value.trim();
  const length=$("#preferredLength").value.trim(),colour=$("#preferredColour").value.trim(),texture=$("#preferredTexture").value.trim(),size=$("#preferredSize").value.trim(),bundleCountRaw=$("#bundleCount").value.trim(),bundleCount=bundleCountRaw?Number(bundleCountRaw):null,notes=$("#customerNotes").value.trim(),marketing=$("#marketingConsent").checked;
  if(!name||!email||!phone){paymentNote.textContent="Enter your name, email and phone number.";return}
  checkoutButton.disabled=true;checkoutButton.textContent="Reserving…";paymentNote.textContent="Saving your request securely for stock and specification confirmation.";
  try{
    const p=cart[0];
    const r=await fetch(LEAD_URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({customer_name:name,customer_email:email,customer_phone:phone,product_code:p.sku,product_name:p.name,preferred_length:length,preferred_colour:colour,preferred_texture:texture||p.texture,preferred_size:size,bundle_count:bundleCount,customer_notes:notes,marketing_consent:marketing,source:location.host||"crowne-hair-web",website:""})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||"Could not save request");
    paymentNote.textContent="Reserved ✓ Reference "+data.reference+". We will use this request to confirm stock, exact options, delivery and the secure iKhokha payment step.";
    checkoutButton.textContent="Reserved ✓";
    if(window.IZGrowth)window.IZGrowth.track("lead_submitted",{reference:data.reference,product_code:p.sku,bundle_count:bundleCount||undefined});
  }catch(err){paymentNote.textContent=String(err.message||"We could not save the request just now. Please try again.");checkoutButton.textContent="Reserve this crown"}
  finally{checkoutButton.disabled=false}
};

const bundleBuilderForm=$("#bundleBuilderForm");
if(bundleBuilderForm){
  bundleBuilderForm.addEventListener("submit",e=>{
    e.preventDefault();
    const sku=$("#bundleOrigin").value,length=$("#bundleLength").value,texture=$("#bundleTexture").value,qty=$("#bundleQty").value;
    if(!sku||!length||!texture||!qty)return;
    addToBag(sku);
    $("#preferredLength").value=length;
    $("#preferredTexture").value=texture;
    $("#bundleCount").value=qty;
    const p=products.find(x=>x.sku===sku);
    paymentNote.textContent=(p?.name||"Bundle set")+" · "+length+" · "+texture+" · "+qty+" bundle"+(qty==="1"?"":"s")+". We confirm verified supplier provenance, stock, weight/grade, delivery and final price before payment.";
    if(window.IZGrowth)window.IZGrowth.track("bundle_builder_selected",{product_code:sku,length,texture,bundle_count:Number(qty)});
  });
}

renderFilters();renderProducts();renderBag();
const ring=$("#spinRing"),viewport=$("#spinViewport"),cards=[...ring.children],step=360/cards.length;let angle=0,timer,dragging=false,startX=0,startAngle=0;
function update(){ring.style.transform="rotateY("+angle+"deg)"}function layout(){const radius=Math.min(380,Math.max(230,viewport.clientWidth*.33));cards.forEach((card,i)=>card.style.transform="rotateY("+(i*step)+"deg) translateZ("+radius+"px)");update()}function rotate(dir=1){angle-=step*dir;update();restart()}function restart(){clearInterval(timer);timer=setInterval(()=>rotate(1),3200)}
$("#spinPrev").onclick=()=>rotate(-1);$("#spinNext").onclick=()=>rotate(1);viewport.addEventListener("pointerdown",e=>{dragging=true;startX=e.clientX;startAngle=angle;viewport.setPointerCapture(e.pointerId);clearInterval(timer)});viewport.addEventListener("pointermove",e=>{if(dragging){angle=startAngle+(e.clientX-startX)*.32;update()}});viewport.addEventListener("pointerup",()=>{dragging=false;angle=Math.round(angle/step)*step;update();restart()});window.addEventListener("resize",layout);layout();restart();

const CROWNE_SALON_BOOKING_URL="https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/crowne-salon-booking";
const salonForm=document.querySelector("#salonBookingForm");
if(salonForm){
  const dateField=document.querySelector("#salonDate");
  if(dateField)dateField.min=new Date().toISOString().slice(0,10);
  salonForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const status=document.querySelector("#salonBookingStatus"),button=document.querySelector("#salonBookingButton");
    const payload={
      customer_name:document.querySelector("#salonName").value.trim(),
      customer_email:document.querySelector("#salonEmail").value.trim(),
      customer_phone:document.querySelector("#salonPhone").value.trim(),
      service:document.querySelector("#salonService").value,
      preferred_date:document.querySelector("#salonDate").value||null,
      preferred_time:document.querySelector("#salonTime").value||null,
      hair_length:document.querySelector("#salonHairLength").value.trim()||null,
      notes:document.querySelector("#salonNotes").value.trim()||null,
      website:document.querySelector("#salonWebsite").value,
      source:location.host||"crowne-salon-web"
    };
    if(!payload.customer_name||!payload.customer_email||!payload.customer_phone||!payload.service){
      status.className="salon-booking-status error";status.textContent="Please complete your name, email, phone and service.";return;
    }
    button.disabled=true;button.textContent="Sending request…";status.className="salon-booking-status";status.textContent="Saving your appointment request securely.";
    try{
      const r=await fetch(CROWNE_SALON_BOOKING_URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const data=await r.json();if(!r.ok)throw new Error(data.error||"Could not save request");
      status.className="salon-booking-status success";status.textContent="Appointment requested ✓ Reference "+data.reference+". The salon will confirm the date, time and service details before your booking is final.";
      button.textContent="Request received ✓";
      if(window.IZGrowth)window.IZGrowth.track("salon_booking_requested",{reference:data.reference,service:payload.service});
      salonForm.reset();if(dateField)dateField.min=new Date().toISOString().slice(0,10);
    }catch(err){
      status.className="salon-booking-status error";status.textContent=String(err.message||"We could not save the request. Please try again.");button.textContent="Request appointment";
    }finally{button.disabled=false}
  });
}
