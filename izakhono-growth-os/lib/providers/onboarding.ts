import type { ProviderId } from "./types";

export type ProviderOnboarding = {
  id: ProviderId;
  label: string;
  approval: string;
  authModel: string;
  env: string[];
  scopes: string[];
  callbackPath: string;
  checklist: string[];
  currentNote?: string;
};

export const providerOnboarding: ProviderOnboarding[] = [
  {
    id:"google-ads",
    label:"Google Ads",
    approval:"Google Cloud project with Google Ads API access",
    authModel:"OAuth 2.0 user authorization",
    env:["GOOGLE_ADS_CLIENT_ID","GOOGLE_ADS_CLIENT_SECRET"],
    scopes:["https://www.googleapis.com/auth/adwords"],
    callbackPath:"/api/oauth/google-ads/callback",
    checklist:[
      "Create or select a Google Cloud project.",
      "Enable the Google Ads API.",
      "Configure an OAuth web application and authorized redirect URI.",
      "Confirm the Cloud project has the required Google Ads API access level.",
      "Authorize the Google Ads user and select accessible customer accounts."
    ],
    currentNote:"Developer-token access was sunset on 9 September 2026; API access levels are now associated with the Google Cloud project."
  },
  {
    id:"meta-ads",
    label:"Meta Ads",
    approval:"Meta developer app with required Marketing API permissions",
    authModel:"OAuth / Facebook Login for Business",
    env:["META_APP_ID","META_APP_SECRET"],
    scopes:["ads_read","ads_management","business_management"],
    callbackPath:"/api/oauth/meta-ads/callback",
    checklist:[
      "Create a Meta developer app for the business integration.",
      "Add the required Marketing API / business permissions.",
      "Register the production callback URL.",
      "Complete any required app review or business verification.",
      "Authorize a user with access to the target ad accounts."
    ]
  },
  {
    id:"tiktok-ads",
    label:"TikTok Ads",
    approval:"TikTok for Business developer app approval",
    authModel:"TikTok Marketing API authorization code flow",
    env:["TIKTOK_ADS_APP_ID","TIKTOK_ADS_SECRET"],
    scopes:["advertiser.read","campaign.read","campaign.write"],
    callbackPath:"/api/oauth/tiktok-ads/callback",
    checklist:[
      "Create and submit a TikTok for Business developer app.",
      "Record the approved app ID and secret.",
      "Register a publicly reachable callback address.",
      "Request the minimum scopes required for reporting and campaign management.",
      "Authorize the advertiser account and retain the resulting token securely."
    ]
  },
  {
    id:"linkedin-ads",
    label:"LinkedIn Ads",
    approval:"LinkedIn Advertising API approval",
    authModel:"3-legged OAuth 2.0 member authorization",
    env:["LINKEDIN_CLIENT_ID","LINKEDIN_CLIENT_SECRET"],
    scopes:["r_ads","r_ads_reporting","rw_ads"],
    callbackPath:"/api/oauth/linkedin-ads/callback",
    checklist:[
      "Create a LinkedIn Developer application.",
      "Apply for Advertising API access.",
      "Register the production redirect URL.",
      "Request only approved Marketing API scopes.",
      "Authorize a LinkedIn member who administers the required ad accounts."
    ],
    currentNote:"LinkedIn Marketing APIs require member authorization; Marketing APIs do not use 2-legged client-credentials authentication."
  },
  {
    id:"amazon-ads",
    label:"Amazon Ads",
    approval:"Amazon Ads API application approval",
    authModel:"OAuth 2.0",
    env:["AMAZON_ADS_CLIENT_ID","AMAZON_ADS_CLIENT_SECRET"],
    scopes:["advertising::campaign_management"],
    callbackPath:"/api/oauth/amazon-ads/callback",
    checklist:[
      "Request Amazon Ads API access for the organization.",
      "Create the approved application and OAuth credentials.",
      "Register the production redirect URL.",
      "Authorize the advertiser or partner profile.",
      "Store refresh/access credentials only in the encrypted server-side token vault."
    ]
  },
  {
    id:"microsoft-ads",
    label:"Microsoft Advertising",
    approval:"Microsoft Advertising API account + registered application",
    authModel:"Microsoft Entra OAuth 2.0",
    env:["MICROSOFT_ADS_CLIENT_ID","MICROSOFT_ADS_CLIENT_SECRET"],
    scopes:["https://ads.microsoft.com/msads.manage","offline_access"],
    callbackPath:"/api/oauth/microsoft-ads/callback",
    checklist:[
      "Register an application with Microsoft Entra ID.",
      "Create the client credential securely.",
      "Register the Growth OS callback URL.",
      "Authorize a user with access to Microsoft Advertising.",
      "Map the returned account/customer identifiers before enabling writes."
    ]
  }
];

export function getProviderOnboarding(id:string){
  return providerOnboarding.find(provider=>provider.id===id);
}
