import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const $ = (id) => document.getElementById(id);
const config = window.DOXA_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const client = configured ? createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;
let leads = [];
const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function show(id, visible=true){ $(id).classList.toggle('hidden', !visible); }
function msg(text,error=false){ $('deskMessage').textContent=text||''; $('deskMessage').classList.toggle('error',error); }
async function load(){
  const { data: admin, error: adminError } = await client.from('doxa_admins').select('user_id').maybeSingle();
  if(adminError || !admin){ show('login',false); show('desk',false); show('signOut'); show('setup'); $('setup').innerHTML='<h2>Access not authorised</h2><p>This signed-in account is not enrolled as a DOXA-SURE administrator.</p>'; return; }
  show('setup',false); show('login',false); show('desk'); show('signOut'); msg('Loading…');
  const { data, error } = await client.from('doxa_pilot_leads').select('*').order('created_at',{ascending:false}).limit(250);
  if(error){ msg(error.message,true); return; } leads=data||[]; render(); msg('');
}
function render(){
  $('newCount').textContent=leads.filter(x=>x.status==='new').length; $('urgentCount').textContent=leads.filter(x=>['red','critical'].includes(x.risk_level)).length; $('totalCount').textContent=leads.length;
  const filter=$('statusFilter').value; const visible=filter?leads.filter(x=>x.status===filter):leads;
  $('leadList').innerHTML=visible.length?visible.map(x=>`<article class="lead"><div><h3>${esc(x.name)} · ${esc(x.reference)}</h3><div class="meta">${new Date(x.created_at).toLocaleString('en-ZA')} · ${esc(x.interest.replaceAll('_',' '))}</div><p><a href="mailto:${encodeURIComponent(x.email)}">${esc(x.email)}</a>${x.phone?` · ${esc(x.phone)}`:''}</p>${x.risk_level?`<p class="risk ${esc(x.risk_level)}">Risk: ${esc(x.risk_level)}</p>`:''}${x.asset_type?`<p>Asset: ${esc(x.asset_type)}</p>`:''}${x.message?`<p>${esc(x.message)}</p>`:''}</div><div class="lead-actions"><label>Status<select data-status="${x.id}">${['new','contacted','qualified','closed'].map(s=>`<option ${s===x.status?'selected':''}>${s}</option>`).join('')}</select></label></div></article>`).join(''):'<div class="card">No leads match this view.</div>';
  document.querySelectorAll('[data-status]').forEach(el=>el.addEventListener('change',()=>updateStatus(el.dataset.status,el.value)));
}
async function updateStatus(id,status){ const {error}=await client.from('doxa_pilot_leads').update({status,updated_at:new Date().toISOString()}).eq('id',id); if(error) return msg(error.message,true); const lead=leads.find(x=>x.id===id); if(lead) lead.status=status; render(); msg('Status saved.'); }
$('loginForm').addEventListener('submit',async e=>{ e.preventDefault(); const email=new FormData(e.currentTarget).get('email'); $('loginMessage').textContent='Sending…'; const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.href.split('#')[0].split('?')[0]}}); $('loginMessage').textContent=error?error.message:'Secure sign-in link sent. Check your email.'; $('loginMessage').classList.toggle('error',Boolean(error)); });
$('refresh').addEventListener('click',load); $('statusFilter').addEventListener('change',render); $('signOut').addEventListener('click',async()=>{await client.auth.signOut(); location.reload();});
if(!configured){show('login',false);show('setup');}else{const {data:{session}}=await client.auth.getSession();if(session)await load();client.auth.onAuthStateChange((_e,s)=>{if(s)load();});}
