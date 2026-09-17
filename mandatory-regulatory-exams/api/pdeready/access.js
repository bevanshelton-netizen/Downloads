const { credentials, verifyEntitlement } = require('../../lib/ikhokha');

function cookieValue(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function roomHtml(product, payload) {
  const track = product.id === 'pde4_launch' ? 'PDE4' : product.id === 'pde5_launch' ? 'PDE5' : 'PDE4 + PDE5';
  const expiry = new Date(payload.exp * 1000).toLocaleDateString('en-ZA', { day:'2-digit', month:'long', year:'numeric' });
  const scenarios = product.id === 'pde5_launch' ? [
    'A branch shows rising complaints and file exceptions despite strong revenue. Build a principal-level remediation plan.',
    'A top performer has an undisclosed financial interest in a supplier repeatedly recommended to clients. Set out immediate and longer-term controls.',
    'Internal review finds missing approval evidence across transaction files. Diagnose the root cause and redesign supervision.',
    'Incorrect client charges are discovered across multiple files. Explain remediation, communication and recurrence controls.'
  ] : product.id === 'pde4_launch' ? [
    'A seller asks you not to mention recurring water ingress. Structure a defensible response using issue → principle → application → action.',
    'Two competing offers arrive close together and one buyer demands secrecy about competing interest. Explain your process.',
    'A supplier offers a private referral incentive. Identify the conflict and the steps needed before proceeding.',
    'A client disputes a fee and says it was never clearly explained. Identify the records and communication that matter.'
  ] : [
    'PDE4: A seller pressures a practitioner to omit material information. Build the complete professional response.',
    'PDE4: Competing offers arrive while a buyer requests preferential treatment. Explain the defensible process.',
    'PDE5: Repeated compliance failures continue after staff reminders. Diagnose why the control environment is failing.',
    'PDE5: Complaints rise after rapid branch expansion. Design management information, supervision and remediation controls.'
  ];
  const weeks = [
    ['Week 1','Baseline diagnostic; confirm PPRA eligibility; build your source index and weak-area list.'],
    ['Week 2','Legislative framework, mandates, records and regulator-facing duties.'],
    ['Week 3','Ethics, disclosure, consumer protection and conflicts of interest.'],
    ['Week 4','Transaction discipline, offers, documentation and complaint handling.'],
    ['Week 5', track.includes('PDE5') ? 'Principal leadership, supervision, controls, risk and remediation.' : 'Case application: turn rules into structured written reasoning.'],
    ['Week 6','Timed case drills; use mark allocation to control depth and time.'],
    ['Week 7','Full mock simulation and error log; drill the three weakest topics.'],
    ['Week 8','Final revision, source navigation, submission discipline and exam-day plan.']
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>PDEReady Premium Room</title><style>
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 90% 0,#1b596c 0,transparent 30%),linear-gradient(180deg,#07131d,#06101a);color:#f7fbff;font:15px/1.6 Inter,system-ui,-apple-system,Segoe UI,sans-serif}a{color:#7de9dc}.wrap{max-width:1100px;margin:auto;padding:28px 20px 70px}.top{display:flex;justify-content:space-between;gap:14px;align-items:center;border-bottom:1px solid #2d566a;padding-bottom:16px}.brand{font-size:24px;font-weight:1000}.pill{padding:6px 10px;border:1px solid #39765a;background:#143e31;border-radius:999px;color:#9ff0bb;font-size:11px;font-weight:900}.hero{padding:44px 0 22px}h1{font-size:clamp(42px,7vw,70px);line-height:.96;margin:8px 0 14px}.muted{color:#b8cbd5}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{background:#0d2939;border:1px solid #2d5b70;border-radius:18px;padding:19px}.card h2,.card h3{margin-top:0}.week{padding:12px 0;border-bottom:1px solid #254a5d}.week:last-child{border-bottom:0}.week b{color:#f1cb66}.scenario{padding:12px;margin:9px 0;background:#081f2d;border:1px solid #31586b;border-radius:12px}.framework{font-size:18px;font-weight:900;color:#82e5a4}.btn{display:inline-block;text-decoration:none;padding:11px 14px;border-radius:11px;background:#f1cb66;color:#352700;font-weight:900;margin-right:8px}.btn.alt{background:#12384a;color:#fff;border:1px solid #396779}.notice{margin-top:18px;padding:14px;border-left:3px solid #f1cb66;background:#392f174a;border-radius:10px}.small{font-size:12px;color:#9fb6c2}@media(max-width:760px){.grid{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}}</style></head><body><main class="wrap">
<div class="top"><div><div class="brand">PDEReady Premium</div><div class="muted">${esc(track)} guided preparation room</div></div><div class="pill">ACCESS ACTIVE TO ${esc(expiry).toUpperCase()}</div></div>
<section class="hero"><div class="small">IZAKHONO AFRICA (PTY) LTD • PREMIUM PREPARATION ACCESS</div><h1>Your exam plan.<br>Your weak areas.<br>Your execution.</h1><p class="muted">Use this room before the exam. It does not provide live-exam answers and does not replace official PPRA rules or study material.</p><p><a class="btn" href="/pdeready/">Open diagnostics & drills</a><a class="btn alt" href="/sources">Official sources</a></p></section>
<div class="grid"><section class="card"><h2>8-week execution plan</h2>${weeks.map(([w,t])=>`<div class="week"><b>${esc(w)}</b><br>${esc(t)}</div>`).join('')}</section>
<section class="card"><h2>Answer architecture</h2><p class="framework">ISSUE → PRINCIPLE → APPLICATION → ACTION</p><p>For each case, identify what is actually wrong, state the relevant legal/professional principle, apply it to the exact facts, then give a practical conclusion or management action.</p><h3>Mark discipline</h3><p>Use the mark allocation as a depth signal. Higher-mark questions require more application and justification, not just more definitions.</p><h3>Personal error log</h3><textarea id="errors" style="width:100%;min-height:180px;background:#061d2a;color:white;border:1px solid #356075;border-radius:12px;padding:12px" placeholder="Record every recurring mistake, missing source, weak topic or time-management problem..."></textarea><button class="btn alt" onclick="localStorage.setItem('pdeready.premium.errors',document.getElementById('errors').value)">Save error log</button></section></div>
<section class="card" style="margin-top:14px"><h2>Premium case sprint</h2><p class="muted">Write each response under time pressure. Do not look at notes until your first draft is complete.</p>${scenarios.map((s,i)=>`<div class="scenario"><b>Case ${i+1}</b><br>${esc(s)}</div>`).join('')}</section>
<section class="card" style="margin-top:14px"><h2>Final 5-hour mock strategy</h2><div class="grid"><div><h3>0:00–0:30</h3><p>Read the complete paper, allocate time by marks, flag source material and plan answer order.</p></div><div><h3>0:30–4:30</h3><p>Write. Keep issue/principle/application/action visible. Move on when the allocated time is exhausted.</p></div><div><h3>4:30–5:00</h3><p>Quality control: completeness, candidate details, file integrity, citations where needed and submission readiness.</p></div><div><h3>After the mock</h3><p>Update your error log and drill only the weak topics instead of repeatedly rereading material you already know.</p></div></div></section>
<div class="notice"><b>Integrity rule:</b> PPRA's 2026 take-home instructions prohibit AI tools during the live examination. PDEReady Premium is strictly a pre-exam preparation product.</div>
<p class="small">Transaction reference: ${esc(payload.tx)} • Access expires ${esc(expiry)} • <a href="/terms">Terms</a> • <a href="/privacy">Privacy</a> • <a href="/refunds">Refunds</a></p>
</main><script>document.getElementById('errors').value=localStorage.getItem('pdeready.premium.errors')||'';</script></body></html>`;
}

module.exports = async function handler(req, res) {
  const { appSecret, configured } = credentials();
  if (!configured) return res.status(503).send('Payment access is not configured on this deployment.');
  const token = cookieValue(req, 'pdeready_entitlement');
  const verified = verifyEntitlement(token, appSecret);
  if (!verified) {
    res.statusCode = 302;
    res.setHeader('Location', '/pdeready/premium');
    return res.end();
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(roomHtml(verified.product, verified.payload));
};
