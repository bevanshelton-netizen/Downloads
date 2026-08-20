'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { legal } from '@/lib/legal';

export async function acceptCreatorAgreement(formData: FormData) {
  const confirmed = formData.get('confirmed') === 'on';
  if (!confirmed) redirect('/legal/creator-agreement/accept?error=You%20must%20confirm%20the%20agreement');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('agreement_acceptances').upsert({
    user_id: user.id,
    document_code: legal.creatorAgreement.code,
    document_version: legal.creatorAgreement.version,
  }, { onConflict: 'user_id,document_code,document_version', ignoreDuplicates: true });

  if (error) redirect(`/legal/creator-agreement/accept?error=${encodeURIComponent(error.message)}`);
  redirect('/studio/productions/new');
}
