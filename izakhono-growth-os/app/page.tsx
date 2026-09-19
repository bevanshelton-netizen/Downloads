"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tab = "command" | "build" | "creative" | "organic" | "leads" | "compliance" | "approvals" | "connections";
type Draft = {
  id:string;
  name:string;
  brand:string;
  objective:string;
  country:string;
  language:string;
  budget:number;
  status:"DRAFT"|"APPROVED";
};
type Plan = {
  allocations:{channel:string;percent:number;amount:number}[];
  preflight:string[];
  note:string;
};

const fallbackBrands = [
  "KORA","AUTO AI","FAISReady","Mandatory Regulatory Exams Platform",
  "DOXA-SURE","Edu-Build Institute – Shelton Campuses","IZAKHONO ONE","Izakhono Africa"
];

const providers = [
  {id:"google-ads",name:"Google Ads",abbr:"G",scope:"Search · PMax · YouTube",status:"DISCONNECTED"},
  {id:"meta-ads",name:"Meta Ads",abbr:"M",scope:"Facebook · Instagram · Reels",status:"DISCONNECTED"},
  {id:"tiktok-ads",name:"TikTok Ads",abbr:"T",scope:"Video · Spark · Lead Gen",status:"DISCONNECTED"},
  {id:"linkedin-ads",name:"LinkedIn Ads",abbr:"in",scope:"B2B · Lead Gen · ABM",status:"DISCONNECTED"},
  {id:"amazon-ads",name:"Amazon Ads",abbr:"a",scope:"Sponsored · Display",status:"DISCONNECTED"},
  {id:"microsoft-ads",name:"Microsoft Ads",abbr:"m",scope:"Search · Audience",status:"DISCONNECTED"}
];

const nav:[Tab,string,string][] = [
  ["command","Command Centre","⌁"],
  ["build","Campaign Builder","＋"],
  ["creative","Creative Lab","✦"],
  ["organic","Organic Social","◉"],
  ["leads","Leads & Revenue","↗"],
  ["compliance","Compliance","✓"],
  ["approvals","Approvals","◎"],
  ["connections","Connections","⌘"]
];

const creativeLanguages = [
  ["English","Reach the right people. Measure what matters."],
  ["isiZulu","Finyelela kubantu abafanele. Linganisa okubalulekile."],
  ["Afrikaans","Bereik die regte mense. Meet wat saak maak."],
  ["Español","Llega a las personas correctas. Mide lo que importa."],
  ["Português","Alcance as pessoas certas. Meça o que importa."],
  ["Français","Touchez les bonnes personnes. Mesurez ce qui compte."],
  ["العربية","تواصل مع الجمهور المناسب. وقِس ما يهم."],
  ["हिन्दी","सही लोगों तक पहुँचें। जो मायने रखता है उसे मापें।"]
];

const complianceRows = [
  ["South Africa","General consumer","READY","Privacy + truthful claims"],
  ["South Africa","Financial education","REVIEW","FSCA/financial-ad classification"],
  ["United Kingdom","Financial services","VERIFY","Platform + FCA-related ad eligibility"],
  ["United States","General consumer","READY","Platform policy + privacy"],
  ["India","Financial services","VERIFY","Platform financial-services verification"],
  ["UAE","Financial services","VERIFY","Local/platform financial-ad checks"]
];

function money(v:number){ return "R"+v.toLocaleString("en-ZA"); }

