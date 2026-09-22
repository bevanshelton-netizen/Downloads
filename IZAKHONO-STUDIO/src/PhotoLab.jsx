import React, { useEffect, useRef, useState } from 'react';

const DEFAULTS = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  blur: 0,
};

export default function PhotoLab() {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [fileName, setFileName] = useState('izakhono-photo');
  const [filters, setFilters] = useState(DEFAULTS);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const maxW = 1280;
    const maxH = 820;
    const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight, 1);
    const w = Math.max(1, Math.round(image.naturalWidth * scale));
    const h = Math.max(1, Math.round(image.naturalHeight * scale));
    const quarterTurn = Math.abs(rotation % 180) === 90;

    canvas.width = quarterTurn ? h : w;
    canvas.height = quarterTurn ? w : h;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.filter = [
      `brightness(${filters.brightness}%)`,
      `contrast(${filters.contrast}%)`,
      `saturate(${filters.saturate}%)`,
      `grayscale(${filters.grayscale}%)`,
      `blur(${filters.blur}px)`,
    ].join(' ');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  };

  useEffect(() => {
    draw();
  }, [image, filters, rotation, flipX, flipY]);

  const loadImage = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName((file.name || 'izakhono-photo').replace(/\.[^.]+$/, ''));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const link = document.createElement('a');
    link.download = `${fileName}-edited.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const reset = () => {
    setFilters(DEFAULTS);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
  };

  const set = (key, value) => {
    setFilters((current) => ({ ...current, [key]: Number(value) }));
  };

  return (
    <section className="photo-lab" id="photo-lab">
      <div className="suite-section-copy">
        <span className="suite-eyebrow">WORKING V1 • LOCAL-FIRST</span>
        <h2>Photo Lab</h2>
        <p>Edit everyday photos directly in the browser. The source image stays on the device for this v1 workflow.</p>
      </div>

      <div className="photo-grid">
        <aside className="photo-controls">
          <label className="suite-upload">
            <strong>{image ? 'Replace photo' : 'Upload a photo'}</strong>
            <span>JPG, PNG, WEBP and other browser-readable images</span>
            <input type="file" accept="image/*" onChange={(event) => loadImage(event.target.files?.[0])} />
          </label>

          {[
            ['brightness', 'Brightness', 20, 180, 1],
            ['contrast', 'Contrast', 20, 180, 1],
            ['saturate', 'Saturation', 0, 220, 1],
            ['grayscale', 'Grayscale', 0, 100, 1],
            ['blur', 'Blur', 0, 12, 0.25],
          ].map(([key, label, min, max, step]) => (
            <label className="photo-slider" key={key}>
              <span>{label}<b>{filters[key]}{key === 'blur' ? 'px' : '%'}</b></span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={filters[key]}
                onChange={(event) => set(key, event.target.value)}
                disabled={!image}
              />
            </label>
          ))}

          <div className="photo-actions">
            <button onClick={() => setRotation((r) => (r - 90) % 360)} disabled={!image}>↶ Rotate</button>
            <button onClick={() => setRotation((r) => (r + 90) % 360)} disabled={!image}>Rotate ↷</button>
            <button onClick={() => setFlipX((v) => !v)} disabled={!image}>Flip H</button>
            <button onClick={() => setFlipY((v) => !v)} disabled={!image}>Flip V</button>
            <button onClick={reset} disabled={!image}>Reset</button>
            <button className="suite-primary" onClick={exportPng} disabled={!image}>Export PNG</button>
          </div>
        </aside>

        <div className="photo-stage">
          {image ? (
            <canvas ref={canvasRef} aria-label="Photo preview" />
          ) : (
            <div className="photo-empty">
              <span>PHOTO LAB</span>
              <strong>Drop in a photo and start editing.</strong>
              <p>No cloud upload is required for the current adjustment workflow.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
