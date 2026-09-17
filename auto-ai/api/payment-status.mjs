import {paymentStatus,sendError} from "../lib/payments.mjs";

export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  try{
    const order=await paymentStatus(req.query?.order);
    return res.status(200).json({ok:true,order});
  }catch(error){
    return sendError(res,error);
  }
}
