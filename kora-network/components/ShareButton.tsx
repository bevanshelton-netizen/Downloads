'use client';

import { useState } from 'react';

type ShareButtonProps = {
  title: string;
  text?: string;
  url?: string;
  className?: string;
};

export default function ShareButton({ title, text, url, className }: ShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied'>('idle');

  async function share() {
    const shareUrl = url || window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus('copied');
      window.setTimeout(() => setStatus('idle'), 2200);
      return;
    } catch {
      window.prompt('Copy this KORA link:', shareUrl);
    }
  }

  return (
    <button type="button" className={className} onClick={share} aria-label={`Share ${title}`}>
      {status === 'copied' ? '✓ LINK COPIED' : '↗ SHARE'}
    </button>
  );
}
