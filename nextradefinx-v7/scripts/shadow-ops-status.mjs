import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { evaluateEvidenceGate } from '../src/shadow/evidence-gate.mjs';

const policy = JSON.parse(await readFile(resolve(process.env.SHADOW_OPS_POLICY_PATH || './config/shadow-ops-policy.json'), 'utf8'));
let summary = {};
try { summary = JSON.parse(await readFile(resolve(process.env.SHADOW_SUMMARY_PATH || './data/live-shadow-summary.json'), 'utf8')); }
catch { summary = {}; }
const trackRecord = summary.track_record || summary.overall || {};
const evidence = evaluateEvidenceGate({ trackRecord, policy });
console.log(JSON.stringify({
  version: '0.7.0',
  provider: summary.provider || process.env.MARKET_DATA_PROVIDER || 'fixture',
  live_shadow_active: summary.mode === 'licensed_live_shadow_cycle',
  evidence,
  execution_enabled: false,
  client_visible: false,
  personalized_advice_enabled: false,
  claim_boundary: 'Internal evidence review only. Passing this gate would not itself authorize client advice, marketing claims or execution.'
}, null, 2));
