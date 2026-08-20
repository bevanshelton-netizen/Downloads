'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelPayFastSubscription } from '@/lib/payfast';

export async function cancelSubscription(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account');

  const subscriptionId = String(formData.get('subscription_id') ?? '');
  if (!subscriptionId) redirect('/account?error=Subscription%20not%20found');

  const { data: subscription } = await supabase.from('subscriptions')
    .select('id,provider,provider_subscription_id,status,current_period_end')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!subscription) redirect('/account?error=Subscription%20not%20found');
  if (subscription.provider !== 'payfast' || !subscription.provider_subscription_id) {
    redirect('/account?error=This%20membership%20cannot%20be%20cancelled%20automatically%20yet');
  }

  try {
    await cancelPayFastSubscription(subscription.provider_subscription_id);
  } catch (error) {
    redirect(`/account?error=${encodeURIComponent(error instanceof Error ? error.message : 'Cancellation failed')}`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from('subscriptions')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', subscription.id);
  if (error) redirect('/account?error=Cancellation%20was%20sent%20to%20PayFast%20but%20KORA%20could%20not%20save%20the%20status');

  revalidatePath('/account');
  redirect('/account?message=Subscription%20cancelled.%20Access%20continues%20through%20the%20paid%20period.');
}
