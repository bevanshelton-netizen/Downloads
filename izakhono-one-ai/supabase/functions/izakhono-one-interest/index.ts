import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { countRows } from "./rest.mjs";

const FOUNDING_LIMIT=1000;
const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type",
  "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
  "Cache-Control":"no-store"
};

function response(status:number,body:unknown){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}
  });
}
function cleanText(value:unknown,max:number){
  if(typeof value!=="string") return null;
  const text=value.trim().replace(/[\r\n\t]+/g," ").slice(0,max);
  return text||null;
}
function validEmail(value:unknown){
  if(typeof value!=="string") return false;
  const email=value.trim().toLowerCase();
  return email.length<=254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
}
const FEEDBACK_OUTCOMES=new Set(["worked","slow","failed","no-webgpu","suggestion"]);
const MODEL_TIERS=new Set(["quick","balanced","strong"]);

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  const url=Deno.env.get("SUPABASE_URL");
  const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!serviceRole) {
    console.error("one_launch_interest configuration missing", {urlConfigured:!!url,serviceRoleConfigured:!!serviceRole});
    return response(503,{error:"Launch service is not configured"});
  }

  if(req.method==="GET"){
    try {
      const [count,feedbackCount]=await Promise.all([
        countRows({
          baseUrl:url,
          serviceRoleKey:serviceRole,
          table:"one_launch_interest",
          filters:{status:"neq.unsubscribed"}
        }),
        countRows({
          baseUrl:url,
          serviceRoleKey:serviceRole,
          table:"one_pilot_feedback"
        })
      ]);
      const total=Number(count||0);
      return response(200,{
        ok:true,
        program:"Founding 1,000",
        foundingLimit:FOUNDING_LIMIT,
        registered:total,
        remaining:Math.max(0,FOUNDING_LIMIT-total),
        waitlist:Math.max(0,total-FOUNDING_LIMIT),
        feedbackReceived:Number(feedbackCount||0),
        tracking:false,
        referralAttribution:false,
        campaignAttribution:false,
        automaticFingerprinting:false
      });
    } catch(error) {
      console.error("one launch status REST query failed", {
        name:error instanceof Error?error.name:"UnknownError",
        message:error instanceof Error?error.message:String(error),
        status:(error as any)?.status??null,
        code:(error as any)?.code??null,
        responseBody:(error as any)?.body??null,
        cause:(error as any)?.cause instanceof Error?(error as any).cause.message:null
      });
      return response(503,{error:"Unable to load launch status"});
    }
  }

  if(req.method!=="POST") return response(405,{error:"Method not allowed"});

  const supabase=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});

  try{
    const body=await req.json().catch(()=>null);
    if(!body||typeof body!=="object") return response(400,{error:"Invalid request"});
    if(cleanText((body as any).website,200)) return response(202,{accepted:true});

    if((body as any).action==="feedback"){
      const outcome=cleanText((body as any).outcome,32);
      const modelTier=cleanText((body as any).modelTier,32);
      const message=cleanText((body as any).message,1200);
      const emailRaw=cleanText((body as any).email,254);
      const consentContact=(body as any).consentContact===true;

      if(!outcome||!FEEDBACK_OUTCOMES.has(outcome)){
        return response(400,{error:"Choose a valid feedback outcome"});
      }
      if(modelTier&&!MODEL_TIERS.has(modelTier)){
        return response(400,{error:"Invalid model tier"});
      }
      if(emailRaw&&!validEmail(emailRaw)){
        return response(400,{error:"Enter a valid email or leave it blank"});
      }
      if(consentContact&&!emailRaw){
        return response(400,{error:"Email is required if you want a reply"});
      }

      const {error}=await supabase.from("one_pilot_feedback").insert({
        outcome,
        model_tier:modelTier||null,
        message:message||null,
        email:consentContact&&emailRaw?String(emailRaw).toLowerCase():null,
        consent_contact:consentContact
      });
      if(error){
        console.error("one pilot feedback insert failed", {code:error.code,message:error.message,details:error.details,hint:error.hint});
        return response(500,{error:"Unable to save feedback right now"});
      }
      return response(202,{
        accepted:true,
        message:"Thank you. Your pilot feedback was recorded.",
        tracking:false,
        referralAttribution:false,
        campaignAttribution:false,
        automaticFingerprinting:false
      });
    }

    const emailRaw=(body as any).email;
    const consent=(body as any).consent===true;
    if(!validEmail(emailRaw)) return response(400,{error:"Enter a valid email address"});
    if(!consent) return response(400,{error:"Consent is required"});

    const email=String(emailRaw).trim().toLowerCase();
    const displayName=cleanText((body as any).displayName,120);

    const {data:existing,error:lookupError}=await supabase
      .from("one_launch_interest")
      .select("id,status,founding_no")
      .eq("email",email)
      .maybeSingle();

    if(lookupError) {
      console.error("one launch registration lookup failed", {code:lookupError.code,message:lookupError.message,details:lookupError.details,hint:lookupError.hint});
      return response(500,{error:"Unable to check your registration right now"});
    }

    if(existing){
      const {error:updateError}=await supabase
        .from("one_launch_interest")
        .update({
          display_name:displayName,
          consent:true,
          status:existing.status==="unsubscribed"?"interested":existing.status,
          updated_at:new Date().toISOString()
        })
        .eq("id",existing.id);
      if(updateError) {
        console.error("one launch registration update failed", {code:updateError.code,message:updateError.message,details:updateError.details,hint:updateError.hint});
        return response(500,{error:"Unable to update your registration right now"});
      }

      return response(202,{
        accepted:true,
        alreadyRegistered:true,
        foundingNo:Number(existing.founding_no||0),
        message:"You're already on the IZAKHONO ONE launch list.",
        referralAttribution:false,
        campaignAttribution:false
      });
    }

    const {data,error}=await supabase
      .from("one_launch_interest")
      .insert({
        email,
        display_name:displayName,
        referral_code:null,
        campaign:null,
        invite_code:null,
        consent:true,
        source:"izakhono-one-public-bridge",
        status:"interested",
        updated_at:new Date().toISOString()
      })
      .select("founding_no")
      .single();

    if(error){
      console.error("one launch insert failed", {code:error.code,message:error.message,details:error.details,hint:error.hint});
      return response(500,{error:"Unable to save your interest right now"});
    }

    const foundingNo=Number(data.founding_no);
    const foundingMember=foundingNo<=FOUNDING_LIMIT;
    return response(202,{
      accepted:true,
      alreadyRegistered:false,
      foundingNo,
      foundingMember,
      foundingLimit:FOUNDING_LIMIT,
      referralAttribution:false,
      campaignAttribution:false,
      message:foundingMember
        ?"Welcome to the IZAKHONO ONE Founding 1,000."
        :"The Founding 1,000 allocation is full, but you're on the priority launch waitlist."
    });
  }catch(error){
    console.error("one launch interest unexpected failure", error);
    return response(500,{error:"Unexpected launch service error"});
  }
});