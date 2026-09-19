export type HouseAd = {
  id: string;
  name: string;
  body: string;
  cta: string;
  clickUrl: string;
  accent: string;
};

export const houseAds: HouseAd[] = [
  {
    id: 'izakhono-ai',
    name: 'IZAKHONO AI',
    body: 'One login. Twelve specialist lanes for business, money, work, learning, compliance, mobility and media. Launch membership starts at R199/month.',
    cta: 'OPEN MY AI TEAM',
    clickUrl: 'https://ai.izakhono.co.za/?utm_source=kora&utm_medium=owned_house_ad&utm_campaign=ai_core_membership_launch#membership',
    accent: '#c9ff4e',
  },
  {
    id: 'faisready-bundle-direct',
    name: 'FAISReady',
    body: 'Prepare for RE1 and RE5 together. The Complete Bundle is R549 with direct iKhokha checkout.',
    cta: 'BUY RE1 + RE5 — R549',
    clickUrl: 'https://pay.ikhokha.com/izakhono/buy/re5-and-re1-complete-p',
    accent: '#f4bd39',
  },
  {
    id: 'faisready-re5-direct',
    name: 'FAISReady',
    body: 'RE5 Complete Prep is R299 once off. Go straight to the live iKhokha checkout.',
    cta: 'BUY RE5 — R299',
    clickUrl: 'https://pay.ikhokha.com/izakhono/buy/re5completeprepara',
    accent: '#18cf72',
  },
  {
    id: 'growth-desk',
    name: 'IZAKHONO Business Growth Desk',
    body: 'Need AI automation, cybersecurity, BPO, procurement, training or commercial solutions? Start a 60-second business assessment.',
    cta: 'REQUEST ASSESSMENT',
    clickUrl: 'https://izakhono-revenue-desk.vercel.app/?utm_source=kora&utm_medium=owned_house_ad&utm_campaign=cash_first_growth_desk#assessment',
    accent: '#b7ff2a',
  },
  {
    id: 'learner-driver-sa',
    name: 'Learner Driver SA',
    body: 'Prepare for motorcycles, Code 08, Code 10 and Code 14 with mock tests, road signs, live simulators and 12 official languages.',
    cta: 'START PREPARING',
    clickUrl: 'https://learner-driver-sa-bevan2.vercel.app/?utm_source=kora&utm_medium=owned_network&utm_campaign=learner_driver_sa_launch&utm_content=house_ad',
    accent: '#18c98b',
  },
  {
    id: 'auto-ai',
    name: 'AUTO AI',
    body: 'Got a repair quote or a car problem? Get clearer vehicle guidance before you spend.',
    cta: 'CHECK MY CAR',
    clickUrl: 'https://auto-ai-eosin.vercel.app/?utm_source=kora&utm_medium=owned_house_ad&utm_campaign=revenue_drive#pricing',
    accent: '#ff7a18',
  },
  {
    id: 'faisready',
    name: 'FAISReady',
    body: 'Independent preparation for RE1, RE3, RE4 and RE5 — study, practise and test your readiness.',
    cta: 'START PREPARING',
    clickUrl: 'https://faisready-revenue.vercel.app/?utm_source=kora&utm_medium=owned_house_ad&utm_campaign=revenue_drive',
    accent: '#18cf72',
  },
  {
    id: 'mandatory-regulatory-exams',
    name: 'Mandatory Regulatory Exams',
    body: 'Find the regulatory or professional exam that applies to your field and open the right preparation path.',
    cta: 'FIND MY EXAM',
    clickUrl: 'https://mandatory-regulatory-exams.vercel.app/?utm_source=kora&utm_medium=owned_house_ad&utm_campaign=revenue_drive#exams',
    accent: '#40e0d0',
  },
];

const ROTATION_MINUTES = 5;
const ROTATION = [
  'faisready-bundle-direct',
  'faisready-re5-direct',
  'auto-ai',
  'faisready-bundle-direct',
  'growth-desk',
  'faisready-re5-direct',
  'faisready-bundle-direct',
  'mandatory-regulatory-exams',
  'auto-ai',
  'faisready-re5-direct',
  'growth-desk',
  'faisready-bundle-direct',
] as const;

export function currentHouseAd(date = new Date()) {
  const slot = Math.floor(date.getTime() / (ROTATION_MINUTES * 60_000));
  const id = ROTATION[slot % ROTATION.length];
  return houseAds.find((ad) => ad.id === id) || houseAds[0];
}

export function houseAdDecision() {
  const item = currentHouseAd();
  return {
    deliveryId: `house:${item.id}`,
    campaignId: 'izakhono-owned-network',
    house: true,
    creative: {
      id: `house:${item.id}`,
      name: item.name,
      body: item.body,
      cta: item.cta,
      accent: item.accent,
      mediaUrl: '',
      clickUrl: item.clickUrl,
      durationSeconds: 0,
    },
    rewardEligible: false,
    rewardAmount: 0,
    targeting: 'contextual' as const,
  };
}
