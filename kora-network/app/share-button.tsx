'use client';

export default function ShareButton() {
  async function share() {
    const payload = {
      title: document.title,
      text: document.querySelector('meta[name="description"]')?.getAttribute('content') || document.title,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        const button = document.querySelector<HTMLButtonElement>('[data-global-share]');
        if (button) {
          const old = button.textContent || 'Share';
          button.textContent = '✓ Link copied';
          window.setTimeout(() => { button.textContent = old; }, 1800);
        }
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    window.prompt('Copy this link', window.location.href);
  }

  return <button type="button" className="globalShareButton" data-global-share onClick={share}>↗ Share</button>;
}
