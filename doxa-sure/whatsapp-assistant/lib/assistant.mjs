const MENU = `Welcome to DOXA-SURE Business Assistant. I can help you take the first safe step.\n\nReply with a number:\n1 — Home / bond pressure\n2 — Vehicle finance / repossession risk\n3 — Income reduced or stopped\n4 — Formal letter / Section 129 / summons / repossession notice\n5 — Free Asset Risk Check result\n6 — R199 Rescue Readiness Pack\n7 — R99/month DOXA-SURE Shield\n8 — Speak to a human\n\nPlease do not send banking passwords, PINs, online-banking logins or ID numbers.`;

const SAFE_BOUNDARY = `DOXA-SURE's founding assistant provides early-warning triage and case-organisation support. It is not an insurer, attorney, debt counsellor or financial adviser, and it cannot guarantee that an asset will be saved or that enforcement will stop.`;

const CRITICAL = `This may already involve a formal legal or enforcement process. Legal deadlines can continue to run. Please obtain suitably qualified professional assistance urgently. DOXA-SURE can help organise the factual file, but this chat does not stop a summons, repossession, court process or sale-in-execution timetable.`;

const INTAKE = `Please reply in one message with these five answers:\nA. What asset is at risk?\nB. Payments: current / 1 behind / 2 behind / 3+ behind / unsure\nC. Income: stable / reduced / stopped / illness-disability affected\nD. Documents: none / arrears letter / Section 129 / summons-court papers / repossession-auction notice\nE. Credit-life or payment-protection cover: yes / no / unsure\n\nDo not include passwords, PINs, ID numbers or full bank-account details.`;

