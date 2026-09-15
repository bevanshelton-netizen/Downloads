import Link from "next/link";
import { measurementSources } from "@/lib/measurement/registry";

const events=[
  ["page_view","Anonymous visit / landing-page engagement"],
  ["lead","Lead captured"],
  ["qualified_lead","Lead meets the brand's qualification threshold"],
  ["application","Application submitted"],
  ["enrolment","Learner/customer enrolment confirmed"],
  ["order","Commercial order created"],
  ["payment","Money successfully received"],
  ["refund","Money returned / reversed"]
];

export default function MeasurementPage(){
  return <main className="measurePage">
    <header className="connectTop"><Link href="/">← Command Centre</Link><span>IZAKHONO GROWTH OS</span></header>
    <section className="connectHero">
      <span className="kicker">MEASUREMENT CONTROL PLANE</span>
      <h1>Measure revenue.<br/>Not vanity.</h1>
      <p>Growth OS joins acquisition, leads and payment outcomes around one internal event model. Platform clicks and impressions remain useful signals, but budget decisions should ultimately trace to qualified leads and real revenue.</p>
      <div className="connectPolicy"><b>NO FAKE ATTRIBUTION</b><span>No synthetic conversions · no hidden demo/live blending · event IDs preserved · revenue source identified</span></div>
    </section>

    <section className="metrics measurementSummary">
      <article className="metric"><span>Measurement sources</span><b>{measurementSources.length}</b><small>Ready for secure configuration</small></article>
      <article className="metric"><span>Canonical events</span><b>{events.length}</b><small>Shared across every provider</small></article>
      <article className="metric"><span>Live ingestion</span><b>LOCKED</b><small>Secret + persistence required</small></article>
      <article className="metric"><span>Auto budget optimization</span><b>OFF</b><small>Until outcomes are trustworthy</small></article>
    </section>

    <section className="measurementSourceGrid">
      {measurementSources.map((source,i)=><article key={source.id} className="measurementSource">
        <div className="connectorNumber">{String(i+1).padStart(2,"0")}</div>
        <span className="kicker">{source.mode.toUpperCase()}</span>
        <h2>{source.label}</h2>
        <p>{source.purpose}</p>
        <div className="measurementVars">{source.env.map(v=><code key={v}>{v}</code>)}</div>
        <div className="measurementNotes">{source.notes.map(n=><span key={n}>✓ {n}</span>)}</div>
      </article>)}
    </section>

    <section className="eventModel card">
      <span className="kicker">GROWTH EVENT TAXONOMY</span>
      <h2>One vocabulary across every business.</h2>
      <div className="eventRows">
        {events.map(([name,description])=><div key={name}><code>{name}</code><span>{description}</span></div>)}
      </div>
    </section>

    <section className="twoCol">
      <article className="card">
        <span className="kicker">ATTRIBUTION RULE</span><h3>Campaign IDs survive the whole journey.</h3>
        <p className="measurementCopy">UTM/click identifiers enter with the visit, persist against the lead/customer journey where consent allows, and reconnect to the eventual payment/refund event. Growth OS can then compare spend against outcomes without pretending last-click is always the whole story.</p>
      </article>
      <article className="card">
        <span className="kicker">ACTIVATION ORDER</span><h3>Connect in this sequence.</h3>
        <div className="rules"><span>1 · GA4</span><span>2 · Google Ads</span><span>3 · Meta CAPI</span><span>4 · TikTok Events</span><span>5 · CRM</span><span>6 · Payments</span></div>
      </article>
    </section>

    <section className="notice">Live event ingestion deliberately refuses data until both an ingestion secret and a persistence layer are configured. This prevents us from claiming attribution before the evidence pipeline exists.</section>
  </main>;
}
