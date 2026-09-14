import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./public/", import.meta.url));
const PORT = Number(process.env.PORT || 18120);
const HOST = process.env.HOST || "0.0.0.0";
const AI_CHAT_URL = process.env.AI_CHAT_URL || "";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "";

const mime = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".svg":"image/svg+xml; charset=utf-8"
};

const COMMON_CODES = {
  P0300:["Random/multiple cylinder misfire detected","ignition, fuel delivery, vacuum leak, compression or timing"],
  P0301:["Cylinder 1 misfire detected","spark plug, ignition coil, injector, compression or wiring"],
  P0302:["Cylinder 2 misfire detected","spark plug, ignition coil, injector, compression or wiring"],
  P0303:["Cylinder 3 misfire detected","spark plug, ignition coil, injector, compression or wiring"],
  P0304:["Cylinder 4 misfire detected","spark plug, ignition coil, injector, compression or wiring"],
  P0420:["Catalyst system efficiency below threshold (Bank 1)","exhaust leak, oxygen sensor, misfire history or catalytic converter"],
  P0430:["Catalyst system efficiency below threshold (Bank 2)","exhaust leak, oxygen sensor, misfire history or catalytic converter"],
  P0171:["System too lean (Bank 1)","vacuum leak, MAF issue, low fuel pressure, injector or exhaust leak"],
  P0172:["System too rich (Bank 1)","injector leak, fuel pressure, MAF/MAP issue, oxygen sensor or restricted air intake"],
  P0299:["Turbo/supercharger underboost","boost leak, actuator/wastegate, turbo wear, sensor or exhaust restriction"],
  P0128:["Coolant temperature below thermostat regulating temperature","thermostat, coolant temperature sensor or cooling-system issue"],
  P0401:["EGR flow insufficient","blocked EGR passages, valve, sensor or vacuum/control fault"],
  P0455:["EVAP system large leak","fuel cap, hose, purge/vent valve or damaged EVAP component"]
};

const stopPatterns = [
  ["brake pedal","soft brake pedal"],["no brakes","braking system"],["oil pressure","oil pressure warning"],
  ["overheat","overheating"],["temperature red","high coolant temperature"],["steering locked","steering fault"],
  ["fuel leak","fuel leak"],["petrol leak","fuel leak"],["diesel leak","fuel leak"],["smoke from engine","engine-bay smoke"],
  ["fire","possible fire"],["wheel loose","wheel/security issue"]
];
const cautionPatterns = [
  ["flashing engine","flashing check-engine light"],["misfire","engine misfire"],["loss of power","power loss"],
  ["limp mode","limp mode"],["abs light","ABS warning"],["airbag light","airbag/SRS warning"],
  ["battery light","charging-system warning"],["vibration","abnormal vibration"]
];

