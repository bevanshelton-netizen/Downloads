(() => {
  'use strict';

  const SUPABASE_URL = 'https://yfawrenhudjomhnglfhq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_3KY--8Y_uuKEdfdumC2txg__OWTRo2p';
  const WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.85';
  const MODEL_PRIMARY = 'SmolLM2-360M-Instruct-q4f16_1-MLC';
  const MODEL_FALLBACK = 'SmolLM2-360M-Instruct-q4f32_1-MLC';

  let aiEngine = null;
  let aiLoading = false;
  let aiMode = false;

  const css = document.createElement('style');
  css.textContent = [
    '.doxa-live-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:20px;align-items:start}',
    '.doxa-form{display:grid;gap:13px}.doxa-form label{display:grid;gap:6px;font-weight:850}',
    '.doxa-form input,.doxa-form select,.doxa-form textarea{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:13px;background:#09090e;color:#f7f7fb;font:inherit}',
    '.doxa-form textarea{min-height:110px;resize:vertical}.doxa-form .consent{display:flex;gap:9px;align-items:flex-start;font-weight:650;color:#d2d3d9}',
    '.doxa-form .consent input{width:auto;margin-top:4px}.doxa-status{min-height:24px;color:var(--muted);font-size:.88rem}',
    '.doxa-status.ok{color:#8cf0b4}.doxa-status.bad{color:#ff9ca9}.doxa-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}',
    '.ai-mode-box{margin:12px 0 0;padding:12px 14px;border:1px solid rgba(192,120,255,.24);border-radius:14px;background:rgba(141,54,255,.07);font-size:.8rem;color:#d7d7df}',
    '.ai-mode-box strong{color:#fff}.ai-mode-progress{height:7px;background:#1d1d26;border-radius:999px;overflow:hidden;margin-top:9px}',
    '.ai-mode-progress i{display:block;width:0;height:100%;background:linear-gradient(90deg,#7c2cff,#c078ff);transition:width .18s}',
    '.ai-chip{border:1px solid rgba(192,120,255,.32)!important;background:rgba(141,54,255,.13)!important;color:#eadbff!important}',
    '.ai-chip.active{background:linear-gradient(135deg,#a94dff,#671bd7)!important;color:#fff!important}',
    '.dashboard-link{display:inline-flex;margin-top:12px}',
    '@media(max-width:980px){.doxa-live-grid{grid-template-columns:1fr}}'
  ].join('');
  document.head.appendChild(css);

  const offers = document.getElementById('offers');
  if (offers && !document.getElementById('request')) {
    offers.insertAdjacentHTML('afterend', [
      '<section id="request" class="section">',
      '<div class="wrap">',
      '<div class="head"><div class="eyebrow">Secure service request</div>',
      '<h2 class="grad">Ready for the next step?</h2>',
      '<p class="muted">The AI Help Desk can answer questions immediately. When you want the R199 Pack, Shield or a structured follow-up, submit this email-first request. No personal phone number is required.</p></div>',
      '<div class="doxa-live-grid">',
      '<aside class="card"><div class="eyebrow">What happens next</div><h3>One reference. One organised case.</h3>',
      '<p class="muted">Your request is stored in the protected DOXA-SURE pilot backend. We collect only the minimum details needed to identify the request and service requested.</p>',
      '<ul class="list"><li>Questions can stay with the on-site AI Help Desk.</li><li>No banking passwords, PINs, login credentials or ID numbers.</li><li>Urgent legal matters still need the appropriate qualified professional.</li></ul>',
      '<a class="btn silverbtn dashboard-link" href="../index.html">OPEN SHIELD DASHBOARD</a></aside>',
      '<section class="card"><form id="doxaRequestForm" class="doxa-form">',
      '<label>Your name<input id="doxaName" maxlength="80" autocomplete="name" required></label>',
      '<label>Email<input id="doxaEmail" type="email" maxlength="254" autocomplete="email" required></label>',
      '<label>What do you need?<select id="doxaInterest"><option value="free_check">Help understanding my free risk check</option><option value="rescue_pack">R199 Rescue Readiness Pack</option><option value="shield">R99/month DOXA-SURE Shield</option><option value="general_question">General DOXA-SURE question</option></select></label>',
      '<label>Short message (optional)<textarea id="doxaMessage" maxlength="1000" placeholder="Do not include banking passwords, PINs, account login details or ID numbers."></textarea></label>',
      '<label class="doxa-honeypot" aria-hidden="true">Website<input id="doxaWebsite" tabindex="-1" autocomplete="off"></label>',
      '<label class="consent"><input id="doxaConsent" type="checkbox" required><span>I consent to DOXA-SURE using these details to handle this pilot request under the Privacy & POPIA Notice.</span></label>',
      '<button id="doxaRequestButton" class="btn" type="submit">SUBMIT SECURE REQUEST</button>',
      '<div id="doxaRequestStatus" class="doxa-status" role="status" aria-live="polite"></div>',
      '</form></section></div></div></section>'
    ].join(''));
    const nav = document.querySelector('.navlinks');
    if (nav) nav.insertAdjacentHTML('beforeend', '<a href="#request">Get help</a>');
  }

  function currentRisk() {
    const badge = document.querySelector('#riskResult .badge');
    if (!badge) return null;
    const txt = badge.textContent.toLowerCase();
    return ['green', 'amber', 'red', 'critical'].find(x => txt.includes(x)) || null;
  }

  async function submitLead(event) {
    event.preventDefault();
    const button = document.getElementById('doxaRequestButton');
    const status = document.getElementById('doxaRequestStatus');
    button.disabled = true;
    status.className = 'doxa-status';
    status.textContent = 'Saving your request securely...';

    const body = {
      p_name: document.getElementById('doxaName').value.trim(),
      p_email: document.getElementById('doxaEmail').value.trim(),
      p_phone: null,
      p_interest: document.getElementById('doxaInterest').value,
      p_risk_level: currentRisk(),
      p_asset_type: document.getElementById('asset') ? document.getElementById('asset').value : null,
      p_message: document.getElementById('doxaMessage').value.trim() || null,
      p_consent: document.getElementById('doxaConsent').checked,
      p_website: document.getElementById('doxaWebsite').value
    };

    try {
      const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/doxa_submit_pilot_lead', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error((payload && (payload.message || payload.hint)) || 'Unable to save the request.');
      const ref = typeof payload === 'string' ? payload : String(payload || 'RECEIVED');
      status.className = 'doxa-status ok';
      status.textContent = ref === 'RECEIVED' ? 'Request received.' : 'Request saved. Your DOXA-SURE reference is ' + ref + '.';
      document.getElementById('doxaRequestForm').reset();
      if (typeof window.addMsg === 'function') {
        window.addMsg('Your secure DOXA-SURE request has been recorded' + (ref !== 'RECEIVED' ? ' as ' + ref : '') + '. You can keep asking me questions here while the request stays organised.', 'bot', true);
      }
    } catch (err) {
      status.className = 'doxa-status bad';
      status.textContent = String((err && err.message) || 'Unable to save the request. Please try again.');
    } finally {
      button.disabled = false;
    }
  }

  const requestForm = document.getElementById('doxaRequestForm');
  if (requestForm) requestForm.addEventListener('submit', submitLead);

  const controls = document.querySelector('.chatControls');
  if (controls && !document.getElementById('doxaAiMode')) {
    controls.insertAdjacentHTML('afterbegin', '<button class="voice ai-chip" id="doxaAiMode" type="button" title="Load private device-local AI">✨ Full AI</button>');
  }
  const chatHead = document.querySelector('.chatHead');
  if (chatHead && !document.getElementById('doxaAiBox')) {
    chatHead.insertAdjacentHTML('afterend', [
      '<div class="ai-mode-box" id="doxaAiBox">',
      '<strong>Guided AI is ready now.</strong> Full AI mode is optional and runs a small language model on your device where WebGPU is supported. First load is roughly 0.4 GB. After loading, prompts stay on your device; model files come from WebLLM/Hugging Face distribution infrastructure.',
      '<div class="ai-mode-progress"><i id="doxaAiProgress"></i></div>',
      '<div id="doxaAiStatus" style="margin-top:7px">Tap Full AI only if you want the additional download.</div>',
      '</div>'
    ].join(''));
  }

  const DOXA_SYSTEM = [
    'You are the DOXA-SURE AI Help Desk, a concise device-local informational assistant for a South African founding pilot.',
    'Verified facts: Free Asset Risk Check R0; Rescue Readiness Pack R199 once-off founding pilot; DOXA-SURE Shield R99/month founding pilot.',
    'DOXA-SURE is an assistance, early-warning and case-organisation pilot. It is not an insurer, insurance policy, law firm, debt-counselling service or financial-product advisory service.',
    'Never guarantee an outcome. Never claim DOXA-SURE can stop a bank, cancel debt, force a lender concession, prevent repossession, approve an insurance claim or save an asset.',
    'If the user mentions summons, court papers, sheriff, repossession, sale in execution, auction, a Section 129/default notice or another legal deadline, clearly tell them to seek suitably qualified professional help urgently and that deadlines may continue.',
    'Credit-life/payment-protection cover may exist depending on the policy. Advise users to locate the agreement/policy and ask the provider. Never guarantee a claim.',
    'Never ask for banking passwords, PINs, security answers, online-banking logins, card secrets, ID numbers or account authentication credentials.',
    'DOXA-SURE online checkout is not live yet. Do not instruct anyone to pay until a verified DOXA-SURE merchant route is activated.',
    'You have no live web access, private account access or authority to contact lenders, insurers, courts or professionals.',
    'Use the user language where practical. Keep responses practical and usually under 180 words. Ask at most one useful follow-up question when needed.'
  ].join('\n');

  function progressFromText(text) {
    const m = String(text || '').match(/(\d+(?:\.\d+)?)%/);
    return m ? Math.max(0, Math.min(100, Number(m[1]))) : null;
  }

  async function createEngine(webllm, id) {
    return webllm.CreateMLCEngine(id, {
      initProgressCallback: p => {
        const status = document.getElementById('doxaAiStatus');
        const bar = document.getElementById('doxaAiProgress');
        if (status) status.textContent = p.text || 'Loading device AI...';
        const pct = progressFromText(p.text);
        if (bar && pct !== null) bar.style.width = pct + '%';
      }
    });
  }

  async function loadAi() {
    if (aiMode || aiLoading) return;
    const button = document.getElementById('doxaAiMode');
    const status = document.getElementById('doxaAiStatus');
    const bar = document.getElementById('doxaAiProgress');

    if (!('gpu' in navigator)) {
      if (status) status.textContent = 'Full AI mode needs a WebGPU-capable browser. Guided AI and voice remain available.';
      return;
    }

    aiLoading = true;
    button.disabled = true;
    button.textContent = 'Loading AI...';
    if (typeof window.setAvatarState === 'function') window.setAvatarState('thinking', 'Loading private AI...');

    try {
      const webllm = await import(WEBLLM_URL);
      try {
        aiEngine = await createEngine(webllm, MODEL_PRIMARY);
      } catch (firstError) {
        if (status) status.textContent = 'Trying the compatibility build...';
        if (bar) bar.style.width = '0%';
        aiEngine = await createEngine(webllm, MODEL_FALLBACK);
      }
      aiMode = true;
      button.classList.add('active');
      button.textContent = '✨ Full AI on';
      if (bar) bar.style.width = '100%';
      if (status) status.textContent = 'Full AI ready on this device. Prompts are processed locally after model load.';
      if (typeof window.setAvatarState === 'function') window.setAvatarState('idle', 'Full AI ready');
      if (typeof window.addMsg === 'function') {
        window.addMsg('Full AI mode is ready on this device. I can now handle broader DOXA-SURE questions while keeping the pilot boundaries in place.', 'bot', true);
      }
    } catch (err) {
      aiEngine = null;
      aiMode = false;
      button.textContent = '✨ Full AI';
      if (bar) bar.style.width = '0%';
      if (status) status.textContent = 'Full AI could not load on this device. Guided AI and voice are still available.';
      if (typeof window.setAvatarState === 'function') window.setAvatarState('idle', 'Guided AI ready');
    } finally {
      aiLoading = false;
      button.disabled = false;
    }
  }

  const aiButton = document.getElementById('doxaAiMode');
  if (aiButton) aiButton.addEventListener('click', loadAi);

  function unsafeOutput(text) {
    return /\b(guarantee(?:d)? to save|we will stop the bank|we can stop the bank|cancel your debt|your claim will be approved|cannot repossess|will prevent repossession)\b/i.test(text);
  }

  async function fullAiAsk(raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    if (!aiMode || !aiEngine) {
      if (typeof window.ask === 'function') return window.ask(text);
      return;
    }

    if (typeof window.addMsg === 'function') window.addMsg(text, 'user', false);
    if (typeof window.setAvatarState === 'function') window.setAvatarState('thinking', 'Thinking locally...');

    const grounded = typeof window.responseFor === 'function' ? window.responseFor(text) : '';
    const risky = /\b(summons|court|sheriff|auction|execution|repossession|section\s*129|default notice|credit life|claim|insurance|debt counsel|debt review|payfast|payment|refund|bond|mortgage|vehicle finance|arrears)\b/i.test(text);
    const userPrompt = risky
      ? 'User question: ' + text + '\n\nMandatory reference guidance from DOXA-SURE verified rules:\n' + grounded + '\n\nAnswer using the mandatory guidance. Do not contradict it or add promises, legal conclusions, payment instructions or regulated advice.'
      : 'User question: ' + text + '\n\nIf this is outside DOXA-SURE verified scope, say so clearly rather than inventing facts.';

    try {
      const result = await aiEngine.chat.completions.create({
        messages: [
          { role: 'system', content: DOXA_SYSTEM },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.25,
        max_tokens: 420
      });
      let answer = String(result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content || '').trim();
      if (!answer || unsafeOutput(answer)) {
        answer = grounded || 'I cannot safely answer that beyond DOXA-SURE verified pilot guidance. Please use the Free Asset Risk Check and seek the appropriate qualified professional if the matter is urgent.';
      }
      if (typeof window.addMsg === 'function') window.addMsg(answer, 'bot', true);
    } catch (err) {
      const fallback = grounded || 'Full AI had a problem on this device. Guided AI is still available for DOXA-SURE questions.';
      if (typeof window.addMsg === 'function') window.addMsg(fallback, 'bot', true);
    }
  }

  const chatForm = document.getElementById('chatForm');
  if (chatForm) {
    chatForm.addEventListener('submit', event => {
      if (!aiMode) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const input = document.getElementById('chatInput');
      const value = input.value;
      input.value = '';
      fullAiAsk(value);
    }, true);
  }

  document.querySelectorAll('[data-question]').forEach(el => {
    el.addEventListener('click', event => {
      if (!aiMode) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector('#help').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => fullAiAsk(el.dataset.question), 320);
    }, true);
  });

  const health = document.createElement('meta');
  health.name = 'doxa-live-backend';
  health.content = 'secure-leads-live;device-ai-optional;payments-gated';
  document.head.appendChild(health);
})();