const targets=[
  ["builder",process.env.WEBSTART_BUILDER_URL||"https://izakhono-webstart.vercel.app","text/html"],
  ["renderer",process.env.WEBSTART_RENDERER_HEALTH||"https://izakhono-webstart-sites.vercel.app/health","application/json"],
  ["core",process.env.WEBSTART_CORE_HEALTH||"https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/webstart-health","application/json"]
];
let failed=false;
for(const [name,url,type] of targets){
  try{
    const r=await fetch(url,{headers:{"cache-control":"no-cache"}});
    const ct=r.headers.get("content-type")||"";
    const ok=r.status===200&&ct.includes(type);
    console.log(JSON.stringify({name,url,status:r.status,contentType:ct,ok}));
    if(!ok)failed=true;
  }catch(e){console.error(JSON.stringify({name,url,ok:false,error:String(e)}));failed=true}
}
if(failed)process.exit(1);
