'use client';

import { useEffect, useRef, useState } from 'react';

type ServedAd = {
  campaignId: string;
  campaignName: string;
  creativeId: string;
  title: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  clickUrl: string | null;
  durationSeconds: number | null;
  rewardEligible: boolean;
  rewardPerVerifiedCompletion: number;
};

export default function SponsoredBreak({ episodeId }: { episodeId: string }) {
  const [ad, setAd] = useState<ServedAd | null>(null);
  const [completionEventId, setCompletionEventId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const sessionId = useRef<string>('');

  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    let cancelled = false;
    void fetch(`/api/ads/serve?episodeId=${encodeURIComponent(episodeId)}`, { cache:'no-store' })
      .then(r => r.json())
      .then(payload => {
        if (cancelled || !payload?.ad) return;
        setAd(payload.ad);
        return fetch('/api/ads/event', {
          method:'POST', headers:{'content-type':'application/json'},
          body:JSON.stringify({ campaignId:payload.ad.campaignId, creativeId:payload.ad.creativeId, episodeId, eventType:'impression', sessionId:sessionId.current, placement:'watch_below_player' }),
        });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [episodeId]);

  async function event(eventType: 'click' | 'complete', watchedSeconds = 0) {
    if (!ad) return null;
    const response = await fetch('/api/ads/event', {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ campaignId:ad.campaignId, creativeId:ad.creativeId, episodeId, eventType, sessionId:sessionId.current, placement:'watch_below_player', watchedSeconds }),
    });
    const payload = await response.json().catch(() => ({}));
    if (eventType === 'complete' && response.ok && payload.eventId) {
      setCompletionEventId(payload.eventId);
      setStatus(ad.rewardEligible ? 'Sponsored view recorded. Reward becomes claimable only after trusted verification.' : 'Sponsored view recorded.');
    }
    return payload;
  }

  async function claimReward() {
    if (!completionEventId) return;
    const response = await fetch('/api/rewards/claim', {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ adEventId:completionEventId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setStatus('Verified reward credited to My KORA wallet.');
    else setStatus(payload.error || 'Reward is not verified or funded yet.');
  }

  if (!ad) return null;

  return (
    <section className="sponsoredBreak" aria-label="Sponsored content">
      <div className="sponsorMeta"><span>SPONSORED</span><strong>{ad.campaignName}</strong><small>{ad.rewardEligible ? `Verified completion may earn R${ad.rewardPerVerifiedCompletion.toFixed(2)} from a funded reward pool.` : 'Sponsored message'}</small></div>
      <div className="sponsorMedia">
        {ad.mediaType === 'video' ? <video src={ad.mediaUrl} controls playsInline onEnded={() => void event('complete', ad.durationSeconds ?? 0)} /> : <img src={ad.mediaUrl} alt={ad.title} />}
      </div>
      <div className="actions">
        {ad.clickUrl ? <a className="secondary" href={ad.clickUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={() => void event('click')}>Visit sponsor ↗</a> : null}
        {completionEventId && ad.rewardEligible ? <button className="secondary" onClick={() => void claimReward()}>Check verified reward</button> : null}
      </div>
      {status ? <small role="status">{status}</small> : null}
    </section>
  );
}
