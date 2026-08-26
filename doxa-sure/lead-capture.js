import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const form = document.getElementById('leadForm');
const message = document.getElementById('leadMessage');
const config = window.DOXA_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const client = configured ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

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
    form.reset();
    setMessage(`Received securely. Your reference is ${reference}. We will reply by email.`);
  } catch (error) {
    setMessage(error.message || 'We could not submit your enquiry. Please try again.', true);
  } finally {
    submit.disabled = false;
  }
});
