import { cookies } from "next/headers";
import { authNodeRequest, getGrowthSession, GROWTH_SESSION_COOKIE } from "@/lib/auth/izakhono-auth";

export async function POST(){
  const session=await getGrowthSession();
  if(session){
    await authNodeRequest("/v1/logout",{
      method:"POST",
      headers:{authorization:`Bearer ${session.token}`}
    }).catch(()=>null);
  }

  const jar=await cookies();
  jar.set(GROWTH_SESSION_COOKIE,"",{
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"lax",
    path:"/",
    maxAge:0
  });

  return Response.json({loggedOut:true},{headers:{"Cache-Control":"no-store"}});
}
