Deno.serve((_req: Request) => new Response(JSON.stringify({
  ok:true,
  service:"IZAKHONO WebStart",
  version:"2.2.0",
  mode:"factory",
  deployment_standard:"international-professional",
  minimum_quality_score:95,
  capabilities:[
    "brief-to-directions",
    "qa-gated-generation",
    "international-professional-gate",
    "verified-publish",
    "lead-capture",
    "owner-lead-inbox",
    "paid-publish-default",
    "ikhokha-checkout",
    "owned-runtime-package"
  ]
}),{headers:{"content-type":"application/json","access-control-allow-origin":"*","cache-control":"no-store"}}));