export default function GrowthOS(){
  const [tab,setTab]=useState<Tab>("command");
  const [brands,setBrands]=useState<string[]>(fallbackBrands);
  const [brand,setBrand]=useState(fallbackBrands[0]);
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [demo,setDemo]=useState(true);
  const [plan,setPlan]=useState<Plan|null>(null);
  const [planning,setPlanning]=useState(false);
  const [form,setForm]=useState({
    name:"World Launch",
    objective:"leads",
    country:"South Africa",
    language:"English",
    industry:"Financial education",
    budget:10000
  });

  useEffect(()=>{
    const raw=localStorage.getItem("growth-os-drafts");
    if(raw){ try{setDrafts(JSON.parse(raw));}catch{} }
    fetch("https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-portfolio-growth-api?list=1")
      .then(r=>r.json()).then(d=>{
        const names=(d.platforms||[]).filter((p:any)=>p.status==="active"||p.status==="building").map((p:any)=>String(p.display_name||"")).filter(Boolean);
        if(names.length){setBrands(names);setBrand(v=>names.includes(v)?v:names[0]);}
      }).catch(()=>{});
  },[]);

  useEffect(()=>{
    localStorage.setItem("growth-os-drafts",JSON.stringify(drafts));
  },[drafts]);

  const approved=drafts.filter(d=>d.status==="APPROVED").length;
  const connected=0;
  const readyScore=useMemo(()=>Math.min(100,42 + drafts.length*4 + approved*5),[drafts,approved]);

  async function buildPlan(e?:FormEvent){
    e?.preventDefault();
    setPlanning(true);
    try{
      const response=await fetch("/api/plan",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(form)
      });
      setPlan(await response.json());
    }finally{setPlanning(false);}
  }

  function saveDraft(){
    const draft:Draft={
      id:crypto.randomUUID(),
      name:form.name||"Untitled campaign",
      brand,
      objective:form.objective,
      country:form.country,
      language:form.language,
      budget:Number(form.budget)||0,
      status:"DRAFT"
    };
    setDrafts(v=>[draft,...v]);
    setTab("approvals");
  }

  function approve(id:string){
    setDrafts(v=>v.map(d=>d.id===id?{...d,status:"APPROVED"}:d));
  }

  return <main className="shell">
    <aside className="sidebar">
      <div className="logoLockup">
        <div className="logoMark">I</div>
        <div><b>IZAKHONO</b><span>GROWTH OS</span></div>
      </div>

      <label className="brandLabel">ACTIVE BRAND</label>
      <select className="brandSelect" value={brand} onChange={e=>setBrand(e.target.value)}>
        {brands.map(b=><option key={b}>{b}</option>)}
      </select>

      <nav className="sideNav">
        {nav.map(([id,label,icon])=><button key={id} onClick={()=>setTab(id)} className={tab===id?"active":""}>
          <span>{icon}</span>{label}{id==="approvals"&&drafts.length>0?<em>{drafts.length}</em>:null}
        </button>)}
      </nav>

      <div className="sideBottom">
        <div className="safety"><i/> SAFE WRITE MODE</div>
        <small>Read first · Draft paused · Approval before write</small>
      </div>
    </aside>

    <section className="main">
      <header className="top">
        <div>
          <span className="crumb">IZAKHONO / {brand}</span>
          <h1>{nav.find(n=>n[0]===tab)?.[1]}</h1>
        </div>
        <div className="topActions">
          <Link className="ownerLogin" href="/login">Owner access</Link>
          <button className={demo?"demoOn":"demoOff"} onClick={()=>setDemo(v=>!v)}>{demo?"DEMO WORKSPACE":"LIVE DATA ONLY"}</button>
          <button className="newCampaign" onClick={()=>setTab("build")}>＋ New campaign</button>
        </div>
      </header>

      {tab==="command"&&<CommandCentre brand={brand} brands={brands} connected={connected} drafts={drafts} readyScore={readyScore} demo={demo} setTab={setTab}/>}
      {tab==="build"&&<CampaignBuilder brand={brand} form={form} setForm={setForm} plan={plan} planning={planning} buildPlan={buildPlan} saveDraft={saveDraft}/>}
      {tab==="creative"&&<CreativeLab brand={brand}/>}
      {tab==="organic"&&<OrganicSocial brand={brand}/>}
      {tab==="leads"&&<LeadsRevenue demo={demo}/>}
      {tab==="compliance"&&<Compliance/>}
      {tab==="approvals"&&<Approvals drafts={drafts} approve={approve}/>}
      {tab==="connections"&&<Connections/>}
    </section>
  </main>;
}

