import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const provider = process.env.MARKET_DATA_PROVIDER || 'fixture';
const entitlementsPath = resolve(process.env.MARKET_DATA_ENTITLEMENTS_PATH || './config/market-data-entitlements.json');
const requested = (process.env.SHADOW_INSTRUMENTS || '').split(',').map(s => s.trim()).filter(Boolean);

const flags = {
  allow_live_shadow: process.env.ALLOW_LIVE_SHADOW === 'true',
  license_approved: process.env.MARKET_DATA_LICENSE_APPROVED === 'true',
  live_shadow_approved: process.env.LIVE_SHADOW_APPROVED === 'true',
  execution_disabled: process.env.EXECUTION_ENABLED !== 'true',
  client_visibility_disabled: process.env.CLIENT_VISIBLE !== 'true',
  personalized_advice_disabled: process.env.PERSONALIZED_ADVICE_ENABLED !== 'true'
};

let entitlements = null;
let entitlement_error = null;
try {
  entitlements = JSON.parse(await readFile(entitlementsPath, 'utf8'));
} catch (error) {
  entitlement_error = error.code || error.message;
}

const credentialPresent = provider === 'twelve'
  ? Boolean(process.env.TWELVE_DATA_API_KEY)
  : provider === 'massive'
    ? Boolean(process.env.MASSIVE_API_KEY)
    : provider === 'fixture';

const instrumentChecks = requested.map(symbol => ({
  symbol,
  approved: Boolean(entitlements?.instruments?.[symbol]?.approved)
}));

const internalUseApproved = Boolean(entitlements?.approved_use?.internal_shadow_research);
const agreementApproved = entitlements?.agreement_status === 'APPROVED';
const allInstrumentsApproved = requested.length > 0 && instrumentChecks.every(x => x.approved);

const blockers = [];
if (provider !== 'fixture' && !flags.allow_live_shadow) blockers.push('ALLOW_LIVE_SHADOW=false');
if (provider !== 'fixture' && !flags.license_approved) blockers.push('MARKET_DATA_LICENSE_APPROVED=false');
if (provider !== 'fixture' && !flags.live_shadow_approved) blockers.push('LIVE_SHADOW_APPROVED=false');
if (!credentialPresent) blockers.push('provider_credential_missing');
if (provider !== 'fixture' && entitlement_error) blockers.push('entitlement_manifest_unreadable');
if (provider !== 'fixture' && !agreementApproved) blockers.push('agreement_not_approved');
if (provider !== 'fixture' && !internalUseApproved) blockers.push('internal_shadow_research_not_licensed');
if (provider !== 'fixture' && !allInstrumentsApproved) blockers.push('one_or_more_instruments_not_entitled');
if (!flags.execution_disabled) blockers.push('execution_must_remain_disabled');
if (!flags.client_visibility_disabled) blockers.push('client_visibility_must_remain_disabled');
if (!flags.personalized_advice_disabled) blockers.push('personalized_advice_must_remain_disabled');

console.log(JSON.stringify({
  provider,
  ready_for_internal_live_shadow: blockers.length === 0,
  flags,
  credential_present: credentialPresent,
  agreement_status: entitlements?.agreement_status || null,
  internal_shadow_research_approved: internalUseApproved,
  instrument_checks: instrumentChecks,
  blockers,
  secrets_echoed: false,
  execution_enabled: false,
  client_visible: false,
  personalized_advice_enabled: false
}, null, 2));

if (blockers.length) process.exitCode = 2;
