'use client';

const SHARE_CONTEXTS: Array<{ match: RegExp; label: string; message: string }> = [
  { match: /\/music(?:\/|$)/i, label: 'Music', message: 'Share this KORA Music page with musicians, artists, DJs, producers and music fans.' },
  { match: /\/kids(?:\/|$)/i, label: 'Kids', message: 'Share this KORA Kids page with ECD practitioners, teachers, parents and child-development communities.' },
  { match: /\/creators(?:\/|$)|\/studio(?:\/|$)/i, label: 'Creators', message: 'Share this KORA page with creators, filmmakers and media professionals.' },
  { match: /\/live(?:-tv)?(?:\/|$)/i, label: 'Live TV', message: 'Share KORA Live TV with your audience and invite them to watch.' },
  { match: /\/watch(?:\/|$)|\/open-africa(?:\/|$)|\/open-library(?:\/|$)/i, label: 'Watch', message: 'Share this KORA viewing page with friends, family and your community.' },
  { match: /\/perform-live(?:\/|$)|\/tickets(?:\/|$)/i, label: 'Events', message: 'Share this KORA event page with your audience, performers and supporters.' },
  { match: /\/partners(?:\/|$)|\/advertise(?:\/|$)|\/advertiser(?:\/|$)/i, label: 'Business', message: 'Share KORA with businesses, brands, advertisers and potential media partners.' },
  { match: /\/family(?:\/|$)/i, label: 'Family', message: 'Share this KORA family page with families and safe-entertainment communities.' },
];

function getShareContext(pathname: string) {
  return SHARE_CONTEXTS.find((context) => context.match.test(pathname)) || {
    label: 'KORA',
    message: 'Share KORA with your community and help African stories, creators and entertainment travel further.',
  };
}

export default function ShareButton() {
  async function share() {
    const context = getShareContext(window.location.pathname);
    const source = encodeURIComponent(context.label.toLowerCase().replace(/\s+/g, '-'));
    const url = new URL(window.location.href);
    url.searchParams.set('utm_source', 'kora_share');
    url.searchParams.set('utm_medium', 'social');
    url.searchParams.set('utm_campaign', 'page_share');
    url.searchParams.set('utm_content', source);

    const payload = {
      title: `${document.title} — KORA`,
      text: `${context.message} ${document.title}`,
      url: url.toString(),
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url.toString());
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
    window.prompt('Copy this KORA promotion link', url.toString());
  }

  return (
    <button
      type="button"
      className="globalShareButton"
      data-global-share
      aria-label="Share this KORA page"
      title="Share this KORA page"
      onClick={share}
    >
      ↗ Share & Promote
    </button>
  );
}
