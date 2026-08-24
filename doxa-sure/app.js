import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const $ = (id) => document.getElementById(id);
const config = window.DOXA_CONFIG || {};
const hasLiveConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const forcedDemo = config.mode === 'demo';
const live = hasLiveConfig && !forcedDemo;
const supabase = live ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

const state = { user: null, profile: null, membership: null, assets: [], documents: [], cases: [], actions: [] };
const demoKey = 'doxa_sure_demo_v1';

function currency(value) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(Number(value || 0));
}
function esc(value='') { return String(value).replace(/[&<>'\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','\"':'&quot;'}[c])); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function setMessage(id, message, error=false) { const el=$(id); if(!el) return; el.textContent=message || ''; el.classList.toggle('error', error); }
function numeric(id) { const value=$(id).value; return value === '' ? null : Number(value); }
function showDashboard(show=true) { $('publicView').classList.toggle('hidden', show); $('dashboardView').classList.toggle('hidden', !show); $('signOutBtn').classList.toggle('hidden', !show); $('dashboardNavBtn').classList.toggle('hidden', !show); if(show) window.scrollTo({top:0,behavior:'smooth'}); }
function openAuth() { $('email').focus(); $('authCard').scrollIntoView({behavior:'smooth', block:'center'}); }
function openRescue() { if(!state.user) return openAuth(); $('rescueDialog').showModal(); }

function emptyDemo() {
  return { email:'', consent:false, profile:{phone:'',employment_type:'',monthly_income:null}, membership:{status:'active',distress_status:'none',protection_score:20,exposed_value:0}, assets:[], documents:[], cases:[], actions:[] };
}
function readDemo() { try { return {...emptyDemo(), ...JSON.parse(localStorage.getItem(demoKey) || '{}')}; } catch { return emptyDemo(); } }
function writeDemo(data) { localStorage.setItem(demoKey, JSON.stringify(data)); }
function demoScore(data) {
  const assets=data.assets||[]; const red=assets.filter(a=>a.status==='red').length; const amber=assets.filter(a=>a.status==='amber').length;
  const arrears=assets.reduce((s,a)=>s+Math.min(Number(a.arrears_count||0),4),0); const docs=(data.documents||[]).length;
  let score=Math.max(0,40-Math.min(40,arrears*10)); score += assets.length ? Math.max(0,30-red*15-amber*7) : 5;
  score += ({permanent:20,contract:15,self_employed:12,other:8,unemployed:0}[data.profile?.employment_type] ?? 5); score += Math.min(10,docs*2);
  return Math.max(0,Math.min(100,score));
}
function refreshDemoMetrics(data) { data.membership.protection_score=demoScore(data); data.membership.exposed_value=(data.assets||[]).reduce((s,a)=>s+Number(a.outstanding_balance||0),0); return data; }

async function ensureLiveMember() {
  const { error } = await supabase.rpc('doxa_ensure_member');
  if (error) throw new Error(`DOXA-SURE database is not ready yet: ${error.message}`);
}

async function signIn(email) {
  if (!live) {
    const data=readDemo(); data.email=email; writeDemo(data); state.user={id:'demo-user',email}; await loadAll(); return {demo:true};
  }
  const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: window.location.href.split('#')[0].split('?')[0] } });
  if(error) throw error;
  return {demo:false};
}

async function signOut() {
  if (live) await supabase.auth.signOut();
  state.user=null; showDashboard(false); $('email').value=''; setMessage('authMessage','');
}

async function loadSession() {
  if (!live) {
    const data=readDemo();
    if(data.email){ state.user={id:'demo-user',email:data.email}; await loadAll(); }
    return;
  }
  const { data:{session} } = await supabase.auth.getSession();
  if(session?.user){ state.user=session.user; await ensureLiveMember(); await loadAll(); }
  supabase.auth.onAuthStateChange(async (_event, sessionNow) => {
    if(sessionNow?.user){ state.user=sessionNow.user; await ensureLiveMember(); await loadAll(); }
    else { state.user=null; showDashboard(false); }
  });
}

