
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const PUBLIC_KEY=Deno.env.get("SUPABASE_ANON_KEY")||"sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p";
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};

const profiles:any={
  construction:{keywords:["construction","builder","building","renovation","contractor","property development"],services:["Construction & renovations","Maintenance & repairs","Project delivery"],colors:["#E85D24","#F4B942","#17212B"],noun:"construction"},
  salon:{keywords:["salon","hair","beauty","nails","barber","spa"],services:["Hair & grooming","Beauty treatments","Bookings & consultations"],colors:["#B83B8F","#E8B4D8","#281624"],noun:"beauty"},
  restaurant:{keywords:["restaurant","food","catering","takeaway","cafe","kitchen"],services:["Dine-in & service","Takeaways & delivery","Catering & events"],colors:["#C84B31","#F3B562","#2A1712"],noun:"food"},
  clothing:{keywords:["clothing","fashion","uniform","apparel","garment","textile"],services:["Custom clothing","Corporate & team wear","Bulk production"],colors:["#111827","#C9A24A","#F8F6F0"],noun:"apparel"},
  consulting:{keywords:["consulting","advisory","consultant","strategy","professional services"],services:["Business consulting","Strategy & planning","Project advisory"],colors:["#244A73","#C4A35A","#101927"],noun:"consulting"},
  security:{keywords:["security","guarding","access control","protection"],services:["Guarding & response","Access control","Security assessments"],colors:["#14213D","#FCA311","#0A0F1C"],noun:"security"},
  transport:{keywords:["transport","logistics","delivery","courier","freight","fleet"],services:["Transport services","Business deliveries","Logistics support"],colors:["#006D77","#83C5BE","#102A2E"],noun:"transport"},
  cleaning:{keywords:["cleaning","cleaners","hygiene","deep clean"],services:["Home cleaning","Office cleaning","Deep cleaning"],colors:["#1D8A99","#8FE3CF","#10353B"],noun:"cleaning"},
  education:{keywords:["education","school","training","academy","college","learning","skills"],services:["Training & learning","Student support","Skills development"],colors:["#146C94","#F6C85F","#102A43"],noun:"education"},
  automotive:{keywords:["automotive","vehicle","car","mechanic","workshop","diagnostic"],services:["Vehicle servicing","Repairs & maintenance","Diagnostics"],colors:["#D62828","#F77F00","#191919"],noun:"automotive"},
  technology:{keywords:["technology","software","digital","web","it ","app","platform","ai "],services:["Digital solutions","Business systems","Technology support"],colors:["#6D5DFB","#12B5CB","#12142A"],noun:"technology"},
  energy:{keywords:["energy","solar","hydrogen","petroleum","renewable","power"],services:["Energy solutions","Project development","Strategic partnerships"],colors:["#087F5B","#74C69D","#0B1F18"],noun:"energy"},
  mining:{keywords:["mining","diamond","mineral","resources","metals"],services:["Resource projects","Commodity partnerships","Supply & development"],colors:["#3C3A36","#D4AF37","#171614"],noun:"resources"},
  agriculture:{keywords:["agriculture","farm","farming","food production","agri"],services:["Agricultural production","Market access","Supply-chain support"],colors:["#52734D","#91C788","#1D2E1A"],noun:"agriculture"},
  general:{keywords:[],services:["Professional services","Customer support","Custom solutions"],colors:["#0BB3BF","#D4AF37","#07101F"],noun:"business"}
};

function inferIndustry(input:string, provided:string){
  const p=(provided||"general").toLowerCase();
  if(profiles[p] && p!=="general") return p;
  const s=input.toLowerCase();
  for(const [k,v] of Object.entries<any>(profiles)){
    if(k==="general") continue;
    if(v.keywords.some((w:string)=>s.includes(w))) return k;
  }
  return "general";
}
function safeText(v:any,max=1200){return String(v||"").trim().replace(/\s+/g," ").slice(0,max)}
function normServices(v:any, fallback:string[]){
  const a=Array.isArray(v)?v.map((x:any)=>safeText(x,90)).filter(Boolean):[];
  return (a.length?a:fallback).slice(0,8);
}
function directions(business:string, industry:string, brief:string, services:string[]){
  const p=profiles[industry]||profiles.general;
  const [base,accent,dark]=p.colors;
  const briefSentence=brief.length>=35?brief:(business+" provides dependable "+p.noun+" services with clear communication, professional delivery and a focus on long-term customer value.");
  return [
    {
      id:"bold-growth",label:"Bold Growth",summary:"High-impact, conversion-led and energetic. Best for businesses that want to look ambitious and move quickly.",
      theme:"bold",brand_color:base,accent_color:accent,
      tagline: industry==="general" ? business+" — built to move business forward." : "Move forward with "+business+".",
      about:briefSentence,
      services,cta:"Start a conversation with "+business
    },
    {
      id:"premium-trust",label:"Premium Trust",summary:"Refined, established and credibility-led. Best for investment, professional, industrial and high-value services.",
      theme:"classic",brand_color:dark,accent_color:accent,
      tagline:"Trusted "+p.noun+" solutions. Built for the long term.",
      about:business+" combines professional delivery, clear accountability and practical execution. "+briefSentence,
      services,cta:"Discuss your next opportunity"
    },
    {
      id:"clean-modern",label:"Clean Modern",summary:"Simple, clear and mobile-first. Best for service businesses that want visitors to understand and act immediately.",
      theme:"minimal",brand_color:base,accent_color:dark,
      tagline:business+", made clear.",
      about:briefSentence,
      services,cta:"Get started with "+business
    }
  ];
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:cors});
  try{
    const auth=req.headers.get("authorization")||"";
    if(!auth.startsWith("Bearer ")) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:cors});
    const b=await req.json();
    const business=safeText(b.business_name||"Your business",120);
    if(business.length<2) return new Response(JSON.stringify({error:"Business name is required"}),{status:400,headers:cors});
    const brief=safeText(b.brief||"",1200);
    const industry=inferIndustry(brief+" "+business,String(b.industry||"general"));
    const p=profiles[industry]||profiles.general;
    const services=normServices(b.services,p.services);
    const dirs=directions(business,industry,brief,services);
    const siteId=String(b.site_id||"");
    if(/^[0-9a-f-]{36}$/i.test(siteId)){
      const h={apikey:PUBLIC_KEY,authorization:auth,"content-type":"application/json",prefer:"return=representation"};
      const patch=await fetch(SUPABASE_URL+"/rest/v1/sites?id=eq."+encodeURIComponent(siteId),{
        method:"PATCH",headers:h,
        body:JSON.stringify({
          industry,
          brief:{text:brief,business_name:business,services},
          design_directions:dirs,
          selected_direction:null,
          generation_mode:"factory-fast"
        })
      });
      if(!patch.ok){
        const d=await patch.text();
        return new Response(JSON.stringify({error:"Could not save factory directions",details:d}),{status:500,headers:cors});
      }
    }
    return new Response(JSON.stringify({
      ok:true,
      mode:"factory-fast",
      inferred_industry:industry,
      content:dirs[0],
      directions:dirs
    }),{headers:cors});
  }catch(e){
    return new Response(JSON.stringify({error:"Drafting failed",details:String(e)}),{status:500,headers:cors});
  }
});