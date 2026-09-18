'use client';

import { useEffect, useRef, useState } from 'react';

type AdDecision = {
  deliveryId: string;
  campaignId: string;
  creative: {
    id: string;
    name: string;
    mediaUrl: string;
    clickUrl: string | null;
    durationSeconds: number;
    body?: string;
    cta?: string;
    accent?: string;
  };
  house?: boolean;
  rewardEligible: boolean;
  rewardAmount: number;
  targeting: 'contextual';
};

export default function AdSupportedPlayer({
  contentUrl,
  episodeId,
  title,
  adsEnabled,
}: {
  contentUrl: string | null;
  episodeId?: string;
  title: string;
  adsEnabled: boolean;
}) {
  const [loading, setLoading] = useState(Boolean(contentUrl && episodeId && adsEnabled));
  const [ad, setAd] = useState<AdDecision | null>(null);
  const [showContent, setShowContent] = useState(!adsEnabled);
  const impressionSent = useRef(false);
  const contentStartSent = useRef(false);
  const sessionId = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  async function recordAdEvent(eventType: 'impression' | 'click' | 'complete') {
    if (!ad?.deliveryId || ad.house || ad.deliveryId.startsWith('house:')) return;
    try {
      await fetch('/api/ads/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deliveryId: ad.deliveryId, eventType }),
        keepalive: true,
      });
    } catch {
      // Playback should not be blocked by telemetry failure.
    }
  }

  async function recordWatchStart() {
    if (!episodeId || contentStartSent.current) return;
    contentStartSent.current = true;
    try {
      await fetch('/api/watch/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ episodeId, eventType: 'start', sessionId: sessionId.current, secondsWatched: 0 }),
        keepalive: true,
      });
    } catch {
      // Viewing remains available if analytics collection fails.
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!contentUrl || !episodeId) {
      setLoading(false);
      setShowContent(true);
      return;
    }
    if (!adsEnabled) {
      setLoading(false);
      setShowContent(true);
      void recordWatchStart();
      return;
    }

    void (async () => {
      try {
        const response = await fetch('/api/ads/decision', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ episodeId, placementType: 'pre_roll' }),
        });
        if (cancelled) return;
        if (response.status === 204 || !response.ok) {
          setShowContent(true);
          void recordWatchStart();
          return;
        }
        const decision = await response.json() as AdDecision;
        if (cancelled) return;
        setAd(decision);
      } catch {
        if (!cancelled) {
          setShowContent(true);
          void recordWatchStart();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentUrl, episodeId, adsEnabled]);

  async function finishAd() {
    await recordAdEvent('complete');
    setShowContent(true);
    void recordWatchStart();
  }

  async function clickAd() {
    if (!ad?.creative.clickUrl) return;
    void recordAdEvent('click');
    window.open(ad.creative.clickUrl, '_blank', 'noopener,noreferrer');
  }

  if (!contentUrl) return <div className="playerPlaceholder"><strong>Video is processing or playback credentials are not active yet.</strong></div>;
  if (loading) return <div className="playerPlaceholder"><strong>Preparing your programme…</strong></div>;

  if (ad && !showContent && ad.house) {
    return <div className="adStage" style={{ minHeight: 360, display: 'grid', placeItems: 'center', padding: 24, background: 'radial-gradient(circle at 80% 20%, rgba(112,255,241,.18), transparent 30%), linear-gradient(135deg,#17114f,#25186d 55%,#11103f)' }}>
      <div style={{ maxWidth: 760, width: '100%', textAlign: 'center', padding: '38px 28px', border: '1px solid rgba(255,255,255,.25)', borderRadius: 28, background: 'rgba(255,255,255,.06)', boxShadow: '0 24px 70px rgba(0,0,0,.25)' }}>
        <span className="adBadge">FROM OUR NETWORK</span>
        <h3 style={{ fontSize: 'clamp(34px,6vw,64px)', margin: '18px 0 10px', lineHeight: .95 }}>{ad.creative.name}</h3>
        <p style={{ color: '#e4e7ff', fontSize: 18, lineHeight: 1.55, margin: '0 auto 26px', maxWidth: 620 }}>{ad.creative.body}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {ad.creative.clickUrl ? <button className="secondary" type="button" onClick={() => void clickAd()}>{ad.creative.cta || 'Open'}</button> : null}
          <button className="secondary" type="button" onClick={() => { setShowContent(true); void recordWatchStart(); }}>Continue to KORA</button>
        </div>
      </div>
    </div>;
  }

  if (ad && !showContent) {
    return <div className="adStage">
      <video
        className="adVideo"
        src={ad.creative.mediaUrl}
        autoPlay
        playsInline
        controls={false}
        onPlaying={() => {
          if (!impressionSent.current) {
            impressionSent.current = true;
            void recordAdEvent('impression');
          }
        }}
        onEnded={() => void finishAd()}
        onError={() => {
          setShowContent(true);
          void recordWatchStart();
        }}
      />
      <div className="adOverlay">
        <span className="adBadge">Sponsored</span>
        <div className="adCopy"><strong>{ad.creative.name}</strong>{ad.rewardEligible ? <small>Eligible sponsored viewing reward: R{Number(ad.rewardAmount).toFixed(2)} after verification and funded-balance checks.</small> : <small>Contextual advertisement</small>}</div>
        {ad.creative.clickUrl ? <button className="secondary" type="button" onClick={() => void clickAd()}>Visit sponsor</button> : null}
      </div>
    </div>;
  }

  return <iframe
    src={contentUrl}
    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
    allowFullScreen
    title={title}
    onLoad={() => void recordWatchStart()}
  />;
}