async function loadAll() {
  if(!state.user) return;
  if(!live){
    const data=refreshDemoMetrics(readDemo()); writeDemo(data);
    state.profile={id:'demo-user',email:data.email,...data.profile}; state.membership=data.membership; state.assets=data.assets; state.documents=data.documents; state.cases=data.cases; state.actions=data.actions;
  } else {
    const [profileRes,membershipRes,assetsRes,docsRes,casesRes,actionsRes] = await Promise.all([
      supabase.from('doxa_profiles').select('*').single(),
      supabase.from('doxa_memberships').select('*').single(),
      supabase.from('doxa_assets').select('*').order('created_at',{ascending:false}),
      supabase.from('doxa_documents').select('*').order('uploaded_at',{ascending:false}),
      supabase.from('doxa_rescue_cases').select('*').order('created_at',{ascending:false}),
      supabase.from('doxa_rescue_actions').select('*').order('created_at',{ascending:true})
    ]);
    const firstError=[profileRes,membershipRes,assetsRes,docsRes,casesRes,actionsRes].find(r=>r.error)?.error;
    if(firstError) throw firstError;
    state.profile=profileRes.data; state.membership=membershipRes.data; state.assets=assetsRes.data||[]; state.documents=docsRes.data||[]; state.cases=casesRes.data||[]; state.actions=actionsRes.data||[];
  }
  render(); showDashboard(true); await maybeConsent();
}

async function maybeConsent() {
  if(!state.user) return;
  let hasConsent=false;
  if(!live) hasConsent=Boolean(readDemo().consent);
  else {
    const {data,error}=await supabase.from('doxa_consents').select('id').eq('consent_type','privacy').eq('consent_version','pilot-v1').eq('granted',true).limit(1);
    if(error) throw error; hasConsent=(data||[]).length>0;
  }
  if(!hasConsent && !$('consentDialog').open) $('consentDialog').showModal();
}

function render() {
  const email=state.user?.email||state.profile?.email||''; $('welcome').textContent=email ? `Protection dashboard — ${email.split('@')[0]}` : 'Protection dashboard';
  $('phone').value=state.profile?.phone||''; $('employment').value=state.profile?.employment_type||''; $('income').value=state.profile?.monthly_income??'';
  const score=Number(state.membership?.protection_score||0); $('scoreValue').textContent=score; $('scoreRing').style.setProperty('--score',score);
  $('exposedValue').textContent=currency(state.membership?.exposed_value||0); $('distressStatus').textContent=String(state.membership?.distress_status||'none').replaceAll('_',' ').toUpperCase();
  renderAssets(); renderDocuments(); renderCases();
}

function renderAssets() {
  if(!state.assets.length){ $('assetList').innerHTML='<p class="empty">No assets yet. Add only what you want DOXA-SURE to track.</p>'; return; }
  $('assetList').innerHTML=state.assets.map(a=>`<div class="list-item"><div class="list-item-head"><div><strong>${esc(a.label||a.type)}</strong><div class="meta">${esc(a.type)}${a.lender_name?` • ${esc(a.lender_name)}`:''}</div></div><span class="risk ${esc(a.status)}">${esc(a.status).toUpperCase()}</span></div><div class="meta">Balance ${currency(a.outstanding_balance)} • Instalment ${currency(a.monthly_instalment)} • Missed ${Number(a.arrears_count||0)}</div></div>`).join('');
}
function renderDocuments() {
  if(!state.documents.length){ $('documentList').innerHTML='<p class="empty">No documents yet.</p>'; return; }
  $('documentList').innerHTML=state.documents.slice(0,8).map(d=>`<div class="list-item"><strong>${esc(d.type).replaceAll('_',' ')}</strong><div class="meta">${esc(d.original_name||d.object_path||'Private document')}</div></div>`).join('');
}
function renderCases() {
  if(!state.cases.length){ $('caseList').innerHTML='<p class="empty">No rescue cases yet. Use SAVE MY ASSET as soon as a financial shock appears.</p>'; return; }
  $('caseList').innerHTML=state.cases.map(c=>{
    const actions=state.actions.filter(a=>a.rescue_case_id===c.id);
    return `<article class="case-block"><div class="case-title"><div><strong>${esc(c.case_number)}</strong><div class="meta">${esc(c.trigger_type).replaceAll('_',' ')} • ${new Date(c.created_at).toLocaleString('en-ZA')}</div></div><span class="risk ${esc(c.severity)}">${esc(c.severity).toUpperCase()}</span></div><div class="case-actions">${actions.map(a=>`<div class="action-row"><div><strong>${esc(a.title)}</strong><div class="meta">${esc(a.status).replaceAll('_',' ')}${a.is_regulated_activity?' • professional action':''}</div></div>${a.owner==='customer'&&a.status!=='completed'?`<button class="btn mini" data-action-complete="${a.id}">Mark done</button>`:''}</div>`).join('')||'<div class="meta">Plan actions are being prepared.</div>'}</div></article>`;
  }).join('');
  document.querySelectorAll('[data-action-complete]').forEach(btn=>btn.addEventListener('click',()=>completeAction(btn.dataset.actionComplete)));
}

