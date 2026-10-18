export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 const event=req.body||{};
 console.log('Inbound email event',JSON.stringify({type:event.type,email_id:event?.data?.email_id,from:event?.data?.from,to:event?.data?.to,subject:event?.data?.subject}));
 return res.status(200).json({ok:true});
}
