import { getGrowthSession, hasGrowthPermission } from "@/lib/auth/izakhono-auth";
import { getGrowthStats } from "@/lib/data/izakhono-data";

export async function GET(){
  const session=await getGrowthSession();
  if(!session) return Response.json({error:"Authentication required"},{status:401});
  if(!hasGrowthPermission(session,"growth.read")) return Response.json({error:"Permission denied"},{status:403});
  try{
    const stats=await getGrowthStats();
    return Response.json(stats,{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Stats unavailable"},{status:503});
  }
}
