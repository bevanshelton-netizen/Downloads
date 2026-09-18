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
    id: 'auto-ai',
    name: 'AUTO AI',
    body: 'Got a repair quote or a car problem? Get clearer vehicle guidance before you spend.',
    cta: 'CHECK MY CAR',
    clickUrl: 'https://auto-ai-eosin.vercel.app/?utm_source=kora&utm_medium=owned_house_ad&utm_campaign=revenue_drive#triage',
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

export function houseAdDecision() {
  const item = houseAds[Math.floor(Math.random() * houseAds.length)];
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
