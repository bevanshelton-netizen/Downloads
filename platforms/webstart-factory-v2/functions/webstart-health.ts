Deno.serve((_req: Request) => new Response(JSON.stringify({
  ok:true,
  service:"IZAKHONO WebStart",
  version:"2.1.0",
  mode:"factory",
  capabilities:[
    "brief-to-directions",
    "qa-gated-generation",
    "verified-publish",
    "lead-capture",
    "owner-lead-inbox",
    "paid-publish-default",
    "ikhokha-checkout",
    "owned-runtime-package"
  ]
}),{headers:{"content-type":"application/json","access-control-allow-origin":"*","cache-control":"no-store"}}));