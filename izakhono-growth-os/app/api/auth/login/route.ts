import { cookies } from "next/headers";
import { authNodeRequest, GROWTH_SESSION_COOKIE } from "@/lib/auth/izakhono-auth";

export async function POST(request:Request){
  const body=await request.json().catch(()=>null);
  if(!body?.email || !body?.password){
    return Response.json({authenticated:false,error:"Email and password are required."},{status:400});
  }

  const response=await authNodeRequest("/v1/login",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      email:String(body.email),
      password:String(body.password),
      totp:body.totp?String(body.totp):undefined
    })
  });

  const payload=await response.json().catch(()=>({}));
  if(!response.ok || !payload?.token){
    return Response.json({
      authenticated:false,
      error:payload?.error || "Sign-in failed.",
      code:payload?.code || null
    },{status:response.status||401,headers:{"Cache-Control":"no-store"}});
  }

  const jar=await cookies();
  jar.set(GROWTH_SESSION_COOKIE,String(payload.token),{
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"lax",
    path:"/",
    maxAge:Number(payload.expiresInSeconds || 43200)
  });

  return Response.json({authenticated:true,user:payload.user},{headers:{"Cache-Control":"no-store"}});
}
