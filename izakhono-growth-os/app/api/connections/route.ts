import { providerRegistry } from "@/lib/providers/registry";

export async function GET(){
  return Response.json({
    providers: providerRegistry,
    connected: providerRegistry.filter(provider=>provider.connectionState.startsWith("connected")).length,
    total: providerRegistry.length,
    liveWritesEnabled: false,
    nextAction: "Configure provider OAuth applications and server-side credentials."
  },{headers:{"Cache-Control":"no-store"}});
}
