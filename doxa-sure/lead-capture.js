import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const form = document.getElementById('leadForm');
const message = document.getElementById('leadMessage');
const config = window.DOXA_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const client = configured ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const FABRIC_OWNED = 'https://fabric.izakhonoafrica.co.za';
const FABRIC_EXTERNAL = 'https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-gateway-event';

async function fabricPost(url, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok || response.status === 202, status: response.status, ...data };
  } catch (error) {
    return { ok: false, error: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function mirrorLeadToFabric(reference, data) {
  const body = {
    platform_id: 'doxa-sure',
    event_type: 'lead.created',
    subject_ref: String(reference || ('lead-' + Date.now())).slice(0, 180),
    contact: {
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim().toLowerCase(),
      phone: String(data.get('phone') || '').trim(),
      company: '',
      role: 'protection / financial-resilience enquiry',
      source: 'doxa-sure-public-lead'
    },
    opportunity: {
      title: 'DOXA-SURE protection enquiry',
      value: 0,
      currency: 'ZAR',
      source: 'doxa-sure-public-lead'
    },
    note: [
      String(data.get('interest') || ''),
      window.doxaRiskLevel ? 'risk level: ' + window.doxaRiskLevel : '',
      String(data.get('message') || '')
    ].filter(Boolean).join(' · ').slice(0, 1000)
  };
  const primary = await fabricPost(FABRIC_OWNED + '/api/fabric/intake', body, 1200);
  if (primary.ok) return {...primary, route: 'owned-primary'};
  const external = await fabricPost(FABRIC_EXTERNAL, {...body, fabric_bridge: true}, 3000);
  return external.ok ? {...external, route: 'external-resilience'} : {ok:false, route:'unavailable'};
}

function setMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}

document.querySelectorAll('[data-lead-interest]').forEach((button) => {
  button.addEventListener('click', () => {
    form.elements.interest.value = button.dataset.leadInterest;
    document.getElementById('lead-capture').scrollIntoView({ behavior: 'smooth' });
  });
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!client) {
    setMessage('Secure lead capture is awaiting backend activation. Please try again after launch setup is complete.', true);
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setMessage('Sending securely…');
  const data = new FormData(form);
  try {
    const { data: reference, error } = await client.rpc('doxa_submit_pilot_lead', {
      p_name: data.get('name'), p_email: data.get('email'), p_phone: data.get('phone') || null,
      p_interest: data.get('interest'), p_risk_level: window.doxaRiskLevel || null,
      p_asset_type: document.getElementById('asset')?.value || null, p_message: data.get('message') || null,
      p_consent: data.get('consent') === 'on', p_website: data.get('website') || null
    });
    if (error) throw error;
    await mirrorLeadToFabric(reference, data).catch(() => null);
    form.reset();
    setMessage(`Received securely. Your reference is ${reference}. We will reply by email.`);
  } catch (error) {
    setMessage(error.message || 'We could not submit your enquiry. Please try again.', true);
  } finally {
    submit.disabled = false;
  }
});
