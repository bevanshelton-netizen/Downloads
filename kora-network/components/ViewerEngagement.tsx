'use client';

import { useEffect } from 'react';

export default function ViewerEngagement({ episodeId }: { episodeId: string }) {
  useEffect(() => {
    const sessionId = crypto.randomUUID();
    const send = (eventType: 'start' | 'heartbeat', seconds = 0) => {
      void fetch('/api/watch/engagement', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ episodeId, eventType, sessionId, seconds }),
        keepalive: true,
      }).catch(() => undefined);
    };

    send('start');
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') send('heartbeat', 30);
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [episodeId]);

  return null;
}
