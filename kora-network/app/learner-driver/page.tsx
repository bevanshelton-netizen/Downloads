'use client';
import { useEffect } from 'react';
const target='https://learner-driver-sa-bevan2.vercel.app/?utm_source=kora_campaign_page&utm_medium=owned_media&utm_campaign=learner_driver_sa_launch&utm_content=clickable_picture_ad';
export default function LearnerDriverCampaign(){
 useEffect(()=>{fetch('https://yfawrenhudjomhnglfhq.supabase.co/rest/v1/learner_driver_campaign_events',{method:'POST',headers:{apikey:'sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p','Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({event_name:'page_view',utm_source:'kora_campaign_page',utm_medium:'owned_media',utm_campaign:'learner_driver_sa_launch',utm_content:'clickable_picture_ad',path:'/learner-driver',page_title:'Learner Driver SA Campaign',session_id:(crypto.randomUUID?crypto.randomUUID():Date.now().toString())})}).catch(()=>{})},[]);
 async function share(){const d={title:'Learner Driver SA',text:"Prepare for your learner's licence — motorcycles, Code 08, 10 and 14.",url:location.href};try{if(navigator.share){await navigator.share(d);return}await navigator.clipboard.writeText(location.href);alert('Campaign link copied.')}catch(e:any){if(e?.name!=='AbortError')prompt('Copy this link',location.href)}}
 return <main style={{minHeight:'100vh',background:'#061525',padding:'18px',color:'#fff',fontFamily:'system-ui,-apple-system,Segoe UI,sans-serif'}}>
  <div style={{maxWidth:900,margin:'0 auto',textAlign:'center'}}>
   <a href={target} target="_blank" rel="noopener noreferrer" style={{display:'block',borderRadius:24,overflow:'hidden',boxShadow:'0 24px 70px rgba(0,0,0,.45)'}}>
    <img src="/images/learner-driver-sa-ad.svg" alt="Learner Driver SA advert" style={{display:'block',width:'100%',height:'auto'}}/>
   </a>
   <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap',margin:'18px 0'}}>
    <a href={target} target="_blank" rel="noopener noreferrer" style={{background:'#21d881',color:'#04130c',borderRadius:999,padding:'15px 22px',fontWeight:900,textDecoration:'none'}}>START LEARNING TODAY →</a>
    <button onClick={share} style={{background:'#ffd43b',color:'#111',border:0,borderRadius:999,padding:'15px 22px',fontWeight:900,cursor:'pointer'}}>↗ SHARE</button>
   </div>
   <p style={{color:'#b9cfdb',fontSize:13}}>Tap the advert to open Learner Driver SA.</p>
  </div>
 </main>
}