
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const PUBLIC_KEY=Deno.env.get("SUPABASE_ANON_KEY")||"sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p";
const RENDERER_RAW=Deno.env.get("WEBSTART_RENDERER_BASE")||"https://izakhono-webstart-sites.vercel.app";
const RENDERER=RENDERER_RAW.endsWith("/")?RENDERER_RAW.slice(0,-1):RENDERER_RAW;
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};

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
    if(!site.generated_html)return new Response(JSON.stringify({error:"Generate the website before publishing"}),{status:409,headers:cors});

    const mode=String(site.generation_mode||"manual");
    if(mode.startsWith("factory") && site.qa_report?.pass!==true){
      return new Response(JSON.stringify({error:"Automated QA must pass before publishing",qa:site.qa_report||{}}),{status:409,headers:cors});
    }

    const sr=await fetch(SUPABASE_URL+"/rest/v1/webstart_subscriptions?site_id=eq."+encodeURIComponent(siteId)+"&status=eq.active&select=id,next_due_at&limit=1",{headers:h});
    const subs=await sr.json();
    const activeSub=sr.ok&&Array.isArray(subs)&&subs.length>0;
    let paidInitial=false;
    if(!activeSub){
      const or=await fetch(SUPABASE_URL+"/rest/v1/orders?site_id=eq."+encodeURIComponent(siteId)+"&billing_type=eq.initial&status=eq.paid&select=id&limit=1",{headers:h});
      const paid=await or.json();
      paidInitial=or.ok&&Array.isArray(paid)&&paid.length>0;
    }
    if(!activeSub&&!paidInitial)return new Response(JSON.stringify({error:"Payment required before public publishing. Preview and generation remain available."}),{status:402,headers:cors});

    const url=RENDERER+"/"+encodeURIComponent(site.slug);
    const now=new Date().toISOString();
    const pr=await fetch(SUPABASE_URL+"/rest/v1/sites?id=eq."+encodeURIComponent(siteId),{
      method:"PATCH",
      headers:{...h,"content-type":"application/json",prefer:"return=representation"},
      body:JSON.stringify({status:"published",published_url:url,published_at:now,verified_at:null})
    });
    const updated=await pr.json();
    if(!pr.ok)return new Response(JSON.stringify({error:"Publish update failed",details:updated}),{status:500,headers:cors});

    let verified=false,verifyStatus=0,verifyType="",verifyError="";
    try{
      const vr=await fetch(url+"?verify="+Date.now(),{headers:{"cache-control":"no-cache"}});
      verifyStatus=vr.status; verifyType=vr.headers.get("content-type")||"";
      const text=await vr.text();
      verified=vr.status===200 && verifyType.includes("text/html") && text.includes(String(site.name)) && text.includes("<html");
      if(!verified)verifyError="Renderer returned unexpected content.";
    }catch(e){verifyError=String(e)}

    if(!verified){
      await fetch(SUPABASE_URL+"/rest/v1/sites?id=eq."+encodeURIComponent(siteId),{
        method:"PATCH",
        headers:{...h,"content-type":"application/json",prefer:"return=minimal"},
        body:JSON.stringify({status:"ready",published_url:null,published_at:null,verified_at:null})
      });
      return new Response(JSON.stringify({error:"Public verification failed; publish was rolled back",status:verifyStatus,content_type:verifyType,details:verifyError}),{status:502,headers:cors});
    }

    const verifiedAt=new Date().toISOString();
    const finalPatch=await fetch(SUPABASE_URL+"/rest/v1/sites?id=eq."+encodeURIComponent(siteId),{
      method:"PATCH",
      headers:{...h,"content-type":"application/json",prefer:"return=representation"},
      body:JSON.stringify({verified_at:verifiedAt})
    });
    const finalRows=await finalPatch.json();

    await fetch(SUPABASE_URL+"/rest/v1/publish_events",{
      method:"POST",
      headers:{...h,"content-type":"application/json",prefer:"return=minimal"},
      body:JSON.stringify({owner_id:site.owner_id,site_id:site.id,status:"published",target:"webstart-renderer",url,details:{billing_enforced:true,verified:true,http_status:verifyStatus,content_type:verifyType,generation_mode:mode,qa_score:site.qa_report?.score||null}})
    });

    return new Response(JSON.stringify({ok:true,url,site:finalRows?.[0]||updated?.[0],billing_enforced:true,verified:true,http_status:verifyStatus}),{headers:cors});
  }catch(e){
    return new Response(JSON.stringify({error:"Publish failed",details:String(e)}),{status:500,headers:cors});
  }
});