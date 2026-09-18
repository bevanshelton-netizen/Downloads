(()=>{if(window.__ldsaCampaignPromo)return;window.__ldsaCampaignPromo=true;
function source(){
  const named=document.documentElement.dataset.ldsaSource;
  if(named)return named;
  const host=(location.hostname||'owned-network').replace(/\.vercel\.app$/,'').replace(/[^a-z0-9-]+/gi,'-').toLowerCase();
  const first=location.pathname.split('/').filter(Boolean)[0];
  return (host.includes('github.io')&&first?first:host)||'owned-network';
}
const url=new URL('https://learner-driver-sa-bevan2.vercel.app/');
url.searchParams.set('utm_source',source());
url.searchParams.set('utm_medium','owned_network');
url.searchParams.set('utm_campaign','learner_driver_sa_launch');
url.searchParams.set('utm_content','portfolio_promo');
function mount(){
  if(document.querySelector('[data-ldsa-promo]'))return;
  const box=document.createElement('aside');box.setAttribute('data-ldsa-promo','1');
  Object.assign(box.style,{position:'fixed',left:'14px',bottom:'106px',zIndex:'9997',width:'min(370px,calc(100vw - 28px))',padding:'14px 15px',borderRadius:'18px',background:'linear-gradient(135deg,#071d45,#0d5e73 72%,#13a873)',border:'1px solid rgba(255,255,255,.22)',boxShadow:'0 18px 45px rgba(0,0,0,.35)',color:'#fff',fontFamily:'system-ui,-apple-system,Segoe UI,sans-serif'});
  box.innerHTML='<button aria-label="Close Learner Driver SA advert" style="position:absolute;right:8px;top:6px;border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer">×</button><a href="'+url.toString()+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;display:block;padding-right:20px"><strong style="display:block;font-size:12px;letter-spacing:.12em;color:#ffd85d;margin-bottom:5px">🇿🇦 LEARNER DRIVER SA</strong><span style="display:block;font-weight:900;font-size:16px;line-height:1.2">Preparing for your learner’s licence?</span><small style="display:block;margin-top:6px;line-height:1.4;color:#dceeff">Motorcycles • Code 08 • 10 • 14 • Mock tests • Live simulators • 12 official languages</small><em style="display:block;margin-top:9px;font-size:12px;font-style:normal;font-weight:950;color:#7fffd4">START PREPARING →</em></a>';
  box.querySelector('button').addEventListener('click',()=>box.remove());
  document.body.appendChild(box);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();