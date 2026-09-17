'use client';

export default function AutoAiPromo() {
  const href = 'https://allegro-vibez.vercel.app/?utm_source=kora&utm_medium=owned_promo&utm_campaign=portfolio_launch';
  return (
    <a className="autoAiPromo" href={href} target="_blank" rel="noopener noreferrer" aria-label="ALLEGRO music streaming and creator platform">
      <strong>ALLEGRO</strong>
      <span>Africa's sound. Global stage. Stream artists and discover new music.</span>
      <em>Press play →</em>
    </a>
  );
}
