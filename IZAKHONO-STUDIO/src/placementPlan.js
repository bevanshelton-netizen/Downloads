export const AD_PLACEMENT_PLAN = [
  {
    "id": "kora",
    "brand": "KORA",
    "objective": "audience-growth-and-one-time-purchases",
    "audience": [
      "music fans",
      "African entertainment audiences",
      "artists",
      "live-event audiences"
    ],
    "ownedPlacements": [
      "ALLEGRO discovery surfaces",
      "IZAKHONO portfolio cross-promo",
      "KORA share surfaces",
      "IZAKHONO STUDIO campaign packs"
    ],
    "externalOrganicTargets": [
      "Facebook",
      "Instagram",
      "TikTok",
      "YouTube",
      "X"
    ],
    "message": "African music, artists and live entertainment built for the world.",
    "cta": "EXPLORE KORA",
    "status": "campaign-ready-payment-live-claim-gated"
  },
  {
    "id": "auto-ai",
    "brand": "AUTO AI",
    "objective": "direct-r99-quote-review-sales",
    "audience": [
      "drivers with repair quotes",
      "used-car owners",
      "motorists comparing workshop advice"
    ],
    "ownedPlacements": [
      "Pimp My Old Car",
      "vehicle diagnostics surfaces",
      "Bevan Shelton Racing",
      "IZAKHONO SIGNAL",
      "KORA display inventory where contextually appropriate",
      "IZAKHONO STUDIO campaign packs"
    ],
    "externalOrganicTargets": [
      "Facebook",
      "TikTok",
      "Instagram",
      "YouTube",
      "X"
    ],
    "message": "Before you approve a repair quote, get a clearer second opinion.",
    "cta": "CHECK MY QUOTE",
    "status": "campaign-ready-payment-live-claim-gated"
  },
  {
    "id": "faisready",
    "brand": "FAISREADY",
    "objective": "course-sales",
    "audience": [
      "financial-services representatives",
      "key individuals",
      "people preparing for RE exams"
    ],
    "ownedPlacements": [
      "Mandatory Regulatory Exams platform",
      "The Chancellor business surfaces",
      "IZAKHONO Group professional surfaces",
      "IZAKHONO STUDIO campaign packs"
    ],
    "externalOrganicTargets": [
      "LinkedIn",
      "Facebook",
      "YouTube",
      "WhatsApp share flows"
    ],
    "message": "Focused preparation for regulatory examinations. Educational support; no regulator endorsement implied.",
    "cta": "START PREPARING",
    "status": "campaign-ready-existing-buy-buttons-usable"
  },
  {
    "id": "mandatory-reg-exams",
    "brand": "MANDATORY REGULATORY EXAMS",
    "objective": "qualified-traffic-and-course-discovery",
    "audience": [
      "professionals subject to mandatory industry exams",
      "employers supporting regulated staff"
    ],
    "ownedPlacements": [
      "FAISReady",
      "The Chancellor business surfaces",
      "IZAKHONO Group professional surfaces",
      "IZAKHONO STUDIO campaign packs"
    ],
    "externalOrganicTargets": [
      "LinkedIn",
      "Google Business/content surfaces",
      "Facebook",
      "YouTube"
    ],
    "message": "Find the exam that applies to your field and prepare through one exam-focused platform.",
    "cta": "FIND YOUR EXAM",
    "status": "campaign-ready-payment-live-claim-gated"
  },
  {
    "id": "doxa-sure",
    "brand": "DOXA-SURE",
    "objective": "qualified-leads-and-nonregulated-service-sales",
    "audience": [
      "households",
      "workers",
      "small businesses",
      "vehicle owners seeking practical support"
    ],
    "ownedPlacements": [
      "AUTO AI cross-promo",
      "The Chancellor business surfaces",
      "IZAKHONO Group",
      "KORA display inventory where contextually appropriate",
      "IZAKHONO STUDIO campaign packs"
    ],
    "externalOrganicTargets": [
      "Facebook",
      "Instagram",
      "LinkedIn",
      "YouTube"
    ],
    "message": "Practical protection, assistance and resilience support. Advertise only currently available non-regulated services.",
    "cta": "SEE YOUR OPTIONS",
    "status": "campaign-ready-nonregulated-services-only"
  },
  {
    "id": "edubuild",
    "brand": "EDU-BUILD ECD360",
    "objective": "lead-generation-and-enrolment-interest",
    "audience": [
      "ECD practitioners",
      "prospective ECD students",
      "preschools",
      "community education partners"
    ],
    "ownedPlacements": [
      "Edu-Build campus surfaces",
      "IZAKHONO Group",
      "KORA family-safe display inventory",
      "IZAKHONO STUDIO campaign packs"
    ],
    "externalOrganicTargets": [
      "Facebook",
      "Instagram",
      "TikTok",
      "YouTube",
      "WhatsApp share flows"
    ],
    "message": "ECD study pathways with campus and digital support.",
    "cta": "ENQUIRE / START LEARNING",
    "status": "lead-generation-only-until-canonical-ecd360-source-and-payment-e2e-restored"
  }
];

export function placementsFor(brandId) {
  return AD_PLACEMENT_PLAN.find((item) => item.id === brandId) || null;
}
