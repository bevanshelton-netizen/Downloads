import JSZip from 'jszip';
import { CAMPAIGN_FORMATS } from './portfolio.js';

export const FORMAT_SIZES = {
  'Instagram Post': [1080, 1080],
  'Story / Reel': [1080, 1920],
  'Facebook Post': [1200, 630],
  'LinkedIn Post': [1200, 627],
  'YouTube Thumbnail': [1280, 720],
  'A4 Flyer': [1240, 1754],
};

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const escapeCsv = (value = '') => `"${String(value).replace(/"/g, '""')}"`;

function copyFor(brand, level, brief, offer) {
  const cleanBrief = brief?.trim();
  const cleanOffer = offer?.trim();

  const variants = {
    awareness: {
      eyebrow: brand.category.toUpperCase(),
      headline: brand.name,
      body: cleanBrief || brand.promise,
      cta: brand.cta,
    },
    benefit: {
      eyebrow: `BUILT FOR ${brand.audience.toUpperCase()}`,
      headline: 'SEE WHAT CHANGES WHEN THE RIGHT TOOL IS IN YOUR HANDS',
      body: brand.promise,
      cta: brand.cta,
    },
    offer: {
      eyebrow: 'CURRENT OFFER',
      headline: cleanOffer ? cleanOffer.toUpperCase() : 'DISCOVER THE OFFER',
      body: cleanBrief || brand.promise,
      cta: brand.cta,
    },
    conversion: {
      eyebrow: 'READY WHEN YOU ARE',
      headline: brand.cta,
      body: cleanBrief || brand.promise,
      cta: brand.cta,
    },
    retarget: {
      eyebrow: 'COME BACK TO IT',
      headline: `STILL THINKING ABOUT ${brand.name}?`,
      body: brand.promise,
      cta: brand.cta,
    },
    share: {
      eyebrow: 'SHARE THIS',
      headline: 'KNOW SOMEONE WHO NEEDS THIS?',
      body: `${brand.name}: ${brand.promise}`,
      cta: 'SHARE • OPEN • EXPLORE',
    },
  };

  return variants[level.id] || variants.awareness;
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  const lines = wrapLines(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function hexToRgba(hex, alpha) {
  const raw = hex.replace('#', '');
  const normalized = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const num = Number.parseInt(normalized, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function toBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Creative export failed'))), 'image/png');
  });
}

export async function renderCampaignCreative({ brand, level, format, brief, offer }) {
  const [width, height] = FORMAT_SIZES[format] || FORMAT_SIZES['Instagram Post'];
  const copy = copyFor(brand, level, brief, offer);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, brand.background);
  gradient.addColorStop(1, '#05070c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = brand.accent;
  ctx.lineWidth = Math.max(1, width * 0.002);
  const gap = Math.max(56, Math.round(width * 0.075));
  for (let x = -height; x < width + height; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const orb = ctx.createRadialGradient(width * 0.82, height * 0.8, 0, width * 0.82, height * 0.8, Math.max(width, height) * 0.52);
  orb.addColorStop(0, hexToRgba(brand.accent, 0.75));
  orb.addColorStop(0.45, hexToRgba(brand.accent, 0.16));
  orb.addColorStop(1, hexToRgba(brand.accent, 0));
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, width, height);

  const pad = Math.round(width * 0.075);
  const contentWidth = width - pad * 2;
  const nameSize = Math.max(48, Math.round(width * 0.072));
  const headlineSize = format === 'Story / Reel' ? Math.max(66, Math.round(width * 0.095)) : Math.max(54, Math.round(width * 0.07));
  const bodySize = Math.max(26, Math.round(width * 0.028));

  ctx.textBaseline = 'top';
  ctx.fillStyle = brand.accent;
  ctx.font = `800 ${Math.max(18, Math.round(width * 0.018))}px Montserrat, Arial, sans-serif`;
  ctx.fillText(copy.eyebrow, pad, pad);

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${nameSize}px ${brand.font}, Arial Black, sans-serif`;
  const nameY = pad + Math.round(nameSize * 0.58);
  drawWrapped(ctx, brand.name, pad, nameY, contentWidth, Math.round(nameSize * 0.92), 2);

  const splitY = format === 'Story / Reel' ? Math.round(height * 0.32) : Math.round(height * 0.34);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${headlineSize}px ${brand.font}, Arial Black, sans-serif`;
  const headlineBottom = drawWrapped(ctx, copy.headline, pad, splitY, contentWidth * 0.92, Math.round(headlineSize * 0.94), format === 'Story / Reel' ? 5 : 3);

  ctx.fillStyle = 'rgba(255,255,255,.86)';
  ctx.font = `700 ${bodySize}px Montserrat, Arial, sans-serif`;
  const bodyY = headlineBottom + Math.round(bodySize * 1.2);
  drawWrapped(ctx, copy.body, pad, bodyY, contentWidth * 0.85, Math.round(bodySize * 1.35), format === 'Story / Reel' ? 6 : 4);

  const cueY = height - Math.max(230, Math.round(height * 0.21));
  ctx.fillStyle = hexToRgba(brand.accent, 0.12);
  ctx.strokeStyle = hexToRgba(brand.accent, 0.7);
  ctx.lineWidth = 2;
  const cueH = Math.max(90, Math.round(height * 0.085));
  ctx.beginPath();
  ctx.roundRect(pad, cueY, contentWidth, cueH, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(18, Math.round(width * 0.018))}px Montserrat, Arial, sans-serif`;
  drawWrapped(ctx, brand.visualCue, pad + 24, cueY + 24, contentWidth - 48, Math.round(width * 0.026), 2);

  const buttonY = height - Math.max(100, Math.round(height * 0.095));
  ctx.fillStyle = brand.accent;
  const buttonW = Math.min(contentWidth, Math.max(350, Math.round(width * 0.46)));
  const buttonH = Math.max(62, Math.round(height * 0.065));
  ctx.beginPath();
  ctx.roundRect(pad, buttonY, buttonW, buttonH, buttonH / 2);
  ctx.fill();
  ctx.fillStyle = '#05070b';
  ctx.font = `900 ${Math.max(24, Math.round(width * 0.026))}px Montserrat, Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(copy.cta, pad + Math.round(buttonH * 0.45), buttonY + buttonH / 2);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = `700 ${Math.max(14, Math.round(width * 0.014))}px Montserrat, Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('CREATED IN IZAKHONO STUDIO', width - pad, height - Math.round(pad * 0.42));

  return toBlob(canvas);
}

export function socialCopy({ brand, level, brief, offer, destination = '' }) {
  const copy = copyFor(brand, level, brief, offer);
  const link = destination || '[ADD LIVE PLATFORM URL]';
  const hashtag = `#${brand.name.replace(/[^A-Za-z0-9]/g, '')}`;
  return {
    Facebook: `${copy.headline}\n\n${copy.body}\n\n${copy.cta}: ${link}\n\n${hashtag} #IzakhonoPortfolio`,
    Instagram: `${copy.headline}\n\n${copy.body}\n\n${copy.cta}. Link: ${link}\n\n${hashtag} #SouthAfrica #IzakhonoPortfolio`,
    LinkedIn: `${brand.name} — ${brand.category}\n\n${copy.body}\n\n${copy.cta}: ${link}\n\n${hashtag}`,
    X: `${copy.headline} — ${copy.cta}: ${link} ${hashtag}`.slice(0, 280),
    TikTok: `${copy.headline}\n${copy.body}\n${copy.cta}: ${link}\n${hashtag} #ForYou`,
    YouTube: `${copy.headline}\n\n${copy.body}\n\n${copy.cta}: ${link}`,
  };
}

export async function buildSuperCampaignPack({ brands, levels, formats = CAMPAIGN_FORMATS, brief, offer, destinations = {}, onProgress }) {
  const zip = new JSZip();
  const manifest = [];
  const captions = [['brand', 'campaign_level', 'network', 'format', 'destination', 'caption']];
  const total = brands.length * levels.length * formats.length;
  let completed = 0;

  for (const brand of brands) {
    for (const level of levels) {
      const networkCopy = socialCopy({ brand, level, brief, offer, destination: destinations[brand.id] || '' });
      for (const format of formats) {
        const blob = await renderCampaignCreative({ brand, level, format, brief, offer });
        const path = `${slug(brand.name)}/${level.id}/${slug(format)}.png`;
        zip.file(path, blob);
        manifest.push({ brand: brand.name, level: level.name, format, file: path, destination: destinations[brand.id] || null });
        for (const [network, caption] of Object.entries(networkCopy)) {
          captions.push([brand.name, level.name, network, format, destinations[brand.id] || '[ADD LIVE PLATFORM URL]', caption]);
        }
        completed += 1;
        onProgress?.({ completed, total, brand: brand.name, level: level.name, format });
      }
    }
  }

  zip.file('campaign-manifest.json', JSON.stringify({ generatedAt: new Date().toISOString(), brief, offer, assets: manifest }, null, 2));
  zip.file('social-captions.csv', captions.map((row) => row.map(escapeCsv).join(',')).join('\n'));
  zip.file('README.txt', [
    'IZAKHONO STUDIO — SUPER CAMPAIGN PACK',
    '',
    `Brands: ${brands.length}`,
    `Campaign levels: ${levels.length}`,
    `Formats: ${formats.length}`,
    `Creative files: ${total}`,
    '',
    'The social-captions.csv file contains network-specific copy for Facebook, Instagram, LinkedIn, X, TikTok and YouTube.',
    'Replace any [ADD LIVE PLATFORM URL] placeholders with the canonical live destination before publishing.',
    'Paid media budgets and account publishing are intentionally not activated by this export; connect authorised social publishing accounts before distribution.',
  ].join('\n'));

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
