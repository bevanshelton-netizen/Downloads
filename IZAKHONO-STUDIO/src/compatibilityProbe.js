function extensionOf(name = '') {
  return name.split('.').pop()?.toLowerCase() || '';
}

function fingerprint(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function asciiPrefix(bytes, length = 16) {
  return Array.from(bytes.slice(0, length), (value) => String.fromCharCode(value)).join('');
}

function countNodes(nodes = []) {
  return nodes.reduce((total, node) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    return total + 1 + countNodes(children);
  }, 0);
}

async function readPrefix(file, length = 32) {
  const buffer = await file.slice(0, length).arrayBuffer();
  return new Uint8Array(buffer);
}

export { extensionOf, fingerprint };

export async function inspectCompatibility(file) {
  const extension = extensionOf(file.name);

  if (extension === 'psd') {
    const [{ readPsd }, buffer] = await Promise.all([
      import('ag-psd'),
      file.arrayBuffer(),
    ]);

    const psd = readPsd(buffer, {
      skipLayerImageData: true,
      skipCompositeImageData: true,
      skipThumbnail: true,
    });

    const nodeCount = countNodes(psd.children || []);
    return {
      state: 'parsed',
      status: 'PSD STRUCTURE READ',
      format: 'PSD',
      summary: `${psd.width || '?'}×${psd.height || '?'} px • ${nodeCount} layers/groups detected locally.`,
      fidelity: 'Structure is readable. Editable visual fidelity, effects, fonts and smart-object behaviour still require staged validation.',
      localOnly: true,
    };
  }

  if (extension === 'ai') {
    const prefix = asciiPrefix(await readPrefix(file, 12), 12);
    const pdfCompatible = prefix.startsWith('%PDF-');
    return {
      state: pdfCompatible ? 'candidate' : 'preserved',
      status: pdfCompatible ? 'PDF-COMPATIBLE AI DETECTED' : 'AI SOURCE PRESERVED',
      format: 'AI',
      summary: pdfCompatible
        ? 'This Illustrator file exposes a PDF container and can enter the PDF extraction path next.'
        : 'No PDF header was detected in the first bytes; preserve the original and use the dedicated Illustrator conversion path.',
      fidelity: 'Illustrator-specific editability is not claimed yet.',
      localOnly: true,
    };
  }

  if (extension === 'pdf') {
    const prefix = asciiPrefix(await readPrefix(file, 8), 8);
    const valid = prefix.startsWith('%PDF-');
    return {
      state: valid ? 'validated' : 'review',
      status: valid ? 'PDF SIGNATURE VERIFIED' : 'PDF REVIEW',
      format: 'PDF',
      summary: valid
        ? 'The file signature matches a PDF container and is ready for the document import pipeline.'
        : 'The extension says PDF, but the expected PDF signature was not found.',
      fidelity: 'Page-level rendering/import still requires the PDF module.',
      localOnly: true,
    };
  }

  if (extension === 'eps') {
    const prefix = asciiPrefix(await readPrefix(file, 16), 16);
    const valid = prefix.startsWith('%!PS-Adobe-');
    return {
      state: valid ? 'validated' : 'review',
      status: valid ? 'EPS SIGNATURE VERIFIED' : 'EPS REVIEW',
      format: 'EPS',
      summary: valid
        ? 'A PostScript/EPS signature was detected. The original is safe to route into the vector conversion path.'
        : 'The expected EPS/PostScript signature was not detected.',
      fidelity: 'Editable vector conversion is not claimed yet.',
      localOnly: true,
    };
  }

  if (extension === 'svg') {
    const text = await file.text();
    const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
    const root = parsed.documentElement;
    const valid = root?.nodeName?.toLowerCase() === 'svg' && !parsed.querySelector('parsererror');
    return {
      state: valid ? 'validated' : 'review',
      status: valid ? 'SVG VALIDATED' : 'SVG REVIEW',
      format: 'SVG',
      summary: valid
        ? 'The SVG parses as vector XML and can enter the current vector workflow.'
        : 'The SVG could not be cleanly parsed as vector XML.',
      fidelity: valid ? 'Vector structure remains available.' : 'Original preserved for review.',
      localOnly: true,
    };
  }

  return null;
}
