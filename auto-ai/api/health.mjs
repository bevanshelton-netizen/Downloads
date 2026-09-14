export default function handler(req,res){
  res.status(200).json({ok:true,service:"auto-ai",version:"0.1.0",runtime:"vercel",aiConfigured:Boolean(process.env.AI_CHAT_URL&&process.env.AI_API_KEY&&process.env.AI_MODEL)});
}
