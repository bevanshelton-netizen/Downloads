const STORAGE_KEY = 'izakhono-gamer-projects-v1';

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

export function sanitizeGamerProject(input = {}) {
  const allowedPresets = ['Stream Overlay', 'YouTube Thumbnail', 'Esports Card', 'Short / Reel Cover'];
  const allowedThemes = ['Neon', 'Inferno', 'Ice', 'Royal'];
  return {
    version: 1,
    name: cleanText(input.name || 'My Gamer Project', 48),
    preset: allowedPresets.includes(input.preset) ? input.preset : 'Stream Overlay',
    themeName: allowedThemes.includes(input.themeName) ? input.themeName : 'Neon',
    gamerTag: cleanText(input.gamerTag || 'PLAYER ONE', 24),
    team: cleanText(input.team || 'IZAKHONO GAMING', 34),
    message: cleanText(input.message || 'LIVE • RANKED • NO QUIT', 48),
    sponsor: cleanText(input.sponsor || '', 28),
    facecam: input.facecam !== false,
    chatBox: input.chatBox !== false,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function readLocalProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(sanitizeGamerProject) : [];
  } catch {
    return [];
  }
}

export function saveLocalProject(project) {
  const next = sanitizeGamerProject({ ...project, updatedAt: new Date().toISOString() });
  const current = readLocalProjects();
  const withoutSame = current.filter((item) => item.name.toLowerCase() !== next.name.toLowerCase());
  localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...withoutSame].slice(0, 12)));
  return next;
}

export function deleteLocalProject(name) {
  const current = readLocalProjects();
  const next = current.filter((item) => item.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function downloadProjectFile(project) {
  const safe = sanitizeGamerProject(project);
  const blob = new Blob([JSON.stringify({
    product: 'IZAKHONO Gamer Studio',
    format: 'izakhono-gamer-project',
    project: safe,
    note: 'Background/gameplay images are intentionally not embedded in this portable v1 project file.',
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'gamer-project'}.izgamer.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readProjectFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const payload = parsed?.project || parsed;
  return sanitizeGamerProject(payload);
}
