import React, { useMemo, useRef, useState } from 'react';
import { toBlob, toPng } from 'html-to-image';
import { PORTFOLIO, CAMPAIGN_LEVELS, CAMPAIGN_FORMATS } from './portfolio.js';
import { FORMAT_SIZES, buildSuperCampaignPack, downloadBlob } from './campaignEngine.js';

const PRESETS = FORMAT_SIZES;
const FONTS = ['Bebas Neue', 'Montserrat', 'Oswald', 'Playfair Display', 'Poppins', 'Archivo Black'];

const starter = [
  { id: 1, type: 'text', text: 'ONE BRIEF. THE WHOLE PORTFOLIO.', x: 80, y: 130, w: 780, fontSize: 88, fontFamily: 'Bebas Neue', fontWeight: 700, color: '#ffffff', align: 'left' },
  { id: 2, type: 'text', text: 'Generate campaigns at portfolio scale.', x: 84, y: 350, w: 650, fontSize: 34, fontFamily: 'Montserrat', fontWeight: 700, color: '#b8ff3d', align: 'left' },
];

function App() {
  const stageRef = useRef(null);
  const [sizeName, setSizeName] = useState('Instagram Post');
  const [elements, setElements] = useState(starter);
  const [selectedId, setSelectedId] = useState(1);
  const [background, setBackground] = useState('#0b0f18');
  const [prompt, setPrompt] = useState('');
  const [brandName, setBrandName] = useState('IZAKHONO STUDIO');
  const [brandColor, setBrandColor] = useState('#b8ff3d');
  const [zoom, setZoom] = useState(0.55);
  const [drag, setDrag] = useState(null);
  const [superBrief, setSuperBrief] = useState('Drive qualified traffic to every live IZAKHONO portfolio platform. Make the offer instantly clear and give people one obvious action.');
  const [superOffer, setSuperOffer] = useState('');
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState(null);
  const [lastPack, setLastPack] = useState(null);

  const [width, height] = PRESETS[sizeName];
  const selected = elements.find((el) => el.id === selectedId);
  const totalCreatives = PORTFOLIO.length * CAMPAIGN_LEVELS.length * CAMPAIGN_FORMATS.length;
  const totalCaptionRows = totalCreatives * 6;

  const templates = useMemo(() => [
    { name: 'Launch', bg: '#0b0f18', accent: '#b8ff3d', headline: 'YOUR NEXT BIG THING STARTS HERE' },
    { name: 'Sale', bg: '#ff3d6e', accent: '#fff16a', headline: 'BIG OFFER. ZERO WHISPERING.' },
    { name: 'Music', bg: '#26003f', accent: '#33f6ff', headline: 'TURN THE VOLUME ALL THE WAY UP' },
    { name: 'Education', bg: '#073b4c', accent: '#ffd166', headline: 'LEARN IT. OWN IT. USE IT.' },
    { name: 'Automotive', bg: '#111111', accent: '#ff6b00', headline: 'YOUR CAR DESERVES A SECOND OPINION' },
  ], []);

  const updateSelected = (patch) => {
    if (!selectedId) return;
    setElements((items) => items.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)));
  };

  const addText = () => {
    const id = Date.now();
    setElements((items) => [...items, { id, type: 'text', text: 'NEW HEADLINE', x: 100, y: 500, w: 700, fontSize: 64, fontFamily: 'Bebas Neue', fontWeight: 700, color: '#ffffff', align: 'left' }]);
    setSelectedId(id);
  };

  const addImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = Date.now();
      setElements((items) => [...items, { id, type: 'image', src: reader.result, x: 120, y: 520, w: 520, h: 360, radius: 28 }]);
      setSelectedId(id);
    };
    reader.readAsDataURL(file);
  };

  const deleteSelected = () => {
    setElements((items) => items.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const id = Date.now();
    setElements((items) => [...items, { ...selected, id, x: selected.x + 35, y: selected.y + 35 }]);
    setSelectedId(id);
  };

  const applyTemplate = (t) => {
    setBackground(t.bg);
    setBrandColor(t.accent);
    setElements([
      { id: 1, type: 'text', text: t.headline, x: 72, y: 140, w: width - 150, fontSize: Math.max(58, Math.round(width * 0.075)), fontFamily: 'Bebas Neue', fontWeight: 700, color: '#ffffff', align: 'left' },
      { id: 2, type: 'text', text: `${brandName} • Design that speaks loud`, x: 76, y: Math.round(height * 0.42), w: width - 160, fontSize: Math.max(25, Math.round(width * 0.032)), fontFamily: 'Montserrat', fontWeight: 700, color: t.accent, align: 'left' },
    ]);
    setSelectedId(1);
  };

  const smartDesign = () => {
    const p = prompt.toLowerCase();
    let t = templates[0];
    if (p.includes('sale') || p.includes('special') || p.includes('offer')) t = templates[1];
    else if (p.includes('music') || p.includes('artist') || p.includes('concert')) t = templates[2];
    else if (p.includes('learn') || p.includes('school') || p.includes('course')) t = templates[3];
    else if (p.includes('car') || p.includes('vehicle') || p.includes('auto')) t = templates[4];
    applyTemplate({ ...t, headline: prompt.trim() ? prompt.trim().toUpperCase().slice(0, 80) : t.headline });
  };

  const generatePortfolioCampaign = async () => {
    if (campaignBusy) return;
    setCampaignBusy(true);
    setLastPack(null);
    setCampaignProgress({ completed: 0, total: totalCreatives, brand: 'Starting', level: '', format: '' });
    try {
      const blob = await buildSuperCampaignPack({
        brands: PORTFOLIO,
        levels: CAMPAIGN_LEVELS,
        formats: CAMPAIGN_FORMATS,
        brief: superBrief,
        offer: superOffer,
        onProgress: setCampaignProgress,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `izakhono-super-campaign-${stamp}.zip`;
      downloadBlob(blob, filename);
      setLastPack({ filename, creatives: totalCreatives, captions: totalCaptionRows });
    } catch (error) {
      console.error(error);
      setCampaignProgress({ error: error?.message || 'Campaign generation failed.' });
    } finally {
      setCampaignBusy(false);
    }
  };

  const exportPng = async () => {
    if (!stageRef.current) return;
    const dataUrl = await toPng(stageRef.current, { cacheBust: true, pixelRatio: 1 });
    const a = document.createElement('a');
    a.download = `${brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'design'}.png`;
    a.href = dataUrl;
    a.click();
  };

  const shareDesign = async () => {
    if (!stageRef.current) return;
    const blob = await toBlob(stageRef.current, { cacheBust: true, pixelRatio: 1 });
    const file = new File([blob], 'izakhono-studio-design.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: brandName, text: 'Created with IZAKHONO STUDIO', files: [file] });
    } else if (navigator.share) {
      await navigator.share({ title: brandName, text: 'Created with IZAKHONO STUDIO', url: window.location.href });
    } else {
      await exportPng();
    }
  };

  const pointerDown = (e, el) => {
    e.stopPropagation();
    setSelectedId(el.id);
    setDrag({ id: el.id, startX: e.clientX, startY: e.clientY, x: el.x, y: el.y });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const pointerMove = (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / zoom;
    const dy = (e.clientY - drag.startY) / zoom;
    setElements((items) => items.map((el) => (el.id === drag.id ? { ...el, x: Math.max(0, drag.x + dx), y: Math.max(0, drag.y + dy) } : el)));
  };

  return (
    <main className="app-shell" onPointerMove={pointerMove} onPointerUp={() => setDrag(null)}>
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-kicker">PORTFOLIO CREATIVE OPERATING SYSTEM</div>
          <div className="brand-name">IZAKHONO <span>STUDIO</span></div>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={shareDesign}>Share Current</button>
          <button className="primary" onClick={exportPng}>Export Current</button>
        </div>
      </header>

      <section className="hero-strip super-hero">
        <div>
          <div className="super-badge">SUPER PLATFORM • {PORTFOLIO.length} PORTFOLIO BRANDS CONNECTED</div>
          <h1>One brief. <em>Every platform.</em> Full campaign.</h1>
          <p>Generate portfolio-wide advertising at every level IZAKHONO STUDIO supports — automatically, in all major creative sizes, with social copy included.</p>
        </div>
        <div className="super-stats">
          <div><strong>{PORTFOLIO.length}</strong><span>brands</span></div>
          <div><strong>{CAMPAIGN_LEVELS.length}</strong><span>campaign levels</span></div>
          <div><strong>{CAMPAIGN_FORMATS.length}</strong><span>creative formats</span></div>
          <div><strong>{totalCreatives}</strong><span>creatives / run</span></div>
        </div>
      </section>

      <section className="super-engine">
        <div className="engine-copy">
          <span className="eyebrow">PORTFOLIO CAMPAIGN ENGINE</span>
          <h2>Generate the whole advertising machine.</h2>
          <p>Studio automatically applies each platform's identity, audience, promise, CTA, visual direction, campaign stage and format. You do not design individual adverts.</p>
          <div className="coverage-chips">
            {PORTFOLIO.map((brand) => <span key={brand.id}>{brand.name}</span>)}
          </div>
        </div>
        <div className="engine-controls">
          <label>Master campaign brief<textarea value={superBrief} onChange={(e) => setSuperBrief(e.target.value)} /></label>
          <label>Portfolio-wide offer or message <input value={superOffer} onChange={(e) => setSuperOffer(e.target.value)} placeholder="Optional — leave blank to use each platform's core offer" /></label>
          <div className="engine-includes">
            <span>Awareness</span><span>Benefits</span><span>Offers</span><span>Conversion</span><span>Retargeting</span><span>Shareable</span>
          </div>
          <button className="super-button" onClick={generatePortfolioCampaign} disabled={campaignBusy}>
            {campaignBusy ? `GENERATING ${campaignProgress?.completed || 0}/${campaignProgress?.total || totalCreatives}` : `GENERATE FULL PORTFOLIO CAMPAIGN • ${totalCreatives} CREATIVES`}
          </button>
          {campaignBusy && <div className="progress-wrap"><div className="progress-bar" style={{ width: `${Math.round(((campaignProgress?.completed || 0) / totalCreatives) * 100)}%` }} /><small>{campaignProgress?.brand} • {campaignProgress?.level} • {campaignProgress?.format}</small></div>}
          {campaignProgress?.error && <p className="error-text">{campaignProgress.error}</p>}
          {lastPack && <div className="success-box"><b>Campaign pack generated.</b><span>{lastPack.creatives} graphics + {lastPack.captions} social-caption placements + manifest packaged in {lastPack.filename}.</span></div>}
        </div>
      </section>

      <section className="automation-ribbon">
        <b>ONE RUN CREATES:</b>
        <span>Feed ads</span><span>Stories</span><span>Reels/TikTok art</span><span>Facebook link ads</span><span>LinkedIn creatives</span><span>YouTube thumbnails</span><span>6 social-network copy sets</span><span>Campaign manifest</span>
      </section>

      <section className="editor-heading">
        <span className="eyebrow">OPTIONAL MANUAL STUDIO</span>
        <h2>Fine-tune only when you want to.</h2>
      </section>

      <section className="hero-strip compact-hero">
        <div>
          <h2>Manual creative editor</h2>
          <p>The bulk engine handles scale. This editor remains available for exceptional campaigns or one-off refinements.</p>
        </div>
        <div className="magic-box">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe a one-off creative…" />
          <button onClick={smartDesign}>Instant Design</button>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel left-panel">
          <h3>Templates</h3>
          <div className="template-grid">
            {templates.map((t) => <button key={t.name} className="template-card" style={{ background: t.bg, borderColor: t.accent }} onClick={() => applyTemplate(t)}><b>{t.name}</b><span style={{ color: t.accent }}>{t.headline}</span></button>)}
          </div>
          <h3>Canvas</h3>
          <select value={sizeName} onChange={(e) => setSizeName(e.target.value)}>{Object.keys(PRESETS).map((key) => <option key={key}>{key}</option>)}</select>
          <label>Background <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} /></label>
          <label>Zoom <input type="range" min="0.28" max="0.8" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
          <h3>Add</h3>
          <button onClick={addText}>+ Text</button>
          <label className="upload-btn">+ Upload image<input hidden type="file" accept="image/*" onChange={(e) => addImage(e.target.files?.[0])} /></label>
        </aside>

        <div className="canvas-wrap" onPointerDown={() => setSelectedId(null)}>
          <div className="canvas-scaler" style={{ width: width * zoom, height: height * zoom }}>
            <div ref={stageRef} className="stage" style={{ width, height, background, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              <div className="accent-orb" style={{ background: brandColor }} />
              <div className="watermark">IZAKHONO STUDIO</div>
              {elements.map((el) => (
                <div key={el.id} onPointerDown={(e) => pointerDown(e, el)} className={`design-element ${selectedId === el.id ? 'selected' : ''}`} style={{ left: el.x, top: el.y, width: el.w, height: el.h || 'auto' }}>
                  {el.type === 'text' ? <div style={{ fontFamily: el.fontFamily, fontSize: el.fontSize, fontWeight: el.fontWeight, color: el.color, textAlign: el.align, lineHeight: 0.95, textTransform: 'uppercase' }}>{el.text}</div> : <img src={el.src} alt="Uploaded design element" draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: el.radius }} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="panel right-panel">
          <h3>Brand Kit</h3>
          <label>Brand name<input value={brandName} onChange={(e) => setBrandName(e.target.value)} /></label>
          <label>Accent<input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} /></label>
          <h3>Selected</h3>
          {!selected && <p className="muted">Tap an element to edit it.</p>}
          {selected?.type === 'text' && <>
            <label>Text<textarea value={selected.text} onChange={(e) => updateSelected({ text: e.target.value })} /></label>
            <label>Font<select value={selected.fontFamily} onChange={(e) => updateSelected({ fontFamily: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
            <label>Size<input type="range" min="18" max="180" value={selected.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} /></label>
            <label>Colour<input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} /></label>
            <label>Align<select value={selected.align} onChange={(e) => updateSelected({ align: e.target.value })}><option>left</option><option>center</option><option>right</option></select></label>
          </>}
          {selected?.type === 'image' && <>
            <label>Width<input type="range" min="120" max="900" value={selected.w} onChange={(e) => updateSelected({ w: Number(e.target.value) })} /></label>
            <label>Height<input type="range" min="120" max="900" value={selected.h} onChange={(e) => updateSelected({ h: Number(e.target.value) })} /></label>
            <label>Corner<input type="range" min="0" max="80" value={selected.radius} onChange={(e) => updateSelected({ radius: Number(e.target.value) })} /></label>
          </>}
          {selected && <div className="row"><button onClick={duplicateSelected}>Duplicate</button><button className="danger" onClick={deleteSelected}>Delete</button></div>}
        </aside>
      </section>
    </main>
  );
}

export default App;