async function saveProfile() {
  const patch={phone:$('phone').value.trim()||null,employment_type:$('employment').value||null,monthly_income:numeric('income')};
  if(!live){ const data=readDemo(); data.profile={...data.profile,...patch}; writeDemo(refreshDemoMetrics(data)); }
  else { const {error}=await supabase.from('doxa_profiles').update(patch).eq('id',state.user.id); if(error) throw error; }
  await loadAll();
}
async function addAsset() {
  const asset={type:$('assetType').value,status:$('assetStatus').value,label:$('assetLabel').value.trim()||null,lender_name:$('lenderName').value.trim()||null,outstanding_balance:numeric('balance'),monthly_instalment:numeric('instalment'),arrears_count:Number($('arrearsCount').value||0),arrears_amount:Number($('arrearsAmount').value||0),has_credit_life:$('creditLife').value===''?null:$('creditLife').value==='true'};
  if(!live){ const data=readDemo(); data.assets.unshift({id:uid(),...asset,created_at:new Date().toISOString()}); writeDemo(refreshDemoMetrics(data)); }
  else { const {error}=await supabase.from('doxa_assets').insert({user_id:state.user.id,...asset}); if(error) throw error; }
  $('assetForm').reset(); $('arrearsCount').value='0'; $('arrearsAmount').value='0'; await loadAll();
}
async function uploadDocument() {
  const file=$('documentFile').files[0]; if(!file) throw new Error('Choose a file first.'); if(file.size>10*1024*1024) throw new Error('File is larger than 10 MB.');
  const type=$('documentType').value;
  if(!live){ const data=readDemo(); data.documents.unshift({id:uid(),type,object_path:file.name,original_name:file.name,uploaded_at:new Date().toISOString()}); writeDemo(refreshDemoMetrics(data)); setMessage('documentMessage','Demo mode: document name recorded, file itself was not uploaded.'); }
  else {
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path=`${state.user.id}/${uid()}-${safe}`;
    const {error:uploadError}=await supabase.storage.from('doxa-vault-docs').upload(path,file,{upsert:false}); if(uploadError) throw uploadError;
    const {error:metaError}=await supabase.from('doxa_documents').insert({user_id:state.user.id,type,bucket:'doxa-vault-docs',object_path:path,original_name:file.name}); if(metaError){ await supabase.storage.from('doxa-vault-docs').remove([path]); throw metaError; }
    setMessage('documentMessage','Uploaded privately.');
  }
  $('documentForm').reset(); await loadAll();
}
async function createRescue() {
  const trigger=$('triggerType').value; const notes=$('rescueNotes').value.trim()||null;
  if(!live){
    const data=refreshDemoMetrics(readDemo()); const maxArrears=Math.max(0,...data.assets.map(a=>Number(a.arrears_count||0))); const hasHome=data.assets.some(a=>a.type==='home'); const hasVehicle=data.assets.some(a=>a.type==='vehicle'); const hasS129=data.documents.some(d=>d.type==='s129_notice');
    let severity='low'; if(trigger==='legal_letter'||hasS129) severity='critical'; else if(maxArrears>=2||['retrenchment','disability','business_collapse'].includes(trigger)) severity='high'; else if(maxArrears===1||['reduced_income','missed_payment'].includes(trigger)) severity='medium';
    const caseId=uid(); const caseNumber=`DS-${new Date().getFullYear()}-${String(data.cases.length+1).padStart(6,'0')}`; data.cases.unshift({id:caseId,case_number:caseNumber,trigger_type:trigger,severity,status:'action_required',created_at:new Date().toISOString(),snapshot:{captured_at:new Date().toISOString(),score:data.membership.protection_score,exposed_value:data.membership.exposed_value,assets:data.assets},customer_notes:notes});
    const add=(type,title,risk,owner='customer',regulated=false)=>data.actions.push({id:uid(),rescue_case_id:caseId,type,title,risk_level:risk,status:'pending',owner,is_regulated_activity:regulated,created_at:new Date().toISOString()});
    add('budget_freeze','Stabilise household cash flow',severity); add('credit_life_check','Check existing credit-life or payment protection',severity);
    if(hasHome) add('mortgage_hardship_engagement','Prepare early home-loan hardship engagement',severity,'doxa_sure'); if(hasVehicle) add('vehicle_hardship_engagement','Prepare early vehicle-finance hardship engagement',severity,'doxa_sure'); if(maxArrears>=2) add('debt_support_assessment','Assess whether regulated debt support is appropriate','high','doxa_sure'); if(trigger==='legal_letter'||hasS129) add('attorney_review','Urgent legal-document review','critical','professional',true); if(!data.documents.length) add('document_request','Upload your key finance documents',severity);
    data.membership.distress_status='active_case'; writeDemo(data);
  } else {
    const {error}=await supabase.rpc('doxa_create_rescue_case',{p_trigger_type:trigger,p_notes:notes}); if(error) throw error;
  }
  $('rescueNotes').value=''; $('rescueDialog').close(); await loadAll();
}
async function completeAction(id) {
  try {
    if(!live){ const data=readDemo(); const action=data.actions.find(a=>a.id===id); if(action){ action.status='completed'; action.completed_at=new Date().toISOString(); } writeDemo(data); }
    else { const {error}=await supabase.rpc('doxa_set_my_action_status',{p_action_id:id,p_status:'completed',p_notes:null}); if(error) throw error; }
    await loadAll();
  } catch(e){ alert(e.message); }
}