function CommandCentre({brand,brands,connected,drafts,readyScore,demo,setTab}:{brand:string;brands:string[];connected:number;drafts:Draft[];readyScore:number;demo:boolean;setTab:(t:Tab)=>void}){
  const demoSpend=demo?18450:0;
  return <div className="stack">
    <section className="heroCard">
      <div>
        <span className="kicker">ONE COMMAND CENTRE · EVERY GROWTH CHANNEL</span>
        <h2>Run growth like an operating system.</h2>
        <p>Plan, localize, approve, publish, measure and optimize paid + organic campaigns without losing control of budgets or compliance.</p>
      </div>
      <div className="readiness">
        <div className="ring" style={{"--p":readyScore} as React.CSSProperties}><b>{readyScore}</b><span>Launch score</span></div>
      </div>
    </section>

    {demo&&<div className="demoStrip">DEMO DATA — sample performance is illustrative until your ad accounts and analytics are connected.</div>}

    <section className="metrics">
      <Metric label="Ad platforms connected" value={String(connected)+"/6"} note="OAuth required"/>
      <Metric label="Portfolio spend" value={money(demoSpend)} note={demo?"Demo last 30 days":"No live accounts"}/>
      <Metric label="Draft campaigns" value={String(drafts.length)} note="All paused by default"/>
      <Metric label="Actions awaiting approval" value={String(drafts.filter(d=>d.status==="DRAFT").length)} note="Nothing spends without approval"/>
    </section>

    <section className="twoCol">
      <div className="card">
        <div className="cardHead"><div><span className="kicker">CHANNEL CONTROL</span><h3>Media network</h3></div><button onClick={()=>setTab("connections")}>Manage →</button></div>
        <div className="providers">
          {providers.map(p=><div className="provider" key={p.name}><div className="providerIcon">{p.abbr}</div><div><b>{p.name}</b><span>{p.scope}</span></div><em>{p.status}</em></div>)}
        </div>
      </div>

      <div className="card">
        <div className="cardHead"><div><span className="kicker">GROWTH COPILOT</span><h3>What should happen next?</h3></div></div>
        <div className="recommendations">
          <article><span>01</span><div><b>Connect measurement first</b><p>Link GA4, conversion APIs and revenue outcomes before asking the system to optimize spend.</p></div><a className="recLink" href="/measure">Open</a></article>
          <article><span>02</span><div><b>Build localized campaign packs</b><p>Create language + country variants from one approved master brief.</p></div><button onClick={()=>setTab("creative")}>Open</button></article>
          <article><span>03</span><div><b>Approve before activation</b><p>Every new paid campaign remains paused until its preflight and budget are approved.</p></div><button onClick={()=>setTab("approvals")}>Review</button></article>
        </div>
      </div>
    </section>

    <section className="card">
      <div className="cardHead"><div><span className="kicker">PORTFOLIO</span><h3>Brands under one growth layer</h3></div><span className="muted">{brand} selected</span></div>
      <div className="brandGrid">
        {brands.map((b,i)=><article key={b}><div className="miniLogo">{b.slice(0,2).toUpperCase()}</div><b>{b}</b><span>{i<3?"Campaign-ready":"Workspace-ready"}</span></article>)}
      </div>
    </section>
  </div>;
}

function Metric({label,value,note}:{label:string;value:string;note:string}){
  return <article className="metric"><span>{label}</span><b>{value}</b><small>{note}</small></article>;
}

function CampaignBuilder({brand,form,setForm,plan,planning,buildPlan,saveDraft}:any){
  return <div className="builderGrid">
    <form className="card formCard" onSubmit={buildPlan}>
      <span className="kicker">CAMPAIGN BRIEF</span><h2>Tell Growth OS the outcome.</h2>
      <label>Campaign name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label>Brand<input value={brand} disabled/></label>
      <div className="formRow">
        <label>Objective<select value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}>
          <option value="leads">Lead generation</option><option value="sales">Sales</option><option value="awareness">Awareness</option>
          <option value="enrolments">Enrolments</option><option value="app_installs">App installs</option>
        </select></label>
        <label>Budget (ZAR)<input type="number" min="0" value={form.budget} onChange={e=>setForm({...form,budget:Number(e.target.value)})}/></label>
      </div>
      <div className="formRow">
        <label>Country<input value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/></label>
        <label>Language<input value={form.language} onChange={e=>setForm({...form,language:e.target.value})}/></label>
      </div>
      <label>Industry<select value={form.industry} onChange={e=>setForm({...form,industry:e.target.value})}>
        <option>Financial education</option><option>Education</option><option>Fashion</option><option>Entertainment</option><option>Professional services</option><option>Automotive</option>
      </select></label>
      <button className="primary" disabled={planning}>{planning?"Planning…":"Build media plan"}</button>
    </form>

    <section className="card planCard">
      <span className="kicker">MEDIA PLAN</span><h2>{plan?"Recommended split":"Waiting for brief"}</h2>
      {!plan&&<div className="emptyPlan"><div>◎</div><p>Growth OS will create a channel mix, budget allocation and compliance preflight without spending anything.</p></div>}
      {plan&&<>
        <div className="allocation">
          {plan.allocations.map((a:{channel:string;percent:number;amount:number})=><div key={a.channel}><div className="allocLabel"><b>{a.channel}</b><span>{a.percent}% · {money(a.amount)}</span></div><div className="bar"><i style={{width:a.percent+"%"}}/></div></div>)}
        </div>
        <div className="preflight"><b>Preflight</b>{plan.preflight.map((x:string)=><p key={x}>✓ {x}</p>)}</div>
        <p className="plannerNote">{plan.note}</p>
        <button className="primary" onClick={saveDraft}>Save as PAUSED draft</button>
      </>}
    </section>
  </div>;
}

