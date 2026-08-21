import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
let passed = 0;

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const payfast = read('lib/payfast.ts');
const notify = read('app/api/payfast/notify/route.ts');
const paymentHardening = read('supabase/003_payment_hardening.sql');
const rewards = read('supabase/006_broadcast_rewards.sql');
const creatorReserve = read('supabase/010_creator_revenue_reserve_hardening.sql');
const ppv = read('supabase/012_ppv_entitlements.sql');
const recurring = read('supabase/014_launch_security_and_recurring.sql');
const ticketing = read('supabase/017_ticket_payment_hardening.sql');

check('PayFast ITN verifies signature before trust', payfast.includes('payFastSignature(unsigned, process.env.PAYFAST_PASSPHRASE) !== receivedSignature'));
check('PayFast ITN verifies merchant identity', payfast.includes("fields.merchant_id !== process.env.PAYFAST_MERCHANT_ID"));
check('PayFast ITN performs provider-side remote validation', payfast.includes('/eng/query/validate') && payfast.includes("trim() === 'VALID'"));
check('PayFast defaults to sandbox unless explicitly live', payfast.includes("process.env.PAYFAST_SANDBOX === 'false'"));
check('Subscription checkout requires a PayFast passphrase', payfast.includes('return checkoutResponse(fields, true);'));
check('PPV checkout rejects non-positive amounts', payfast.includes('!Number.isFinite(input.amount) || input.amount <= 0'));

const validateIndex = notify.indexOf('const valid = await validateItn');
const adminIndex = notify.indexOf('const admin = createAdminClient()');
check('ITN validation happens before privileged database access', validateIndex >= 0 && adminIndex > validateIndex);
check('PayFast callback rejects malformed/negative gross amounts', notify.includes('!Number.isFinite(receivedAmount) || receivedAmount < 0'));
check('PPV amount is rechecked against stored purchase amount', notify.includes('const expectedAmount = Number(purchase.amount)') && notify.includes("return new NextResponse('Amount mismatch', { status: 400 })"));
check('PPV completion requires COMPLETE status', notify.includes("if (paymentStatus === 'COMPLETE')") && notify.includes("admin.rpc('complete_payfast_purchase'"));
check('PPV entitlement completion is delegated to atomic DB function', notify.includes("admin.rpc('complete_payfast_purchase'"));
check('Subscription amount comes from server-owned plan table', notify.includes('Number(plans[planCode].amount)'));
check('Recurring ITN deduplicates by provider payment ID', notify.includes(".eq('source_type', 'payfast_subscription')") && notify.includes(".eq('source_id', providerPaymentId)"));
check('Recurring period extends only when payment revenue is new', notify.includes('if (!existingRevenue)') && notify.includes('current_period_end: addOneMonth(subscription.current_period_end)'));
check('Stable subscription token is persisted separately', notify.includes('provider_subscription_id: subscriptionToken'));

check('Revenue source IDs are globally unique per source type', paymentHardening.includes('create unique index if not exists revenue_events_source_unique') && paymentHardening.includes('on public.revenue_events(source_type, source_id)'));

check('Reward claims are one-per verified ad event', rewards.includes('ad_event_id uuid not null unique') && rewards.includes("if exists(select 1 from public.reward_claims where ad_event_id = p_ad_event_id)"));
check('Rewards require verified completed ad events', rewards.includes("v_verified is not true or v_event_type <> 'complete'"));
check('Rewards spend only cleared funded pools', rewards.includes('and re.cleared = true') && rewards.includes('rp.funded_amount - rp.spent_amount >= v_amount'));
check('Reward pool spend is locked before mutation', rewards.includes('for update of rp'));
check('Reward spend increments the funded pool atomically', rewards.includes('set spent_amount = spent_amount + v_amount'));
check('Reward claim RPC is service-role only', rewards.includes('grant execute on function public.claim_verified_ad_reward(uuid, uuid) to service_role'));

check('Creator revenue requires cleared source revenue', creatorReserve.includes('where id = p_revenue_event_id and cleared = true'));
check('Creator allocation locks the source revenue event', creatorReserve.includes('for update;'));
check('Creator and reward pools cannot double-spend gross revenue', creatorReserve.includes('v_allocated + v_reward_reserved + p_eligible_amount > v_gross'));
check('Creator allocation requires an accepted revenue deal', creatorReserve.includes("status = 'accepted'"));
check('Creator allocation RPC is service-role only', creatorReserve.includes('grant execute on function public.allocate_creator_revenue(uuid, uuid, numeric) to service_role'));

check('PPV provider payment IDs are unique', ppv.includes('create unique index if not exists purchases_provider_payment_unique'));
check('PPV completion locks purchase row', ppv.includes("where id = p_purchase_id and provider = 'payfast'") && ppv.includes('for update;'));
check('PPV completion rechecks expected amount in database', ppv.includes('abs(v_expected - p_amount) > 0.01'));
check('Repeated PPV COMPLETE for same provider ID is idempotent', ppv.includes("if v_status = 'complete'") && ppv.includes('if v_existing_provider = p_provider_payment_id then return p_purchase_id'));
check('PPV completion writes cleared revenue only after success', ppv.includes("values('payfast_purchase', p_provider_payment_id, p_amount, 'ZAR', true, now())"));
check('PPV revenue insert is duplicate-safe', ppv.includes('on conflict (source_type, source_id) where source_id is not null do nothing'));
check('PPV completion RPC is service-role only', ppv.includes('grant execute on function public.complete_payfast_purchase(uuid,text,numeric) to service_role'));

check('Ticket reservation locks inventory', ticketing.includes('for update') && ticketing.includes('reserved_count=reserved_count+p_quantity'));
check('Ticket completion rechecks stored amount', ticketing.includes('abs(v_order.total_amount-p_amount)>0.01'));
check('Ticket completion is idempotent', ticketing.includes("if v_order.status='complete'") && ticketing.includes('Ticket order already completed by another payment'));
check('Ticket issuance follows inventory conversion', ticketing.includes('sold_count=sold_count+v_order.quantity') && ticketing.includes('insert into public.event_tickets'));
check('Ticket completion RPC is service-role only', ticketing.includes('grant execute on function public.complete_payfast_ticket_order(uuid,text,numeric) to service_role'));
check('PayFast recurring token is unique', recurring.includes('create unique index if not exists subscriptions_payfast_token_unique'));
check('Users cannot self-elevate role or KYC', recurring.includes('revoke update on table public.profiles from authenticated') && recurring.includes('grant update (display_name, country_code)'));
check('Users cannot directly insert payout requests', recurring.includes('revoke insert, update, delete on table public.payout_requests from authenticated'));
check('Creators cannot directly mutate publication/playback state', recurring.includes('revoke insert, update, delete on table public.episodes from authenticated'));

console.log(`\nKORA financial-integrity guard: ${passed} passed, ${failures.length} failed.`);
if (failures.length) {
  console.error('\nFinancial-integrity violations:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
