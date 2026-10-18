'use client';

import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';

type LivePlayerProps = {
  src: string;
  title: string;
  channelName?: string;
  nowTitle?: string | null;
  nextTitle?: string | null;
};

export default function LivePlayer({ src, title, channelName = 'KORA TV', nowTitle, nextTitle }: LivePlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    setStatus('loading');

    const handlePlaying = () => setStatus('playing');
    const handleError = () => setStatus('error');
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.load();
      return () => {
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('error', handleError);
      };
    }
    if (!Hls.isSupported()) {
      video.src = src;
      video.load();
      return () => {
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('error', handleError);
      };
    }

    const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setStatus('error');
    });

    return () => {
      hls.destroy();
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
    };
  }, [src]);

  return (
    <div className="tvPlayerFrame">
      <video ref={ref} className="livePlayer" controls playsInline autoPlay muted aria-label={title} />
      <div className="tvLiveBug"><span className="tvLiveDot" /> LIVE</div>
      <div className="tvChannelBug">{channelName}</div>
      <div className="tvPlayerStatus" aria-live="polite">
        {status === 'loading' ? 'Connecting to broadcast…' : null}
        {status === 'error' ? 'Broadcast signal unavailable — retrying when the feed returns.' : null}
      </div>
      {(nowTitle || nextTitle) ? (
        <div className="tvNowNext">
          {nowTitle ? <div><small>NOW PLAYING</small><strong>{nowTitle}</strong></div> : null}
          {nextTitle ? <div><small>UP NEXT</small><strong>{nextTitle}</strong></div> : null}
        </div>
      ) : null}
    </div>
  );
}
