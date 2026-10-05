import { NextRequest, NextResponse } from 'next/server';
import { evaluateTerritory, type RightsRecord } from '../../../../lib/yhvh/territory-gate';

export const dynamic = 'force-dynamic';

const registryUrl = process.env.YHVH_RIGHTS_REGISTRY_URL ||
  'https://kora-network.vercel.app/gospel/rights-registry.json';

async function loadRecords(): Promise<RightsRecord[]> {
  try {
    const res = await fetch(registryUrl, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.territories) ? data.territories : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const territory = url.searchParams.get('territory') || '';
  const contentId = url.searchParams.get('contentId') || 'YHVH-LIVE';
  const distributionMethod = url.searchParams.get('distributionMethod') || 'web';

  if (!territory) {
    return NextResponse.json({ ok: false, error: 'territory_required' }, { status: 400 });
  }

  const records = await loadRecords();
  const decision = evaluateTerritory(records, territory, contentId, distributionMethod);

  return NextResponse.json({
    ok: true,
    authority: 'IZAKHONO',
    territory,
    contentId,
    distributionMethod,
    decision
  }, {
    headers: { 'cache-control': 'no-store' }
  });
}
