'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

const SUPABASE_URL='https://yfawrenhudjomhnglfhq.supabase.co';
const SUPABASE_KEY='sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p';
const APP_URL='https://learner-driver-sa-bevan2.vercel.app/';

function safe(value:string|null,fallback:string,max=120){
  return (value||fallback).replace(/[^a-zA-Z0-9_\-:.]/g,'-').slice(0,max);
}

export default function LearnerDriverCampaign(){
  const [refCode,setRefCode]=useState('friend');
  const [schoolStatus,setSchoolStatus]=useState('');
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{
    let id=localStorage.getItem('ldsa_ref_code');
    if(!id){
      id='LDSA-'+Math.random().toString(36).slice(2,8).toUpperCase();
      localStorage.setItem('ldsa_ref_code',id);
    }
    setRefCode(id);

    const p=new URLSearchParams(location.search);
    track('page_view',{
      source:safe(p.get('utm_source'),'kora_campaign_page'),
      medium:safe(p.get('utm_medium'),'owned_media'),
      content:safe(p.get('utm_content'),'growth_hub'),
      term:safe(p.get('ref'),'')
    });
  },[]);

  const appTarget=useMemo(()=>{
    const u=new URL(APP_URL);
    u.searchParams.set('utm_source','kora_growth_hub');
    u.searchParams.set('utm_medium','owned_media');
    u.searchParams.set('utm_campaign','learner_driver_sa_launch');
    u.searchParams.set('utm_content','start_learning');
    u.searchParams.set('ref',refCode);
    return u.toString();
  },[refCode]);

  const referralUrl=useMemo(()=>{
    if(typeof window==='undefined') return 'https://kora-network.vercel.app/learner-driver';
    const u=new URL(window.location.origin+'/learner-driver');
    u.searchParams.set('utm_source','learner_referral');
    u.searchParams.set('utm_medium','referral');
    u.searchParams.set('utm_campaign','learner_driver_sa_launch');
    u.searchParams.set('utm_content','challenge_3_friends');
    u.searchParams.set('ref',refCode);
    return u.toString();
  },[refCode]);

  function track(eventName:string,opts:{source?:string;medium?:string;content?:string;term?:string}={}){
    const sessionKey='ldsa_campaign_session';
    let sid=sessionStorage.getItem(sessionKey);
    if(!sid){
      sid=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now());
      sessionStorage.setItem(sessionKey,sid);
    }
    const p=new URLSearchParams(location.search);
    const row={
      event_name:eventName,
      utm_source:(opts.source||p.get('utm_source')||'kora_growth_hub').slice(0,120),
      utm_medium:(opts.medium||p.get('utm_medium')||'owned_media').slice(0,120),
      utm_campaign:'learner_driver_sa_launch',
      utm_content:(opts.content||p.get('utm_content')||'growth_hub').slice(0,120),
      utm_term:(opts.term||p.get('ref')||refCode||'').slice(0,120),
      referrer_host:document.referrer?new URL(document.referrer).hostname.slice(0,200):null,
      path:location.pathname.slice(0,500),
      page_title:document.title.slice(0,200),
      session_id:sid.slice(0,80)
    };
    fetch(SUPABASE_URL+'/rest/v1/learner_driver_campaign_events',{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify(row),
      keepalive:true
    }).catch(()=>{});
  }

  function startLearning(){
    track('start_learning',{content:'primary_cta'});
  }

  async function nativeShare(){
    track('share',{source:'native_share',medium:'referral',content:'challenge_3_friends'});
    const d={title:'Learner Driver SA',text:"Prepare for your learner's licence — motorcycles, Code 08, 10 and 14.",url:referralUrl};
    try{
      if(navigator.share){await navigator.share(d);return;}
      await navigator.clipboard.writeText(referralUrl);
      alert('Referral link copied.');
    }catch(e:any){
      if(e?.name!=='AbortError') prompt('Copy this link',referralUrl);
    }
  }

  function channelShare(channel:string){
    track('share',{source:channel,medium:'referral',content:'challenge_3_friends'});
  }

  async function copyLink(){
    channelShare('copy_link');
    try{await navigator.clipboard.writeText(referralUrl);alert('Referral link copied.');}
    catch{prompt('Copy this link',referralUrl);}
  }

  async function submitSchool(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    setSubmitting(true);
    setSchoolStatus('');
    const form=e.currentTarget;
    const fd=new FormData(form);
    const row={
      school_name:String(fd.get('school_name')||'').trim(),
      contact_name:String(fd.get('contact_name')||'').trim()||null,
      phone:String(fd.get('phone')||'').trim(),
      email:String(fd.get('email')||'').trim()||null,
      province:String(fd.get('province')||'').trim()||null,
      area:String(fd.get('area')||'').trim(),
      categories:String(fd.get('categories')||'Code 08 / Code 10 / Code 14 / Motorcycles'),
      teaching_languages:String(fd.get('teaching_languages')||'').trim()||null,
      notes:'Founding Partner campaign — 60 day launch offer interest',
      verification_consent:true,
      status:'pending',
      submitted_from:'learner-driver-sa-public'
    };
    try{
      const res=await fetch(SUPABASE_URL+'/rest/v1/learner_driver_school_signups',{
        method:'POST',
        headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify(row)
      });
      if(!res.ok) throw new Error('submit failed');
      track('driving_school_join',{source:'kora_growth_hub',medium:'partner_acquisition',content:'founding_school_form'});
      setSchoolStatus('✅ Registration received. We will verify the school before public listing.');
      form.reset();
    }catch{
      setSchoolStatus('We could not submit the registration right now. Please try again.');
    }finally{
      setSubmitting(false);
    }
  }

  const wa='https://wa.me/?text='+encodeURIComponent("I'm preparing for my learner's licence with Learner Driver SA. Join me: "+referralUrl);
  const fb='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(referralUrl);

  const buttonBase={border:0,borderRadius:999,padding:'14px 20px',fontWeight:900,fontSize:15,cursor:'pointer',textDecoration:'none',display:'inline-block'} as const;

  return <main style={{minHeight:'100vh',background:'radial-gradient(circle at top,#0c6680 0,#061525 48%,#030b14 100%)',padding:'18px',color:'#fff',fontFamily:'system-ui,-apple-system,Segoe UI,sans-serif'}}>
    <div style={{maxWidth:960,margin:'0 auto'}}>
      <a href={appTarget} onClick={startLearning} target="_blank" rel="noopener noreferrer" style={{display:'block',borderRadius:24,overflow:'hidden',boxShadow:'0 24px 70px rgba(0,0,0,.45)'}}>
        <img src="/images/learner-driver-sa-ad.svg" alt="Learner Driver SA advert" style={{display:'block',width:'100%',height:'auto'}}/>
      </a>

      <section style={{textAlign:'center',padding:'22px 0 6px'}}>
        <h1 style={{fontSize:'clamp(30px,6vw,58px)',margin:'0 0 8px',fontWeight:950}}>Learn today. <span style={{color:'#ffd43b'}}>Drive tomorrow.</span></h1>
        <p style={{color:'#d7edf7',fontSize:18,maxWidth:720,margin:'0 auto 18px'}}>One South African learner-prep hub for Motorcycles, Code 08, Code 10 and Code 14 — with mock tests, road signs, simulator practice and multilingual support.</p>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          <a href={appTarget} onClick={startLearning} target="_blank" rel="noopener noreferrer" style={{...buttonBase,background:'#21d881',color:'#04130c'}}>START LEARNING FREE →</a>
          <button onClick={nativeShare} style={{...buttonBase,background:'#ffd43b',color:'#111'}}>↗ SHARE</button>
        </div>
      </section>

      <section style={{margin:'24px 0',padding:'24px',borderRadius:24,background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.14)'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:950,letterSpacing:1.4,color:'#7fffd4'}}>THE 3-FRIEND CHALLENGE</div>
          <h2 style={{fontSize:'clamp(25px,4vw,38px)',margin:'7px 0'}}>Don’t study alone. Bring 3 people with you.</h2>
          <p style={{color:'#cfe3ec',margin:'0 auto 16px',maxWidth:700}}>Share your personal campaign link. It lets us measure referrals without collecting your name or social profile.</p>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <a href={wa} onClick={()=>channelShare('whatsapp')} target="_blank" rel="noopener noreferrer" style={{...buttonBase,background:'#20c66b',color:'#04130c'}}>WhatsApp</a>
            <a href={fb} onClick={()=>channelShare('facebook')} target="_blank" rel="noopener noreferrer" style={{...buttonBase,background:'#fff',color:'#0b2e55'}}>Facebook</a>
            <button onClick={nativeShare} style={{...buttonBase,background:'#e8f4ff',color:'#071d45'}}>Phone Share</button>
            <button onClick={copyLink} style={{...buttonBase,background:'#182f47',color:'#fff',border:'1px solid #ffffff33'}}>Copy Link</button>
          </div>
          <p style={{fontSize:12,color:'#9eb8c5',marginBottom:0}}>Referral code: {refCode}</p>
        </div>
      </section>

      <section style={{margin:'24px 0',padding:'26px',borderRadius:24,background:'linear-gradient(135deg,#fff 0%,#eafaf5 100%)',color:'#071d45'}}>
        <div style={{maxWidth:760,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:950,letterSpacing:1.3,color:'#08724b'}}>DRIVING SCHOOLS</div>
            <h2 style={{fontSize:'clamp(26px,4vw,40px)',margin:'7px 0'}}>Become a Learner Driver SA Founding Partner</h2>
            <p style={{margin:0,color:'#405769'}}>Register interest for the 60-day founding-partner launch period. Schools are verified before appearing to learners.</p>
          </div>
          <form onSubmit={submitSchool} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
            <input name="school_name" required minLength={2} maxLength={120} placeholder="Driving school name *" style={{padding:14,borderRadius:12,border:'1px solid #b8cbd2',fontSize:16}}/>
            <input name="contact_name" placeholder="Contact person" style={{padding:14,borderRadius:12,border:'1px solid #b8cbd2',fontSize:16}}/>
            <input name="phone" required minLength={7} maxLength={30} placeholder="Phone / WhatsApp *" style={{padding:14,borderRadius:12,border:'1px solid #b8cbd2',fontSize:16}}/>
            <input name="email" type="email" placeholder="Email" style={{padding:14,borderRadius:12,border:'1px solid #b8cbd2',fontSize:16}}/>
            <input name="area" required minLength={2} maxLength={120} placeholder="Town / area *" style={{padding:14,borderRadius:12,border:'1px solid #b8cbd2',fontSize:16}}/>
            <select name="province" defaultValue="" style={{padding:14,borderRadius:12,border:'1px solid #b8cbd2',fontSize:16,background:'#fff'}}>
              <option value="">Province</option><option>Gauteng</option><option>Eastern Cape</option><option>Free State</option><option>KwaZulu-Natal</option><option>Limpopo</option><option>Mpumalanga</option><option>North West</option><option>Northern Cape</option><option>Western Cape</option>
            </select>
            <input name="categories" placeholder="Codes taught e.g. 08, 10, 14" style={{padding:14,borderRadius:12,border:'1px solid #b8cbd2',fontSize:16}}/>
            <input name="teaching_languages" placeholder="Teaching languages" style={{padding:14,borderRadius:12,border:'1px solid #b8cbd2',fontSize:16}}/>
            <button disabled={submitting} style={{...buttonBase,gridColumn:'1 / -1',background:'#071d45',color:'#fff',opacity:submitting?.7:1}}>{submitting?'Submitting…':'REGISTER AS A FOUNDING SCHOOL →'}</button>
          </form>
          {schoolStatus && <p style={{textAlign:'center',fontWeight:800,marginBottom:0}}>{schoolStatus}</p>}
          <p style={{textAlign:'center',fontSize:12,color:'#60727c'}}>By submitting, the school consents to verification before listing. Registration does not imply government endorsement.</p>
        </div>
      </section>

      <section style={{textAlign:'center',padding:'12px 0 30px'}}>
        <h2 style={{marginBottom:6}}>The campaign goal</h2>
        <p style={{color:'#b9cfdb',maxWidth:720,margin:'0 auto'}}>Every learner studies, shares and brings another learner. Every verified driving school gives learners a safer route from theory preparation to practical training.</p>
      </section>
    </div>
  </main>;
}
