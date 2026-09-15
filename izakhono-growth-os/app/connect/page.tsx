import { providerOnboarding } from "@/lib/providers/onboarding";
import Link from "next/link";

const base="https://izakhono-growth-os.vercel.app";

export default function ConnectPage(){
  return <main className="connectPage">
    <header className="connectTop">
      <Link href="/">← Command Centre</Link>
      <span>IZAKHONO GROWTH OS</span>
    </header>

    <section className="connectHero">
      <span className="kicker">SECURE CONNECTION WIZARD</span>
      <h1>Connect the data first.<br/>Spend later.</h1>
      <p>Register provider applications, callbacks and approvals here. Growth OS will not activate live campaign writes until OAuth, account mapping, measurement and the approval gate are complete.</p>
      <div className="connectPolicy"><b>SAFE WRITE MODE</b><span>OAuth only · no passwords · encrypted tokens · PAUSED campaign default · human approval before activation</span></div>
    </section>

    <section className="connectSteps">
      <article><b>01</b><span>Provider approval</span><p>Create/approve the developer application.</p></article>
      <article><b>02</b><span>Server credentials</span><p>Add client credentials outside source control.</p></article>
      <article><b>03</b><span>OAuth consent</span><p>Authorize only the accounts Growth OS should access.</p></article>
      <article><b>04</b><span>Measurement</span><p>Map conversion sources before optimization.</p></article>
      <article><b>05</b><span>Write activation</span><p>Enable writes only after an explicit approval gate.</p></article>
    </section>

    <section className="connectorList">
      {providerOnboarding.map((p,i)=><article id={p.id} className="connectorSetup" key={p.id}>
        <div className="connectorNumber">{String(i+1).padStart(2,"0")}</div>
        <div className="connectorBody">
          <div className="connectorTitle"><div><span className="kicker">{p.authModel}</span><h2>{p.label}</h2></div><span className="approvalBadge">APPROVAL REQUIRED</span></div>
          <p className="approvalText">{p.approval}</p>
          {p.currentNote&&<div className="currentNote">{p.currentNote}</div>}
          <div className="connectorColumns">
            <div><b>Registration checklist</b>{p.checklist.map(item=><p key={item}>✓ {item}</p>)}</div>
            <div><b>Growth OS callback</b><code>{base+p.callbackPath}</code><b>Server-side credentials</b>{p.env.map(v=><code key={v}>{v}</code>)}<b>Requested scopes</b>{p.scopes.map(v=><code key={v}>{v}</code>)}</div>
          </div>
          <a className="readinessLink" href={"/api/oauth/"+p.id+"/readiness"}>Check live readiness →</a>
        </div>
      </article>)}
    </section>

    <section className="measurementBlock">
      <span className="kicker">MEASUREMENT BEFORE OPTIMIZATION</span>
      <h2>Conversion sources to connect next</h2>
      <div className="measurementGrid">
        <article><b>GA4</b><span>Sessions · events · conversions · revenue</span></article>
        <article><b>Google Ads</b><span>Conversion actions · offline conversion imports</span></article>
        <article><b>Meta Pixel / CAPI</b><span>Browser + server event reconciliation</span></article>
        <article><b>TikTok Pixel / Events API</b><span>Web events · lead and purchase signals</span></article>
        <article><b>CRM</b><span>Lead status · qualified · won · lost</span></article>
        <article><b>Payments</b><span>Real revenue and refund outcomes</span></article>
      </div>
    </section>
  </main>;
}
