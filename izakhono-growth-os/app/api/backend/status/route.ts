function ready(name:string){
  return Boolean(process.env[name]);
}

export async function GET(){
  const ownedBridge=ready("GROWTH_OS_OWNED_BRIDGE_URL") && ready("GROWTH_OS_OWNED_BRIDGE_KEY");
  const auth=ready("IZAKHONO_AUTH_URL") || ownedBridge;
  const data=ready("IZAKHONO_DATA_URL") && ready("IZAKHONO_DATA_KEY");
  const measurementKey=ready("MEASUREMENT_INGEST_KEY");
  const tokenVault=ready("OAUTH_TOKEN_ENCRYPTION_KEY");
  const ikhokhaCheckout=ready("IKHOKHA_CHECKOUT_URL") || ready("IKHOKHA_BUY_BUTTON_URL");
  const ikhokhaWebhook=ready("IKHOKHA_WEBHOOK_SECRET");
  const crm=ready("IZAKHONO_CRM_URL") || ownedBridge;

  return Response.json({
    product:"IZAKHONO GROWTH OS",
    authority:"IZAKHONO-owned infrastructure",
    externalRoute:process.env.VERCEL?"Vercel resilience":"owned runtime",
    bridge:{
      configured:ownedBridge,
      policy:"External hosting is transport/resilience only. Protected operations stay behind IZAKHONO AUTH/DATA/FORTRESS."
    },
    modules:{
      ownerAuth:{ready:auth,state:auth?"ready":"gated-owner-infrastructure"},
      dataAndApprovals:{ready:data,state:data?"ready":"gated-owner-infrastructure"},
      crm:{ready:crm,state:crm?"ready":"gated-owner-infrastructure"},
      measurement:{
        ready:data && measurementKey,
        state:data && measurementKey?"ready":"gated-owner-infrastructure"
      },
      oauthVault:{
        ready:tokenVault,
        state:tokenVault?"ready":"credentials-not-loaded-on-external-host"
      },
      payments:{
        provider:"iKhokha",
        checkoutReady:ikhokhaCheckout,
        webhookReady:ikhokhaWebhook,
        ready:ikhokhaCheckout && ikhokhaWebhook,
        state:ikhokhaCheckout && ikhokhaWebhook?"ready":"gated-payment-adapter"
      }
    },
    guardrails:{
      liveAdWrites:false,
      approvalRequiredBeforeWrite:true,
      silentBudgetChanges:false,
      externalDatabaseAuthority:false,
      cardDataStored:false
    }
  },{headers:{"Cache-Control":"no-store"}});
}
