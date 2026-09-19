import { getGrowthSession } from "@/lib/auth/izakhono-auth";

export async function GET(){
  const session=await getGrowthSession();
  if(!session){
    return Response.json({authenticated:false},{status:401,headers:{"Cache-Control":"no-store"}});
  }
  return Response.json({authenticated:true,user:session.user},{headers:{"Cache-Control":"no-store"}});
}
