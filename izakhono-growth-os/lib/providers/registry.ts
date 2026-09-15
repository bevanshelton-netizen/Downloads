export type ProviderId =
  | "google-ads"
  | "meta-ads"
  | "tiktok-ads"
  | "linkedin-ads"
  | "amazon-ads"
  | "microsoft-ads";

export type ConnectionState = "disconnected" | "oauth-required" | "connected-readonly" | "connected-write";

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  scope: string[];
  auth: "oauth";
  defaultCampaignState: "PAUSED";
  writePolicy: "approval-required";
  connectionState: ConnectionState;
};

export const providerRegistry: ProviderDefinition[] = [
  {id:"google-ads",label:"Google Ads",scope:["Search","Performance Max","YouTube"],auth:"oauth",defaultCampaignState:"PAUSED",writePolicy:"approval-required",connectionState:"oauth-required"},
  {id:"meta-ads",label:"Meta Ads",scope:["Facebook","Instagram","Reels"],auth:"oauth",defaultCampaignState:"PAUSED",writePolicy:"approval-required",connectionState:"oauth-required"},
  {id:"tiktok-ads",label:"TikTok Ads",scope:["Video","Spark","Lead Generation"],auth:"oauth",defaultCampaignState:"PAUSED",writePolicy:"approval-required",connectionState:"oauth-required"},
  {id:"linkedin-ads",label:"LinkedIn Ads",scope:["B2B","Lead Gen","ABM"],auth:"oauth",defaultCampaignState:"PAUSED",writePolicy:"approval-required",connectionState:"oauth-required"},
  {id:"amazon-ads",label:"Amazon Ads",scope:["Sponsored Ads","Display"],auth:"oauth",defaultCampaignState:"PAUSED",writePolicy:"approval-required",connectionState:"oauth-required"},
  {id:"microsoft-ads",label:"Microsoft Ads",scope:["Search","Audience"],auth:"oauth",defaultCampaignState:"PAUSED",writePolicy:"approval-required",connectionState:"oauth-required"}
];

export function getProvider(id:ProviderId){
  return providerRegistry.find(provider=>provider.id===id);
}
