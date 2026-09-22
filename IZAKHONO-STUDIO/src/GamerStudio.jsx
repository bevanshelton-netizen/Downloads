import React, { useEffect, useRef, useState } from 'react';

const PRESETS = {
  'Stream Overlay': [1920, 1080],
  'YouTube Thumbnail': [1280, 720],
  'Esports Card': [1080, 1080],
  'Short / Reel Cover': [1080, 1920],
};

const THEMES = {
  Neon: { bg: '#070913', accent: '#42f5c5', accent2: '#7a5cff' },
  Inferno: { bg: '#140705', accent: '#ff5a36', accent2: '#ffc857' },
  Ice: { bg: '#06121c', accent: '#67e8f9', accent2: '#60a5fa' },
  Royal: { bg: '#12091d', accent: '#d8b4fe', accent2: '#f472b6' },
};

function loadImage(file, callback) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    callback(img);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export default function GamerStudio() {
  const canvasRef = useRef(null);
  const [preset, setPreset] = useState('Stream Overlay');
  const [themeName, setThemeName] = useState('Neon');
  const [gamerTag, setGamerTag] = useState('PLAYER ONE');
  const [team, setTeam] = useState('IZAKHONO GAMING');
  const [message, setMessage] = useState('LIVE • RANKED • NO QUIT');
  const [background, setBackground] = useState(null);
  const [facecam, setFacecam] = useState(true);
  const [chatBox, setChatBox] = useState(true);

  const [width, height] = PRESETS[preset];
  const theme = THEMES[themeName];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    if (background) {
      const scale = Math.max(width / background.naturalWidth, height / background.naturalHeight);
      const drawW = background.naturalWidth * scale;
      const drawH = background.naturalHeight * scale;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(background, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
      ctx.globalAlpha = 1;
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,.15)');
      grad.addColorStop(1, 'rgba(0,0,0,.74)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    const glow = ctx.createRadialGradient(width * 0.78, height * 0.18, 20, width * 0.78, height * 0.18, width * 0.55);
    glow.addColorStop(0, theme.accent + '55');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, 0, width, Math.max(12, Math.round(height * 0.018)));

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.font = `900 ${Math.max(54, Math.round(width * 0.055))}px Arial Black, Arial, sans-serif`;
    ctx.fillText(gamerTag.toUpperCase().slice(0, 24), Math.round(width * 0.055), Math.round(height * 0.08));

    ctx.fillStyle = theme.accent;
    ctx.font = `800 ${Math.max(28, Math.round(width * 0.025))}px Arial, sans-serif`;
    ctx.fillText(team.toUpperCase().slice(0, 34), Math.round(width * 0.058), Math.round(height * 0.19));

    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.font = `700 ${Math.max(22, Math.round(width * 0.018))}px Arial, sans-serif`;
    ctx.fillText(message.toUpperCase().slice(0, 48), Math.round(width * 0.058), Math.round(height * 0.265));

    ctx.strokeStyle = theme.accent2;
    ctx.lineWidth = Math.max(4, Math.round(width * 0.004));

    if (preset === 'Stream Overlay' && facecam) {
      const fw = Math.round(width * 0.245);
      const fh = Math.round(height * 0.34);
      const fx = Math.round(width * 0.055);
      const fy = height - fh - Math.round(height * 0.075);
      ctx.fillStyle = 'rgba(5,8,14,.62)';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.font = `700 ${Math.max(18, Math.round(width * 0.012))}px Arial, sans-serif`;
      ctx.fillText('FACECAM', fx + 20, fy + 18);
    }

    if (preset === 'Stream Overlay' && chatBox) {
      const cw = Math.round(width * 0.22);
      const ch = Math.round(height * 0.58);
      const cx = width - cw - Math.round(width * 0.04);
      const cy = Math.round(height * 0.18);
      ctx.fillStyle = 'rgba(5,8,14,.56)';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeRect(cx, cy, cw, ch);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.font = `700 ${Math.max(18, Math.round(width * 0.012))}px Arial, sans-serif`;
      ctx.fillText('LIVE CHAT', cx + 20, cy + 18);
    }

    const badgeW = Math.min(Math.round(width * 0.34), 640);
    const badgeH = Math.max(68, Math.round(height * 0.075));
    const bx = Math.round(width * 0.055);
    const by = height - badgeH - Math.round(height * 0.04);
    const badge = ctx.createLinearGradient(bx, by, bx + badgeW, by);
    badge.addColorStop(0, theme.accent);
    badge.addColorStop(1, theme.accent2);
    ctx.fillStyle = badge;
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, badgeH, badgeH / 2);
    ctx.fill();

    ctx.fillStyle = '#05070b';
    ctx.font = `900 ${Math.max(20, Math.round(width * 0.017))}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(preset === 'Stream Overlay' ? 'STREAM STARTING / LIVE' : 'PLAY • CREATE • SHARE', bx + 28, by + badgeH / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.52)';
    ctx.font = `700 ${Math.max(15, Math.round(width * 0.011))}px Arial, sans-serif`;
    ctx.fillText('CREATED IN IZAKHONO GAMER STUDIO', width - Math.round(width * 0.035), height - Math.round(height * 0.025));
    ctx.textAlign = 'left';
  }, [width, height, theme, gamerTag, team, message, background, facecam, chatBox, preset]);

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `${gamerTag.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'gamer'}-${preset.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <section className="gamer-studio" id="gamer-studio">
      <div className="suite-section-copy">
        <span className="suite-eyebrow">GAMER STUDIO • WORKING V1</span>
        <h2>Built for players, streamers and esports.</h2>
        <p>Create stream overlays, gaming thumbnails, esports cards and vertical covers in-browser. The next gaming layer connects clips, highlights, emotes, team kits, sprites, textures, trailers and developer assets into the same suite.</p>
      </div>

      <div className="gamer-grid">
        <aside className="gamer-controls">
          <label>Format<select value={preset} onChange={(e) => setPreset(e.target.value)}>{Object.keys(PRESETS).map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>Theme<select value={themeName} onChange={(e) => setThemeName(e.target.value)}>{Object.keys(THEMES).map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>Gamer tag<input value={gamerTag} maxLength={24} onChange={(e) => setGamerTag(e.target.value)} /></label>
          <label>Team / channel<input value={team} maxLength={34} onChange={(e) => setTeam(e.target.value)} /></label>
          <label>Message<input value={message} maxLength={48} onChange={(e) => setMessage(e.target.value)} /></label>
          <label className="suite-upload">
            <strong>Add gameplay / hero image</strong>
            <span>Optional. The image stays local in this v1 editor.</span>
            <input type="file" accept="image/*" onChange={(e) => loadImage(e.target.files?.[0], setBackground)} />
          </label>
          {preset === 'Stream Overlay' && <div className="gamer-toggles">
            <label><input type="checkbox" checked={facecam} onChange={(e) => setFacecam(e.target.checked)} /> Facecam frame</label>
            <label><input type="checkbox" checked={chatBox} onChange={(e) => setChatBox(e.target.checked)} /> Chat frame</label>
          </div>}
          <button className="gamer-export" onClick={exportPng}>Export Gamer PNG</button>
        </aside>

        <div className="gamer-preview" style={{ aspectRatio: `${width} / ${height}` }}>
          <canvas ref={canvasRef} aria-label="Gaming creative preview" />
        </div>
      </div>

      <div className="gamer-roadmap">
        <article><b>STREAM</b><span>Scenes, overlays, alerts, facecam frames, chat panels and sponsor slots.</span></article>
        <article><b>CLIPS</b><span>Gameplay highlights, Shorts/Reels, captions, win moments and auto-resize.</span></article>
        <article><b>ESPORTS</b><span>Team identity, fixtures, score cards, player profiles, brackets and sponsor media.</span></article>
        <article><b>GAME DEV</b><span>Sprites, textures, UI assets, icons, trailers, audio assets and storefront graphics.</span></article>
      </div>
    </section>
  );
}
