import React, { useMemo, useRef, useState } from 'react';

const MAX_EXPORT_SECONDS = 60;

const OUTPUTS = {
  'Landscape 16:9': { width: 1280, height: 720, label: 'YouTube / landscape' },
  'Vertical 9:16': { width: 720, height: 1280, label: 'Shorts / Reels / TikTok' },
  'Square 1:1': { width: 720, height: 720, label: 'Feed / promo' },
};

function formatTime(value) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function safeName(value) {
  return String(value || 'gameplay-clip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gameplay-clip';
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    if (!video || !Number.isFinite(time)) return resolve();
    if (Math.abs(video.currentTime - time) < 0.05) return resolve();
    const done = () => resolve();
    video.addEventListener('seeked', done, { once: true });
    video.currentTime = time;
  });
}

function drawCover(ctx, video, width, height, caption) {
  const srcW = video.videoWidth || width;
  const srcH = video.videoHeight || height;
  const srcRatio = srcW / srcH;
  const dstRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (srcRatio > dstRatio) {
    sw = srcH * dstRatio;
    sx = (srcW - sw) / 2;
  } else if (srcRatio < dstRatio) {
    sh = srcW / dstRatio;
    sy = (srcH - sh) / 2;
  }

  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

  if (caption.trim()) {
    const fontSize = Math.max(26, Math.round(width * 0.035));
    const pad = Math.round(fontSize * 0.75);
    const text = caption.trim().slice(0, 90);
    ctx.font = `900 ${fontSize}px Arial Black, Arial, sans-serif`;
    ctx.textBaseline = 'bottom';
    const metrics = ctx.measureText(text);
    const boxW = Math.min(width - pad * 2, metrics.width + pad * 2);
    const x = (width - boxW) / 2;
    const y = height - Math.round(height * 0.06);

    ctx.fillStyle = 'rgba(4,7,12,.78)';
    ctx.beginPath();
    ctx.roundRect(x, y - fontSize - pad, boxW, fontSize + pad * 1.35, Math.round(fontSize * .4));
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text, width / 2, y - pad * .25);
    ctx.textAlign = 'left';
  }
}

function pickMimeType() {
  if (!window.MediaRecorder) return '';
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return types.find((type) => window.MediaRecorder.isTypeSupported?.(type)) || '';
}

