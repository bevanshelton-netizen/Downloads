export type ProviderId =
  | "google-ads"
  | "meta-ads"
  | "tiktok-ads"
  | "linkedin-ads"
  | "amazon-ads"
  | "microsoft-ads";

export type ConnectionState = "disconnected" | "oauth-required" | "connected-readonly" | "connected-write";

export type ProviderAccount = {
  id: string;
  name: string;
  currency?: string;
  timezone?: string;
};

export type CampaignDraft = {
  name: string;
  objective: string;
  dailyBudget: number;
  currency: string;
  country: string;
  language: string;
  landingPage: string;
  status: "PAUSED";
};

export type ProviderAdapter = {
  id: ProviderId;
  label: string;
  state(): Promise<ConnectionState>;
  listAccounts(): Promise<ProviderAccount[]>;
  listCampaigns(accountId: string): Promise<unknown[]>;
  createPausedCampaign(accountId: string, draft: CampaignDraft, approvalId: string): Promise<unknown>;
  proposeBudgetChange(accountId: string, campaignId: string, amount: number): Promise<{
    requiresApproval: true;
    proposedAmount: number;
  }>;
};
