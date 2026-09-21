'use client';

import { FormEvent, useState } from 'react';

type Props = { primaryUrl: string; externalUrl: string };
type Result = { ok?: boolean; reference?: string; route?: string; error?: string };

const fieldStyle = {width:'100%',border:'1px solid rgba(255,255,255,.14)',background:'#081526',color:'#fff',borderRadius:14,padding:'12px 13px'} as const;
const labelStyle = {display:'grid',gap:7,fontSize:14,fontWeight:800,color:'#dce6f3'} as const;

export default function GlobalIntake({primaryUrl,externalUrl}:Props){
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [route,setRoute]=useState('');

  async function submit(url:string,payload:Record<string,unknown>){
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const body=(await r.json().catch(()=>({}))) as Result;
    return {r,body};
  }

  async function onSubmit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    setBusy(true);setStatus('Sending…');setRoute('');
    const form=e.currentTarget;
    const fd=new FormData(form);
    const payload:Record<string,unknown>=Object.fromEntries(fd.entries());
    payload.onAir=false;
    payload.rightsAttested=fd.get('rightsAttested')==='on';
    payload.sourceChannel='kora-global-acquisition-desk';

    try{
      let fallBack=false;
      try{
        const owned=await submit(primaryUrl.replace(/\/$/,'')+'/api/submissions',payload);
        if(owned.r.ok){
          setStatus('Received by IZAKHONO. Reference: '+owned.body.reference);
          setRoute('OWNED · AUTHORITATIVE');
          form.reset();return;
        }
        if(owned.r.status>=500||[404,405].includes(owned.r.status))fallBack=true;
        else throw new Error(owned.body.error||'Unable to submit.');
      }catch(err){
        if(err instanceof TypeError||String(err instanceof Error?err.message:'').includes('Failed to fetch'))fallBack=true;
        else throw err;
      }
      if(!fallBack)throw new Error('Unable to submit right now.');

      const fallback=await submit(externalUrl,payload);
      if(!fallback.r.ok)throw new Error(fallback.body.error||'Both intake routes are temporarily unavailable.');
      setStatus('Received through the external resilience route. Reference: '+fallback.body.reference);
      setRoute('EXTERNAL BUFFER · PENDING IZAKHONO REVIEW');
      form.reset();
    }catch(err){
      setStatus(err instanceof Error?err.message:'Unable to submit right now.');
      setRoute('');
    }finally{setBusy(false)}
  }

  return <form onSubmit={onSubmit} style={{display:'grid',gap:14,padding:24,border:'1px solid rgba(255,255,255,.13)',borderRadius:24,background:'rgba(255,255,255,.045)'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
      <label style={labelStyle}>I am joining as
        <select name="category" required style={fieldStyle} defaultValue="content">
          <option value="content">Content / Ministry / Artist</option>
          <option value="partner">Commercial / Distribution Partner</option>
        </select>
      </label>
      <label style={labelStyle}>Type
        <select name="type" required style={fieldStyle} defaultValue="church">
          <option value="church">Church / Ministry</option>
          <option value="artist">Gospel Artist</option>
          <option value="choir">Choir</option>
          <option value="programme">TV Programme</option>
          <option value="live-event">Live Gospel Event</option>
          <option value="broadcaster">Broadcaster</option>
          <option value="distribution">Distribution / Platform Partner</option>
          <option value="sponsor">Sponsor / Advertiser</option>
        </select>
      </label>
      <label style={labelStyle}>Country / territory<input name="territory" maxLength={80} required style={fieldStyle}/></label>
      <label style={labelStyle}>Primary language<input name="language" maxLength={50} required style={fieldStyle}/></label>
      <label style={labelStyle}>Name / organisation<input name="name" maxLength={120} required style={fieldStyle}/></label>
      <label style={labelStyle}>Email or phone<input name="contact" maxLength={160} required style={fieldStyle}/></label>
    </div>
    <label style={labelStyle}>Tell us what you want to bring to KORA GOSPEL TV
      <textarea name="message" maxLength={1600} required style={{...fieldStyle,minHeight:130,resize:'vertical'}}/>
    </label>
    <label style={{display:'flex',gap:10,alignItems:'flex-start',color:'#c9d5e5',fontSize:13,lineHeight:1.5}}>
      <input name="rightsAttested" type="checkbox" style={{marginTop:3}}/>
      I understand that submission does not equal broadcast approval and that KORA will separately verify content, music, participant and territory rights before transmission.
    </label>
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <button disabled={busy} type="submit" style={{border:0,borderRadius:999,padding:'13px 18px',background:'#f5c451',color:'#2d2108',fontWeight:900,cursor:busy?'wait':'pointer'}}>{busy?'Sending…':'Submit to the Global Desk'}</button>
      {route&&<span style={{fontSize:12,fontWeight:900,letterSpacing:'.08em',color:route.startsWith('OWNED')?'#83f0c4':'#ffe29a'}}>{route}</span>}
    </div>
    <div aria-live="polite" style={{minHeight:22,color:'#e9f0fa'}}>{status}</div>
    <p style={{margin:0,fontSize:12,color:'#91a4bc',lineHeight:1.5}}>Routing policy: IZAKHONO-owned intake first. If that route is unavailable, the submission is buffered by an external resilience service and remains subject to IZAKHONO review.</p>
  </form>;
}
