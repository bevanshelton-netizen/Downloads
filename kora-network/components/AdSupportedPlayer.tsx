'use client';

import { useEffect, useRef, useState } from 'react';

type AdDecision = {
  deliveryId: string;
  campaignId: string;
  creative: { id: string; name: string; mediaUrl: string; clickUrl: string | null; durationSeconds: number; body?: string; cta?: string; accent?: string };
  house?: boolean;
  rewardEligible: boolean;
  rewardAmount: number;
  targeting: 'contextual';
};

export default function AdSupportedPlayer({ contentUrl, episodeId, title, adsEnabled, playbackSessionId }: { contentUrl: string | null; episodeId?: string; title: string; adsEnabled: boolean; playbackSessionId?: string }) {
  const [loading, setLoading] = useState(Boolean(contentUrl && episodeId && adsEnabled));
  const [ad, setAd] = useState<AdDecision | null>(null);
  const [showContent, setShowContent] = useState(!adsEnabled);
  const impressionSent = useRef(false);
  const contentStartSent = useRef(false);
  const sessionId = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  async function recordOttEvent(name: string) {
    try { await fetch('/api/ott/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, sessionId: playbackSessionId ?? sessionId.current, contentId: episodeId, device: 'web' }), keepalive: true }); } catch {}
  }
  async function recordAdEvent(eventType: 'impression' | 'click' | 'complete') {
    if (!ad?.deliveryId || ad.house || ad.deliveryId.startsWith('house:')) return;
    try { await fetch('/api/ads/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deliveryId: ad.deliveryId, eventType }), keepalive: true }); } catch {}
    if (eventType === 'impression') void recordOttEvent('ad_impression');
    if (eventType === 'complete') void recordOttEvent('ad_complete');
  }
  async function recordWatchStart() {
    if (!episodeId || contentStartSent.current) return;
    contentStartSent.current = true;
    void recordOttEvent('playback_start');
    try { await fetch('/api/watch/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ episodeId, eventType: 'start', sessionId: sessionId.current, playbackSessionId, secondsWatched: 0 }), keepalive: true }); } catch {}
  }

  useEffect(() => {
    let cancelled = false;
    if (!contentUrl || !episodeId) { setLoading(false); setShowContent(true); return; }
    if (!adsEnabled) { setLoading(false); setShowContent(true); void recordWatchStart(); return; }
    void (async () => {
      try {
        const response = await fetch('/api/ads/decision', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ episodeId, placementType: 'pre_roll' }) });
        if (cancelled) return;
        if (response.status === 204 || !response.ok) { setShowContent(true); void recordWatchStart(); return; }
        const decision = await response.json() as AdDecision;
        if (cancelled) return;
        setAd(decision);
      } catch { if (!cancelled) { setShowContent(true); void recordWatchStart(); } }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentUrl, episodeId, adsEnabled, playbackSessionId]);

  async function finishAd() { await recordAdEvent('complete'); setShowContent(true); void recordWatchStart(); }
  async function clickAd() { if (!ad?.creative.clickUrl) return; void recordAdEvent('click'); window.open(ad.creative.clickUrl, '_blank', 'noopener,noreferrer'); }

  if (!contentUrl) return <div className="playerPlaceholder"><strong>Video is processing or playback credentials are not active yet.</strong></div>;
  if (loading) return <div className="playerPlaceholder"><strong>Preparing your programme…</strong></div>;
  if (ad && !showContent && ad.house) return <div className="adStage" style={{ minHeight: 360, display: 'grid', placeItems: 'center', padding: 24 }}><div style={{ maxWidth: 760, width: '100%', textAlign: 'center', padding: '38px 28px', border: '1px solid rgba(255,255,255,.25)', borderRadius: 28, background: 'rgba(255,255,255,.06)' }}><span className="adBadge">FROM OUR NETWORK</span><h3>{ad.creative.name}</h3><p>{ad.creative.body}</p><div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>{ad.creative.clickUrl ? <button className="secondary" type="button" onClick={() => void clickAd()}>{ad.creative.cta || 'Open'}</button> : null}<button className="secondary" type="button" onClick={() => { setShowContent(true); void recordWatchStart(); }}>Continue to KORA</button></div></div></div>;
  if (ad && !showContent) return <div className="adStage"><video className="adVideo" src={ad.creative.mediaUrl} autoPlay playsInline controls={false} onPlaying={() => { if (!impressionSent.current) { impressionSent.current = true; void recordAdEvent('impression'); } }} onEnded={() => void finishAd()} onError={() => { setShowContent(true); void recordWatchStart(); }} /><div className="adOverlay"><span className="adBadge">Sponsored</span><div className="adCopy"><strong>{ad.creative.name}</strong><small>{ad.rewardEligible ? `Eligible sponsored viewing reward: R${Number(ad.rewardAmount).toFixed(2)} after verification and funded-balance checks.` : 'Contextual advertisement'}</small></div>{ad.creative.clickUrl ? <button className="secondary" type="button" onClick={() => void clickAd()}>Visit sponsor</button> : null}</div></div>;
  return <iframe src={contentUrl} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen title={title} onLoad={() => void recordWatchStart()} />;
}
