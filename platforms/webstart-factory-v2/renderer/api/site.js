const SUPA="https://yfawrenhudjomhnglfhq.supabase.co";
const KEY="sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p";
function cleanSlug(v){const s=String(v||"").toLowerCase().trim();return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)?s:"";}
export default async function handler(req,res){
  const slug=cleanSlug(req.query.slug);
  if(!slug){res.status(400).setHeader("content-type","text/plain; charset=utf-8");return res.send("Invalid site slug");}
  try{
    const url=SUPA+"/rest/v1/sites?slug=eq."+encodeURIComponent(slug)+"&status=eq.published&select=generated_html,name,updated_at&limit=1";
    const r=await fetch(url,{headers:{apikey:KEY,accept:"application/json"}});
    if(!r.ok){res.status(502).setHeader("content-type","text/plain; charset=utf-8");return res.send("Site lookup failed");}
    const rows=await r.json(),site=Array.isArray(rows)?rows[0]:null;
    if(!site?.generated_html){res.status(404).setHeader("content-type","text/html; charset=utf-8");res.setHeader("cache-control","no-store");return res.send("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Site not found</title></head><body><h1>Website not published yet</h1></body></html>");}
    res.status(200);res.setHeader("content-type","text/html; charset=utf-8");res.setHeader("cache-control","public, max-age=60, s-maxage=300, stale-while-revalidate=600");res.setHeader("x-content-type-options","nosniff");res.setHeader("referrer-policy","strict-origin-when-cross-origin");res.setHeader("permissions-policy","camera=(), microphone=(), geolocation=()");return res.send(site.generated_html);
  }catch(_e){res.status(500).setHeader("content-type","text/plain; charset=utf-8");return res.send("Unexpected server error");}
}