function CreativeLab({brand}:{brand:string}){
  return <div className="stack">
    <section className="heroCard creativeHero">
      <div><span className="kicker">MULTILINGUAL CREATIVE ENGINE</span><h2>One idea. Every market.</h2><p>Create a master message once, then adapt language, culture, format, CTA and disclosure for each country — without losing brand control.</p></div>
      <button className="primary">＋ New creative pack</button>
    </section>
    <section className="creativeGrid">
      {creativeLanguages.map(([lang,line],i)=><article className="creativeCard" key={lang}>
        <div className="creativeVisual"><span>{brand}</span><strong>{line}</strong><em>{i%2===0?"LEARN MORE":"EXPLORE"}</em></div>
        <div className="creativeMeta"><b>{lang}</b><span>{i<3?"Africa":"Global"} · 1:1 / 9:16 / 16:9</span></div>
      </article>)}
    </section>
    <section className="card"><div className="cardHead"><div><span className="kicker">CREATIVE SAFETY</span><h3>Global rules before generation</h3></div></div>
      <div className="rules"><span>No guaranteed outcomes</span><span>No fake scarcity</span><span>No misleading before/after</span><span>Local disclosure pack</span><span>Brand-safe fonts & voice</span><span>Human approval for paid launch</span></div>
    </section>
  </div>;
}

function OrganicSocial({brand}:{brand:string}){
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  return <div className="stack">
    <section className="heroCard"><div><span className="kicker">ORGANIC + PAID TOGETHER</span><h2>Stop treating social content and ads as separate worlds.</h2><p>Turn winning organic posts into paid candidates, reuse paid creative organically, and keep one multilingual content calendar.</p></div><button className="primary">＋ Schedule content</button></section>
    <section className="calendar">
      {days.map((d,i)=><article key={d}><b>{d}</b><span>{15+i} Sep</span>{i!==2&&<div className="post"><small>{i%2?"VIDEO":"CAROUSEL"}</small><strong>{i%2?"20-sec feature demo":"3 things to know"}</strong><em>{brand}</em></div>}</article>)}
    </section>
    <section className="twoCol">
      <div className="card"><span className="kicker">BOOST CANDIDATES</span><h3>Organic posts worth testing as ads</h3><div className="emptyPlan"><div>↗</div><p>Connect your social accounts to score real posts by watch time, saves, shares and downstream conversions.</p></div></div>
      <div className="card"><span className="kicker">PUBLISHING ADAPTERS</span><h3>Social connection state</h3><div className="rules"><span>Instagram · disconnected</span><span>Facebook · disconnected</span><span>TikTok · disconnected</span><span>LinkedIn · disconnected</span><span>YouTube · disconnected</span></div></div>
    </section>
  </div>;
}

