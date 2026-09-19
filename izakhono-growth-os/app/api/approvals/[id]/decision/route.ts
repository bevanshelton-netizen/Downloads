import { getGrowthSession, hasGrowthPermission } from "@/lib/auth/izakhono-auth";
import { decideGrowthApproval } from "@/lib/data/izakhono-data";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getGrowthSession();
  if(!session) return Response.json({error:"Authentication required"},{status:401});
  if(!hasGrowthPermission(session,"growth.write")) return Response.json({error:"Permission denied"},{status:403});

  const {id}=await params;
  const body=await request.json().catch(()=>null);
  const status=String(body?.status||"");
  if(!["approved","rejected","cancelled"].includes(status)) return Response.json({error:"Invalid decision."},{status:400});

  try{
    const result=await decideGrowthApproval(id,{
      status:status as "approved"|"rejected"|"cancelled",
      note:body?.note?String(body.note).slice(0,1000):null,
      actorRef:session.user.id
    });
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Approval decision failed"},{status:503});
  }
}
