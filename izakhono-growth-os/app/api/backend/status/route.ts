import { OWNED_BRIDGE_URL, ownedBridgeHealth, useOwnedBridge } from "@/lib/owned-bridge";

function ready(name:string){ return Boolean(process.env[name]); }

export async function GET(){
  const external=useOwnedBridge();
  const bridge=external?await ownedBridgeHealth():null;
  const bridgeBody=(bridge?.body||{}) as any;
  const bridgeReachable=Boolean(bridge?.reachable);
  const auth=external?Boolean(bridgeBody?.modules?.auth?.reachable):ready("IZAKHONO_AUTH_URL");
  const data=external?Boolean(bridgeBody?.modules?.data?.reachable && bridgeBody?.modules?.data?.keyReady):Boolean(ready("IZAKHONO_DATA_URL")&&ready("IZAKHONO_DATA_KEY"));
  const pay=external?bridgeBody?.modules?.payments:null;
  const measurementKey=external?data:ready("MEASUREMENT_INGEST_KEY");
  const tokenVault=ready("OAUTH_TOKEN_ENCRYPTION_KEY");
  const crm=external?bridgeReachable:(ready("IZAKHONO_CRM_URL"));

  return Response.json({
    product:"IZAKHONO GROWTH OS",
    authority:"IZAKHONO-owned infrastructure",
    externalRoute:external?"Vercel resilience":"owned runtime",
    bridge:{
      url:external?OWNED_BRIDGE_URL:null,
      configured:external?true:false,
      reachable:external?bridgeReachable:true,
      authentication:external?"Vercel project OIDC with custom audience":"loopback owned services",
      policy:"External hosting is transport/resilience only. Protected operations stay behind IZAKHONO AUTH/DATA/PAY/FORTRESS."
    },
    modules:{
      ownerAuth:{ready:auth,state:auth?"ready":"gated-owner-infrastructure"},
      dataAndApprovals:{ready:data,state:data?"ready":"gated-owner-infrastructure"},
      crm:{ready:crm,state:crm?"bridge-ready":"gated-owner-infrastructure"},
      measurement:{ready:data&&measurementKey,state:data&&measurementKey?"ready":"gated-owner-infrastructure"},
      oauthVault:{ready:tokenVault,state:tokenVault?"ready":"provider-credentials-remain-owner-side"},
      payments:{
        provider:"iKhokha via IZAKHONO PAY",
        gatewayReachable:external?Boolean(pay?.reachable):null,
        growthOsRegistered:external?Boolean(pay?.growthOsRegistered):false,
        ready:external?Boolean(pay?.reachable&&pay?.growthOsRegistered):false,
        state:external&&pay?.reachable&&pay?.growthOsRegistered?"ready":"gated-payment-registration"
      }
    },
    guardrails:{
      liveAdWrites:false,
      approvalRequiredBeforeWrite:true,
      silentBudgetChanges:false,
      externalDatabaseAuthority:false,
      cardDataStored:false,
      bridgeArbitraryProxy:false,
      bridgeShellAccess:false
    }
  },{headers:{"Cache-Control":"no-store"}});
}
