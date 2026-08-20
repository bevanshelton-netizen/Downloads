'use client';

import { useState } from 'react';

export default function UploadEpisode({ episodeId, hasVideo }: { episodeId: string; hasVideo: boolean }) {
  const [status, setStatus] = useState(hasVideo ? 'Video attached' : 'No video yet');
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      setStatus('Creating secure upload…');
      const create = await fetch('/api/video/direct-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ episodeId }),
      });
      const session = await create.json();
      if (!create.ok) throw new Error(session.error || 'Could not create upload');

      setStatus('Uploading video…');
      if (session.provider !== 'mock') {
        const form = new FormData();
        form.append('file', file);
        const uploaded = await fetch(session.uploadUrl, { method: 'POST', body: form });
        if (!uploaded.ok) throw new Error('Video upload failed');
      }

      const finalise = await fetch('/api/video/finalize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ episodeId, assetId: session.assetId }),
      });
      const result = await finalise.json();
      if (!finalise.ok) throw new Error(result.error || 'Could not attach video');
      setStatus('Uploaded • awaiting moderation');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="uploadControl">
      <span>{status}</span>
      <label className="secondary uploadButton">
        {busy ? 'Working…' : hasVideo ? 'Replace video' : 'Upload video'}
        <input
          type="file"
          accept="video/*"
          disabled={busy}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
    </div>
  );
}
