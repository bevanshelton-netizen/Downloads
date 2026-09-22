import React, { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { extensionOf, fingerprint, inspectCompatibility } from './compatibilityProbe.js';

const DIRECT = new Set(['png','jpg','jpeg','webp','svg']);
const READY = new Set(['pdf','mp4','mov','wav','mp3','m4a']);
const SOURCE = new Set(['psd','psb','ai','indd','aep','prproj','eps']);

function classify(file) {
  const e = extensionOf(file.name);
  if (DIRECT.has(e)) return { level:'direct', label:'DIRECT NOW', note:'Can enter the current browser-first creative workflow.' };
  if (READY.has(e)) return { level:'ready', label:'SUITE-READY', note:'Recognised common format; matching module import lands as that editor ships.' };
  if (SOURCE.has(e)) return { level:'convert', label:'CONVERSION PATH', note:'Proprietary/source format. Preserve the original and migrate through a compatible conversion/import layer.' };
  return { level:'review', label:'REVIEW', note:'Preserved in the migration pack for compatibility review.' };
}

export default function SwitchCenter() {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState({});

  const inventory = useMemo(() => files.map((file) => ({ file, ...classify(file) })), [files]);
  const counts = useMemo(() => inventory.reduce((acc, item) => {
    acc[item.level] = (acc[item.level] || 0) + 1;
    return acc;
  }, {}), [inventory]);

  const scanFile = async (file) => {
    const key = fingerprint(file);
    setAnalysis((current) => ({
      ...current,
      [key]: {
        state: 'pending',
        status: 'LOCAL COMPATIBILITY CHECK',
        summary: 'Reading only the format information needed to determine a safe migration path.',
        localOnly: true,
      },
    }));

    try {
      const result = await inspectCompatibility(file);
      setAnalysis((current) => {
        if (!result) {
          const next = { ...current };
          delete next[key];
          return next;
        }
        return { ...current, [key]: result };
      });
    } catch (error) {
      setAnalysis((current) => ({
        ...current,
        [key]: {
          state: 'review',
          status: 'PROBE COULD NOT COMPLETE',
          summary: 'The original is still preserved. This file stays on the review/conversion path rather than being silently discarded.',
          fidelity: error?.message ? `Parser note: ${error.message}` : 'No editable-import claim is made.',
          localOnly: true,
        },
      }));
    }
  };

  const addFiles = (incoming) => {
    const next = Array.from(incoming || []);
    next.forEach((file) => scanFile(file));
    setFiles((current) => {
      const seen = new Set(current.map((f) => fingerprint(f)));
      return [...current, ...next.filter((f) => !seen.has(fingerprint(f)))];
    });
  };

  const remove = (target) => {
    const key = fingerprint(target);
    setFiles((current) => current.filter((file) => file !== target));
    setAnalysis((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const exportPack = async () => {
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      const originals = zip.folder('originals');
      for (const file of files) originals.file(file.name, file);

      const manifest = inventory.map(({ file, level, label, note }) => ({
        name: file.name,
        size: file.size,
        type: file.type || 'unknown',
        extension: extensionOf(file.name),
        migrationLevel: level,
        status: label,
        note,
        compatibilityProbe: analysis[fingerprint(file)] || null,
      }));

      zip.file('migration-manifest.json', JSON.stringify({
        product: 'IZAKHONO CREATIVE SUITE',
        generatedAt: new Date().toISOString(),
        policy: 'Preserve originals. Convert only when needed. Do not lock users in.',
        privacy: 'Compatibility probes are designed to run locally in the browser. No upload is required for these checks.',
        totals: counts,
        files: manifest,
      }, null, 2));

      zip.file('README.txt', [
        'IZAKHONO CREATIVE SUITE — SWITCH CENTER',
        '',
        'This pack preserves your original files plus a migration manifest.',
        'DIRECT NOW: common image/vector formats that fit the current browser-first workflow.',
        'SUITE-READY: common media/document formats recognised for matching suite modules.',
        'CONVERSION PATH: proprietary/source formats that need a compatible import/conversion layer.',
        'COMPATIBILITY PROBE: local format checks can validate structure/signatures without changing your original.',
        '',
        'IZAKHONO policy: preserve originals, support open/common export formats, and avoid customer lock-in.',
      ].join('\n'));

      const blob = await zip.generateAsync({ type:'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `izakhono-switch-pack-${new Date().toISOString().slice(0,10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="switch-center" id="switch-center">
      <div className="suite-section-copy">
        <span className="suite-eyebrow">SWITCH CENTER • KEEP YOUR WORK</span>
        <h2>Move without starting over.</h2>
        <p>Bring existing creative files into one migration inventory. Originals are preserved, common formats are accepted first, and proprietary source files are inspected or flagged for compatible conversion rather than silently discarded.</p>
      </div>

      <div className="switch-grid">
        <div className="switch-drop">
          <label className="suite-upload switch-upload">
            <strong>Add creative files</strong>
            <span>Images, SVG, PDF, video, audio and major source-project formats can be inventoried together.</span>
            <input
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,.mp4,.mov,.wav,.mp3,.m4a,.psd,.psb,.ai,.indd,.aep,.prproj,.eps"
              onChange={(event) => addFiles(event.target.files)}
            />
          </label>

          <div className="switch-counts">
            <div><strong>{files.length}</strong><span>files queued</span></div>
            <div><strong>{counts.direct || 0}</strong><span>direct now</span></div>
            <div><strong>{counts.ready || 0}</strong><span>suite-ready</span></div>
            <div><strong>{counts.convert || 0}</strong><span>conversion path</span></div>
          </div>

          <button className="switch-export" disabled={!files.length || busy} onClick={exportPack}>
            {busy ? 'BUILDING SWITCH PACK…' : 'EXPORT MIGRATION PACK'}
          </button>
          <small className="switch-note">Compatibility probes run locally where implemented. Full native editability is claimed only after a format passes real-file fidelity testing.</small>
        </div>

        <div className="switch-inventory">
          {inventory.length === 0 ? (
            <div className="switch-empty">
              <b>Your work belongs to you.</b>
              <span>Add files to see exactly what can move directly, what can be structurally inspected and what still needs a conversion path.</span>
            </div>
          ) : inventory.map((item) => {
            const probe = analysis[fingerprint(item.file)];
            return (
              <div className="switch-file" key={fingerprint(item.file)}>
                <div className="switch-file-main">
                  <strong>{item.file.name}</strong>
                  <span>{(item.file.size / (1024 * 1024)).toFixed(item.file.size > 1024 * 1024 ? 1 : 2)} MB • .{extensionOf(item.file.name) || 'file'}</span>
                </div>
                <div className={`switch-badge ${item.level}`}>{item.label}</div>
                <p>{item.note}</p>
                {probe && (
                  <small className="switch-note">
                    <b>{probe.status}</b> — {probe.summary}{probe.fidelity ? ` ${probe.fidelity}` : ''}
                  </small>
                )}
                <button onClick={() => remove(item.file)}>Remove</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="switch-promise">
        <div><b>NO LOCK-IN</b><span>Export to common formats and keep originals.</span></div>
        <div><b>NO REBUILD TAX</b><span>Migration tooling is part of the product, not an afterthought.</span></div>
        <div><b>NO FORCED CLOUD</b><span>Local-first processing remains the default where practical.</span></div>
        <div><b>ONE $5 CORE PLAN</b><span>Switching should reduce cost and complexity, not add another subscription maze.</span></div>
      </div>
    </section>
  );
}
