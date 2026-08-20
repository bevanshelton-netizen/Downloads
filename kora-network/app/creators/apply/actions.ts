'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function submitCreatorApplication(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const creatorName = String(formData.get('creator_name') ?? '').trim();
  const creatorType = String(formData.get('creator_type') ?? '').trim();
  const pitch = String(formData.get('pitch') ?? '').trim();
  if (!creatorName || !creatorType || pitch.length < 30) redirect('/creators/apply?error=Tell%20us%20more%20about%20your%20work');

  const { error } = await supabase.from('creator_applications').insert({
    user_id: user.id,
    creator_name: creatorName,
    city: String(formData.get('city') ?? '').trim() || null,
    country_code: String(formData.get('country_code') ?? 'ZA').toUpperCase().slice(0,2),
    creator_type: creatorType,
    portfolio_url: String(formData.get('portfolio_url') ?? '').trim() || null,
    audience_summary: String(formData.get('audience_summary') ?? '').trim() || null,
    pitch,
  });
  if (error) redirect(`/creators/apply?error=${encodeURIComponent(error.message)}`);
  redirect('/creators/apply?submitted=1');
}
