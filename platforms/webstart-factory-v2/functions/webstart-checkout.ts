const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const IK_APP_ID = Deno.env.get("IKHOKHA_APP_ID") || "";
const IK_SECRET = Deno.env.get("IKHOKHA_APP_SECRET") || "";
const IK_MODE = (Deno.env.get("IKHOKHA_MODE") || "test").toLowerCase();
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};
const api="https://api.ikhokha.com/public-api/v1/api/payment";
function hex(buf:ArrayBuffer){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function jsEscape(s:string){return s.replace(/[\\"']/g,"\\$&").replace(/\u0000/g,"\\0")}
async function sign(path:string, body:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(IK_SECRET.trim()),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(jsEscape(path+body))))}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:cors});
 try{
  if(!IK_APP_ID||!IK_SECRET)return new Response(JSON.stringify({error:"iKhokha API credentials are not installed yet",setup_required:true}),{status:503,headers:cors});
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:cors});
  const input=await req.json();
  const siteId=String(input.site_id||"");
  const pkg=String(input.package||"");
  if(!/^[0-9a-f-]{36}$/i.test(siteId)||!["start","business","commerce"].includes(pkg))return new Response(JSON.stringify({error:"Invalid checkout request"}),{status:400,headers:cors});
  const h={apikey:PUBLIC_KEY,authorization:auth,accept:"application/json","content-type":"application/json"};
  const sr=await fetch(SUPABASE_URL+"/rest/v1/sites?id=eq."+encodeURIComponent(siteId)+"&select=id,owner_id,name,slug",{headers:h});
  const sites=await sr.json(); const site=sites?.[0];
  if(!sr.ok||!site)return new Response(JSON.stringify({error:"Site not found"}),{status:404,headers:cors});
  const pricing:any={
    start:{once_off_cents:99900,monthly_cents:9900},
    business:{once_off_cents:249900,monthly_cents:19900},
    commerce:{once_off_cents:499900,monthly_cents:34900}
  };
  const price=pricing[pkg];
  const or=await fetch(SUPABASE_URL+"/rest/v1/orders",{method:"POST",headers:{...h,prefer:"return=representation"},body:JSON.stringify({owner_id:site.owner_id,site_id:site.id,package:pkg,once_off_cents:price.once_off_cents,monthly_cents:price.monthly_cents})});
  const orders=await or.json(); const order=orders?.[0];
  if(!or.ok||!order)return new Response(JSON.stringify({error:"Could not create order",details:orders}),{status:500,headers:cors});
  const external="WS-"+order.id;
  const callback=SUPABASE_URL+"/functions/v1/webstart-ikhokha-webhook";
  const resultBase=SUPABASE_URL+"/functions/v1/webstart-payment-result";
  const amount=Number(order.once_off_cents)+Number(order.monthly_cents);
  const payload={
    entityID:order.id,
    externalEntityID:site.id,
    amount,
    currency:"ZAR",
    requesterUrl:"https://izakhono-webstart.vercel.app",
    description:"IZAKHONO WebStart "+pkg+" — setup plus first month",
    paymentReference:site.slug+"-"+order.id.slice(0,8),
    mode:IK_MODE,
    externalTransactionID:external,
    urls:{
      callbackUrl:callback,
      successPageUrl:resultBase+"?status=success",
      failurePageUrl:resultBase+"?status=failure",
      cancelUrl:resultBase+"?status=cancelled"
    }
  };
  const body=JSON.stringify(payload);
  const path=new URL(api).pathname;
  const signature=await sign(path,body);
  const pr=await fetch(api,{method:"POST",headers:{"content-type":"application/json","accept":"application/json","IK-APPID":IK_APP_ID.trim(),"IK-SIGN":signature},body});
  const payment=await pr.json().catch(()=>({}));
  if(!pr.ok||!payment?.paylinkUrl){
    await fetch(SUPABASE_URL+"/rest/v1/orders?id=eq."+order.id,{method:"PATCH",headers:{...h,prefer:"return=minimal"},body:JSON.stringify({status:"manual_review",external_transaction_id:external,payment_response_code:String(payment?.responseCode||pr.status),payment_payload:payment})});
    return new Response(JSON.stringify({error:"iKhokha did not return a checkout link",details:payment}),{status:502,headers:cors});
  }
  const ur=await fetch(SUPABASE_URL+"/rest/v1/orders?id=eq."+order.id,{method:"PATCH",headers:{...h,prefer:"return=representation"},body:JSON.stringify({external_transaction_id:external,paylink_id:payment.paylinkID||null,checkout_url:payment.paylinkUrl,payment_response_code:payment.responseCode||null,payment_payload:payment})});
  const updated=await ur.json();
  return new Response(JSON.stringify({ok:true,order:updated?.[0]||order,checkout_url:payment.paylinkUrl,initial_charge_cents:amount,mode:IK_MODE}),{headers:cors});
 }catch(e){return new Response(JSON.stringify({error:"Checkout failed",details:String(e)}),{status:500,headers:cors})}
});