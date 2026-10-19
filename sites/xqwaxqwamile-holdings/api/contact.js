export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 try{
  const {name,organisation,email,interest,message,website}=req.body||{};
  if(website) return res.status(200).json({ok:true});
  if(!name||!email||!message) return res.status(400).json({error:'Name, email and message are required.'});

  const to=process.env.MAIL_TO||'info@xqwaxqwamile.co.za';
  const from=process.env.MAIL_FROM||'Website Enquiries <info@xqwaxqwamile.co.za>';
  const subject=`Website enquiry: ${interest||'General enquiry'}`;
  const text=`Name: ${name}\nOrganisation: ${organisation||''}\nEmail: ${email}\nInterest: ${interest||''}\n\n${message}`;
  const html=`<h2>New website enquiry</h2><p><b>Name:</b> ${esc(name)}</p><p><b>Organisation:</b> ${esc(organisation||'')}</p><p><b>Email:</b> ${esc(email)}</p><p><b>Interest:</b> ${esc(interest||'')}</p><p><b>Message:</b><br>${esc(message).replace(/\n/g,'<br>')}</p>`;

  // Owned-first: IZAKHONO MAIL is the preferred transport. Credentials stay server-side.
  const mailUrl=String(process.env.IZAKHONO_MAIL_API_URL||'').replace(/\/$/,'');
  const mailToken=process.env.IZAKHONO_MAIL_API_TOKEN||'';
  if(mailUrl&&mailToken){
   const rr=await fetch(`${mailUrl}/v1/send`,{
    method:'POST',
    headers:{Authorization:`Bearer ${mailToken}`,'Content-Type':'application/json','User-Agent':'IZAKHONO-XQWAXQWAMILE/1.1'},
    body:JSON.stringify({
     idempotency_key:`xqwaxqwamile-${cryptoRandomId()}`,
     to:{email:to},
     subject,
     body_text:text,
     metadata:{source:'xqwaxqwamile-holdings',reply_to:email,organisation:organisation||'',interest:interest||''}
    })
   });
   const out=await rr.json().catch(()=>({}));
   if(rr.ok&&out.ok) return res.status(200).json({ok:true,provider:'izakhono-mail',delivery_claim:out.delivery_claim||'accepted',id:out.outbox?.id||null});
   if(rr.status!==404&&rr.status!==503) return res.status(502).json({error:out.error||'IZAKHONO MAIL rejected the message'});
  }

  // Reversible fallback: Resend remains available when explicitly configured.
  const key=process.env.RESEND_API_KEY;
  if(!key) return res.status(503).json({error:'Email service not configured'});
  const rr=await fetch('https://api.resend.com/emails',{
   method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','User-Agent':'IZAKHONO-XQWAXQWAMILE/1.1'},
   body:JSON.stringify({from,to:[to],reply_to:email,subject,html,text})
  });
  const out=await rr.json();
  if(!rr.ok) return res.status(502).json({error:out.message||'Mail provider rejected the message'});
  return res.status(200).json({ok:true,provider:'resend',id:out.id});
 }catch(e){return res.status(500).json({error:'Server error'});}
}
function cryptoRandomId(){return `${Date.now()}-${Math.random().toString(36).slice(2,14)}`}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
