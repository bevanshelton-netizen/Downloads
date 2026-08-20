import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type PlatformReleaseState = {
  schema_version: number;
  release_name: 'private_beta' | 'public_beta' | 'general_availability';
  public_launch_enabled: boolean;
  public_signups_enabled: boolean;
  creator_applications_enabled: boolean;
  advertiser_campaigns_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  updated_at: string | null;
};

const safeClosed: PlatformReleaseState = {
  schema_version: 0,
  release_name: 'private_beta',
  public_launch_enabled: false,
  public_signups_enabled: false,
  creator_applications_enabled: false,
  advertiser_campaigns_enabled: false,
  maintenance_mode: true,
  maintenance_message: 'KORA is not yet activated for public access.',
  updated_at: null,
};

export async function getPlatformReleaseState(): Promise<PlatformReleaseState> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('platform_release_state')
      .select('schema_version,release_name,public_launch_enabled,public_signups_enabled,creator_applications_enabled,advertiser_campaigns_enabled,maintenance_mode,maintenance_message,updated_at')
      .eq('singleton', true)
      .maybeSingle();
    if (error || !data) return safeClosed;
    return data as PlatformReleaseState;
  } catch {
    return safeClosed;
  }
}

export function publicAccessOpen(state: PlatformReleaseState) {
  return state.public_launch_enabled && !state.maintenance_mode;
}
