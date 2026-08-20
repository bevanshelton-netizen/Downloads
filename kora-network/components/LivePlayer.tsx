'use client';

import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

export default function LivePlayer({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    if (!Hls.isSupported()) {
      video.src = src;
      return;
    }
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [src]);

  return <video ref={ref} className="livePlayer" controls playsInline autoPlay muted aria-label={title} />;
}
