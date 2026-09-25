'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

type Props = { primaryUrl: string; externalUrl: string };
type Result = { ok?: boolean; reference?: string; route?: string; error?: string };

const CHARTER_VERSION='2026-09-25';
const fieldStyle = {width:'100%',border:'1px solid rgba(255,255,255,.14)',background:'#081526',color:'#fff',borderRadius:14,padding:'12px 13px'} as const;
const labelStyle = {display:'grid',gap:7,fontSize:14,fontWeight:800,color:'#dce6f3'} as const;
const checkStyle={display:'flex',gap:10,alignItems:'flex-start',color:'#c9d5e5',fontSize:13,lineHeight:1.5} as const;

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
    setBusy(true);setStatus('Validating application…');setRoute('');
    const form=e.currentTarget;
    const fd=new FormData(form);
    const partnerClass=String(fd.get('partnerClass')||'');
    const minorsInvolved=String(fd.get('minorsInvolved')||'no');
    const rightsAttested=fd.get('rightsAttested')==='on';
    const charterAccepted=fd.get('charterAccepted')==='on';
    const editorialIndependence=fd.get('editorialIndependence')==='on';
    const safeguardingAttested=fd.get('safeguardingAttested')==='on';

    try{
      if(!charterAccepted)throw new Error('Please read and accept the YHVH Partner & Contributor Charter.');
      if(!editorialIndependence)throw new Error('Editorial independence must be acknowledged before applying.');
      if(!rightsAttested)throw new Error('Please confirm that you control or can obtain the rights and permissions relevant to your submission.');
      if(minorsInvolved==='yes'&&!safeguardingAttested)throw new Error('Applications involving minors require the safeguarding declaration.');

      const payload:Record<string,unknown>={
        category:['distribution-partner','commercial-partner'].includes(partnerClass)?'partner':'content',
        type:String(fd.get('type')||''),
        name:String(fd.get('name')||''),
        contact:String(fd.get('contact')||''),
        territory:String(fd.get('territory')||''),
        language:String(fd.get('language')||''),
        message:String(fd.get('message')||''),
        onAir:false,
        rightsAttested,
        sourceChannel:'yhvh-global-acquisition-desk',
        details:{
          partnerClass,
          website:String(fd.get('website')||''),
          organisationRegistration:String(fd.get('organisationRegistration')||''),
          rightsScope:String(fd.get('rightsScope')||''),
          minorsInvolved,
          fundraisingInvolved:String(fd.get('fundraisingInvolved')||'no'),
          healthClaims:String(fd.get('healthClaims')||'no'),
          charterVersion:CHARTER_VERSION,
          charterAccepted:true,
          editorialIndependence:true,
          safeguardingAttested,
          verificationStatus:'pending'
        }
      };

      setStatus('Sending application…');
      let fallBack=false;
      try{
        const owned=await submit(primaryUrl.replace(/\/$/,'')+'/api/submissions',payload);
        if(owned.r.ok){
          setStatus('Application received by IZAKHONO. Reference: '+owned.body.reference+' — verification is pending.');
          setRoute('OWNED · VERIFICATION PENDING');
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
      setStatus('Application buffered safely for IZAKHONO review. Reference: '+fallback.body.reference+' — verification is pending.');
      setRoute('EXTERNAL BUFFER · VERIFICATION PENDING');
      form.reset();
    }catch(err){
      setStatus(err instanceof Error?err.message:'Unable to submit right now.');
      setRoute('');
    }finally{setBusy(false)}
  }

  return <form onSubmit={onSubmit} style={{display:'grid',gap:16,padding:24,border:'1px solid rgba(255,255,255,.13)',borderRadius:24,background:'rgba(255,255,255,.045)'}}>
    <div>
      <small style={{color:'#f5c451',fontWeight:900,letterSpacing:'.11em'}}>FORMAL PARTNER APPLICATION</small>
      <h2 style={{fontFamily:'Georgia,serif',fontSize:'clamp(1.8rem,4vw,3rem)',margin:'7px 0'}}>Start your YHVH onboarding.</h2>
      <p style={{margin:0,color:'#9fb0c5',lineHeight:1.6}}>All applications begin in <b style={{color:'#fff'}}>verification pending</b>. No submission, payment or sponsorship guarantees broadcast approval.</p>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
      <label style={labelStyle}>Partner class
        <select name="partnerClass" required style={fieldStyle} defaultValue="content-partner">
          <option value="content-partner">Content Partner</option>
          <option value="artist-partner">Artist / Choir Partner</option>
          <option value="event-partner">Event Partner</option>
          <option value="distribution-partner">Distribution / Broadcast Partner</option>
          <option value="commercial-partner">Commercial Partner</option>
        </select>
      </label>
      <label style={labelStyle}>Applicant type
        <select name="type" required style={fieldStyle} defaultValue="church">
          <option value="church">Church / Ministry</option>
          <option value="artist">Gospel Artist</option>
          <option value="choir">Choir / Worship Team</option>
          <option value="programme">TV / Digital Programme</option>
          <option value="live-event">Live Gospel Event</option>
          <option value="producer">Producer / Content Studio</option>
          <option value="broadcaster">Broadcaster</option>
          <option value="distribution">Distribution / Platform Partner</option>
          <option value="sponsor">Sponsor / Advertiser</option>
          <option value="production-client">Production Client</option>
        </select>
      </label>
      <label style={labelStyle}>Name / organisation<input name="name" maxLength={120} required style={fieldStyle}/></label>
      <label style={labelStyle}>Email or phone<input name="contact" maxLength={160} required style={fieldStyle}/></label>
      <label style={labelStyle}>Country / territory<input name="territory" maxLength={80} required style={fieldStyle}/></label>
      <label style={labelStyle}>Primary language<input name="language" maxLength={50} required style={fieldStyle}/></label>
      <label style={labelStyle}>Website / public profile<input name="website" maxLength={180} style={fieldStyle} placeholder="https://…"/></label>
      <label style={labelStyle}>Registration / entity number (if applicable)<input name="organisationRegistration" maxLength={100} style={fieldStyle}/></label>
      <label style={labelStyle}>Rights scope you control
        <select name="rightsScope" required style={fieldStyle} defaultValue="local">
          <option value="local">Local / home territory</option>
          <option value="regional">Regional / multi-country</option>
          <option value="worldwide">Worldwide</option>
          <option value="to-confirm">To be confirmed during rights review</option>
        </select>
      </label>
      <label style={labelStyle}>Will submitted content involve minors?
        <select name="minorsInvolved" required style={fieldStyle} defaultValue="no"><option value="no">No</option><option value="yes">Yes</option></select>
      </label>
      <label style={labelStyle}>Will it include fundraising / donation appeals?
        <select name="fundraisingInvolved" required style={fieldStyle} defaultValue="no"><option value="no">No</option><option value="yes">Yes</option></select>
      </label>
      <label style={labelStyle}>Will it include health / healing / deliverance claims?
        <select name="healthClaims" required style={fieldStyle} defaultValue="no"><option value="no">No</option><option value="yes">Yes</option></select>
      </label>
    </div>

    <label style={labelStyle}>What do you want to bring to YHVH GOSPEL TV?
      <textarea name="message" maxLength={1600} required style={{...fieldStyle,minHeight:140,resize:'vertical'}} placeholder="Tell us about your ministry, content, catalogue, event, audience, distribution opportunity or commercial proposal."/>
    </label>

    <section style={{padding:18,borderRadius:18,border:'1px solid rgba(245,196,81,.17)',background:'rgba(245,196,81,.04)',display:'grid',gap:12}}>
      <label style={checkStyle}><input name="rightsAttested" type="checkbox" required style={{marginTop:3}}/>I confirm that I control, or can obtain, the rights and permissions relevant to the content, music, footage, performances, brands or materials I propose to submit.</label>
      <label style={checkStyle}><input name="charterAccepted" type="checkbox" required style={{marginTop:3}}/>I have read and accept the <Link href="/gospel/charter" target="_blank" style={{color:'#ffe29a',fontWeight:900}}>YHVH Partner & Contributor Charter</Link> (version {CHARTER_VERSION}).</label>
      <label style={checkStyle}><input name="editorialIndependence" type="checkbox" required style={{marginTop:3}}/>I understand that payment, sponsorship, donation or partnership does not buy editorial approval, ministry endorsement or guaranteed airtime.</label>
      <label style={checkStyle}><input name="safeguardingAttested" type="checkbox" style={{marginTop:3}}/>If my application involves minors, I confirm that appropriate guardian consent, permissions and safeguarding measures will be provided before broadcast.</label>
    </section>

    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <button disabled={busy} type="submit" style={{border:0,borderRadius:999,padding:'13px 18px',background:'#f5c451',color:'#2d2108',fontWeight:950,cursor:busy?'wait':'pointer'}}>{busy?'Submitting…':'Submit partner application →'}</button>
      {route&&<span style={{fontSize:12,fontWeight:900,letterSpacing:'.08em',color:route.startsWith('OWNED')?'#83f0c4':'#ffe29a'}}>{route}</span>}
    </div>
    <div aria-live="polite" style={{minHeight:22,color:'#e9f0fa'}}>{status}</div>
    <p style={{margin:0,fontSize:12,color:'#91a4bc',lineHeight:1.5}}>Routing policy: IZAKHONO-owned intake first. External buffering is resilience only; editorial and onboarding authority remains with IZAKHONO / YHVH GOSPEL TV.</p>
  </form>;
}
