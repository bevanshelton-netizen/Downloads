type PlanRequest = {
  objective?: string;
  budget?: number;
  country?: string;
  language?: string;
  industry?: string;
};

const mixes: Record<string, Record<string, number>> = {
  leads: {Meta:35,Google:30,TikTok:15,LinkedIn:10,Organic:10},
  sales: {Google:35,Meta:30,TikTok:15,Amazon:10,Organic:10},
  awareness: {Meta:30,TikTok:25,YouTube:20,LinkedIn:10,Organic:15},
  enrolments: {Meta:35,Google:30,TikTok:15,YouTube:10,Organic:10},
  app_installs: {Meta:30,Google:25,TikTok:25,YouTube:10,Organic:10}
};

export async function POST(request:Request) {
  const body = await request.json() as PlanRequest;
  const objective = body.objective || "leads";
  const budget = Math.max(0, Number(body.budget || 0));
  const mix = mixes[objective] || mixes.leads;
  const allocations = Object.entries(mix).map(([channel,percent])=>({
    channel, percent, amount: Math.round((budget * percent) / 100)
  }));

  const finance = (body.industry || "").toLowerCase().includes("financial");
  return Response.json({
    objective,
    country: body.country || "South Africa",
    language: body.language || "English",
    allocations,
    preflight: finance ? [
      "Keep claims educational; no guaranteed profits or returns.",
      "Confirm platform financial-services verification for the target country.",
      "Publish legal entity, privacy and required financial disclosures.",
      "Create campaigns paused and obtain approval before activation."
    ] : [
      "Verify landing-page claims and contact details.",
      "Confirm consent/privacy requirements for lead capture.",
      "Create campaigns paused and obtain approval before activation."
    ],
    note:"Deterministic launch planner. Live platform data will replace assumptions once accounts are connected."
  });
}
