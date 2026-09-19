import { getGrowthSession, hasGrowthPermission } from "@/lib/auth/izakhono-auth";
import { createGrowthApproval, listGrowthApprovals } from "@/lib/data/izakhono-data";

const allowedActions=new Set([
  "campaign.create","campaign.update","campaign.activate","budget.change","provider.write"
]);

export async function GET(){
  const session=await getGrowthSession();
  if(!session) return Response.json({error:"Authentication required"},{status:401});
  if(!hasGrowthPermission(session,"growth.read")) return Response.json({error:"Permission denied"},{status:403});
  try{
    return Response.json(await listGrowthApprovals(),{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Approvals unavailable"},{status:503});
  }
}

export async function POST(request:Request){
  const session=await getGrowthSession();
  if(!session) return Response.json({error:"Authentication required"},{status:401});
  if(!hasGrowthPermission(session,"growth.write")) return Response.json({error:"Permission denied"},{status:403});

  const body=await request.json().catch(()=>null);
  const actionType=String(body?.actionType||"");
  if(!allowedActions.has(actionType)) return Response.json({error:"Unsupported approval action."},{status:400});

  const requestedPayload=body?.requestedPayload ?? {};
  if(JSON.stringify(requestedPayload).length>100000) return Response.json({error:"Approval payload too large."},{status:413});

  try{
    const approval=await createGrowthApproval({
      id:body?.id?String(body.id):undefined,
      actionType,
      provider:body?.provider?String(body.provider):null,
      externalAccountId:body?.externalAccountId?String(body.externalAccountId):null,
      campaignRef:body?.campaignRef?String(body.campaignRef):null,
      requestedPayload
    });
    return Response.json(approval,{status:201,headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Approval creation failed"},{status:503});
  }
}
