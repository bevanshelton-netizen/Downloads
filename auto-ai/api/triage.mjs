import {baseReport,aiTriage} from "../lib/core.mjs";
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const input=req.body||{};
  const fallback=baseReport(input);
  try{
    const ai=await aiTriage(input);
    return res.status(200).json({...fallback,...(ai||{}),source:ai?"ai":"local-safety-engine"});
  }catch{
    return res.status(200).json({...fallback,source:"local-safety-engine",notice:"AI service unavailable; safety triage fallback used."});
  }
}
