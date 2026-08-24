export function safeReturnPath(value, fallback = '/learn') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const u = new URL(value, 'https://nextradefinx.invalid');
    if (u.origin !== 'https://nextradefinx.invalid') return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}

export function requireAuthenticatedUser(session) {
  const user = session?.user;
  if (!user?.id || typeof user.id !== 'string') {
    const error = new Error('authentication_required');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  return { id: user.id, email: user.email ?? null };
}

export function publicSessionView(session) {
  const user = session?.user;
  return user?.id ? { authenticated: true, user_id: user.id } : { authenticated: false, user_id: null };
}
