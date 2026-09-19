export async function GET() {
  return Response.json({
    product:"IZAKHONO GROWTH OS",
    version:"2.0",
    status:"owner-host-ready",
    mode:"safe-command-centre",
    runtime:"IZAKHONO OWNED CLOUD",
    publicBaseUrl:process.env.GROWTH_OS_PUBLIC_BASE_URL || null,
    liveAdWrites:false,
    connectorPolicy:"read first, draft paused, explicit approval before write",
    persistence:{
      primary:"IZAKHONO DATA NODE",
      thirdPartyDatabaseRequired:false,
      configured:Boolean(process.env.IZAKHONO_DATA_URL && process.env.IZAKHONO_DATA_KEY)
    },
    providers:["Google Ads","Meta Ads","TikTok Ads","LinkedIn Ads","Amazon Ads","Microsoft Ads"],
    modules:["paid media","organic social","creative localization","landing pages","lead pipeline","attribution","compliance","budget planning","measurement control","revenue events","owned data persistence"]
  },{headers:{"Cache-Control":"no-store"}});
}
