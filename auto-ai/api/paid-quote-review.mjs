import {quoteReview} from "../lib/core.mjs";
import {requirePaid,sendError} from "../lib/payments.mjs";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    await requirePaid(req.body?.order_id,"repair-second-opinion");
    const result=quoteReview(req.body||{});
    return res.status(200).json({...result,paid:true,service:"Repair Quote Second Opinion"});
  }catch(error){
    return sendError(res,error);
  }
}