function LeadsRevenue({demo}:{demo:boolean}){
  return <div className="stack">
    {demo&&<div className="demoStrip">DEMO PIPELINE — replace with CRM + payment + analytics events when connected.</div>}
    <section className="metrics">
      <Metric label="New leads" value={demo?"84":"0"} note="Last 30 days"/>
      <Metric label="Qualified" value={demo?"31":"0"} note="Lead-score threshold"/>
      <Metric label="Customers" value={demo?"12":"0"} note="Attributed conversions"/>
      <Metric label="Attributed revenue" value={demo?"R47,600":"R0"} note="Demo multi-touch view"/>
    </section>
    <section className="twoCol">
      <div className="card"><span className="kicker">PIPELINE</span><h3>Lead journey</h3>
        <div className="funnel"><div><b>84</b><span>Captured</span></div><i>→</i><div><b>55</b><span>Contacted</span></div><i>→</i><div><b>31</b><span>Qualified</span></div><i>→</i><div><b>12</b><span>Won</span></div></div>
      </div>
      <div className="card"><span className="kicker">ATTRIBUTION</span><h3>From spend to revenue</h3>
        <div className="attribution"><p><b>Meta</b><span>38%</span></p><p><b>Google</b><span>32%</span></p><p><b>Organic</b><span>18%</span></p><p><b>TikTok</b><span>12%</span></p></div>
      </div>
    </section>
    <section className="card"><div className="cardHead"><div><span className="kicker">INTEGRATION TARGETS</span><h3>Close the measurement loop</h3></div><a className="primary miniCta" href="/measure">Open measurement control →</a></div><div className="rules"><span>GA4</span><span>Meta Pixel / CAPI</span><span>Google Ads conversions</span><span>TikTok Events API</span><span>CRM</span><span>Payment gateway</span></div></section>
  </div>;
}

function Compliance(){
  return <div className="stack">
    <section className="heroCard"><div><span className="kicker">COUNTRY-AWARE PREFLIGHT</span><h2>Compliance before spend.</h2><p>Growth OS checks category, country, claim language, landing-page disclosures and account verification before a campaign can move out of draft.</p></div><div className="shield">✓</div></section>
    <section className="card">
      <div className="complianceTable">
        <div className="row head"><span>Market</span><span>Category</span><span>Gate</span><span>Action</span></div>
        {complianceRows.map(([market,category,status,action])=><div className="row" key={market+category}><span>{market}</span><span>{category}</span><span><b className={"state "+status.toLowerCase()}>{status}</b></span><span>{action}</span></div>)}
      </div>
    </section>
    <div className="notice">Growth OS provides workflow controls, not legal clearance. Country/platform requirements must be verified before activation.</div>
  </div>;
}

function Approvals({drafts,approve}:{drafts:Draft[];approve:(id:string)=>void}){
  return <div className="stack">
    <section className="heroCard"><div><span className="kicker">HUMAN-IN-CONTROL</span><h2>Nothing consequential happens silently.</h2><p>Review budget, market, creative, compliance and destination before the connector is allowed to write to an ad account.</p></div></section>
    <section className="card">
      {drafts.length===0?<div className="emptyPlan"><div>◎</div><p>No campaign drafts yet. Build a plan and save it to create your first approval item.</p></div>:
      <div className="approvalList">{drafts.map(d=><article key={d.id}>
        <div className="approvalIcon">{d.status==="APPROVED"?"✓":"!"}</div>
        <div><b>{d.name}</b><span>{d.brand} · {d.country} · {d.language}</span><small>{d.objective} · {money(d.budget)}</small></div>
        <em className={d.status.toLowerCase()}>{d.status}</em>
        {d.status==="DRAFT"?<button onClick={()=>approve(d.id)}>Approve for connector</button>:<button disabled>Awaiting live connector</button>}
      </article>)}</div>}
    </section>
  </div>;
}

function Connections(){
  return <div className="stack">
    <section className="heroCard"><div><span className="kicker">SECURE PROVIDER LAYER</span><h2>Connect accounts. Never passwords.</h2><p>Growth OS uses provider OAuth and server-side secrets. Read access and write access are separated; campaign creation remains paused by default.</p></div><a className="primary heroLink" href="/connect">Open connection wizard →</a></section>
    <section className="connectionGrid">
      {providers.map(p=><article className="connectionCard" key={p.name}>
        <div className="providerIcon big">{p.abbr}</div><h3>{p.name}</h3><p>{p.scope}</p><span className="disconnected">OAUTH REQUIRED</span><a href={"/connect#"+p.id}>Configure connector →</a>
      </article>)}
    </section>
    <section className="card">
      <span className="kicker">CONNECTOR CONTRACT</span><h3>Every provider must obey the same rules</h3>
      <div className="rules"><span>Read before write</span><span>Draft paused</span><span>Budget caps</span><span>Explicit approval</span><span>Activity ledger</span><span>Instant revoke</span></div>
    </section>
  </div>;
}
