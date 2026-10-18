export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 try{
  const {name,organisation,email,interest,message,website}=req.body||{};
  if(website) return res.status(200).json({ok:true});
  if(!name||!email||!message) return res.status(400).json({error:'Name, email and message are required.'});
  const key=process.env.RESEND_API_KEY, to=process.env.MAIL_TO||'info@xqwaxqwamile.co.za', from=process.env.MAIL_FROM||'Website Enquiries <onboarding@resend.dev>';
  if(!key) return res.status(503).json({error:'Email service not configured'});
  const html=`<h2>New website enquiry</h2><p><b>Name:</b> ${esc(name)}</p><p><b>Organisation:</b> ${esc(organisation||'')}</p><p><b>Email:</b> ${esc(email)}</p><p><b>Interest:</b> ${esc(interest||'')}</p><p><b>Message:</b><br>${esc(message).replace(/\n/g,'<br>')}</p>`;
  const rr=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','User-Agent':'IZAKHONO-XQWAXQWAMILE/1.0'},body:JSON.stringify({from,to:[to],reply_to:email,subject:`Website enquiry: ${interest||'General enquiry'}`,html,text:`Name: ${name}\nOrganisation: ${organisation||''}\nEmail: ${email}\nInterest: ${interest||''}\n\n${message}`})});
  const out=await rr.json(); if(!rr.ok) return res.status(502).json({error:out.message||'Mail provider rejected the message'});
  return res.status(200).json({ok:true,id:out.id});
 }catch(e){return res.status(500).json({error:'Server error'});}
}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
