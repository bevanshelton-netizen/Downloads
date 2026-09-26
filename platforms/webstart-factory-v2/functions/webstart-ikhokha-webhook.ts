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
  const expected=(await sign(new URL(req.url).pathname,raw)).toLowerCase();
  if(!got||got!==expected)return new Response("Forbidden",{status:403});
  const external=String(payload.externalTransactionID||"");
  if(!external)return new Response("Missing externalTransactionID",{status:400});
  const headers={apikey:SERVICE,authorization:"Bearer "+SERVICE,"content-type":"application/json"};
  const or=await fetch(SUPABASE_URL+"/rest/v1/orders?external_transaction_id=eq."+encodeURIComponent(external)+"&select=id,owner_id,site_id,package,monthly_cents,status,billing_type,subscription_id&limit=1",{headers});
  const orders=await or.json(); const order=Array.isArray(orders)?orders[0]:null;
  if(!or.ok||!order)return new Response("Order not found",{status:404});
  if(order.status==="paid")return new Response("OK",{status:200});
  const paid=String(payload.status||"").toUpperCase()==="SUCCESS"&&String(payload.responseCode||"")==="00";
  const patch:any={payment_response_code:String(payload.responseCode||""),payment_payload:payload};
  const paidAt=new Date();
  if(paid){patch.status="paid";patch.paid_at=paidAt.toISOString()}else{patch.status="manual_review"}
  const r=await fetch(SUPABASE_URL+"/rest/v1/orders?id=eq."+encodeURIComponent(order.id),{method:"PATCH",headers:{...headers,prefer:"return=minimal"},body:JSON.stringify(patch)});
  if(!r.ok)return new Response("Database update failed",{status:500});
  if(paid){
    if(order.billing_type==="initial"){
      const end=new Date(paidAt); end.setUTCMonth(end.getUTCMonth()+1);
      const subPayload={owner_id:order.owner_id,site_id:order.site_id,package:order.package,monthly_cents:Number(order.monthly_cents||0),currency:"ZAR",status:"active",current_period_start:paidAt.toISOString(),current_period_end:end.toISOString(),next_due_at:end.toISOString(),last_paid_order_id:order.id,updated_at:paidAt.toISOString()};
      const sr=await fetch(SUPABASE_URL+"/rest/v1/webstart_subscriptions?on_conflict=site_id",{method:"POST",headers:{...headers,prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(subPayload)});
      const subs=await sr.json().catch(()=>[]);
      const sub=Array.isArray(subs)?subs[0]:null;
      if(sr.ok&&sub?.id){
        await fetch(SUPABASE_URL+"/rest/v1/orders?id=eq."+encodeURIComponent(order.id),{method:"PATCH",headers:{...headers,prefer:"return=minimal"},body:JSON.stringify({subscription_id:sub.id})});
      }
    }else if(order.subscription_id){
      const sr=await fetch(SUPABASE_URL+"/rest/v1/webstart_subscriptions?id=eq."+encodeURIComponent(order.subscription_id)+"&select=id,current_period_end&limit=1",{headers});
      const subs=await sr.json(); const sub=Array.isArray(subs)?subs[0]:null;
      const now=new Date();
      const current=sub?.current_period_end?new Date(sub.current_period_end):now;
      const start=current>now?current:now;
      const end=new Date(start); end.setUTCMonth(end.getUTCMonth()+1);
      await fetch(SUPABASE_URL+"/rest/v1/webstart_subscriptions?id=eq."+encodeURIComponent(order.subscription_id),{method:"PATCH",headers:{...headers,prefer:"return=minimal"},body:JSON.stringify({status:"active",current_period_start:start.toISOString(),current_period_end:end.toISOString(),next_due_at:end.toISOString(),last_paid_order_id:order.id,updated_at:now.toISOString()})});
    }
  }
  return new Response("OK",{status:200});
 }catch(_e){return new Response("Webhook error",{status:500})}
});