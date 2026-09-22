'use client';

import { FormEvent, useState } from 'react';

type Props={primaryUrl:string;externalUrl:string};
type Result={ok?:boolean;reference?:string;route?:string;error?:string};

const field={width:'100%',border:'1px solid rgba(255,255,255,.12)',background:'rgba(4,12,23,.82)',color:'#fff',borderRadius:14,padding:'13px 14px',outline:'none'} as const;
const label={display:'grid',gap:7,fontSize:13,fontWeight:800,color:'#dce6f3',letterSpacing:'.01em'} as const;

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
      const ext=await post(externalUrl,{...payload,sourceChannel:'yhvh-external-commercial-launch'});
      if(!ext.r.ok)throw new Error(ext.body.error||'Commercial intake is temporarily unavailable.');
      setStatus('Commercial enquiry received. Reference: '+ext.body.reference);
      setRoute('ENQUIRY RECEIVED · IZAKHONO COMMERCIAL REVIEW');form.reset();
    }catch(err){
      setStatus(err instanceof Error?err.message:'Unable to submit right now.');setRoute('');
    }finally{setBusy(false)}
  }

  return <form onSubmit={submit} style={{display:'grid',gap:16,padding:28,border:'1px solid rgba(255,255,255,.09)',borderRadius:22,background:'linear-gradient(180deg,rgba(10,27,48,.96),rgba(6,18,33,.98))',boxShadow:'inset 0 1px 0 rgba(255,255,255,.03)'}}>
    <div>
      <div style={{color:'#f5c451',fontWeight:900,fontSize:11,letterSpacing:'.14em'}}>COMMERCIAL BRIEF</div>
      <h3 style={{fontFamily:'Cormorant Garamond, Georgia, serif',fontSize:'2.3rem',lineHeight:1,margin:'8px 0 8px'}}>Request a proposal.</h3>
      <p style={{margin:0,color:'#9fb0c4',lineHeight:1.6,fontSize:14}}>Share enough detail for us to understand the opportunity. No payment is taken on this form.</p>
    </div>
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
    <button disabled={busy} type="submit" style={{justifySelf:'start',border:0,borderRadius:999,padding:'14px 21px',background:'linear-gradient(135deg,#f5c451,#dda03a)',color:'#2d2108',fontWeight:900,cursor:busy?'wait':'pointer',boxShadow:'0 12px 28px rgba(229,157,29,.18)'}}>{busy?'Sending…':'Request Commercial Proposal →'}</button>
    {route&&<div style={{padding:'10px 12px',borderRadius:12,border:'1px solid rgba(131,240,196,.22)',background:'rgba(131,240,196,.06)',fontSize:11,fontWeight:900,letterSpacing:'.08em',color:'#9cf1ce'}}>{route}</div>}
    <div aria-live="polite" style={{minHeight:22,color:'#e9f0fa'}}>{status}</div>
    <p style={{margin:0,fontSize:12,color:'#91a4bc',lineHeight:1.55}}>Commercial participation does not buy programme placement, ministry endorsement or editorial approval. All advertising, sponsorship and event integrations remain subject to Gospel TV brand, rights and suitability review.</p>
  </form>;
}
