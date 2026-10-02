const SVG = 'http://www.w3.org/2000/svg';
const SERIALIZER = new XMLSerializer();
const MAX_PIXELS = 8_000_000;

function length(value) {
  const match = /^\s*(\d*\.?\d+(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(value || '');
  if (!match) return null;
  const factor = { px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
  return Number(match[1]) * (factor[(match[2] || 'px').toLowerCase()]);
}

function parse(source) {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.querySelector('parsererror') || root.localName !== 'svg' || root.namespaceURI !== SVG) {
    throw new Error('This file is not a valid SVG.');
  }
  if (/<\?xml-stylesheet\b|<!ENTITY\b/i.test(source)) {
    throw new Error('Embed external resources before trimming this SVG.');
  }
  // Keep uploads out of the page DOM. Reject content that cannot be measured
  // faithfully in SVG image mode, rather than silently dropping that content.
  for (const node of [root, ...root.querySelectorAll('*')]) {
    if (/^(script|foreignObject|animate|animateTransform|animateMotion|set)$/i.test(node.localName)) {
      throw new Error('Use a static SVG without scripts, animation or embedded HTML.');
    }
    for (const attribute of node.attributes) {
      if (/^on/i.test(attribute.localName)) throw new Error('Remove scripts before trimming this SVG.');
      if (attribute.localName === 'href' && attribute.value && !attribute.value.startsWith('#')) {
        const embeddedImage = /^(image|feImage)$/.test(node.localName) && /^data:image\/(png|jpeg|webp);base64,/i.test(attribute.value);
        if (!embeddedImage) throw new Error('Embed linked images and other external resources first.');
      }
    }
    const css = node.localName === 'style' ? node.textContent : node.getAttribute('style') || '';
    if (/@import|@font-face|@media|@keyframes|\banimation\s*:|:root|\\/i.test(css)) {
      throw new Error('Use static, self-contained SVG styles and outline any custom fonts first.');
    }
    const values = css + ' ' + [...node.attributes].map(a => a.value).join(' ');
    for (const match of values.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
      if (!match[2].trim().startsWith('#')) throw new Error('Embed external resources before trimming this SVG.');
    }
  }
  const vb = root.hasAttribute('viewBox') ? root.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number) : null;
  if (vb && (vb.length !== 4 || !vb.every(Number.isFinite) || vb[2] <= 0 || vb[3] <= 0)) {
    throw new Error('The SVG has an invalid viewBox.');
  }
  let width = length(root.style.width || root.getAttribute('width'));
  let height = length(root.style.height || root.getAttribute('height'));
  if (vb) {
    width ??= height ? height * vb[2] / vb[3] : vb[2];
    height ??= width * vb[3] / vb[2];
  }
  if (!(width > 0 && height > 0) || !Number.isFinite(width * height) || Math.max(width, height) > 1e7) {
    throw new Error('The SVG needs a finite, positive width and height or viewBox.');
  }
  return { root, width, height, vb };
}

function freezeViewport(root, width, height) {
  for (const [key, value] of Object.entries({ width, height, x: 0, y: 0 })) {
    root.setAttribute(key, String(value));
    root.style.setProperty(key, `${value}px`, 'important');
  }
  // Match the original image viewport even after nesting the source SVG.
  root.style.setProperty('overflow', 'hidden', 'important');
}

async function render(source, width, height, placement = null) {
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  const img = new Image();
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { img.src = ''; reject(new Error('This SVG took too long to render.')); }, 15000);
      img.onload = () => { clearTimeout(timeout); resolve(); };
      img.onerror = () => { clearTimeout(timeout); reject(new Error('The browser could not render this SVG.')); };
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('This browser could not create a preview.');
    if (placement) ctx.drawImage(img, ...placement);
    else ctx.drawImage(img, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    canvas.width = canvas.height = 1;
    return pixels;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Exact outer limits for the common Illustrator export: one group, clipped
// by one rectangle in the artboard's coordinate system. Raster bounds can be
// tightened to these limits without losing anti-aliased edges (e.g. 297.4px).
function rectangularClipLimit({ root, width, height, vb }) {
  if (vb && (vb[0] || vb[1] || vb[2] !== width || vb[3] !== height)) return null;
  if (root.querySelector('style') || root.hasAttribute('transform') || root.hasAttribute('filter') || root.hasAttribute('style')) return null;
  const children = [...root.children].filter(n => !['defs', 'title', 'desc', 'metadata'].includes(n.localName));
  if (children.length !== 1) return null;
  const group = children[0];
  if (group.localName !== 'g' || group.hasAttribute('transform') || group.hasAttribute('style')) return null;
  const ref = /^url\(\s*['"]?#([^'"\s)]+)['"]?\s*\)$/.exec(group.getAttribute('clip-path') || '');
  if (!ref) return null;
  const clip = [...root.querySelectorAll('clipPath')].find(n => n.id === ref[1]);
  if (!clip || clip.children.length !== 1 || clip.hasAttribute('transform') || clip.hasAttribute('style') || (clip.hasAttribute('clipPathUnits') && clip.getAttribute('clipPathUnits') !== 'userSpaceOnUse')) return null;
  const rect = clip.firstElementChild;
  if (rect.localName !== 'rect' || rect.hasAttribute('transform') || rect.hasAttribute('style')) return null;
  const x = length(rect.getAttribute('x') || '0'), y = length(rect.getAttribute('y') || '0');
  const w = length(rect.getAttribute('width')), h = length(rect.getAttribute('height'));
  if ([x, y, w, h].some(n => n === null) || w <= 0 || h <= 0) return null;
  return { left: Math.max(0, x), top: Math.max(0, y), right: Math.min(width, x + w), bottom: Math.min(height, y + h) };
}

export async function trimSvg(source) {
  const parsed = parse(source);
  const { root, width, height } = parsed;
  const clip = rectangularClipLimit(parsed);
  const scale = Math.min(8, 4096 / Math.max(width, height), Math.sqrt(MAX_PIXELS / (width * height)));
  const rw = Math.max(1, Math.floor(width * scale)), rh = Math.max(1, Math.floor(height * scale));
  freezeViewport(root, width, height);
  const pixels = await render(SERIALIZER.serializeToString(root), rw, rh);
  let left = rw, top = rh, right = -1, bottom = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (pixels[(y * rw + x) * 4 + 3] !== 0) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < 0) throw new Error('No visible artwork found. This file was not downloaded.');
  // One sample of breathing room protects faint strokes, soft masks and
  // antialiasing. At normal illustration sizes this is a fraction of a pixel.
  left = Math.max(0, left - 1) * width / rw;
  top = Math.max(0, top - 1) * height / rh;
  right = Math.min(rw, right + 2) * width / rw;
  bottom = Math.min(rh, bottom + 2) * height / rh;
  if (clip) {
    left = Math.max(left, clip.left); top = Math.max(top, clip.top);
    right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom);
  }
  left = Math.floor(left * 1e6) / 1e6; top = Math.floor(top * 1e6) / 1e6;
  right = Math.ceil(right * 1e6) / 1e6; bottom = Math.ceil(bottom * 1e6) / 1e6;
  const croppedWidth = Number((right - left).toFixed(6));
  const croppedHeight = Number((bottom - top).toFixed(6));
  const changed = left > 0 || top > 0 || right < width || bottom < height;
  let svg = source;
  if (changed) {
    // Keep the source viewport: simply changing its viewBox would change
    // percentage-based shapes, patterns, user-space masks and filter regions.
    const outer = document.createElementNS(SVG, 'svg');
    outer.setAttribute('width', croppedWidth);
    outer.setAttribute('height', croppedHeight);
    outer.setAttribute('viewBox', `${left} ${top} ${croppedWidth} ${croppedHeight}`);
    outer.setAttribute('overflow', 'hidden');
    outer.append(root);
    svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + SERIALIZER.serializeToString(outer) + '\n';
    // Nesting can affect unusual CSS selectors (for example "svg svg").
    // Verify the exported artwork against the source before offering a file.
    const check = await render(svg, rw, rh, [left * rw / width, top * rh / height, croppedWidth * rw / width, croppedHeight * rh / height]);
    let difference = 0, painted = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] || check[i + 3]) painted++;
      difference += Math.abs(pixels[i + 3] - check[i + 3]);
      for (let channel = 0; channel < 3; channel++) {
        difference += Math.abs(pixels[i + channel] * pixels[i + 3] / 255 - check[i + channel] * check[i + 3] / 255);
      }
    }
    if (difference / Math.max(1, painted * 4) > 2) {
      throw new Error('Trimming changed the appearance of this SVG. Simplify its styles or outline text and try again.');
    }
  }
  return { svg, width, height, croppedWidth, croppedHeight, changed, bounds: { left, top, right, bottom } };
}
