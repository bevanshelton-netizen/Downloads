const cfg={
  teamSlug:process.env.VERCEL_TEAM_SLUG||"bevan2",
  teamId:process.env.VERCEL_TEAM_ID||"team_XSHdQaQxmXGD1HlK2E4nehif",
  projectName:process.env.VERCEL_PROJECT_NAME||"izakhono-growth-os-resilience",
  projectId:process.env.VERCEL_PROJECT_ID||"prj_OpMGIOe5TXhyhn6lHabQOOafRTV6",
  environment:process.env.VERCEL_ENVIRONMENT||"production",
  audience:process.env.VERCEL_OIDC_AUDIENCE||"https://bridge.domains.izakhonoafrica.co.za"
};

export function oidcConfig(){
  return {
    ...cfg,
    issuer:`https://oidc.vercel.com/${cfg.teamSlug}`,
    subject:`owner:${cfg.teamSlug}:project:${cfg.projectName}:environment:${cfg.environment}`
  };
}

export function assertClaims(payload){
  const c=oidcConfig();
  if(payload.owner_id!==c.teamId) throw new Error("OWNER_ID_MISMATCH");
  if(payload.project_id!==c.projectId) throw new Error("PROJECT_ID_MISMATCH");
  if(payload.project!==c.projectName) throw new Error("PROJECT_NAME_MISMATCH");
  if(payload.environment!==c.environment) throw new Error("ENVIRONMENT_MISMATCH");
  return true;
}

function approvalDecision(path){
  const m=path.match(/^\/v1\/data\/approvals\/([A-Za-z0-9._:-]{1,160})\/decision$/);
  return m?{upstream:"data",path:`/v1/approvals/${encodeURIComponent(m[1])}/decision`,methods:["POST"]}:null;
}

export function mapRoute(method,pathname,search=""){
  const m=(method||"GET").toUpperCase();
  const exact=new Map([
    ["POST /v1/auth/login",{upstream:"auth",path:"/v1/login",methods:["POST"]}],
    ["GET /v1/auth/me",{upstream:"auth",path:"/v1/me",methods:["GET"],forwardAuthorization:true}],
    ["POST /v1/auth/logout",{upstream:"auth",path:"/v1/logout",methods:["POST"],forwardAuthorization:true}],
    ["GET /v1/data/stats",{upstream:"data",path:"/v1/stats",methods:["GET"],internalKey:true}],
    ["GET /v1/data/approvals",{upstream:"data",path:"/v1/approvals",methods:["GET"],internalKey:true}],
    ["POST /v1/data/approvals",{upstream:"data",path:"/v1/approvals",methods:["POST"],internalKey:true}],
    ["POST /v1/data/events",{upstream:"data",path:"/v1/events",methods:["POST"],internalKey:true}],
    ["GET /v1/pay/health",{upstream:"pay",path:"/health",methods:["GET"]}],
    ["GET /v1/pay/products",{upstream:"pay",path:"/api/v1/products",methods:["GET"],payKey:true}],
    ["POST /v1/pay/orders",{upstream:"pay",path:"/api/v1/orders",methods:["POST"],payKey:true}],
    ["GET /v1/pay/orders/status",{upstream:"pay",path:`/api/v1/orders/status${search||""}`,methods:["GET"],payKey:true}]
  ]);
  const direct=exact.get(`${m} ${pathname}`);
  if(direct) return direct;
  const decision=approvalDecision(pathname);
  if(decision && decision.methods.includes(m)) return {...decision,internalKey:true};
  return null;
}
