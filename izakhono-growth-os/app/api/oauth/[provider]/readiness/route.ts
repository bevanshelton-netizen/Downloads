import { getProviderOnboarding } from "@/lib/providers/onboarding";
import { isTokenVaultReady } from "@/lib/security/token-vault";

export async function GET(
  request: Request,
  {params}:{params:Promise<{provider:string}>}
){
  const {provider} = await params;
  const config = getProviderOnboarding(provider);
  if(!config){
    return Response.json({error:"Unknown provider"},{status:404});
  }

  const env = Object.fromEntries(config.env.map(name=>[name,Boolean(process.env[name])]));
  const missing = config.env.filter(name=>!process.env[name]);
  const requestOrigin = new URL(request.url).origin;
  const publicBase = (process.env.GROWTH_OS_PUBLIC_BASE_URL || requestOrigin).replace(/\/$/,"");

  return Response.json({
    provider:config.id,
    label:config.label,
    configured:missing.length===0,
    credentialsPresent:env,
    missing,
    approval:config.approval,
    authModel:config.authModel,
    scopes:config.scopes,
    callbackUrl:publicBase+config.callbackPath,
    tokenVaultReady:isTokenVaultReady(),
    liveWritesEnabled:false,
    nextAction:missing.length
      ? "Add the missing credentials to the protected Growth OS server environment."
      : "Credentials are present. Complete provider approval and callback exchange before enabling account access."
  },{headers:{"Cache-Control":"no-store"}});
}
