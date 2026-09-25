const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IK_APP_ID=Deno.env.get("IKHOKHA_APP_ID")||"";
const IK_SECRET=Deno.env.get("IKHOKHA_APP_SECRET")||"";
function hex(buf:ArrayBuffer){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function jsEscape(s:string){return s.replace(/[\\"']/g,"\\$&").replace(/\u0000/g,"\\0")}
async function sign(path:string,body:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(IK_SECRET.trim()),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(jsEscape(path+body))))}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 try{
  if(!IK_APP_ID||!IK_SECRET)return new Response("Payment credentials not configured",{status:503});
  const app=req.headers.get("ik-appid")||req.headers.get("IK-APPID")||"";
  const got=(req.headers.get("ik-sign")||req.headers.get("IK-SIGN")||"").toLowerCase();
  if(app.trim()!==IK_APP_ID.trim())return new Response("Forbidden",{status:403});
  const raw=await req.text();
  let payload:any={}; try{payload=JSON.parse(raw)}catch{return new Response("Bad JSON",{status:400})}
  const expected=(await sign(new URL(req.url).pathname,JSON.stringify(payload))).toLowerCase();
  if(!got||got!==expected)return new Response("Forbidden",{status:403});
  const external=String(payload.externalTransactionID||"");
  if(!external)return new Response("Missing externalTransactionID",{status:400});
  const paid=String(payload.status||"").toUpperCase()==="SUCCESS"&&String(payload.responseCode||"")==="00";
  const patch:any={payment_response_code:String(payload.responseCode||""),payment_payload:payload};
  if(paid){patch.status="paid";patch.paid_at=new Date().toISOString()}else{patch.status="manual_review"}
  const r=await fetch(SUPABASE_URL+"/rest/v1/orders?external_transaction_id=eq."+encodeURIComponent(external),{method:"PATCH",headers:{apikey:SERVICE,authorization:"Bearer "+SERVICE,"content-type":"application/json",prefer:"return=minimal"},body:JSON.stringify(patch)});
  if(!r.ok)return new Response("Database update failed",{status:500});
  return new Response("OK",{status:200});
 }catch(_e){return new Response("Webhook error",{status:500})}
});