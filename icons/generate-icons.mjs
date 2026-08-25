/* generate-icons.mjs — Creates PNG icons from embedded pixel data.
 * Run: node icons/generate-icons.mjs
 * Requires: none (uses pure Node.js Buffer + minimal PNG encoder)
 */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* Minimal PNG encoder (no dependencies) */
function createPNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([t, data]));
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, t, data, c]);
  }

  /* CRC-32 */
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /* IHDR */
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  /* IDAT: filter type 0 (None) per row */
  const rowLen = width * 4 + 1;
  const raw = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0; // filter: None
    rgba.copy(raw, y * rowLen + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = deflateSync(raw, { level: 9 });

  /* IEND */
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend),
  ]);
}

/* Draw a simple icon programmatically */
function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const xi = Math.floor(x), yi = Math.floor(y);
    const i = (yi * size + xi) * 4;
    // Alpha blend
    const srcA = a / 255;
    const dstA = buf[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA > 0) {
      buf[i]     = Math.round((r * srcA + buf[i] * dstA * (1 - srcA)) / outA);
      buf[i + 1] = Math.round((g * srcA + buf[i+1] * dstA * (1 - srcA)) / outA);
      buf[i + 2] = Math.round((b * srcA + buf[i+2] * dstA * (1 - srcA)) / outA);
      buf[i + 3] = Math.round(outA * 255);
    }
  }

  function fillRect(x0, y0, w, h, r, g, b, a) {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) setPixel(x, y, r, g, b, a);
  }

  function fillCircle(cx, cy, radius, r, g, b, a) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++)
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 <= r2) {
          const edge = Math.max(0, 1 - (Math.sqrt(d2) - radius + 1));
          setPixel(x, y, r, g, b, Math.round(a * edge));
        }
      }
  }

  function drawLine(x0, y0, x1, y1, r, g, b, a, thickness) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(len * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t, y = y0 + dy * t;
      fillCircle(x, y, thickness / 2, r, g, b, a);
    }
  }

  const s = size;
  const margin = Math.round(s * 0.12);

  // Background: dark blue-black with rounded corners (approximate)
  fillRect(0, 0, s, s, 5, 8, 20, 255);

  // Radial gradient approximation (lighter center)
  const center = s / 2;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2) / (s * 0.5);
      if (dist < 1) {
        const intensity = Math.round((1 - dist) * 15);
        const i = (y * s + x) * 4;
        buf[i] = Math.min(255, buf[i] + intensity);
        buf[i + 1] = Math.min(255, buf[i + 1] + intensity + 5);
        buf[i + 2] = Math.min(255, buf[i + 2] + intensity + 15);
      }
    }
  }

  // Corner brackets (cyan: 0, 240, 255)
  const bLen = Math.round(s * 0.12);
  const bThick = Math.max(2, Math.round(s * 0.018));
  const bm = margin;
  // Top-left
  drawLine(bm, bm, bm + bLen, bm, 0, 240, 255, 180, bThick);
  drawLine(bm, bm, bm, bm + bLen, 0, 240, 255, 180, bThick);
  // Top-right
  drawLine(s - bm, bm, s - bm - bLen, bm, 0, 240, 255, 180, bThick);
  drawLine(s - bm, bm, s - bm, bm + bLen, 0, 240, 255, 180, bThick);
  // Bottom-left
  drawLine(bm, s - bm, bm + bLen, s - bm, 0, 240, 255, 180, bThick);
  drawLine(bm, s - bm, bm, s - bm - bLen, 0, 240, 255, 180, bThick);
  // Bottom-right
  drawLine(s - bm, s - bm, s - bm - bLen, s - bm, 0, 240, 255, 180, bThick);
  drawLine(s - bm, s - bm, s - bm, s - bm - bLen, 0, 240, 255, 180, bThick);

  // Scan lines
  const scanY1 = Math.round(s * 0.22);
  const scanY2 = Math.round(s * 0.78);
  drawLine(bm + 4, scanY1, s - bm - 4, scanY1, 0, 240, 255, 60, 1);
  drawLine(bm + 4, scanY2, s - bm - 4, scanY2, 0, 240, 255, 60, 1);

  // Ψ symbol (draw as three vertical lines + arc at bottom)
  const psiCx = center;
  const psiTop = Math.round(s * 0.22);
  const psiBot = Math.round(s * 0.78);
  const psiMid = Math.round(s * 0.55);
  const psiW = Math.round(s * 0.22);
  const psiThick = Math.max(3, Math.round(s * 0.04));

  // Central vertical line (full height)
  drawLine(psiCx, psiTop, psiCx, psiBot, 0, 240, 255, 230, psiThick);
  // Left prong
  drawLine(psiCx - psiW, psiTop, psiCx - psiW, psiMid, 0, 200, 255, 200, psiThick);
  // Right prong
  drawLine(psiCx + psiW, psiTop, psiCx + psiW, psiMid, 0, 200, 255, 200, psiThick);
  // Curved connections (approximate with short diagonal lines)
  const curveSteps = 12;
  for (let i = 0; i <= curveSteps; i++) {
    const t = i / curveSteps;
    // Left curve
    const lx = psiCx - psiW * (1 - t);
    const ly = psiMid + (psiBot - psiMid) * 0.4 * t * t;
    drawLine(lx, ly, psiCx - psiW * (1 - (i + 1) / curveSteps),
      psiMid + (psiBot - psiMid) * 0.4 * ((i + 1) / curveSteps) ** 2,
      0, 220, 255, 200, psiThick * 0.9);
    // Right curve (mirror)
    const rx = psiCx + psiW * (1 - t);
    drawLine(rx, ly, psiCx + psiW * (1 - (i + 1) / curveSteps),
      psiMid + (psiBot - psiMid) * 0.4 * ((i + 1) / curveSteps) ** 2,
      0, 220, 255, 200, psiThick * 0.9);
  }

  // Glow effect: add subtle purple glow in bottom right
  for (let y = Math.round(s * 0.6); y < s; y++) {
    for (let x = Math.round(s * 0.6); x < s; x++) {
      const dist = Math.sqrt((x - s) ** 2 + (y - s) ** 2) / (s * 0.5);
      if (dist < 1) {
        const intensity = Math.round((1 - dist) * 8);
        const idx = (y * s + x) * 4;
        buf[idx + 2] = Math.min(255, buf[idx + 2] + intensity);
        buf[idx] = Math.min(255, buf[idx] + Math.round(intensity * 0.5));
      }
    }
  }

  return buf;
}

// Generate both sizes
[192, 512].forEach(function (size) {
  const rgba = drawIcon(size);
  const png = createPNG(size, size, rgba);
  const path = join(__dirname, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`✓ Generated ${path} (${png.length} bytes)`);
});
