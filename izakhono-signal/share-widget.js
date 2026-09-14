(()=>{if(window.__izakhonoShareReady)return;window.__izakhonoShareReady=true;
function mount(){
  if(document.querySelector('[data-izakhono-share]'))return;
  const b=document.createElement('button');
  b.type='button';b.setAttribute('data-izakhono-share','1');b.setAttribute('aria-label','Share this platform');
  b.textContent='↗ Share';
  Object.assign(b.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:'9999',border:'1px solid rgba(255,255,255,.22)',borderRadius:'999px',padding:'12px 16px',font:'800 14px system-ui,-apple-system,Segoe UI,sans-serif',background:'linear-gradient(135deg,#36e1c7,#2f9cff)',color:'#06111b',boxShadow:'0 14px 35px rgba(0,0,0,.35)',cursor:'pointer'});
  b.addEventListener('click',async()=>{const payload={title:document.title,text:(document.querySelector('meta[name="description"]')?.content||document.title),url:location.href};
    try{if(navigator.share){await navigator.share(payload);return}if(navigator.clipboard){await navigator.clipboard.writeText(location.href);const old=b.textContent;b.textContent='✓ Link copied';setTimeout(()=>b.textContent=old,1800);return}}
    catch(e){if(e?.name==='AbortError')return}
    prompt('Copy this link',location.href);
  });
  document.body.appendChild(b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();