function securityHeaders(extra={}) {
  return Object.assign({
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"strict-origin-when-cross-origin",
    "Permissions-Policy":"camera=(self), microphone=(self), geolocation=()",
    "Content-Security-Policy":"default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  },extra);
}
function sendJson(res,status,data){
  res.writeHead(status,securityHeaders({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}));
  res.end(JSON.stringify(data));
}
async function readJson(req){
  let raw="", size=0;
  for await (const chunk of req){
    size += chunk.length;
    if(size > 1000000) throw new Error("Request too large");
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}
function txt(x){ return String(x || "").trim(); }
function findPattern(text, patterns){
  const lower=text.toLowerCase();
  return patterns.find(function(item){ return lower.includes(item[0]); });
}
function baseReport(input){
  const symptoms=txt(input.symptoms);
  const stop=findPattern(symptoms,stopPatterns);
  const caution=findPattern(symptoms,cautionPatterns);
  const urgency=stop ? "STOP" : caution ? "URGENT" : "CHECK";
  return {
    urgency:urgency,
    safety: stop
      ? "Stop driving as soon as it is safe to do so and arrange qualified inspection or recovery. Do not rely on this app alone."
      : caution
      ? "Limit driving until the fault is properly checked. If the warning becomes red, severe, or handling/braking changes, stop safely."
      : "No immediate stop condition was identified from the information supplied, but symptoms still require proper inspection if they persist.",
    likely_categories: stop ? [stop[1]] : caution ? [caution[1]] : ["maintenance or mechanical/electrical fault requiring structured checks"],
    next_checks:[
      "Confirm exact warning lights/messages and whether they are steady or flashing.",
      "Record when the symptom occurs: cold/hot, idle/acceleration, speed, load and weather.",
      "Check fluid levels only when safe and according to the vehicle handbook.",
      "Retrieve diagnostic trouble codes if available before replacing parts."
    ],
    confidence:"preliminary",
    disclaimer:"This is decision support, not a confirmed mechanical diagnosis."
  };
}
async function aiTriage(input){
  if(!AI_CHAT_URL || !AI_API_KEY || !AI_MODEL) return null;
  const system = "You are AUTO AI by IZAKHONO, a cautious international vehicle triage assistant. Never claim a confirmed diagnosis from symptoms alone. Separate possible causes from confirmed faults. Put safety first. If braking, steering, fire, fuel leak, red oil-pressure, severe overheating, wheel/security, or other immediate danger is described, tell the user to stop driving safely and seek qualified help. Do not recommend bypassing safety systems or emissions controls. Return valid JSON only with keys: urgency, safety, likely_categories (array), next_checks (array), questions (array), confidence, disclaimer. Use the user's language if provided.";
  const payload={
    model:AI_MODEL,
    messages:[
      {role:"system",content:system},
      {role:"user",content:JSON.stringify({
        language:input.language || "English",
        vehicle:{year:input.year,make:input.make,model:input.model,mileage:input.mileage},
        symptoms:input.symptoms,
        warningLights:input.warningLights,
        recentWork:input.recentWork
      })}
    ],
    temperature:0.2
  };
  const r=await fetch(AI_CHAT_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer " + AI_API_KEY},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(20000)
  });
  if(!r.ok) throw new Error("AI gateway returned " + r.status);
  const data=await r.json();
  const content=data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if(!content) throw new Error("AI gateway returned no content");
  const cleaned=content.replace(/^\`\`\`json\s*/i,"").replace(/\`\`\`$/,"").trim();
  return JSON.parse(cleaned);
}
function quoteReview(input){
  const q=txt(input.quote);
  const flags=[];
  if(q.length < 40) flags.push("The quotation is too brief to verify what work is actually included.");
  if(!/(labou?r|hours|hrs)/i.test(q)) flags.push("Labour hours/rate are not clearly shown.");
  if(!/(part|plug|coil|sensor|pump|filter|belt|disc|pad|battery|tyre|injector|turbo|radiator|service)/i.test(q)) flags.push("Parts or repair items are not clearly itemised.");
  if(!/(diagnos|test|scan|inspection|pressure|compression|voltage)/i.test(q)) flags.push("The quote does not clearly show the test/diagnosis that justified the repair.");
  if(/ecu|gearbox|engine|turbo|catalytic|module|injector/i.test(q)) flags.push("This includes a high-value component. Ask for the test evidence before authorising replacement.");
  return {
    result:flags.length ? "REVIEW BEFORE APPROVING" : "REASONABLY ITEMISED",
    flags:flags,
    askWorkshop:[
      "What test confirmed each major part needs replacement?",
      "Are parts new, OEM, aftermarket, rebuilt or used?",
      "What labour hours and hourly rate are included?",
      "What warranty applies to parts and labour?",
      "Will I be contacted before any additional work is done?"
    ],
    disclaimer:"AUTO AI checks clarity and decision quality; it does not certify a workshop quotation as correct."
  };
}
function usedCarScore(input){
  const issues=Array.isArray(input.issues) ? input.issues : [];
  let score=100;
  const notes=[];
  for(const issue of issues){
    if(!issue || !issue.checked) continue;
    const sev=issue.severity || "medium";
    const deduction=sev==="high" ? 18 : sev==="low" ? 5 : 10;
    score-=deduction;
    notes.push(issue.label || "Reported concern");
  }
  score=Math.max(0,Math.min(100,score));
  const band=score>=85 ? "LOWER RISK" : score>=70 ? "PROCEED WITH CHECKS" : score>=50 ? "HIGH CAUTION" : "WALK AWAY / EXPERT INSPECTION";
  return {
    score:score,band:band,concerns:notes,
    next:[
      "Verify VIN and ownership/documentation independently.",
      "Request service and repair history.",
      "Do a cold start and full road test.",
      "Use an independent physical inspection before purchase when material concerns exist."
    ],
    disclaimer:"This score is a screening aid, not a roadworthy certificate, valuation, title check or mechanical guarantee."
  };
}

async function api(req,res,url){
  if(req.method==="GET" && url.pathname==="/api/health"){
    return sendJson(res,200,{ok:true,service:"auto-ai",version:"0.1.0",aiConfigured:Boolean(AI_CHAT_URL && AI_API_KEY && AI_MODEL)});
  }
  if(req.method!=="POST") return sendJson(res,405,{error:"Method not allowed"});
  let input;
  try{ input=await readJson(req); }catch(e){ return sendJson(res,400,{error:e.message}); }

  if(url.pathname==="/api/triage"){
    const fallback=baseReport(input);
    try{
      const ai=await aiTriage(input);
      return sendJson(res,200,Object.assign({},fallback,ai || {},{source:ai ? "ai" : "local-safety-engine"}));
    }catch(e){
      return sendJson(res,200,Object.assign({},fallback,{source:"local-safety-engine",notice:"AI service unavailable; safety triage fallback used."}));
    }
  }
  if(url.pathname==="/api/fault-code"){
    const code=txt(input.code).toUpperCase().replace(/[^A-Z0-9]/g,"");
    const hit=COMMON_CODES[code];
    return sendJson(res,200,hit ? {
      code:code,meaning:hit[0],possibleCauses:hit[1],
      advice:"Treat the code as evidence, not a parts order. Check freeze-frame/live data and test the system before replacing expensive components.",
      confidence:"code definition",
      disclaimer:"Manufacturer-specific meanings can differ. Confirm against the correct service information for the exact vehicle."
    } : {
      code:code,meaning:"Code not in the offline starter library.",
      possibleCauses:"Use manufacturer-specific service information or the configured AI service for interpretation.",
      advice:"Do not replace a component based only on an unfamiliar code.",
      confidence:"unknown"
    });
  }
  if(url.pathname==="/api/quote-review") return sendJson(res,200,quoteReview(input));
  if(url.pathname==="/api/used-car-score") return sendJson(res,200,usedCarScore(input));
  return sendJson(res,404,{error:"Not found"});
}
async function serveStatic(req,res,url){
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==="/") pathname="/index.html";
  const safe=normalize(pathname).replace(/^(\.\.(\/|\\|$))+/,"");
  const full=join(ROOT,safe);
  if(!full.startsWith(ROOT)) return sendJson(res,403,{error:"Forbidden"});
  try{
    const data=await readFile(full);
    res.writeHead(200,securityHeaders({
      "Content-Type":mime[extname(full)] || "application/octet-stream",
      "Cache-Control":full.endsWith("index.html") ? "no-cache" : "public, max-age=3600"
    }));
    res.end(data);
  }catch{
    try{
      const data=await readFile(join(ROOT,"index.html"));
      res.writeHead(200,securityHeaders({"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"}));
      res.end(data);
    }catch{
      sendJson(res,404,{error:"Not found"});
    }
  }
}
const server=http.createServer(async function(req,res){
  const url=new URL(req.url,"http://" + (req.headers.host || "localhost"));
  try{
    if(url.pathname.startsWith("/api/")) await api(req,res,url);
    else await serveStatic(req,res,url);
  }catch(e){
    console.error(e);
    sendJson(res,500,{error:"Internal server error"});
  }
});
server.listen(PORT,HOST,function(){ console.log("AUTO AI listening on http://" + HOST + ":" + PORT); });