$('authForm').addEventListener('submit',async(e)=>{ e.preventDefault(); const email=$('email').value.trim(); try{ setMessage('authMessage','Working…'); const result=await signIn(email); if(result.demo){ setMessage('authMessage','Demo Shield opened. Data stays only in this browser.'); } else setMessage('authMessage','Secure sign-in link sent. Check your email.'); }catch(err){ setMessage('authMessage',err.message,true); } });
$('profileForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await saveProfile();setMessage('profileMessage','Saved.');}catch(err){setMessage('profileMessage',err.message,true);}});
$('assetForm').addEventListener('submit',async(e)=>{e.preventDefault();try{await addAsset();setMessage('assetMessage','Added to your Vault.');}catch(err){setMessage('assetMessage',err.message,true);}});
$('documentForm').addEventListener('submit',async(e)=>{e.preventDefault();try{setMessage('documentMessage','Working…');await uploadDocument();}catch(err){setMessage('documentMessage',err.message,true);}});
$('rescueForm').addEventListener('submit',async(e)=>{e.preventDefault();try{setMessage('rescueMessage','Creating audited Rescue Case…');await createRescue();setMessage('rescueMessage','');}catch(err){setMessage('rescueMessage',err.message,true);}});
$('consentForm').addEventListener('submit',async(e)=>{ e.preventDefault(); try{ if(!live){const data=readDemo();data.consent=true;writeDemo(data);} else {const {error}=await supabase.from('doxa_consents').upsert({user_id:state.user.id,consent_type:'privacy',consent_version:'pilot-v1',granted:true,source:'web'},{onConflict:'user_id,consent_type,consent_version'});if(error)throw error;} $('consentDialog').close(); }catch(err){alert(err.message);} });
['heroRescueBtn','heroCheckBtn'].forEach(id=>$(id).addEventListener('click',()=>state.user?openRescue():openAuth()));
['rescueBtn','newCaseBtn'].forEach(id=>$(id).addEventListener('click',openRescue)); $('cancelRescue').addEventListener('click',()=>$('rescueDialog').close()); $('refreshBtn').addEventListener('click',()=>loadAll().catch(e=>alert(e.message))); $('signOutBtn').addEventListener('click',()=>signOut().catch(e=>alert(e.message))); $('dashboardNavBtn').addEventListener('click',()=>showDashboard(true));

if(!live){ $('modeBanner').textContent='Bootstrap demo mode — no paid services, no backend required, and uploaded files are NOT stored. Add the Supabase public anon key later to switch on live private storage.'; $('modeBanner').classList.remove('hidden'); }
loadSession().catch(err=>{ $('modeBanner').textContent=`Setup required: ${err.message}`; $('modeBanner').classList.remove('hidden'); });
