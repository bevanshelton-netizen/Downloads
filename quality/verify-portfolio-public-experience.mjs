import {readFile} from "node:fs/promises";
import {resolve} from "node:path";

const ROOT=resolve(process.cwd());
const read=async p=>readFile(resolve(ROOT,p),"utf8");
const load=async p=>JSON.parse(await read(p));
const fail=m=>{console.error("PORTFOLIO_PUBLIC_EXPERIENCE_FAIL:",m);process.exitCode=2};
const ok=m=>console.log("PORTFOLIO_PUBLIC_EXPERIENCE:",m);

const directive=await load("quality/portfolio-public-experience-directive.json");
const premium=await load("quality/izakhono-premium-standard.json");
const registry=await load("owner-host/platforms.json");
const visual=await load("quality/visual-regression-contract.json");
const rollout=await load("izakhono-one-ai/public-sellable-rollout.json");
const human=await read("IZAKHONO-PLATFORM-INFRASTRUCTURE-DIRECTIVE.md");

if(directive.status!=="IMMEDIATE_EFFECT") fail("directive must be immediate");
if(!String(directive.scope||"").startsWith("ALL_IZAKHONO_PLATFORMS")) fail("IZAKHONO scope drift");
if(directive.infrastructure?.ownedPrimary!==true) fail("owned-primary requirement disabled");
if(directive.infrastructure?.externalIndependentResilience!==true) fail("external resilience requirement disabled");
if(directive.infrastructure?.bothRequiredForPublicCustomerFacingPlatforms!==true) fail("hybrid public delivery requirement disabled");

for(const key of [
  "internationalProfessionalStandard",
  "immediatelyExplainWhatWeOffer",
  "immediatelyExplainWhoItIsFor",
  "immediatelyExplainWhyItMatters",
  "primaryActionAboveFold",
  "relevantPhotographyOrOriginalGraphics",
  "strongHeroVisual",
  "modernTypography",
  "visualStorytelling",
  "responsiveMobileFirst",
  "trustSignals",
  "placeholdersForbidden",
  "genericTemplateLookForbidden",
  "deadLinksForbidden",
  "unverifiedLiveClaimsForbidden"
]){
  if(directive.customerFacingExperience?.[key]!==true) fail("customer-facing rule disabled: "+key);
}

if(premium.architecture?.ownedInfrastructurePrimaryRequired!==true) fail("premium profile lost owned-primary rule");
if(premium.architecture?.externalResilienceRequiredForPublicPlatforms!==true) fail("premium profile lost external-resilience rule");
if(premium.architecture?.internalAndExternalDeliveryRequired!==true) fail("premium profile lost hybrid-delivery rule");

for(const key of [
  "offerClarityRequired","audienceClarityRequired","benefitClarityRequired",
  "relevantHeroMediaRequired","originalGraphicsOrRelevantPhotographyRequired",
  "modernTypographyRequired","visualStorytellingRequired","trustSignalsRequired",
  "mobileConversionPathRequired","primaryMessageMustExplainProductImmediately"
]){
  if(premium.productExperience?.[key]!==true) fail("premium experience rule disabled: "+key);
}
if(premium.productExperience?.placeholderPublicPagesAllowed!==false) fail("placeholder pages must remain forbidden");
if(premium.productExperience?.genericTemplateLookAllowed!==false) fail("generic template look must remain forbidden");

const excluded=(directive.explicitExclusions||[]).map(x=>String(x.organization||"").toLowerCase());
if(!excluded.some(x=>x.includes("edu-build"))) fail("EDU-BUILD explicit exclusion missing");
if(!human.includes("EDU-BUILD INSTITUTE – Shelton Campuses is a separate organisation/business and is not an IZAKHONO platform.")) fail("human EDU-BUILD separation missing");

const ids=new Set((registry.platforms||[]).map(x=>x.id));
if(ids.has("ecd360")||ids.has("edu-build")||ids.has("edubuild")) fail("EDU-BUILD/ECD360 must not be in IZAKHONO registry");
if((visual.dedicatedRepositories||[]).some(x=>x.id==="ecd360")) fail("ECD360 must not be in IZAKHONO visual contract");
if((rollout.products||[]).some(x=>x.id==="ecd360")) fail("ECD360 must not be in IZAKHONO sellable rollout");

const policy=registry.infrastructurePolicy||{};
if(policy.ownedPrimaryRequired!==true) fail("registry owned-primary rule disabled");
if(policy.externalResilienceRequiredForPublicPlatforms!==true) fail("registry external-resilience requirement disabled");
if(policy.internalAndExternalDeliveryRequired!==true) fail("registry hybrid delivery disabled");

const presentation=registry.presentationPolicy||{};
for(const key of [
  "internationalProfessionalStandardRequired","immediateOfferClarityRequired",
  "targetAudienceClarityRequired","primaryCTARequired",
  "relevantPhotographyOrOriginalGraphicsRequired","strongHeroVisualRequired",
  "modernTypographyRequired","mobileFirstRequired","visualStorytellingRequired",
  "trustSignalsRequired"
]){
  if(presentation[key]!==true) fail("registry presentation rule disabled: "+key);
}
if(presentation.placeholderPagesAllowed!==false) fail("registry placeholders must be forbidden");
if(presentation.genericTemplateLookAllowed!==false) fail("registry generic template look must be forbidden");
if(presentation.deadLinksAllowed!==false) fail("registry dead links must be forbidden");
if(presentation.unverifiedLiveClaimsAllowed!==false) fail("registry unverified live claims must be forbidden");

for(const p of registry.platforms||[]){
  const machineOnly=["collector-only","api-only","machine-only"].includes(p.publicSurface);
  if(!machineOnly && p.qualityProfile!=="izakhono-premium-v1") fail(p.id+": missing premium quality profile");
}

if(!process.exitCode){
  ok("PASS platforms="+registry.platforms.length+" EDU_BUILD_SEPARATE=YES HYBRID=REQUIRED PROFESSIONAL_VISUAL_STANDARD=REQUIRED");
}
