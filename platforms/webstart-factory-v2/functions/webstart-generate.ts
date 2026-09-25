
const SUPABASE_URL="https://yfawrenhudjomhnglfhq.supabase.co";
const PUBLIC_KEY="sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p";
const RENDERER_RAW=Deno.env.get("WEBSTART_RENDERER_BASE")||"https://izakhono-webstart-sites.vercel.app";
const RENDERER=RENDERER_RAW.endsWith("/")?RENDERER_RAW.slice(0,-1):RENDERER_RAW;
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};

function esc(v:any){return String(v??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}
function color(v:any,f:string){const s=String(v||"");return /^#[0-9a-fA-F]{6}$/.test(s)?s:f}
function safeHttp(v:any){try{const u=new URL(String(v||""));return (u.protocol==="https:"||u.protocol==="http:")?u.toString():""}catch{return ""}}
function services(c:any){const raw=Array.isArray(c?.services)?c.services:[];return raw.map((x:any)=>typeof x==="string"?x:x?.name).filter(Boolean).slice(0,12).map(String)}
function pickDirection(site:any,id:string){
  const dirs=Array.isArray(site.design_directions)?site.design_directions:[];
  return dirs.find((d:any)=>d?.id===id)||dirs[0]||null;
}
function qa(html:string,site:any,c:any){
  const checks=[
    {id:"html",label:"HTML document",pass:/<!doctype html>/i.test(html)&&/<html[^>]*lang=/i.test(html),critical:true},
    {id:"viewport",label:"Mobile viewport",pass:/name=['"]viewport['"]/i.test(html),critical:true},
    {id:"title",label:"Page title",pass:/<title>[^<]{3,}/i.test(html),critical:true},
    {id:"description",label:"Meta description",pass:/name=['"]description['"]/i.test(html),critical:true},
    {id:"h1",label:"Primary heading",pass:/<h1[^>]*>[^<]{3,}/i.test(html),critical:true},
    {id:"responsive",label:"Responsive CSS",pass:/@media/i.test(html),critical:true},
    {id:"contact",label:"Lead form",pass:/id=['"]leadForm['"]/i.test(html)&&/webstart_leads/i.test(html),critical:true},
    {id:"labels",label:"Form labels",pass:(html.match(/<label/gi)||[]).length>=3,critical:true},
    {id:"services",label:"Service content",pass:services(c).length>=1,critical:false},
    {id:"security",label:"No secret credentials",pass:!html.includes("service_role")&&!html.includes("SUPABASE_SERVICE_ROLE_KEY"),critical:true}
  ];
  const criticalPass=checks.filter(x=>x.critical).every(x=>x.pass);
  const passed=checks.filter(x=>x.pass).length;
  return {pass:criticalPass,score:Math.round((passed/checks.length)*100),checks,checked_at:new Date().toISOString(),site_id:site.id};
}
function buildHtml(site:any,c:any,theme:string,primary:string,accent:string){
  const name=esc(site.name);
  const tagline=esc(c.tagline||("Professional "+site.industry+" services you can rely on."));
  const about=esc(c.about||(site.name+" provides dependable service, clear communication and professional delivery."));
  const cta=esc(c.cta||"Start a conversation");
  const svc=services(c);
  const logo=safeHttp(site.logo_url),hero=safeHttp(site.hero_image_url);
  const ct=site.contact||{};
  const phone=esc(ct.phone||""),email=esc(ct.email||""),address=esc(ct.address||"");
  const phoneHref=String(ct.phone||"").replace(/[^0-9+]/g,"");
  const wa=String(ct.whatsapp||ct.phone||"").replace(/[^0-9]/g,"");
  const logoHtml=logo?"<img class='logo' src='"+esc(logo)+"' alt='"+name+" logo'>":"<div class='wordmark'>"+name+"</div>";
  const heroStyle=hero?" style=\"background-image:linear-gradient(90deg,rgba(5,10,20,.90),rgba(5,10,20,.35)),url('"+esc(hero)+"')\"":"";
  const cards=(svc.length?svc:["Professional service","Customer support","Custom solutions"]).map((s:string,i:number)=>"<article class='card'><span>0"+(i+1)+"</span><h3>"+esc(s)+"</h3><p>Practical, customer-focused "+esc(s.toLowerCase())+" tailored to your needs.</p></article>").join("");
  const contactBits=[
    phone?"<a href='tel:"+esc(phoneHref)+"'>"+phone+"</a>":"",
    email?"<a href='mailto:"+email+"'>"+email+"</a>":"",
    address?"<span>"+address+"</span>":""
  ].filter(Boolean).join("<span class='dot'>•</span>");
  const waButton=wa?"<a class='button secondary' href='https://wa.me/"+esc(wa)+"' target='_blank' rel='noopener'>WhatsApp us</a>":"";
  const org:any={"@context":"https://schema.org","@type":"Organization","name":site.name};
  if(ct.email)org.email=ct.email;if(ct.phone)org.telephone=ct.phone;if(ct.address)org.address=ct.address;
  const jsonld=JSON.stringify(org).replace(/</g,"\\u003c");
  return "<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"+
  "<title>"+name+" | "+esc(site.industry)+"</title><meta name='description' content='"+tagline+"'>"+
  "<meta property='og:title' content='"+name+"'><meta property='og:description' content='"+tagline+"'><meta property='og:type' content='website'>"+
  "<script type='application/ld+json'>"+jsonld+"</script><style>"+
  ":root{--p:"+primary+";--a:"+accent+";--ink:#0b1220;--soft:#f4f7fa;--paper:#fff;--line:#e6ebef}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--ink);background:var(--paper);line-height:1.55}a{text-decoration:none;color:inherit}.nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:18px max(5vw,24px);background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.logo{height:48px;max-width:180px;object-fit:contain}.wordmark{font-weight:950;letter-spacing:-.04em;font-size:1.25rem}.navlinks{display:flex;gap:24px;align-items:center;font-weight:800}.button{display:inline-flex;align-items:center;justify-content:center;padding:13px 19px;border-radius:12px;font-weight:900;border:2px solid transparent;cursor:pointer}.primary{background:var(--p);color:#fff}.secondary{border-color:var(--p);color:var(--p);background:#fff}.hero{min-height:76vh;display:grid;place-items:center;background:#07101f;background-size:cover;background-position:center;color:#fff;padding:88px max(5vw,24px)}.hero-inner{max-width:1120px;width:100%}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-weight:900;color:var(--a)}h1{font-size:clamp(2.8rem,7vw,6.2rem);line-height:.94;letter-spacing:-.065em;margin:14px 0;max-width:980px}.lead{font-size:clamp(1.08rem,2vw,1.4rem);max-width:760px;color:#d8e3ec}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.section{padding:84px max(5vw,24px)}.section.alt{background:var(--soft)}.kicker{font-weight:900;color:var(--p);text-transform:uppercase;letter-spacing:.12em}.section h2{font-size:clamp(2rem,4vw,3.4rem);letter-spacing:-.045em;line-height:1;margin:10px 0 28px}.about{font-size:1.2rem;max-width:850px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:28px;box-shadow:0 10px 40px rgba(9,30,66,.06)}.card span{color:var(--a);font-weight:900}.card h3{font-size:1.3rem}.contact{background:var(--ink);color:#fff}.contactline{display:flex;gap:10px;flex-wrap:wrap;color:#cbd6e2}.dot{opacity:.4}.leadform{margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:880px}.leadform label{display:grid;gap:6px;font-size:.82rem;font-weight:850}.leadform input,.leadform textarea{width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#fff;color:#0b1220;font:inherit}.leadform textarea{min-height:120px;resize:vertical}.leadform .full{grid-column:1/-1}.formstatus{grid-column:1/-1;color:#cbd6e2;font-size:.9rem}.footer{padding:24px max(5vw,24px);display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;background:#050a12;color:#aab7c4;font-size:.9rem}"+
  ".classic .hero h1,.classic .section h2{font-family:Georgia,serif;letter-spacing:-.035em}.classic .card{border-radius:8px}.minimal .hero{min-height:64vh;background:#fff;color:var(--ink)}.minimal .hero .lead{color:#4d5a66}.minimal .eyebrow{color:var(--p)}.minimal .card{box-shadow:none}.bold .hero{background-color:#06121f}.bold .card{border-top:4px solid var(--p)}"+
  "@media(max-width:800px){.navlinks a:not(.button){display:none}.grid,.leadform{grid-template-columns:1fr}.leadform .full{grid-column:auto}.section{padding-top:64px;padding-bottom:64px}.hero{min-height:68vh}}"+
  "</style></head><body class='"+esc(theme)+"'><nav class='nav'>"+logoHtml+"<div class='navlinks'><a href='#services'>Services</a><a href='#about'>About</a><a class='button primary' href='#contact'>Contact</a></div></nav>"+
  "<header class='hero'"+heroStyle+"><div class='hero-inner'><div class='eyebrow'>"+esc(site.industry)+" • "+name+"</div><h1>"+tagline+"</h1><p class='lead'>"+about+"</p><div class='actions'><a class='button primary' href='#contact'>"+cta+"</a>"+waButton+"</div></div></header>"+
  "<section id='services' class='section alt'><div class='kicker'>What we do</div><h2>Services built around your needs.</h2><div class='grid'>"+cards+"</div></section>"+
  "<section id='about' class='section'><div class='kicker'>About us</div><h2>"+name+"</h2><p class='about'>"+about+"</p></section>"+
  "<section id='contact' class='section contact'><div class='kicker'>Let's work together</div><h2>"+cta+"</h2><div class='contactline'>"+contactBits+"</div><div class='actions'>"+(phone?"<a class='button primary' href='tel:"+esc(phoneHref)+"'>Call now</a>":"")+(email?"<a class='button secondary' href='mailto:"+email+"'>Email us</a>":"")+waButton+"</div>"+
  "<form id='leadForm' class='leadform'><label>Name<input name='name' required minlength='2' maxlength='120' autocomplete='name'></label><label>Email<input name='email' required type='email' maxlength='254' autocomplete='email'></label><label>Phone<input name='phone' maxlength='50' autocomplete='tel'></label><label class='full'>Message<textarea name='message' required minlength='10' maxlength='5000'></textarea></label><div aria-hidden='true' style='position:absolute;left:-9999px'><label>Leave blank<input name='website' tabindex='-1' autocomplete='off'></label></div><button id='leadSubmit' class='button primary' type='submit'>Send enquiry</button><div id='leadStatus' class='formstatus' aria-live='polite'>Your enquiry will go directly to this business.</div></form></section>"+
  "<footer class='footer'><span>© "+new Date().getFullYear()+" "+name+". All rights reserved.</span><span>Website powered by IZAKHONO WebStart</span></footer>"+
  "<script>(function(){const f=document.getElementById('leadForm'),b=document.getElementById('leadSubmit'),s=document.getElementById('leadStatus');if(!f)return;f.addEventListener('submit',async function(e){e.preventDefault();const d=new FormData(f);if(String(d.get('website')||'').trim())return;if(location.protocol==='about:'){s.textContent='The enquiry form activates automatically when this site is published.';return}b.disabled=true;b.textContent='Sending…';s.textContent='Sending securely…';try{const r=await fetch('"+SUPABASE_URL+"/rest/v1/webstart_leads',{method:'POST',headers:{'content-type':'application/json','apikey':'"+PUBLIC_KEY+"','Prefer':'return=minimal'},body:JSON.stringify({site_id:'"+esc(site.id)+"',name:String(d.get('name')||'').trim(),email:String(d.get('email')||'').trim(),phone:String(d.get('phone')||'').trim()||null,message:String(d.get('message')||'').trim()})});if(!r.ok)throw new Error('submit');f.reset();s.textContent='Thank you. Your enquiry has been received.'}catch(_){s.textContent='We could not send the enquiry. Please use the contact details above.'}finally{b.disabled=false;b.textContent='Send enquiry'}})})();</script></body></html>";
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:cors});
  try{
    const auth=req.headers.get("authorization")||"";
    if(!auth.startsWith("Bearer "))return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:cors});
    const body=await req.json();
    const siteId=String(body.site_id||"");
    if(!/^[0-9a-f-]{36}$/i.test(siteId))return new Response(JSON.stringify({error:"Invalid site id"}),{status:400,headers:cors});
    const h={apikey:PUBLIC_KEY,authorization:auth,accept:"application/json"};
    const gr=await fetch(SUPABASE_URL+"/rest/v1/sites?id=eq."+encodeURIComponent(siteId)+"&select=*",{headers:h});
    const rows=await gr.json(); const site=rows?.[0];
    if(!gr.ok||!site)return new Response(JSON.stringify({error:"Site not found"}),{status:404,headers:cors});

    const requested=String(body.direction||site.selected_direction||"");
    const dir=pickDirection(site,requested);
    const c=dir?{tagline:dir.tagline,about:dir.about,services:dir.services,cta:dir.cta}:(site.content||{});
    const theme=dir?.theme||site.theme||"bold";
    const primary=color(dir?.brand_color||site.brand_color,"#0BB3BF");
    const accent=color(dir?.accent_color||site.accent_color,"#D4AF37");
    const html=buildHtml(site,c,theme,primary,accent);
    const report=qa(html,site,c);
    if(!report.pass)return new Response(JSON.stringify({error:"Automated QA failed",qa:report}),{status:422,headers:cors});

    const patchBody:any={
      content:c,theme,brand_color:primary,accent_color:accent,
      generated_html:html,status:"ready",qa_report:report,
      selected_direction:dir?.id||null,
      generation_mode:dir?"factory-fast":(site.generation_mode||"manual"),
      generated_at:new Date().toISOString()
    };
    const pr=await fetch(SUPABASE_URL+"/rest/v1/sites?id=eq."+encodeURIComponent(siteId),{
      method:"PATCH",
      headers:{...h,"content-type":"application/json",prefer:"return=representation"},
      body:JSON.stringify(patchBody)
    });
    const updated=await pr.json();
    if(!pr.ok)return new Response(JSON.stringify({error:"Could not save generated site",details:updated}),{status:500,headers:cors});
    return new Response(JSON.stringify({ok:true,site:updated[0],html,qa:report,direction:dir||null,live_url:RENDERER+"/"+site.slug}),{headers:cors});
  }catch(e){
    return new Response(JSON.stringify({error:"Generation failed",details:String(e)}),{status:500,headers:cors});
  }
});