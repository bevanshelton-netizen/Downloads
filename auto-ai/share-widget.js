(()=>{if(window.__izakhonoShareReady)return;window.__izakhonoShareReady=true;

const PAY_KEY='autoai.payment.orders.v1';
const PROFILE_KEY='autoai.payment.profile.v1';
const DRAFT_KEY='autoai.quote.draft.v1';
const PRODUCTS={
  'vehicle-health-report':{label:'Vehicle Health Report',price:'R79'},
  'repair-second-opinion':{label:'Repair Quote Second Opinion',price:'R99'},
  'used-car-buyer-check':{label:'Used-Car Buyer Check',price:'R149'}
};
const WHATSAPP_NUMBER='27662982213';
function whatsappUrl(product){
  const p=PRODUCTS[product];
  if(!p)return'';
  const message=`Hi AUTO AI, I want the ${p.price} ${p.label}. Please send me the secure iKhokha payment link.`;
  return 'https://wa.me/'+WHATSAPP_NUMBER+'?text='+encodeURIComponent(message);
}
function openWhatsAppCheckout(product){
  const url=whatsappUrl(product);
  if(!url)throw new Error('Unknown AUTO AI service.');
  notice('Opening WhatsApp so we can send your secure iKhokha payment link…','good');
  location.href=url;
}
function readJson(key,fallback={}){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function productFromNode(node){const text=(node.closest('.cash-card,.price-card')?.textContent||node.textContent||'').toLowerCase();if(text.includes('r79')||text.includes('vehicle health'))return'vehicle-health-report';if(text.includes('r99')||text.includes('repair quote'))return'repair-second-opinion';if(text.includes('r149')||text.includes('used-car'))return'used-car-buyer-check';return''}
function profile(){const current=readJson(PROFILE_KEY,{});let name=current.name||prompt('Your name for the secure checkout','')||'';if(!name.trim())throw new Error('Name is required.');let email=current.email||prompt('Email address for the secure checkout','')||'';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw new Error('A valid email address is required.');const p={name:name.trim(),email:email.trim().toLowerCase()};writeJson(PROFILE_KEY,p);return p}
async function api(path,options={}){const r=await fetch(path,{cache:'no-store',...options,headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});let data={};try{data=await r.json()}catch{}if(!r.ok)throw new Error(data.error||'Secure payment service is unavailable.');return data}
function orders(){return readJson(PAY_KEY,{})}
function saveOrder(product,order){const all=orders();all[product]={id:order.id,status:order.status||'pending',amount_minor:order.amount_minor||0,provider:order.provider||order.payment_method||'',updated_at:Date.now()};writeJson(PAY_KEY,all)}
function paidOrder(product){const o=orders()[product];return o&&o.status==='paid'?o:null}
function notice(message,kind='info'){
  let el=document.querySelector('[data-autoai-pay-notice]');if(!el){el=document.createElement('div');el.setAttribute('data-autoai-pay-notice','1');Object.assign(el.style,{position:'fixed',left:'50%',top:'18px',transform:'translateX(-50%)',zIndex:'10000',maxWidth:'min(92vw,680px)',padding:'14px 18px',borderRadius:'14px',font:'700 14px system-ui,-apple-system,Segoe UI,sans-serif',boxShadow:'0 16px 45px rgba(0,0,0,.45)',textAlign:'center'});document.body.appendChild(el)}el.style.background=kind==='good'?'#0d4b3f':kind==='bad'?'#61222b':'#102b43';el.style.color='#fff';el.textContent=message;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>{el.hidden=true},6500)
}
function eftMessage(order){const b=order.bank||{};return `Secure online checkout is temporarily unavailable, so IZAKHONO PAY supplied the EFT fallback.\n\nAmount: R${((order.amount_minor||0)/100).toFixed(2)}\nReference: ${order.payment_reference||''}\nBank: ${b.bank_name||''}\nAccount: ${b.account_name||''}\nAccount number: ${b.account_number||''}\nBranch: ${b.branch_code||''}\n\nUse the exact reference so the payment can be reconciled.`}
async function startCheckout(product){
  if(!PRODUCTS[product])throw new Error('Unknown AUTO AI service.');
  const p=profile();notice(`Opening secure iKhokha checkout for ${PRODUCTS[product].label}…`);
  const data=await api('/api/payment/create',{method:'POST',body:JSON.stringify({product,name:p.name,email:p.email})});
  const order=data.order;if(!order||!order.id)throw new Error('Payment order was not created.');saveOrder(product,order);
  if(order.payment_method==='ikhokha'&&order.redirect_url){location.href=order.redirect_url;return}
  if(order.payment_method==='eft'){alert(eftMessage(order));notice('EFT order created. Access unlocks after verified settlement.');return}
  throw new Error('No supported checkout method was returned.');
}
async function refreshOrder(product){const all=orders(),saved=all[product];if(!saved?.id)return null;try{const data=await api('/api/payment/status?'+new URLSearchParams({order:saved.id}));const remote=data.order;if(remote?.id===saved.id){all[product]={...saved,...remote,updated_at:Date.now()};writeJson(PAY_KEY,all);if(remote.status==='paid')notice(`${PRODUCTS[product]?.label||'AUTO AI service'} payment confirmed.`, 'good');return all[product]}}catch{}return saved}
async function refreshOrders(){for(const product of Object.keys(orders()))await refreshOrder(product)}
function bindPaidLinks(){document.querySelectorAll('a[href*="wa.me/27662982213"]').forEach(a=>{const product=productFromNode(a);if(!product)return;a.dataset.autoaiProduct=product;a.title=`Pay ${PRODUCTS[product].price} securely with iKhokha`;a.addEventListener('click',async e=>{e.preventDefault();try{await startCheckout(product)}catch(err){notice('Automated checkout is unavailable on this route. Continuing on WhatsApp for your secure iKhokha payment link.');openWhatsAppCheckout(product)}})});}
function renderPaidQuote(result){const el=document.querySelector('#quoteResult');if(!el)return;const list=x=>(x||[]).length?'<ul>'+x.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':'';el.innerHTML='<div style="font-weight:900;color:#33e0c4;margin-bottom:8px">✓ PAID R99 SECOND OPINION</div><h3>'+esc(result.result)+'</h3>'+(result.flags?.length?'<p><strong>Things to clarify:</strong></p>'+list(result.flags):'<p>The quotation contains useful itemisation, but still confirm the diagnosis.</p>')+'<p><strong>Ask the workshop:</strong></p>'+list(result.askWorkshop)+'<p><small>'+esc(result.disclaimer||'')+'</small></p>';el.hidden=false;el.scrollIntoView({behavior:'smooth',block:'nearest'})}
function bindPaidQuote(){const form=document.querySelector('#quoteForm');if(!form)return;const button=form.querySelector('button[type="submit"]');if(button){button.textContent='R99 · Secure second opinion';button.title='Paid via iKhokha through IZAKHONO PAY'}form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const quote=String(new FormData(form).get('quote')||'').trim();if(!quote){notice('Paste the workshop quotation first.','bad');return}localStorage.setItem(DRAFT_KEY,quote);let order=paidOrder('repair-second-opinion');if(!order){order=await refreshOrder('repair-second-opinion')}if(!order||order.status!=='paid'){try{await startCheckout('repair-second-opinion')}catch(err){notice('Automated checkout is unavailable on this route. Continuing on WhatsApp for your secure iKhokha payment link.');openWhatsAppCheckout('repair-second-opinion')}return}if(button){button.disabled=true;button.textContent='Preparing paid second opinion…'}try{const result=await api('/api/paid/quote-review',{method:'POST',body:JSON.stringify({order_id:order.id,quote})});renderPaidQuote(result)}catch(err){notice(err.message,'bad')}finally{if(button){button.disabled=false;button.textContent='R99 · Secure second opinion'}}},true)}
function restoreDraft(){const q=localStorage.getItem(DRAFT_KEY);const ta=document.querySelector('#quoteForm textarea[name="quote"]');if(q&&ta&&!ta.value)ta.value=q}
function mountShare(){if(document.querySelector('[data-izakhono-share]'))return;const b=document.createElement('button');b.type='button';b.setAttribute('data-izakhono-share','1');b.setAttribute('aria-label','Share AUTO AI');b.textContent='↗ Share AUTO AI';Object.assign(b.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:'9999',border:'1px solid rgba(255,255,255,.22)',borderRadius:'999px',padding:'12px 16px',font:'800 14px system-ui,-apple-system,Segoe UI,sans-serif',background:'linear-gradient(135deg,#36e1c7,#2f9cff)',color:'#06111b',boxShadow:'0 14px 35px rgba(0,0,0,.35)',cursor:'pointer'});b.addEventListener('click',async()=>{const canonical=document.querySelector('link[rel="canonical"]')?.href||'https://auto-ai-eosin.vercel.app/';const payload={title:'AUTO AI — understand your car before you spend',text:'AUTO AI: Vehicle Health Report R79 • Repair Quote Second Opinion R99 • Used-Car Buyer Check R149. Safety-first vehicle intelligence for everyday drivers.',url:canonical};try{if(navigator.share){await navigator.share(payload);return}const shareText=payload.text+' '+payload.url;if(navigator.clipboard){await navigator.clipboard.writeText(shareText);const old=b.textContent;b.textContent='✓ Offer copied';setTimeout(()=>b.textContent=old,1800);return}}catch(e){if(e?.name==='AbortError')return}prompt('Copy and share AUTO AI',payload.text+' '+payload.url)});document.body.appendChild(b)}
async function mount(){mountShare();bindPaidLinks();restoreDraft();bindPaidQuote();await refreshOrders();const params=new URLSearchParams(location.search);if(params.get('payment')==='success'){notice('Payment submitted. AUTO AI is verifying it with iKhokha…');setTimeout(refreshOrders,1600)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();