export function normalize(text = '') {
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

function includesAny(text, words) {
  return words.some((w) => text.includes(w));
}

export function classifyIntent(input = '') {
  const text = normalize(input);
  if (!text) return 'welcome';
  if (includesAny(text, ['password', 'pin ', 'online banking login', 'otp'])) return 'sensitive';
  if (/^8\b/.test(text) || /\b(human|agent|person)\b/.test(text) || includesAny(text, ['call me', 'phone me', 'speak to a human'])) return 'human';
  if (/^4\b/.test(text) || includesAny(text, ['section 129', 's129', 'summons', 'court paper', 'court papers', 'auction', 'sale in execution', 'sale-in-execution', 'legal letter', 'repossession notice'])) return 'legal';
  if (/^(hi|hello|hey|menu|start|help|good morning|good afternoon|good evening)\b/.test(text)) return 'welcome';
  if (/^5\b/.test(text) || includesAny(text, ['asset risk check', 'risk check', 'green —', 'amber —', 'red —', 'critical —', 'green -', 'amber -', 'red -', 'critical -'])) return 'risk_result';
  if (/^6\b/.test(text) || /^pack\b/.test(text) || includesAny(text, ['r199', 'rescue readiness pack', 'readiness pack'])) return 'pack';
  if (/^7\b/.test(text) || /^shield\b/.test(text) || includesAny(text, ['r99', 'doxa-sure shield'])) return 'shield';
  if (/^1\b/.test(text) || includesAny(text, ['home', 'bond', 'mortgage', 'house'])) return 'home';
  if (/^2\b/.test(text) || includesAny(text, ['vehicle', 'car', 'vehicle finance', 'car finance', 'repossess'])) return 'vehicle';
  if (/^3\b/.test(text) || includesAny(text, ['income', 'retrenched', 'retrenchment', 'salary', 'job loss', 'lost my job', 'reduced income'])) return 'income';
  return 'general';
}

function detectRiskLevel(text = '') {
  const t = normalize(text);
  if (includesAny(t, ['critical', 'summons', 'court papers', 'court paper', 'repossession notice', 'auction', 'sale in execution', 'sale-in-execution'])) return 'critical';
  if (includesAny(t, ['red', 'section 129', 's129', '3 behind', '3+ behind', 'two behind', '2 behind'])) return 'red';
  if (includesAny(t, ['amber', '1 behind', 'one behind', 'income reduced', 'reduced income'])) return 'amber';
  if (includesAny(t, ['green', 'current'])) return 'green';
  return 'unknown';
}

function riskReply(text) {
  const level = detectRiskLevel(text);
  if (level === 'critical') return `${CRITICAL}\n\nIf you want DOXA-SURE to organise the factual file, reply PACK. If you need a human review request, reply HUMAN.`;
  if (level === 'red') return `Your message indicates a RED / urgent position. Act now rather than waiting for another missed payment. Gather the latest statement, formal notices, proof of any income change and a dated timeline of lender/provider communication.\n\nIf you want us to organise that information into the founding Rescue Readiness file, reply PACK.\n\n${SAFE_BOUNDARY}`;
  if (level === 'amber') return `Your message indicates an AMBER / act-early position. This is the stage where preparation can still create more options. Keep key statements together, record income changes and communication with the lender/provider, and confirm whether credit-life/payment protection exists.\n\nIf you want the R199 Rescue Readiness Pack, reply PACK.`;
  if (level === 'green') return `Your message indicates a GREEN / prepared position. Keep monitoring payment dates and keep key finance documents together. Confirm whether credit-life or payment-protection cover exists before a crisis develops. You can rerun the Free Asset Risk Check if circumstances change.`;
  return `I can help interpret the urgency category from the DOXA-SURE Free Asset Risk Check. Please send the result shown on the website (GREEN, AMBER, RED or CRITICAL) together with the asset type only. Do not send passwords, PINs or ID numbers.`;
}

export function buildReply(input = '') {
  const intent = classifyIntent(input);
  switch (intent) {
    case 'welcome':
      return { intent, reply: MENU, needsHuman: false };
    case 'home':
      return { intent, reply: `I can help you organise the first facts around home / bond pressure.\n\n${INTAKE}\n\nIf you have already received summons or court papers, reply LEGAL instead of waiting.`, needsHuman: false };
    case 'vehicle':
      return { intent, reply: `I can help you organise the first facts around vehicle-finance or repossession risk.\n\n${INTAKE}\n\nIf a repossession notice or court process is already underway, reply LEGAL.`, needsHuman: false };
    case 'income':
      return { intent, reply: `A sudden income change can affect several obligations at once. We will start by identifying what is most exposed and whether any credit-life/payment-protection cover may exist.\n\n${INTAKE}`, needsHuman: false };
    case 'legal':
      return { intent, reply: `${CRITICAL}\n\nTell me only the document type and any visible response/court date. Do not send passwords, PINs or full identity/banking details here.`, needsHuman: true, urgent: true };
    case 'risk_result':
      return { intent, reply: riskReply(input), needsHuman: detectRiskLevel(input) === 'critical', urgent: detectRiskLevel(input) === 'critical' };
    case 'pack':
      return { intent, reply: `The founding DOXA-SURE Rescue Readiness Pack is R199 once-off. It is a human-assisted case-organisation service: factual asset position, document checklist, communication timeline, missing-information list and referral-file preparation where regulated help is required.\n\nIt is not insurance cover, legal representation, debt counselling or a guaranteed lender outcome.\n\nIf you want to register for the Pack, reply: PACK YES + your asset type (home / vehicle / income / business). Do not send payment until DOXA-SURE confirms the official payment instruction.`, needsHuman: true };
    case 'shield':
      return { intent, reply: `The founding DOXA-SURE Shield is R99/month. During the pilot it is a rescue-readiness membership focused on keeping the member's asset-risk picture, document readiness and Rescue Case history organised. It is not an insurance policy.\n\nIf you want to register interest, reply: SHIELD YES. DOXA-SURE will confirm the official next step before any payment.`, needsHuman: true };
    case 'human':
      return { intent, reply: `Human review requested. Please send one short sentence describing the main issue and whether you have received a formal legal/enforcement document. Do not send passwords, PINs or ID numbers.`, needsHuman: true };
    case 'sensitive':
      return { intent, reply: `Please do not send passwords, PINs, OTPs, online-banking logins or ID numbers. Delete or redact sensitive details before continuing. Tell me only the asset type, payment status, income change and document stage.`, needsHuman: true };
    default:
      return { intent, reply: `I can help with home, vehicle, income, legal-document urgency, the Free Asset Risk Check, the R199 Rescue Readiness Pack or the R99 Shield.\n\n${MENU}`, needsHuman: false };
  }
}

export function extractIncomingMessages(payload = {}) {
  const out = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        if (message?.type !== 'text' || !message?.text?.body || !message?.from || !message?.id) continue;
        out.push({ id: message.id, from: message.from, text: message.text.body, timestamp: message.timestamp || null });
      }
    }
  }
  return out;
}

export const ASSISTANT_POLICY = { MENU, SAFE_BOUNDARY, CRITICAL, INTAKE };
