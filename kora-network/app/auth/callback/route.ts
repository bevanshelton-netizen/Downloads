import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/account';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (!code) return NextResponse.redirect(new URL('/login?error=Missing%20confirmation%20code', url.origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));

  return NextResponse.redirect(new URL(next, url.origin));
}
