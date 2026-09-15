import { getProviderOnboarding } from "@/lib/providers/onboarding";

export async function GET(
  _request: Request,
  {params}:{params:Promise<{provider:string}>}
){
  const {provider} = await params;
  const config = getProviderOnboarding(provider);
  if(!config){
    return Response.json({error:"Unknown provider"},{status:404});
  }

  const env = Object.fromEntries(config.env.map(name=>[name,Boolean(process.env[name])]));
  const missing = config.env.filter(name=>!process.env[name]);

  return Response.json({
    provider:config.id,
    label:config.label,
    configured:missing.length===0,
    credentialsPresent:env,
    missing,
    approval:config.approval,
    authModel:config.authModel,
    scopes:config.scopes,
    callbackUrl:"https://izakhono-growth-os.vercel.app"+config.callbackPath,
    liveWritesEnabled:false,
    nextAction:missing.length
      ? "Add the missing credentials as server-side production environment variables."
      : "Credentials are present. Complete provider approval and callback exchange before enabling account access."
  },{headers:{"Cache-Control":"no-store"}});
}
