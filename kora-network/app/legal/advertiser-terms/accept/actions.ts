'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { legal } from '@/lib/legal';

export async function acceptAdvertiserTerms(formData: FormData) {
  const confirmed = formData.get('confirmed') === 'on';
  if (!confirmed) redirect('/legal/advertiser-terms/accept?error=You%20must%20confirm%20the%20advertiser%20terms');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('agreement_acceptances').upsert({
    user_id: user.id,
    document_code: legal.advertiserTerms.code,
    document_version: legal.advertiserTerms.version,
  }, { onConflict: 'user_id,document_code,document_version', ignoreDuplicates: true });

  if (error) redirect(`/legal/advertiser-terms/accept?error=${encodeURIComponent(error.message)}`);
  redirect('/advertiser');
}
