import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function redirectTo(request: NextRequest, response: NextResponse, pathname: string, search = '') {
  const destination = request.nextUrl.clone();
  destination.pathname = pathname;
  destination.search = search;
  const redirectResponse = NextResponse.redirect(destination);
  response.cookies.getAll().forEach(({ name, value, ...options }) => redirectResponse.cookies.set(name, value, options));
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let authenticated = false;
  let staff = false;
  let publicLaunchEnabled = false;
  let maintenanceMode = false;

  const pathname = request.nextUrl.pathname;
  const alwaysPublic = pathname === '/coming-soon'
    || pathname === '/open-africa'
    || pathname === '/perform-live'
    || pathname === '/tickets'
    || pathname.startsWith('/tickets/')
    || pathname.startsWith('/legal/')
    || pathname === '/creators'
    || pathname === '/advertise'
    || pathname === '/login'
    || pathname === '/forgot-password'
    || pathname === '/reset-password'
    || pathname === '/auth/callback'
    || pathname.startsWith('/api/');

  if (url && publicKey) {
    const supabase = createServerClient(url, publicKey, {
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

    if (process.env.NODE_ENV === 'production') {
      const { data: release } = await supabase
        .from('platform_release_state')
        .select('public_launch_enabled,maintenance_mode')
        .eq('singleton', true)
        .maybeSingle();
      publicLaunchEnabled = release?.public_launch_enabled === true;
      maintenanceMode = release?.maintenance_mode === true;

      if (user && maintenanceMode) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        staff = profile?.role === 'admin' || profile?.role === 'moderator';
      }
    } else {
      publicLaunchEnabled = true;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    if (maintenanceMode && !staff && !alwaysPublic) {
      return redirectTo(request, response, '/coming-soon', '?maintenance=1');
    }
    if (!publicLaunchEnabled && !authenticated && !alwaysPublic) {
      return redirectTo(request, response, '/coming-soon');
    }
  }

  const childProfile = request.cookies.get('kora_child_profile')?.value;
  const childAllowed = pathname === '/kids'
    || pathname.startsWith('/kids/')
    || pathname === '/coming-soon'
    || pathname === '/open-africa'
    || pathname === '/api/health'
    || pathname === '/api/readiness';

  if (childProfile && !authenticated) {
    response.cookies.delete('kora_child_profile');
    return response;
  }

  if (childProfile && authenticated && !childAllowed) {
    return redirectTo(request, response, '/kids');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