export default function GamerClipLab() {
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('');
  const [duration, setDuration] = useState(0);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const [outputName, setOutputName] = useState('Vertical 9:16');
  const [caption, setCaption] = useState('CLUTCH MOMENT');
  const [moments, setMoments] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('Import gameplay to create a local highlight. Nothing uploads in this v1 workflow.');

  const output = OUTPUTS[outputName];
  const selectedLength = useMemo(() => Math.max(0, outPoint - inPoint), [inPoint, outPoint]);
  const canRecord = typeof window !== 'undefined'
    && Boolean(window.MediaRecorder)
    && Boolean(HTMLCanvasElement.prototype.captureStream);

  const setSource = (file) => {
    if (!file) return;
    setVideoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    setVideoName(file.name);
    setDuration(0);
    setInPoint(0);
    setOutPoint(0);
    setMoments([]);
    setStatus(file.size > 2 * 1024 * 1024 * 1024
      ? 'Large local file loaded. Browser export may be demanding; the source is still not uploaded.'
      : 'Gameplay loaded locally. Set IN/OUT points or mark a moment.');
  };

  const loadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const d = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(d);
    setInPoint(0);
    setOutPoint(Math.min(d, 30));
  };

  const setInSafe = (value) => {
    const next = Math.max(0, Math.min(Number(value) || 0, Math.max(0, outPoint - 0.1)));
    setInPoint(next);
  };

  const setOutSafe = (value) => {
    const requested = Number(value) || 0;
    const maxByLength = Math.min(duration, inPoint + MAX_EXPORT_SECONDS);
    setOutPoint(Math.max(inPoint + 0.1, Math.min(requested, maxByLength)));
  };

  const setInFromPlayhead = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(video.currentTime, Math.max(0, outPoint - 0.1));
    setInPoint(next);
    if (outPoint - next > MAX_EXPORT_SECONDS) setOutPoint(Math.min(duration, next + MAX_EXPORT_SECONDS));
  };

  const setOutFromPlayhead = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(inPoint + 0.1, Math.min(video.currentTime, inPoint + MAX_EXPORT_SECONDS, duration));
    setOutPoint(next);
  };

  const markMoment = () => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const value = Math.round(video.currentTime * 10) / 10;
    setMoments((current) => [...new Set([...current, value])].sort((a, b) => a - b).slice(0, 12));
    setStatus(`Marked ${formatTime(value)}. Use it to make a 20-second highlight window.`);
  };

  const useMoment = (time) => {
    const start = Math.max(0, time - 7);
    const end = Math.min(duration, start + 20);
    setInPoint(start);
    setOutPoint(end);
    const video = videoRef.current;
    if (video) video.currentTime = start;
  };

  const previewSelection = async () => {
    const video = videoRef.current;
    if (!video || !duration) return;
    await seekVideo(video, inPoint);
    setPreviewing(true);
    try {
      await video.play();
      setStatus(`Previewing ${formatTime(inPoint)} → ${formatTime(outPoint)}.`);
    } catch {
      setStatus('Preview could not auto-play. Press play on the video, then use the IN/OUT controls.');
    }
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (previewing && video && video.currentTime >= outPoint) {
      video.pause();
      setPreviewing(false);
      setStatus('Selection preview complete.');
    }
  };

  const exportRecipe = () => {
    if (!videoName || !duration) return;
    const payload = {
      product: 'IZAKHONO Gamer Clip Lab',
      version: 1,
      sourceFile: videoName,
      inPoint,
      outPoint,
      selectedSeconds: selectedLength,
      output: { name: outputName, ...output },
      caption: caption.trim(),
      localFirst: true,
      note: 'Edit-decision recipe only. The source gameplay file is not embedded.',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName(videoName)}-clip-recipe.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Clip recipe exported. It preserves the edit decision without uploading the source video.');
  };

  const captureThumbnail = () => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const canvas = document.createElement('canvas');
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext('2d');
    drawCover(ctx, video, output.width, output.height, caption);
    const link = document.createElement('a');
    link.download = `${safeName(videoName)}-${safeName(outputName)}-thumbnail.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setStatus('Thumbnail captured locally from the current gameplay frame.');
  };

  const exportClip = async () => {
    const video = videoRef.current;
    if (!video || !duration || exporting) return;

    if (!canRecord) {
      exportRecipe();
      setStatus('This browser cannot render the local clip directly, so an edit recipe was exported instead.');
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      exportRecipe();
      setStatus('No compatible local WebM recorder was found. Exported an edit recipe instead.');
      return;
    }

    setExporting(true);
    setPreviewing(false);
    setStatus('Rendering locally in your browser. Keep this tab open until export finishes.');

    const restoreTime = video.currentTime;
    const restoreMuted = video.muted;
    const wasPaused = video.paused;
    const canvas = document.createElement('canvas');
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext('2d');

    let timer;
    let canvasStream;
    let sourceStream;
    let recorder;

    try {
      await seekVideo(video, inPoint);
      drawCover(ctx, video, output.width, output.height, caption);

      canvasStream = canvas.captureStream(30);
      const capture = video.captureStream || video.mozCaptureStream;
      if (capture) {
        try {
          sourceStream = capture.call(video);
          sourceStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
        } catch {
          sourceStream = null;
        }
      }

      const chunks = [];
      recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: output.width >= 1200 ? 6_000_000 : 4_000_000,
      });

      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };

      recorder.start(500);
      video.muted = true;
      await video.play();

      timer = window.setInterval(() => {
        drawCover(ctx, video, output.width, output.height, caption);
        if (video.currentTime >= outPoint || video.ended) {
          window.clearInterval(timer);
          video.pause();
          if (recorder.state !== 'inactive') recorder.stop();
        }
      }, 33);

      await stopped;

      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName(videoName)}-${safeName(outputName)}.webm`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      const audioNote = sourceStream?.getAudioTracks?.().length
        ? 'Audio track was available to the browser.'
        : 'Browser audio capture was unavailable, so this export may be silent.';
      setStatus(`Local clip exported as WebM. ${audioNote}`);
    } catch (error) {
      setStatus(`Local video export failed: ${error?.message || 'browser media error'}. Use Export Recipe as the safe fallback.`);
    } finally {
      if (timer) window.clearInterval(timer);
      if (recorder?.state && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
      canvasStream?.getTracks?.().forEach((track) => track.stop());
      sourceStream?.getTracks?.().forEach((track) => track.stop());
      video.pause();
      video.muted = restoreMuted;
      await seekVideo(video, Math.min(restoreTime, duration));
      if (!wasPaused) {
        try { await video.play(); } catch {}
      }
      setExporting(false);
    }
  };

  return (
    <section className="clip-lab" id="gamer-clip-lab">
      <div className="suite-section-copy">
        <span className="suite-eyebrow">GAMER CLIP LAB • LOCAL-FIRST V1</span>
        <h2>Turn the best moment into the next post.</h2>
        <p>Import gameplay from your device, mark moments, choose a clip window up to 60 seconds, reframe for landscape/vertical/square, add a headline and export locally. Browser recording support varies, so an open edit-recipe export is always available as the fallback.</p>
      </div>

      <div className="clip-grid">
        <aside className="clip-controls">
          <label className="suite-upload">
            <strong>Import gameplay video</strong>
            <span>MP4/WebM/MOV support depends on the browser codec. The source file stays on this device.</span>
            <input type="file" accept="video/*" onChange={(e) => setSource(e.target.files?.[0])} />
          </label>

          <label>Output
            <select value={outputName} onChange={(e) => setOutputName(e.target.value)}>
              {Object.entries(OUTPUTS).map(([name, meta]) => <option key={name} value={name}>{name} — {meta.label}</option>)}
            </select>
          </label>

          <label>Headline / caption
            <input value={caption} maxLength={90} onChange={(e) => setCaption(e.target.value)} />
          </label>

          <div className="clip-range-card">
            <div><b>IN</b><strong>{formatTime(inPoint)}</strong></div>
            <input disabled={!duration} type="range" min="0" max={Math.max(0, duration)} step="0.1" value={inPoint} onChange={(e) => setInSafe(e.target.value)} />
            <button type="button" disabled={!duration} onClick={setInFromPlayhead}>Set IN to playhead</button>
          </div>

          <div className="clip-range-card">
            <div><b>OUT</b><strong>{formatTime(outPoint)}</strong></div>
            <input disabled={!duration} type="range" min="0" max={Math.max(0, duration)} step="0.1" value={outPoint} onChange={(e) => setOutSafe(e.target.value)} />
            <button type="button" disabled={!duration} onClick={setOutFromPlayhead}>Set OUT to playhead</button>
          </div>

          <div className="clip-selection">
            <span>Selection</span>
            <strong>{selectedLength.toFixed(1)} sec</strong>
            <small>Local browser render is capped at {MAX_EXPORT_SECONDS} seconds in v1.</small>
          </div>

          <div className="clip-actions">
            <button type="button" disabled={!duration || exporting} onClick={previewSelection}>Preview</button>
            <button type="button" disabled={!duration || exporting} onClick={markMoment}>Mark moment</button>
            <button type="button" disabled={!duration || exporting} onClick={captureThumbnail}>Capture thumbnail</button>
            <button type="button" disabled={!duration || exporting} onClick={exportRecipe}>Export recipe</button>
            <button className="clip-export" type="button" disabled={!duration || exporting || selectedLength <= 0} onClick={exportClip}>
              {exporting ? 'Rendering locally…' : canRecord ? 'Export WebM clip' : 'Export compatible recipe'}
            </button>
          </div>
        </aside>

        <div className="clip-workspace">
          <div className="clip-preview" style={{ aspectRatio: `${output.width} / ${output.height}` }}>
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  onLoadedMetadata={loadedMetadata}
                  onTimeUpdate={onTimeUpdate}
                />
                {caption.trim() && <div className="clip-caption">{caption.trim()}</div>}
              </>
            ) : (
              <div className="clip-empty">
                <span>GAMEPLAY → HIGHLIGHT</span>
                <strong>Your next clip starts here.</strong>
                <p>Import a gameplay recording to mark the clutch, goal, win, reaction or tutorial moment.</p>
              </div>
            )}
          </div>

          <div className="clip-moments">
            <div><b>Marked moments</b><span>{moments.length}/12</span></div>
            {moments.length === 0 ? <small>Use “Mark moment” while the video is on an important play.</small> : (
              <div className="clip-moment-list">
                {moments.map((moment) => (
                  <span key={moment}>
                    <button type="button" onClick={() => useMoment(moment)}>Use {formatTime(moment)}</button>
                    <button type="button" aria-label={`Remove moment ${formatTime(moment)}`} onClick={() => setMoments((current) => current.filter((item) => item !== moment))}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="clip-status" role="status">{status}</div>
        </div>
      </div>

      <div className="clip-value-grid">
        <article><b>ZERO UPLOAD BY DEFAULT</b><span>Gameplay editing and supported export happen locally in the browser.</span></article>
        <article><b>SHORT-FORM READY</b><span>Vertical, square and landscape reframing for creator distribution.</span></article>
        <article><b>MARGIN SAFE</b><span>Local rendering protects the $15 plan from uncontrolled cloud-render cost.</span></article>
        <article><b>OPEN FALLBACK</b><span>Edit recipes remain portable when a browser cannot render the final clip.</span></article>
      </div>
    </section>
  );
}
