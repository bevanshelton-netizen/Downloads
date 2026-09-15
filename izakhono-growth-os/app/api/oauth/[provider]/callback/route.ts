import { getProviderOnboarding } from "@/lib/providers/onboarding";

export async function GET(
  request: Request,
  {params}:{params:Promise<{provider:string}>}
){
  const {provider} = await params;
  const config = getProviderOnboarding(provider);
  if(!config){
    return Response.json({error:"Unknown provider"},{status:404});
  }

  const url = new URL(request.url);
  const hasCode = Boolean(url.searchParams.get("code") || url.searchParams.get("auth_code"));
  const hasError = Boolean(url.searchParams.get("error") || url.searchParams.get("error_description"));

  if(hasError){
    return Response.json({
      connected:false,
      provider:config.id,
      error:"Provider authorization returned an error.",
      detail:url.searchParams.get("error_description") || url.searchParams.get("error")
    },{status:400});
  }

  if(!hasCode){
    return Response.json({
      connected:false,
      provider:config.id,
      status:"callback-ready",
      message:"This callback endpoint is registered and reachable. No authorization code was supplied."
    });
  }

  return Response.json({
    connected:false,
    provider:config.id,
    status:"authorization-code-received",
    message:"Code exchange is intentionally locked until the encrypted token vault is configured. No token was written or exposed.",
    liveWritesEnabled:false
  },{status:202,headers:{"Cache-Control":"no-store"}});
}
