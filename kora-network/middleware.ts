import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let authenticated = false;

  if (url && anonKey) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options as any));
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    authenticated = Boolean(user);
  }

  const childProfile = request.cookies.get('kora_child_profile')?.value;
  const pathname = request.nextUrl.pathname;
  const childAllowed = pathname === '/kids' || pathname.startsWith('/kids/') || pathname === '/api/health' || pathname === '/api/readiness';

  if (childProfile && !authenticated) {
    response.cookies.delete('kora_child_profile');
    return response;
  }

  if (childProfile && authenticated && !childAllowed) {
    const destination = request.nextUrl.clone();
    destination.pathname = '/kids';
    destination.search = '';
    const redirectResponse = NextResponse.redirect(destination);
    response.cookies.getAll().forEach(({ name, value, ...options }) => redirectResponse.cookies.set(name, value, options));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
