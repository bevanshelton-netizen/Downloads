export const dynamic = 'force-static';

const CROWNE_LIVE_URL = 'https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/crowne-hair-site';

export async function GET() {
  return Response.redirect(CROWNE_LIVE_URL, 307);
}
