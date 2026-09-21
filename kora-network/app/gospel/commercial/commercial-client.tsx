'use client';

import { FormEvent, useState } from 'react';

type Props={primaryUrl:string;externalUrl:string};
type Result={ok?:boolean;reference?:string;route?:string;error?:string};

const field={width:'100%',border:'1px solid rgba(255,255,255,.14)',background:'#081526',color:'#fff',borderRadius:14,padding:'12px 13px'} as const;
const label={display:'grid',gap:7,fontSize:14,fontWeight:800,color:'#dce6f3'} as const;

export default function CommercialLead({primaryUrl,externalUrl}:Props){
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [route,setRoute]=useState('');

  async function post(url:string,payload:Record<string,unknown>){
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const body=(await r.json().catch(()=>({}))) as Result;
    return {r,body};
  }

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setStatus('Sending…');setRoute('');
    const form=e.currentTarget;
    const fd=new FormData(form);
    const packageId=String(fd.get('package')||'');
    const payload:Record<string,unknown>={
      category:'partner',
      type:'commercial',
      name:String(fd.get('name')||''),
      contact:String(fd.get('contact')||''),
      territory:String(fd.get('territory')||''),
      language:String(fd.get('language')||'English'),
      message:String(fd.get('message')||''),
      sourceChannel:'kora-gospel-commercial-desk',
      details:{
        package:packageId,
        organisation:String(fd.get('organisation')||''),
        budget:String(fd.get('budget')||''),
        desired_start:String(fd.get('desiredStart')||''),
        campaign_goal:String(fd.get('goal')||''),
        website:String(fd.get('website')||'')
      }
    };

    try{
      let fallback=false;
      try{
        const owned=await post(primaryUrl.replace(/\/$/,'')+'/api/submissions',payload);
        if(owned.r.ok){
          setStatus('Commercial enquiry received by IZAKHONO. Reference: '+owned.body.reference);
          setRoute('OWNED · AUTHORITATIVE');form.reset();return;
        }
        if(owned.r.status>=500||[404,405].includes(owned.r.status))fallback=true;
        else throw new Error(owned.body.error||'Unable to submit.');
      }catch(err){
        if(err instanceof TypeError||String(err instanceof Error?err.message:'').includes('Failed to fetch'))fallback=true;
        else throw err;
      }
      if(!fallback)throw new Error('Unable to submit right now.');

      const ext=await post(externalUrl,payload);
      if(!ext.r.ok)throw new Error(ext.body.error||'Both commercial intake routes are temporarily unavailable.');
      setStatus('Commercial enquiry received through the resilience route. Reference: '+ext.body.reference);
      setRoute('EXTERNAL BUFFER · PENDING IZAKHONO REVIEW');form.reset();
    }catch(err){
      setStatus(err instanceof Error?err.message:'Unable to submit right now.');setRoute('');
    }finally{setBusy(false)}
  }

  return <form onSubmit={submit} style={{display:'grid',gap:14,padding:24,border:'1px solid rgba(255,255,255,.14)',borderRadius:24,background:'rgba(255,255,255,.045)'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
      <label style={label}>Opportunity
        <select name="package" defaultValue="founding-partner" required style={field}>
          <option value="founding-partner">Founding / Presenting Partner</option>
          <option value="programme-sponsor">Programme Sponsor</option>
          <option value="event-broadcast">Live Event Broadcast Partner</option>
          <option value="regional-distribution">Regional Distribution Partner</option>
          <option value="advertising">Faith-aligned Advertising</option>
          <option value="production-services">Production Services</option>
        </select>
      </label>
      <label style={label}>Organisation<input name="organisation" maxLength={120} required style={field}/></label>
      <label style={label}>Contact person<input name="name" maxLength={120} required style={field}/></label>
      <label style={label}>Email or phone<input name="contact" maxLength={160} required style={field}/></label>
      <label style={label}>Market / territory<input name="territory" maxLength={80} required style={field}/></label>
      <label style={label}>Primary language<input name="language" maxLength={50} defaultValue="English" required style={field}/></label>
      <label style={label}>Indicative budget / currency<input name="budget" maxLength={80} placeholder="e.g. R50,000 or USD 5,000" style={field}/></label>
      <label style={label}>Desired start<input name="desiredStart" maxLength={80} placeholder="Month / campaign window" style={field}/></label>
      <label style={label}>Campaign goal<input name="goal" maxLength={160} placeholder="Reach, event, awareness, distribution…" style={field}/></label>
      <label style={label}>Website / profile<input name="website" maxLength={180} placeholder="https://…" style={field}/></label>
    </div>
    <label style={label}>Tell us what you want to achieve
      <textarea name="message" maxLength={1600} required style={{...field,minHeight:130,resize:'vertical'}}/>
    </label>
    <button disabled={busy} type="submit" style={{justifySelf:'start',border:0,borderRadius:999,padding:'13px 20px',background:'#f5c451',color:'#2d2108',fontWeight:900,cursor:busy?'wait':'pointer'}}>{busy?'Sending…':'Request Commercial Proposal'}</button>
    {route&&<div style={{fontSize:12,fontWeight:900,letterSpacing:'.08em',color:route.startsWith('OWNED')?'#83f0c4':'#ffe29a'}}>{route}</div>}
    <div aria-live="polite" style={{minHeight:22,color:'#e9f0fa'}}>{status}</div>
    <p style={{margin:0,fontSize:12,color:'#91a4bc',lineHeight:1.55}}>Commercial participation does not buy programme placement, ministry endorsement or editorial approval. All advertising, sponsorship and event integrations remain subject to Gospel TV brand, rights and suitability review.</p>
  </form>;
}
