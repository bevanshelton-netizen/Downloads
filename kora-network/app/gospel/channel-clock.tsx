'use client';

import { useEffect, useMemo, useState } from 'react';

const slots = [
  ['00:00',120,'Midnight Worship','Worship'],
  ['02:00',120,'Scripture Through the Night','Word'],
  ['04:00',60,'Quiet Hour','Reflection'],
  ['05:00',120,'Morning Glory','Worship'],
  ['07:00',120,'Gospel Africa AM','Music'],
  ['09:00',60,'Women of Faith','Talk'],
  ['10:00',120,'The Word','Word'],
  ['12:00',60,'Word at Noon','Word'],
  ['13:00',60,'Choirs of Africa','Music'],
  ['14:00',60,'Faith Without Borders','Global'],
  ['15:00',90,'Gospel Kids','Kids'],
  ['16:30',60,'Young & Faithful','Youth'],
  ['17:30',90,'Gospel Africa PM','Music'],
  ['19:00',60,'Testimony Hour','Testimony'],
  ['20:00',60,'Prime Gospel','Prime'],
  ['21:00',120,'Revival Nights','Revival'],
  ['23:00',60,'Late Night Praise','Worship'],
] as const;

function sastParts(date: Date){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Africa/Johannesburg',hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'
  }).formatToParts(date);
  const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {hour:Number(map.hour),minute:Number(map.minute),second:Number(map.second)};
}

export default function GospelChannelClock(){
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t)},[]);

  const state=useMemo(()=>{
    const p=sastParts(now);
    const minute=p.hour*60+p.minute+p.second/60;
    const normalized=slots.map((s,i)=>{
      const [h,m]=s[0].split(':').map(Number);
      return {start:s[0],duration:s[1],title:s[2],genre:s[3],index:i,startMin:h*60+m};
    });
    let current=normalized[normalized.length-1];
    for(const slot of normalized){if(minute>=slot.startMin)current=slot;else break;}
    const next=normalized[(current.index+1)%normalized.length];
    const elapsed=current.startMin<=minute?minute-current.startMin:1440-current.startMin+minute;
    const progress=Math.max(0,Math.min(100,(elapsed/current.duration)*100));
    return {current,next,progress,time:`${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`};
  },[now]);

  return <section className="channelClock" aria-label="YHVH Gospel TV channel clock">
    <div className="clockTop">
      <span className="clockLiveDot" aria-hidden="true"/>
      <span>CHANNEL CLOCK · SAST</span>
      <strong>{state.time}</strong>
    </div>
    <div className="clockMain">
      <div>
        <small>SCHEDULED NOW</small>
        <h2>{state.current.title}</h2>
        <p>{state.current.genre} · {state.current.start}</p>
      </div>
      <div className="clockNext">
        <small>UP NEXT</small>
        <strong>{state.next.title}</strong>
        <span>{state.next.start} SAST</span>
      </div>
    </div>
    <div className="clockProgress" aria-label="Programme progress"><span style={{width:`${state.progress}%`}}/></div>
    <p className="clockNote">Programme clock shows the published YHVH schedule. Public stream availability is reported separately by the watch gateway.</p>
  </section>;
}
