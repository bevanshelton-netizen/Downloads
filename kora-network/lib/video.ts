import 'server-only';

export type DirectUpload = {
  provider: 'cloudflare' | 'mock';
  assetId: string;
  uploadUrl: string;
};

export async function createDirectVideoUpload(maxDurationSeconds = 7200): Promise<DirectUpload> {
  const provider = process.env.VIDEO_PROVIDER || 'mock';

  if (provider === 'cloudflare') {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_STREAM_TOKEN;
    if (!accountId || !token) throw new Error('Missing Cloudflare Stream configuration');

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ maxDurationSeconds, requireSignedURLs: true }),
      cache: 'no-store',
    });
    const json = await response.json();
    if (!response.ok || !json?.success || !json?.result?.uploadURL || !json?.result?.uid) {
      throw new Error('Cloudflare Stream direct upload could not be created');
    }
    return { provider: 'cloudflare', assetId: json.result.uid, uploadUrl: json.result.uploadURL };
  }

  return {
    provider: 'mock',
    assetId: `mock-${crypto.randomUUID()}`,
    uploadUrl: '/api/video/mock-upload',
  };
}
