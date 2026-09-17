import {createPayment,sendError} from "../lib/payments.mjs";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const order=await createPayment(req.body||{});
    return res.status(201).json({ok:true,order});
  }catch(error){
    return sendError(res,error);
  }
}
