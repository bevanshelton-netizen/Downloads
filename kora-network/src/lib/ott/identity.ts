export type KoraIdentityProvider = 'email' | 'google' | 'apple' | 'phone' | 'guest';

export interface KoraUser {
  id: string;
  email?: string;
  displayName?: string;
  provider: KoraIdentityProvider;
  createdAt: string;
}

export interface KoraAuthSession {
  id: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  deviceId?: string;
}

export function createAuthSession(userId: string, deviceId?: string, now = new Date()): KoraAuthSession {
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `ka_${userId}_${now.getTime().toString(36)}`,
    userId,
    issuedAt,
    expiresAt,
    deviceId,
  };
}

export function isAuthSessionValid(session: KoraAuthSession, now = new Date()): boolean {
  return new Date(session.expiresAt).getTime() > now.getTime();
}
