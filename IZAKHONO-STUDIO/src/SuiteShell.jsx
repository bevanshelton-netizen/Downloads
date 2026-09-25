import React from 'react';
import App from './App.jsx';
import PhotoLab from './PhotoLab.jsx';
import SwitchCenter from './SwitchCenter.jsx';
import GamerStudio from './GamerStudio.jsx';
import GamerClipLab from './GamerClipLab.jsx';
import { GAMER_PRICE, SUITE_PRICE, SUITE_PROMISES, SUITE_TOOLS } from './suiteCatalog.js';

function Status({ value }) {
  return <span className={`suite-status ${value === 'working-v1' ? 'ready' : ''}`}>{value === 'working-v1' ? 'WORKING V1' : 'IN SUITE FOUNDATION'}</span>;
}

export default function SuiteShell() {
  const workingCount = SUITE_TOOLS.filter((tool) => tool.status === 'working-v1').length;

  return (
    <div className="suite-shell">
      <section className="suite-hero">
        <div className="suite-hero-copy">
          <div className="suite-pill">IZAKHONO CREATIVE SUITE • ORIGINAL PRODUCT</div>
          <h1>One creative universe. <em>{SUITE_PRICE.label}.</em></h1>
          <p className="suite-lead">A unified alternative to expensive, fragmented creative software: design, photo, gaming, vector, publishing, video, motion, audio, documents, AI, assets and distribution under one IZAKHONO roof.</p>
          <div className="suite-price-row">
            <div className="suite-price"><strong>$5</strong><span>USD / month</span></div>
            <div className="suite-price-copy">
              <b>All core tools. One plan.</b>
              <span>AI-heavy generation uses an included starter allowance plus optional top-ups so the base subscription remains sustainable.</span>
            </div>
          </div>
          <div className="suite-cta-row">
            <a className="suite-primary-link" href="#switch-center">Switch to IZAKHONO</a>
            <a className="suite-secondary-link" href="#gamer-studio">Open Gamer Studio</a>
          </div>
        </div>

        <div className="suite-scorecard">
          <span>V0.6 CREATIVE SUITE</span>
          <strong>{SUITE_TOOLS.length}</strong>
          <b>connected tool families</b>
          <div>
            <small>{workingCount} working in this build</small>
            <small>{SUITE_TOOLS.length - workingCount} sharing the same product foundation</small>
          </div>
        </div>
      </section>

      <section className="suite-why">
        <div>
          <span className="suite-eyebrow">THE IMPROVEMENT</span>
          <h2>Less fragmentation. More creation.</h2>
        </div>
        <div className="suite-promises">
          {SUITE_PROMISES.map((promise) => <span key={promise}>{promise}</span>)}
        </div>
      </section>

      <section className="suite-catalog">
        <div className="suite-section-copy">
          <span className="suite-eyebrow">ONE SUITE • SHARED ASSETS • SHARED PROJECTS</span>
          <h2>The creative package</h2>
          <p>We are not cloning Adobe branding or interfaces. These are original IZAKHONO tools built around the same customer jobs, with a simpler commercial model and a common project architecture.</p>
        </div>

        <div className="suite-tool-grid">
          {SUITE_TOOLS.map((tool, index) => (
            <article className="suite-tool-card" key={tool.id}>
              <div className="suite-tool-number">{String(index + 1).padStart(2, '0')}</div>
              <div className="suite-tool-title">
                <span>{tool.kicker}</span>
                <h3>{tool.name}</h3>
              </div>
              <p>{tool.description}</p>
              <Status value={tool.status} />
            </article>
          ))}
        </div>
      </section>

      <SwitchCenter />

      <GamerStudio />

      <GamerClipLab />

      <PhotoLab />

      <section className="suite-commercial">
        <div>
          <span className="suite-eyebrow">COMMERCIAL MODEL</span>
          <h2>$5 for creators. $15 for gamers.</h2>
        </div>
        <div className="suite-commercial-grid">
          <div><b>Creative subscription</b><strong>$5/month</strong><span>Core creative tools excluding Gamer Studio.</span></div>
          <div><b>Gamer subscription</b><strong>{GAMER_PRICE.label}</strong><span>Includes the full Creative Suite plus Gamer Studio.</span></div>
          <div><b>AI compute</b><strong>Controlled</strong><span>Starter allowance included; top-ups only when costly generation exceeds the base allowance.</span></div>
          <div><b>Storage</b><strong>Hybrid</strong><span>Local-first where practical, with IZAKHONO storage and approved external resilience as the product matures.</span></div>
          <div><b>Payments</b><strong>Gated</strong><span>List price is approved. Public checkout stays off until the selected gateway, legal pages and end-to-end payment flow are verified.</span></div>
        </div>
      </section>

      <div id="design-studio" className="suite-existing-app">
        <App />
      </div>

      <footer className="suite-legal-footer">
        <div>
          <b>IZAKHONO AFRICA (PTY) LTD</b>
          <span>Creative $5 • Gamer $15 • checkout remains gated until settlement and entitlement verification pass.</span>
        </div>
        <nav aria-label="Legal and commercial information">
          <a href="/pricing">Pricing</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/refunds">Refunds & Cancellation</a>
        </nav>
      </footer>
    </div>
  );
}
