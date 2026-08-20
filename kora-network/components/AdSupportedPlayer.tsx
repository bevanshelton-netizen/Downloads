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
  };
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
    if (!ad?.deliveryId) return;
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
