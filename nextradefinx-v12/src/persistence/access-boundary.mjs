const PROHIBITED = ['bank_credentials','card_number','cvv','otp','broker_password','live_balance','service_role_key'];

export function assertEducationalPayload(payload = {}) {
  const keys = Object.keys(payload).map(k => k.toLowerCase());
  const found = PROHIBITED.filter(x => keys.includes(x));
  if (found.length) throw new Error(`prohibited_educational_profile_fields:${found.join(',')}`);
  return true;
}

export function productBoundary() {
  return Object.freeze({
    account_type: 'learning_passport',
    brokerage_account: false,
    kyc_profile: false,
    suitability_assessment: false,
    personalized_advice: false,
    client_funds: false,
    live_execution: false,
    leverage: false
  });
}
