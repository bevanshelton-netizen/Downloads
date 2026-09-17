import React, { useMemo, useRef, useState } from 'react';
import { toBlob, toPng } from 'html-to-image';

const PRESETS = {
  'Instagram Post': [1080, 1080],
  'Story / Reel': [1080, 1920],
  'Facebook Post': [1200, 630],
  'LinkedIn Post': [1200, 627],
  'YouTube Thumbnail': [1280, 720],
  'A4 Flyer': [1240, 1754],
};

const FONTS = ['Bebas Neue', 'Montserrat', 'Oswald', 'Playfair Display', 'Poppins', 'Archivo Black'];

const starter = [
  { id: 1, type: 'text', text: 'MAKE IT IMPOSSIBLE TO IGNORE', x: 80, y: 130, w: 760, fontSize: 88, fontFamily: 'Bebas Neue', fontWeight: 700, color: '#ffffff', align: 'left' },
  { id: 2, type: 'text', text: 'Design fast. Brand loud. Share anywhere.', x: 84, y: 350, w: 650, fontSize: 34, fontFamily: 'Montserrat', fontWeight: 700, color: '#b8ff3d', align: 'left' },
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

  const [width, height] = PRESETS[sizeName];
  const selected = elements.find((el) => el.id === selectedId);

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
          <div className="brand-kicker">CREATE • BRAND • SHARE</div>
          <div className="brand-name">IZAKHONO <span>STUDIO</span></div>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={shareDesign}>Share</button>
          <button className="primary" onClick={exportPng}>Export PNG</button>
        </div>
      </header>

      <section className="hero-strip">
        <div>
          <h1>Design fast. <em>Brand loud.</em> Share anywhere.</h1>
          <p>Create social posts, posters, stories, flyers and branded content directly in your browser.</p>
        </div>
        <div className="magic-box">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe what you want to create…" />
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
                <div
                  key={el.id}
                  onPointerDown={(e) => pointerDown(e, el)}
                  className={`design-element ${selectedId === el.id ? 'selected' : ''}`}
                  style={{ left: el.x, top: el.y, width: el.w, height: el.h || 'auto' }}
                >
                  {el.type === 'text' ? (
                    <div style={{ fontFamily: el.fontFamily, fontSize: el.fontSize, fontWeight: el.fontWeight, color: el.color, textAlign: el.align, lineHeight: 0.95, textTransform: 'uppercase' }}>{el.text}</div>
                  ) : (
                    <img src={el.src} alt="Uploaded design element" draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: el.radius }} />
                  )}
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
