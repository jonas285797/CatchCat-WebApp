import {
  ENERGY_TYPES,
  BORDER_PRESETS,
  BACKGROUND_PRESETS,
  FX_PRESETS,
  BADGE_PRESETS,
  resolveAdaptiveFX
} from './presets.js?v=20261127c';
import { drawQRToCanvas } from './qr.js?v=20261127c';

export const CARD_MM_W = 63;
export const CARD_MM_H = 88;
export const CARD_LOGICAL_W = 326;
export const CARD_LOGICAL_H = CARD_LOGICAL_W * (CARD_MM_H / CARD_MM_W); // 455.365 (exact 63:88)
export const CARD_OUTER_RADIUS = 15.5; // ~3.0mm Pokemon TCG standard corner radius
export const CARD_EXPORT_PX_W = 3024;  // 63mm * 48 = 1219.2 DPI 4K Print Master
export const CARD_EXPORT_PX_H = 4224;  // 88mm * 48 = exact 63:88 physical aspect

const FONT_STACK = `'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
const MONO_STACK = `'SF Mono', 'JetBrains Mono', 'Menlo', monospace`;

const imageCache = new Map();
const trimBoxCache = new WeakMap();
let cachedBackEmblemImg = null;

function measureCutoutTrimBox(img) {
  if (!img || !(img.naturalWidth || img.width)) return null;
  if (trimBoxCache.has(img)) return trimBoxCache.get(img);
  try {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const S = 96;
    const s = Math.min(1, S / Math.max(iw, ih));
    const sw = Math.max(8, Math.round(iw * s));
    const sh = Math.max(8, Math.round(ih * s));
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, sw, sh);
    const d = ctx.getImageData(0, 0, sw, sh).data;
    let minX = sw, minY = sh, maxX = -1, maxY = -1;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (d[(y * sw + x) * 4 + 3] > 28) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const res =
      maxX > minX && maxY > minY
        ? { w: (maxX - minX + 1) / sw, h: (maxY - minY + 1) / sh, trimW: maxX - minX + 1, trimH: maxY - minY + 1 }
        : { w: 1, h: 1, trimW: iw, trimH: ih };
    trimBoxCache.set(img, res);
    return res;
  } catch {
    return null;
  }
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Inject standard PNG pHYs chunk so 3024x4224px opens at exact 63mm x 88mm in Print/Photoshop
 */
async function injectPngPhysicalSize63x88(pngBlob, pxPerMeter = 48000) {
  try {
    const ab = await pngBlob.arrayBuffer();
    const u8 = new Uint8Array(ab);
    if (u8.length < 40 || u8[0] !== 0x89 || u8[1] !== 0x50) return pngBlob;

    // 9-byte pHYs payload
    const chunk = new Uint8Array(21);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9, false);
    chunk[4] = 0x70; chunk[5] = 0x48; chunk[6] = 0x59; chunk[7] = 0x73; // 'pHYs'
    dv.setUint32(8, pxPerMeter, false);
    dv.setUint32(12, pxPerMeter, false);
    chunk[16] = 1; // unit = meter
    dv.setUint32(17, crc32(chunk.subarray(4, 17)), false);

    // Insert right after IHDR (byte 33)
    const out = new Uint8Array(u8.length + chunk.length);
    out.set(u8.subarray(0, 33), 0);
    out.set(chunk, 33);
    out.set(u8.subarray(33), 33 + chunk.length);
    return new Blob([out], { type: 'image/png' });
  } catch {
    return pngBlob;
  }
}

export function loadImageCached(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) return imageCache.get(src);

  const promise = new Promise((resolve) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src) && !src.startsWith(window.location.origin)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      imageCache.delete(src);
      resolve(null);
    };
    img.src = src;
  });

  imageCache.set(src, promise);
  return promise;
}

loadImageCached('assets/app-icon.png').then((img) => {
  if (img) cachedBackEmblemImg = img;
});

export function getEnergyConfig(energyType) {
  return ENERGY_TYPES.find((e) => e.id === energyType) || ENERGY_TYPES[0];
}

export function getCardDisplayTitle(card) {
  const baseName = (card.customNickname && card.customNickname.trim()) || card.name || '神秘猫猫';
  return card.suffix ? `${baseName} ${card.suffix}` : baseName;
}

export function resolveEffectiveBorderId(card) {
  if (card.borderStyle && card.borderStyle !== 'auto') return card.borderStyle;
  const map = {
    food: 'classicGold',
    swift: 'platinumEx',
    brawl: 'blackObsidian',
    charm: 'roseGold',
    dark: 'blackObsidian',
    normal: 'platinumEx'
  };
  return map[card.energyType] || 'classicGold';
}

export function resolveEffectiveBgId(card) {
  if (card.backgroundStyle && card.backgroundStyle !== 'auto') return card.backgroundStyle;
  const map = {
    food: 'sunburstArena',
    swift: 'emeraldForest',
    brawl: 'cosmosNebula',
    charm: 'sakuraPastel',
    dark: 'cosmosNebula',
    normal: 'frozenCrystal'
  };
  return map[card.energyType] || 'sunburstArena';
}

export function resolveEffectiveFXId(card) {
  if (card.fxPreset && card.fxPreset !== 'auto') return card.fxPreset;
  const map = {
    food: 'lightningSurge',
    swift: 'speedBlades',
    brawl: 'psychicOrbit',
    charm: 'rainbowSparkles',
    dark: 'cosmosSwirl',
    normal: 'crackedIce'
  };
  return map[card.energyType] || 'rainbowSparkles';
}

export function resolveEffectiveBadgeId(card) {
  if (card.badgeIcon && card.badgeIcon !== 'auto') return card.badgeIcon;
  const map = {
    food: 'fish',
    swift: 'bolt',
    brawl: 'crown',
    charm: 'heart',
    dark: 'moon',
    normal: 'paw'
  };
  return map[card.energyType] || 'paw';
}

function roundPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

function makeLinearGrad(ctx, x0, y0, x1, y1, colors) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  if (!colors || !colors.length) return '#ffffff';
  if (colors.length === 1) return colors[0];
  colors.forEach((col, i) => {
    g.addColorStop(i / (colors.length - 1), col);
  });
  return g;
}

function wrapTextLines(ctx, text, maxWidth, maxLines) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const lines = [];
  let current = '';

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = current + ch;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (lines.length + 1 >= maxLines) {
        let trimmed = current;
        while (trimmed.length > 0 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
          trimmed = trimmed.slice(0, -1);
        }
        lines.push(`${trimmed}…`);
        return lines;
      }
      lines.push(current);
      current = ch === ' ' ? '' : ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawBadgeVector(ctx, badgeId, cx, cy, size, color = '#ffffff') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const s = size;
  switch (badgeId) {
    case 'bolt': {
      ctx.beginPath();
      ctx.moveTo(s * 0.14, -s * 0.72);
      ctx.lineTo(-s * 0.42, s * 0.08);
      ctx.lineTo(s * 0.04, s * 0.08);
      ctx.lineTo(-s * 0.16, s * 0.74);
      ctx.lineTo(s * 0.44, -s * 0.06);
      ctx.lineTo(-s * 0.02, -s * 0.06);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'crown': {
      ctx.beginPath();
      ctx.moveTo(-s * 0.62, s * 0.44);
      ctx.lineTo(-s * 0.72, -s * 0.34);
      ctx.lineTo(-s * 0.28, s * 0.05);
      ctx.lineTo(0, -s * 0.56);
      ctx.lineTo(s * 0.28, s * 0.05);
      ctx.lineTo(s * 0.72, -s * 0.34);
      ctx.lineTo(s * 0.62, s * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.58, s * 0.52, s * 1.16, s * 0.15);
      break;
    }
    case 'fish': {
      ctx.beginPath();
      ctx.ellipse(-s * 0.12, 0, s * 0.46, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.26, 0);
      ctx.lineTo(s * 0.68, -s * 0.36);
      ctx.lineTo(s * 0.68, s * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(-s * 0.32, -s * 0.08, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'flame': {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.72);
      ctx.bezierCurveTo(s * 0.56, -s * 0.22, s * 0.64, s * 0.48, 0, s * 0.68);
      ctx.bezierCurveTo(-s * 0.64, s * 0.48, -s * 0.56, -s * 0.12, -s * 0.15, -s * 0.35);
      ctx.bezierCurveTo(-s * 0.12, -s * 0.05, -s * 0.04, -s * 0.52, 0, -s * 0.72);
      ctx.fill();
      break;
    }
    case 'moon': {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.58, -0.35 * Math.PI, 0.55 * Math.PI, true);
      ctx.bezierCurveTo(-s * 0.04, s * 0.18, s * 0.02, -s * 0.28, -s * 0.22, -s * 0.52);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'diamond': {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.68);
      ctx.lineTo(s * 0.56, 0);
      ctx.lineTo(0, s * 0.68);
      ctx.lineTo(-s * 0.56, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'heart': {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.58);
      ctx.bezierCurveTo(-s * 0.78, s * 0.08, -s * 0.68, -s * 0.64, 0, -s * 0.22);
      ctx.bezierCurveTo(s * 0.68, -s * 0.64, s * 0.78, s * 0.08, 0, s * 0.58);
      ctx.fill();
      break;
    }
    case 'shield': {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.66);
      ctx.lineTo(s * 0.54, -s * 0.42);
      ctx.quadraticCurveTo(s * 0.5, s * 0.28, 0, s * 0.68);
      ctx.quadraticCurveTo(-s * 0.5, s * 0.28, -s * 0.54, -s * 0.42);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'paw':
    default: {
      // Main metacarpal pad
      ctx.beginPath();
      ctx.ellipse(0, s * 0.22, s * 0.34, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      // 4 toe beans
      const toes = [
        [-s * 0.42, -s * 0.08, 0.12],
        [-s * 0.16, -s * 0.32, 0.13],
        [s * 0.16, -s * 0.32, 0.13],
        [s * 0.42, -s * 0.08, 0.12]
      ];
      toes.forEach(([tx, ty, tr]) => {
        ctx.beginPath();
        ctx.arc(tx, ty, s * tr, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
  }
  ctx.restore();
}

function drawFourPointStar(ctx, cx, cy, r, innerRatio = 0.26) {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * innerRatio;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawBackgroundStage(ctx, bgId, rect, energy) {
  const { x, y, w, h } = rect;
  const preset = BACKGROUND_PRESETS.find((b) => b.id === bgId) || BACKGROUND_PRESETS[1];
  const cols = preset.colors;

  ctx.save();
  roundPath(ctx, x, y, w, h, 8);
  ctx.clip();

  // Base gradient fill
  ctx.fillStyle = makeLinearGrad(ctx, x, y, x + w * 0.25, y + h, cols);
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.54;

  if (bgId === 'sunburstArena') {
    const rayCount = 18;
    for (let i = 0; i < rayCount; i += 1) {
      const a0 = (i * Math.PI * 2) / rayCount;
      const a1 = a0 + Math.PI / rayCount;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * w, cy + Math.sin(a0) * w);
      ctx.lineTo(cx + Math.cos(a1) * w, cy + Math.sin(a1) * w);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,140,20,0.08)';
      ctx.fill();
    }
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.52);
    g.addColorStop(0, 'rgba(255,252,210,0.88)');
    g.addColorStop(0.55, 'rgba(255,204,72,0.22)');
    g.addColorStop(1, 'rgba(255,180,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  } else if (bgId === 'emeraldForest') {
    // Misty bamboo / foliage beams
    const stalks = [0.08, 0.19, 0.78, 0.91];
    stalks.forEach((sx, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(9, 44, 34, 0.34)' : 'rgba(15, 78, 56, 0.28)';
      ctx.fillRect(x + w * sx, y, 8 + (idx % 2) * 5, h);
    });
    const haze = ctx.createRadialGradient(cx, y + h * 0.25, 10, cx, cy, w * 0.6);
    haze.addColorStop(0, 'rgba(205, 255, 178, 0.65)');
    haze.addColorStop(0.6, 'rgba(35, 209, 154, 0.2)');
    haze.addColorStop(1, 'rgba(8, 36, 28, 0.35)');
    ctx.fillStyle = haze;
    ctx.fillRect(x, y, w, h);
    // Bokeh leaves
    [
      [0.24, 0.26, 22],
      [0.72, 0.32, 26],
      [0.36, 0.7, 16],
      [0.64, 0.62, 18]
    ].forEach(([bx, by, br]) => {
      ctx.fillStyle = 'rgba(220, 255, 205, 0.16)';
      ctx.beginPath();
      ctx.arc(x + w * bx, y + h * by, br, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (bgId === 'cosmosNebula') {
    const neb1 = ctx.createRadialGradient(x + w * 0.28, y + h * 0.32, 6, x + w * 0.28, y + h * 0.32, w * 0.56);
    neb1.addColorStop(0, 'rgba(130, 82, 255, 0.65)');
    neb1.addColorStop(1, 'rgba(130, 82, 255, 0)');
    ctx.fillStyle = neb1;
    ctx.fillRect(x, y, w, h);

    const neb2 = ctx.createRadialGradient(x + w * 0.76, y + h * 0.68, 8, x + w * 0.76, y + h * 0.68, w * 0.52);
    neb2.addColorStop(0, 'rgba(45, 206, 245, 0.45)');
    neb2.addColorStop(1, 'rgba(45, 206, 245, 0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(x, y, w, h);

    // Planetary orbits
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.24);
    ctx.strokeStyle = 'rgba(162, 224, 255, 0.26)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.44, h * 0.17, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(218, 164, 255, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.32, h * 0.11, 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Starfield
    const stars = [
      [0.14, 0.18, 3.2], [0.84, 0.22, 4.2], [0.22, 0.76, 3.0],
      [0.78, 0.8, 3.6], [0.62, 0.16, 2.5], [0.1, 0.5, 2.8], [0.9, 0.48, 2.6]
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    stars.forEach(([sx, sy, sr]) => drawFourPointStar(ctx, x + w * sx, y + h * sy, sr, 0.24));
  } else if (bgId === 'sakuraPastel') {
    const glow = ctx.createRadialGradient(cx, y + h * 0.4, 8, cx, cy, w * 0.6);
    glow.addColorStop(0, 'rgba(255, 252, 254, 0.92)');
    glow.addColorStop(0.55, 'rgba(255, 198, 225, 0.35)');
    glow.addColorStop(1, 'rgba(219, 110, 187, 0.25)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    // Petals
    const petals = [
      [0.15, 0.24, 0.4, 7], [0.82, 0.2, -0.5, 8], [0.22, 0.68, 0.9, 6],
      [0.76, 0.62, -0.8, 7], [0.46, 0.15, 0.2, 5.5], [0.64, 0.82, 1.1, 6]
    ];
    petals.forEach(([px, py, rot, sz]) => {
      ctx.save();
      ctx.translate(x + w * px, y + h * py);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.beginPath();
      ctx.ellipse(0, 0, sz, sz * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  } else if (bgId === 'flameCanyon') {
    const lava = ctx.createRadialGradient(cx, y + h * 0.82, 10, cx, y + h * 0.65, w * 0.68);
    lava.addColorStop(0, 'rgba(255, 214, 92, 0.9)');
    lava.addColorStop(0.45, 'rgba(235, 68, 22, 0.5)');
    lava.addColorStop(1, 'rgba(34, 4, 8, 0.2)');
    ctx.fillStyle = lava;
    ctx.fillRect(x, y, w, h);
    // Silhouetted rock spires
    ctx.fillStyle = 'rgba(24, 6, 8, 0.65)';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h * 0.62);
    ctx.lineTo(x + w * 0.18, y + h * 0.78);
    ctx.lineTo(x + w * 0.34, y + h * 0.9);
    ctx.lineTo(x + w * 0.72, y + h * 0.88);
    ctx.lineTo(x + w * 0.88, y + h * 0.68);
    ctx.lineTo(x + w, y + h * 0.56);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    // Rising embers
    ctx.fillStyle = 'rgba(255, 224, 112, 0.9)';
    [[0.18, 0.38, 2.2], [0.28, 0.22, 1.8], [0.76, 0.32, 2.5], [0.84, 0.54, 1.9], [0.58, 0.16, 1.7]].forEach(([ex, ey, er]) => {
      ctx.beginPath();
      ctx.arc(x + w * ex, y + h * ey, er, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (bgId === 'frozenCrystal') {
    const ice = ctx.createRadialGradient(cx, cy * 0.95, 8, cx, cy, w * 0.6);
    ice.addColorStop(0, 'rgba(232, 251, 255, 0.9)');
    ice.addColorStop(0.55, 'rgba(84, 208, 245, 0.32)');
    ice.addColorStop(1, 'rgba(22, 62, 128, 0.25)');
    ctx.fillStyle = ice;
    ctx.fillRect(x, y, w, h);
    // Faceted ice shards
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    const polyShards = [
      [[0.04, 0.22], [0.2, 0.08], [0.26, 0.36]],
      [[0.78, 0.12], [0.96, 0.28], [0.74, 0.4]],
      [[0.08, 0.78], [0.24, 0.64], [0.3, 0.92]],
      [[0.75, 0.68], [0.92, 0.86], [0.68, 0.96]]
    ];
    polyShards.forEach((pts) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(x + w * px, y + h * py);
        else ctx.lineTo(x + w * px, y + h * py);
      });
      ctx.closePath();
      ctx.fill();
    });
  } else {
    // obsidianStudio
    const spot = ctx.createRadialGradient(cx, y + h * 0.42, 10, cx, cy, w * 0.58);
    spot.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    spot.addColorStop(0.5, 'rgba(130, 152, 190, 0.08)');
    spot.addColorStop(1, 'rgba(0, 0, 0, 0.48)');
    ctx.fillStyle = spot;
    ctx.fillRect(x, y, w, h);
  }

  // Stage horizon floor & grounded aura
  const floorG = ctx.createLinearGradient(0, y + h * 0.72, 0, y + h);
  floorG.addColorStop(0, 'rgba(0,0,0,0)');
  floorG.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = floorG;
  ctx.fillRect(x, y + h * 0.72, w, h * 0.28);

  const rimAura = ctx.createRadialGradient(cx, y + h * 0.85, 6, cx, y + h * 0.85, w * 0.38);
  rimAura.addColorStop(0, 'rgba(255,255,255,0.45)');
  rimAura.addColorStop(0.5, `${energy.orb[0]}55`);
  rimAura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rimAura;
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.86, w * 0.38, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawLightningBolt(ctx, x1, y1, x2, y2, jitter, branches, strokeColor) {
  const segs = 6;
  const pts = [[x1, y1]];
  for (let i = 1; i < segs; i += 1) {
    const t = i / segs;
    const bx = x1 + (x2 - x1) * t + Math.sin(i * 2.9 + x1) * jitter;
    const by = y1 + (y2 - y1) * t + Math.cos(i * 3.7 + y1) * jitter * 0.7;
    pts.push([bx, by]);
  }
  pts.push([x2, y2]);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3.2;
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  pts.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.25;
  ctx.stroke();

  if (branches && pts.length > 3) {
    const [mx, my] = pts[2];
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + jitter * 1.4, my + jitter * 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFXOverlay(ctx, fxId, zone, intensity, rect, energy) {
  if (fxId === 'none' || intensity <= 0.02) return;
  const { x, y, w, h } = rect;
  const alpha = Math.min(1, Math.max(0.1, intensity));

  ctx.save();
  roundPath(ctx, x, y, w, h, 8);
  ctx.clip();
  ctx.globalAlpha = alpha;

  let anchorX = x + w * 0.5;
  let anchorY = y + h * 0.5;
  if (zone === 'leftSurge') anchorX = x + w * 0.22;
  if (zone === 'rightSurge') anchorX = x + w * 0.78;
  if (zone === 'groundWave') anchorY = y + h * 0.82;
  if (zone === 'orbitCrown') anchorY = y + h * 0.22;

  if (fxId === 'lightningSurge') {
    const color = energy.id === 'swift' ? '#4df0a4' : '#ffd84a';
    if (zone === 'closeupBurst' || zone === 'centerApex') {
      drawLightningBolt(ctx, x + 12, y + 18, x + 68, y + 66, 9, true, color);
      drawLightningBolt(ctx, x + w - 14, y + 20, x + w - 72, y + 70, 9, true, color);
      drawLightningBolt(ctx, x + 18, y + h - 16, x + 78, y + h - 62, 8, false, color);
      drawLightningBolt(ctx, x + w - 18, y + h - 14, x + w - 80, y + h - 58, 8, false, color);
    } else if (zone === 'rightSurge') {
      drawLightningBolt(ctx, x + w - 18, y + 18, x + w * 0.58, y + h * 0.52, 11, true, color);
      drawLightningBolt(ctx, x + w - 22, y + h - 22, x + w * 0.62, y + h * 0.58, 10, true, color);
    } else if (zone === 'leftSurge') {
      drawLightningBolt(ctx, x + 18, y + 18, x + w * 0.42, y + h * 0.52, 11, true, color);
      drawLightningBolt(ctx, x + 22, y + h - 22, x + w * 0.38, y + h * 0.58, 10, true, color);
    } else {
      drawLightningBolt(ctx, x + 20, anchorY - 20, anchorX, anchorY + 12, 10, true, color);
      drawLightningBolt(ctx, x + w - 20, anchorY - 18, anchorX, anchorY + 14, 10, true, color);
    }
  } else if (fxId === 'psychicOrbit') {
    ctx.strokeStyle = 'rgba(205, 130, 255, 0.78)';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#b76cff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(anchorX, anchorY, w * 0.38, h * 0.19, -0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110, 232, 255, 0.72)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(anchorX, anchorY, w * 0.32, h * 0.14, 0.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    drawFourPointStar(ctx, anchorX - w * 0.32, anchorY - 12, 6, 0.25);
    drawFourPointStar(ctx, anchorX + w * 0.31, anchorY + 14, 5.5, 0.25);
  } else if (fxId === 'speedBlades') {
    ctx.strokeStyle = 'rgba(72, 245, 198, 0.85)';
    ctx.lineCap = 'round';
    [
      [0.08, 0.78, 0.44, 0.14, 3.2],
      [0.14, 0.88, 0.52, 0.26, 2.0],
      [0.54, 0.86, 0.94, 0.22, 3.0],
      [0.62, 0.94, 0.96, 0.38, 1.8]
    ].forEach(([sx0, sy0, sx1, sy1, lw]) => {
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x + w * sx0, y + h * sy0);
      ctx.quadraticCurveTo(x + w * ((sx0 + sx1) * 0.5 - 0.06), y + h * ((sy0 + sy1) * 0.5 - 0.08), x + w * sx1, y + h * sy1);
      ctx.stroke();
    });
  } else if (fxId === 'rainbowSparkles') {
    const pts = [
      [0.14, 0.2, 8.5, '#ff8ce0'], [0.85, 0.22, 9.5, '#5be9ff'],
      [0.2, 0.82, 7.5, '#ffe455'], [0.82, 0.78, 8.5, '#4df0a4'],
      [0.12, 0.52, 5.5, '#ffffff'], [0.88, 0.48, 6.0, '#ffd478']
    ];
    pts.forEach(([px, py, sr, col]) => {
      ctx.fillStyle = col;
      drawFourPointStar(ctx, x + w * px, y + h * py, sr, 0.22);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      drawFourPointStar(ctx, x + w * px, y + h * py, sr * 0.46, 0.28);
    });
  } else if (fxId === 'crackedIce') {
    const shards = [
      [[0.02, 0.15], [0.22, 0.04], [0.28, 0.28], [0.06, 0.35]],
      [[0.74, 0.06], [0.98, 0.14], [0.92, 0.34], [0.7, 0.24]],
      [[0.04, 0.72], [0.26, 0.68], [0.22, 0.96], [0.02, 0.9]],
      [[0.76, 0.66], [0.96, 0.76], [0.92, 0.96], [0.72, 0.92]],
      [[0.44, 0.02], [0.58, 0.04], [0.52, 0.16]]
    ];
    shards.forEach((poly, i) => {
      ctx.beginPath();
      poly.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(x + w * px, y + h * py) : ctx.lineTo(x + w * px, y + h * py)));
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(130, 232, 255, 0.24)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.52)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    });
  } else if (fxId === 'cosmosSwirl') {
    ctx.save();
    ctx.translate(anchorX, anchorY);
    ctx.strokeStyle = 'rgba(198, 228, 255, 0.48)';
    ctx.setLineDash([8, 6]);
    for (let r = 46; r <= 120; r += 24) {
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.15, r * 0.56, -0.18 + r * 0.004, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    drawFourPointStar(ctx, x + w * 0.16, y + h * 0.2, 6, 0.24);
    drawFourPointStar(ctx, x + w * 0.84, y + h * 0.8, 6.5, 0.24);
  }

  ctx.restore();
}

function drawFoilMicroTexture(ctx, rect, foilIntensity) {
  if (foilIntensity <= 0.05) return;
  const { x, y, w, h } = rect;
  ctx.save();
  roundPath(ctx, x, y, w, h, 8);
  ctx.clip();

  // Diagonal prismatic sheen ribbon
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.32, `rgba(120, 240, 255, ${(0.12 * foilIntensity).toFixed(3)})`);
  g.addColorStop(0.5, `rgba(255, 255, 255, ${(0.22 * foilIntensity).toFixed(3)})`);
  g.addColorStop(0.68, `rgba(255, 168, 238, ${(0.12 * foilIntensity).toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // Subtle etched diagonal foil grain
  ctx.strokeStyle = `rgba(255,255,255,${(0.055 * foilIntensity).toFixed(3)})`;
  ctx.lineWidth = 0.8;
  for (let d = -h; d < w + h; d += 9) {
    ctx.beginPath();
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + d - h * 0.55, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderCardFrontToCanvas(canvas, card, cutoutImg, scale = 2) {
  if (!canvas) return;
  const W = CARD_LOGICAL_W;
  const H = CARD_LOGICAL_H;

  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(canvas.width * (CARD_MM_H / CARD_MM_W));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const energy = getEnergyConfig(card.energyType);
  const borderId = resolveEffectiveBorderId(card);
  const border = BORDER_PRESETS.find((b) => b.id === borderId) || BORDER_PRESETS[1];
  const bgId = resolveEffectiveBgId(card);
  const fxId = resolveEffectiveFXId(card);
  const badgeId = resolveEffectiveBadgeId(card);
  const foilIntensity = card.foilIntensity ?? 0.72;
  const inkColor = energy.ink;
  const secondaryInk = energy.bright ? 'rgba(20, 24, 30, 0.72)' : 'rgba(235, 240, 248, 0.78)';
  const subtleSurface = energy.bright ? 'rgba(255, 255, 255, 0.56)' : 'rgba(255, 255, 255, 0.11)';

  // Master rounded clip (clean edges, zero outer bleed)
  ctx.save();
  roundPath(ctx, 0, 0, W, H, CARD_OUTER_RADIUS);
  ctx.clip();

  // 1. Metallic outer rim border
  ctx.fillStyle = makeLinearGrad(ctx, 0, 0, W, H, border.grad);
  ctx.fillRect(0, 0, W, H);

  // Diagonal metallic specular sheen on outer border
  const rimGloss = ctx.createLinearGradient(0, 0, W, H * 0.75);
  rimGloss.addColorStop(0, 'rgba(255,255,255,0.34)');
  rimGloss.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  rimGloss.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = rimGloss;
  ctx.fillRect(0, 0, W, H);

  // Subtle bevel inside outer edge
  roundPath(ctx, 1.5, 1.5, W - 3, H - 3, CARD_OUTER_RADIUS - 1.5);
  ctx.strokeStyle = border.innerGold ? 'rgba(245, 200, 82, 0.52)' : 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  if (border.innerGold) {
    roundPath(ctx, 5.5, 5.5, W - 11, H - 11, CARD_OUTER_RADIUS - 5);
    ctx.strokeStyle = 'rgba(245, 200, 82, 0.44)';
    ctx.lineWidth = 0.85;
    ctx.stroke();
  }

  // 2. Inner card plate
  const plate = { x: 10, y: 10, w: W - 20, h: H - 20, r: 13.5 };
  ctx.save();
  roundPath(ctx, plate.x, plate.y, plate.w, plate.h, plate.r);
  ctx.clip();

  ctx.fillStyle = makeLinearGrad(ctx, plate.x, plate.y, plate.x + plate.w * 0.4, plate.y + plate.h, energy.base);
  ctx.fillRect(plate.x, plate.y, plate.w, plate.h);

  // Subtle radial luminosity behind artwork and stats
  const cardLight = ctx.createRadialGradient(W * 0.5, H * 0.34, 16, W * 0.5, H * 0.5, W * 0.85);
  cardLight.addColorStop(0, energy.bright ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.12)');
  cardLight.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = cardLight;
  ctx.fillRect(plate.x, plate.y, plate.w, plate.h);

  if (border.innerGold) {
    roundPath(ctx, plate.x + 2.5, plate.y + 2.5, plate.w - 5, plate.h - 5, plate.r - 2);
    ctx.strokeStyle = 'rgba(232, 190, 74, 0.72)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
  ctx.restore();

  // 3. Header (Metallic Silver Stage Trapezoid + Card Name + Suffix + HP + Energy Orb)
  const stageText = (card.stage || '基础形态').slice(0, 6);
  ctx.font = `800 8.2px ${FONT_STACK}`;
  const stageW = Math.min(62, Math.max(46, ctx.measureText(stageText).width + 16));
  const stageX = 18;
  const stageY = 20.5;
  const stageH = 17;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(stageX, stageY + 2);
  ctx.quadraticCurveTo(stageX, stageY, stageX + 3, stageY);
  ctx.lineTo(stageX + stageW, stageY);
  ctx.lineTo(stageX + stageW - 6, stageY + stageH);
  ctx.lineTo(stageX + 3, stageY + stageH);
  ctx.quadraticCurveTo(stageX, stageY + stageH, stageX, stageY + stageH - 2);
  ctx.closePath();
  ctx.fillStyle = makeLinearGrad(ctx, stageX, stageY, stageX + stageW, stageY + stageH, ['#fcfdff', '#cfd7e3', '#a6b0bf', '#e8edf5']);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 0.85;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#14171e';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(stageText, stageX + (stageW - 3) * 0.5, stageY + stageH * 0.5 + 0.4);

  // Right side: Energy Orb + HP
  const orbX = 294;
  const orbY = 29;
  const orbR = 13;

  // Orb base gradient
  const orbG = ctx.createRadialGradient(orbX - 4, orbY - 4, 2, orbX, orbY, orbR);
  orbG.addColorStop(0, energy.orb[0]);
  orbG.addColorStop(1, energy.orb[1]);
  ctx.beginPath();
  ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
  ctx.fillStyle = orbG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Specular cap inside orb
  ctx.beginPath();
  ctx.ellipse(orbX - 3.5, orbY - 5.5, 6.2, 3.2, -0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.fill();

  drawBadgeVector(ctx, badgeId, orbX, orbY + 0.5, 8.6, '#ffffff');

  // HP Number
  const hpVal = String(card.hp ?? 180);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = inkColor;
  ctx.font = `900 18.5px ${FONT_STACK}`;
  const hpNumW = ctx.measureText(hpVal).width;
  const hpNumX = orbX - orbR - 6;
  ctx.fillText(hpVal, hpNumX, 35.5);

  ctx.font = `800 8.5px ${FONT_STACK}`;
  const hpLabelW = ctx.measureText('HP').width;
  ctx.fillStyle = secondaryInk;
  ctx.fillText('HP', hpNumX - hpNumW - 2.5, 35);

  // Card Title + Optional Suffix
  const titleLeft = stageX + stageW + 7;
  const titleRight = hpNumX - hpNumW - hpLabelW - 10;
  const maxTitleW = Math.max(40, titleRight - titleLeft);
  const rawName = (card.customNickname && card.customNickname.trim()) || card.name || '神秘猫猫';
  const suffix = card.suffix ? card.suffix.trim() : '';

  let nameFontSize = 18;
  ctx.font = `900 ${nameFontSize}px ${FONT_STACK}`;
  let suffixW = 0;
  if (suffix) {
    ctx.font = `900 italic 11px ${FONT_STACK}`;
    suffixW = ctx.measureText(suffix).width + 10;
  }
  ctx.font = `900 ${nameFontSize}px ${FONT_STACK}`;
  while (ctx.measureText(rawName).width + suffixW > maxTitleW && nameFontSize > 11.5) {
    nameFontSize -= 0.5;
    ctx.font = `900 ${nameFontSize}px ${FONT_STACK}`;
  }

  let drawnName = rawName;
  while (drawnName.length > 1 && ctx.measureText(drawnName).width + suffixW > maxTitleW) {
    drawnName = `${drawnName.slice(0, -2)}…`;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = inkColor;
  ctx.fillText(drawnName, titleLeft, 35.5);

  if (suffix) {
    const nw = ctx.measureText(drawnName).width;
    const sx = titleLeft + nw + 4;
    const sy = 21.5;
    const sw = Math.max(20, suffixW - 4);
    roundPath(ctx, sx, sy, sw, 15, 4);
    ctx.fillStyle = makeLinearGrad(ctx, sx, sy, sx + sw, sy + 15, ['#ffe97a', '#ff9f43']);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    ctx.fillStyle = '#181410';
    ctx.font = `900 italic 10px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suffix, sx + sw * 0.5, sy + 8);
  }

  // 4. Artwork Stage Window (背景、全息特效 FX 与箔纹都在动物主体下方裁切于原画框内)
  const artRect = { x: 20, y: 49, w: 286, h: 184 };

  // Bezel border around art window
  roundPath(ctx, artRect.x - 2, artRect.y - 2, artRect.w + 4, artRect.h + 4, 10);
  ctx.fillStyle = makeLinearGrad(ctx, artRect.x, artRect.y, artRect.x + artRect.w, artRect.y + artRect.h, border.grad);
  ctx.fill();

  drawBackgroundStage(ctx, bgId, artRect, energy);

  // Adaptive FX & Foil Micro-prism Layer（位于原画框内、猫咪主体之下）
  const adaptive = resolveAdaptiveFX(card);
  drawFXOverlay(ctx, fxId, adaptive.zone, foilIntensity, artRect, energy);
  drawFoilMicroTexture(ctx, artRect, foilIntensity);

  // Crisp inner stroke around art window
  roundPath(ctx, artRect.x, artRect.y, artRect.w, artRect.h, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // 5. Metallic Cylinder Taxonomy Ribbon under Artwork
  const ribY = 238;
  roundPath(ctx, 21, ribY, W - 42, 15, 7.5);
  ctx.fillStyle = makeLinearGrad(ctx, 21, ribY, 21, ribY + 15, ['#f3f6fa', '#c6cedb', '#e9edf4']);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  const shortNo = String(card.serialNumber || '001').split('/')[0];
  const ribLabel = `NO.${shortNo}  ${card.breedName || '中华田园猫'} · ${card.coatPattern || '特色毛色'}${card.tnrClipped ? ' · 已TNR' : ''}`;
  ctx.fillStyle = '#181c24';
  ctx.font = `700 8.3px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ribLabel.slice(0, 36), W * 0.5, ribY + 7.8);

  // 6. Ability & Attack Section
  let cursorY = 264;
  if (card.abilityName) {
    // [特性] tag
    roundPath(ctx, 22, cursorY, 34, 15, 4);
    ctx.fillStyle = '#cf2d39';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 8.5px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('特性', 39, cursorY + 7.8);

    ctx.fillStyle = energy.bright ? '#b41b28' : '#ff8e96';
    ctx.font = `800 12.5px ${FONT_STACK}`;
    ctx.textAlign = 'left';
    ctx.fillText((card.abilityName || '').slice(0, 14), 62, cursorY + 7.8);

    cursorY += 20;
    ctx.fillStyle = secondaryInk;
    ctx.font = `500 9.8px ${FONT_STACK}`;
    ctx.textBaseline = 'top';
    const abLines = wrapTextLines(ctx, card.abilityDesc || '', W - 46, 2);
    abLines.forEach((line, i) => {
      ctx.fillText(line, 22, cursorY + i * 13);
    });
    cursorY += Math.max(18, abLines.length * 13) + 6;
  } else {
    cursorY += 12;
  }

  // Hairline divider
  ctx.strokeStyle = energy.bright ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(22, cursorY);
  ctx.lineTo(W - 22, cursorY);
  ctx.stroke();

  cursorY += 16;

  // Attack Row
  [0, 1].forEach((idx) => {
    const px = 29 + idx * 15;
    const py = cursorY + 1;
    const pg = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 6.2);
    pg.addColorStop(0, energy.orb[0]);
    pg.addColorStop(1, energy.orb[1]);
    ctx.beginPath();
    ctx.arc(px, py, 6.2, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });

  // Damage value
  const dmgText = String(card.attackDamage ?? 120);
  ctx.fillStyle = inkColor;
  ctx.font = `900 18px ${FONT_STACK}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(dmgText, W - 22, cursorY + 1.5);
  const dmgW = ctx.measureText(dmgText).width;

  // Attack Name
  const atkX = 58;
  const maxAtkW = W - 22 - dmgW - 10 - atkX;
  let atkFont = 13.5;
  ctx.font = `800 ${atkFont}px ${FONT_STACK}`;
  const atkName = card.attackName || '呼噜震击';
  while (ctx.measureText(atkName).width > maxAtkW && atkFont > 10.5) {
    atkFont -= 0.5;
    ctx.font = `800 ${atkFont}px ${FONT_STACK}`;
  }
  ctx.textAlign = 'left';
  ctx.fillText(atkName, atkX, cursorY + 1.5);

  // 7. Metallic Profile Bar (Personality / Hobby / Coat Pattern)
  const statY = 360;
  roundPath(ctx, 20, statY, W - 40, 21, 7);
  ctx.fillStyle = makeLinearGrad(ctx, 20, statY, 20, statY + 21, ['#eff2f7', '#c5cddb', '#e5eaf2']);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  const pLabel = (card.personalityTag || card.abilityName || '元气粘人').slice(0, 6);
  const hLabel = (card.hobbyTag || card.attackName || '晒太阳贴贴').slice(0, 7);
  const cLabel = (card.coatPattern || '全息珍藏').slice(0, 6);

  ctx.textBaseline = 'middle';
  ctx.font = `700 8px ${FONT_STACK}`;
  ctx.fillStyle = '#1c202a';
  ctx.textAlign = 'left';
  ctx.fillText(`性格 ${pLabel}`, 26, statY + 10.8);
  ctx.textAlign = 'center';
  ctx.fillText(`爱好 ${hLabel}`, W * 0.5, statY + 10.8);
  ctx.textAlign = 'right';
  ctx.fillText(cLabel, W - 26, statY + 10.8);

  // Vertical hairline separators inside profile bar
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 0.75;
  [W * 0.34, W * 0.67].forEach((vx) => {
    ctx.beginPath();
    ctx.moveTo(vx, statY + 4.5);
    ctx.lineTo(vx, statY + 16.5);
    ctx.stroke();
  });

  // 8. Flavor Box
  const flavY = 388;
  roundPath(ctx, 20, flavY, W - 40, 29, 6);
  ctx.fillStyle = energy.bright ? 'rgba(255,255,255,0.44)' : 'rgba(0,0,0,0.22)';
  ctx.fill();

  ctx.fillStyle = secondaryInk;
  ctx.font = `500 8.2px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const flavLines = wrapTextLines(ctx, card.flavorText || '发现于城市街头，拥有极高回头率。', W - 54, 2);
  flavLines.forEach((line, i) => {
    ctx.fillText(line, 27, flavY + 5 + i * 10.5);
  });

  // 9. Collector Footer (Illus. 抓宠大作战 + ©2026 CatchPet · 抓宠大作战)
  ctx.fillStyle = secondaryInk;
  ctx.textBaseline = 'middle';
  ctx.font = `italic 700 7.2px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText('Illus. 抓宠大作战', 22, 424);

  ctx.font = `600 6.5px ${FONT_STACK}`;
  const loc = (card.locationName || '抓宠大作战 示范馆').slice(0, 14);
  ctx.fillText(`📍 ${loc}`, 22, 435);

  ctx.textAlign = 'right';
  ctx.font = `700 7.2px ${MONO_STACK}`;
  ctx.fillText(card.serialNumber || '001/165 ★', W - 22, 424);

  ctx.font = `600 6.2px ${MONO_STACK}`;
  ctx.fillText('©2026 CatchPet · 抓宠大作战', W - 22, 435);

  // 10. 动物主体置顶层 (3D 破框跃出，置于原画边框、FX 特效、箔纹与版式之上，仅安全裁切在外金属框内缘)
  ctx.save();
  roundPath(ctx, plate.x, plate.y, plate.w, plate.h, plate.r);
  ctx.clip();

  if (cutoutImg && cutoutImg.naturalWidth > 0 && cutoutImg.naturalHeight > 0) {
    const iw = cutoutImg.naturalWidth;
    const ih = cutoutImg.naturalHeight;
    const aspect = iw / Math.max(1, ih);
    const maxPopW = artRect.w * 1.04;
    let baseW;
    let baseH;
    if (aspect < 0.78) {
      const rawH = artRect.h * 1.15;
      baseW = Math.min(maxPopW, rawH * aspect);
      baseH = baseW / aspect;
    } else if (aspect < 1.12) {
      const rawH = artRect.h * 1.13;
      baseW = Math.min(maxPopW, rawH * aspect);
      baseH = Math.min(artRect.h * 1.16, baseW / aspect);
    } else {
      baseW = maxPopW;
      baseH = Math.min(artRect.h * 1.14, baseW / aspect);
      baseW = baseH * aspect;
    }

    const userScale = Math.max(0.55, Math.min(2.1, Number(card.subjectScale || 1)));
    const drawW = baseW * userScale;
    const drawH = baseH * userScale;

    const ox = Number(card.subjectOffsetX || 0) * artRect.w;
    const oy = Number(card.subjectOffsetY || 0) * artRect.h;

    const dx = artRect.x + (artRect.w - drawW) * 0.5 + ox;
    const dy = artRect.y + artRect.h - drawH + 5 + oy;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(cutoutImg, dx, dy, drawW, drawH);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    drawBadgeVector(ctx, 'paw', artRect.x + artRect.w * 0.5, artRect.y + artRect.h * 0.52, 34, 'rgba(255,255,255,0.34)');
  }
  ctx.restore();

  ctx.restore();
}

export function renderCardBackToCanvas(canvas, card, cutoutImg = null, scale = 2, emblemImg = null) {
  if (!canvas) return;
  if (typeof cutoutImg === 'number') {
    emblemImg = scale && typeof scale !== 'number' ? scale : null;
    scale = cutoutImg;
    cutoutImg = null;
  }

  const W = CARD_LOGICAL_W;
  const H = CARD_LOGICAL_H;

  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(canvas.width * (CARD_MM_H / CARD_MM_W));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const energy = getEnergyConfig(card.energyType);
  const borderId = resolveEffectiveBorderId(card);
  const border = BORDER_PRESETS.find((b) => b.id === borderId) || BORDER_PRESETS[1];
  const badgeId = resolveEffectiveBadgeId(card);
  const orbIcon = emblemImg || cachedBackEmblemImg;
  const backStyle = card.cardBackStyle || 'fullArtPet';

  ctx.save();
  roundPath(ctx, 0, 0, W, H, CARD_OUTER_RADIUS);
  ctx.clip();

  // Outer metallic rim
  ctx.fillStyle = makeLinearGrad(ctx, 0, 0, W, H, backStyle === 'fullArtPet'
    ? ['#fff3bd', '#e2bc5c', '#c39134', '#f7df94']
    : border.grad);
  ctx.fillRect(0, 0, W, H);

  // Inner metallic rim highlight
  roundPath(ctx, 1.5, 1.5, W - 3, H - 3, CARD_OUTER_RADIUS - 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  const plate = { x: 10, y: 10, w: W - 20, h: H - 20, r: 11 };
  ctx.save();
  roundPath(ctx, plate.x, plate.y, plate.w, plate.h, plate.r);
  ctx.clip();

  // ── Variant 1 (Default): Clark-inspired Full-Art Holographic Pet Back (Portrait / Landscape) ──
  if (backStyle === 'fullArtPet') {
    const orientPref = card.cardBackOrientation || 'auto';
    const trim = measureCutoutTrimBox(cutoutImg);
    const isLandscape =
      orientPref === 'landscape' ||
      (orientPref === 'auto' && trim && trim.trimW > trim.trimH * 1.12);

    ctx.save();
    if (isLandscape) {
      ctx.translate(W * 0.5, H * 0.5);
      ctx.rotate(-Math.PI * 0.5);
      ctx.translate(-H * 0.5, -W * 0.5);
    }

    const BW = isLandscape ? H : W;
    const BH = isLandscape ? W : H;

    // 1. Clean warm pearl-champagne studio radial backdrop
    const studioBg = ctx.createRadialGradient(BW * 0.5, BH * 0.45, 18, BW * 0.5, BH * 0.48, Math.max(BW, BH) * 0.72);
    studioBg.addColorStop(0, '#fff9e6');
    studioBg.addColorStop(0.45, '#f0d896');
    studioBg.addColorStop(0.85, '#c9a152');
    studioBg.addColorStop(1, '#9c732d');
    ctx.fillStyle = studioBg;
    ctx.fillRect(0, 0, BW, BH);

    // 2. Soft diagonal rainbow foil sheen (inspired by Clark promo holographic texture)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const prism = ctx.createLinearGradient(0, 0, BW, BH);
    prism.addColorStop(0.00, 'rgba(255, 224, 150, 0.25)');
    prism.addColorStop(0.28, 'rgba(255, 182, 232, 0.30)');
    prism.addColorStop(0.54, 'rgba(162, 238, 255, 0.34)');
    prism.addColorStop(0.80, 'rgba(255, 236, 158, 0.28)');
    prism.addColorStop(1.00, 'rgba(255, 210, 175, 0.22)');
    ctx.fillStyle = prism;
    ctx.fillRect(0, 0, BW, BH);

    // Gentle sunlit diagonal shimmer shafts
    const ray1 = ctx.createLinearGradient(BW * 0.1, 0, BW * 0.85, BH);
    ray1.addColorStop(0.30, 'rgba(255,255,255,0)');
    ray1.addColorStop(0.50, 'rgba(255,255,255,0.28)');
    ray1.addColorStop(0.70, 'rgba(255,255,255,0)');
    ctx.fillStyle = ray1;
    ctx.fillRect(0, 0, BW, BH);
    ctx.restore();

    // 3. Soft ambient stardust bokeh motes (subtle & uncluttered)
    const bokehSpots = [
      [0.14, 0.16, 4.5], [0.84, 0.20, 6], [0.20, 0.72, 5],
      [0.86, 0.66, 4], [0.76, 0.36, 3], [0.16, 0.42, 3.5]
    ];
    bokehSpots.forEach(([fx, fy, fr]) => {
      const bgGrad = ctx.createRadialGradient(BW * fx, BH * fy, 0, BW * fx, BH * fy, fr * 2.5);
      bgGrad.addColorStop(0, 'rgba(255, 252, 232, 0.72)');
      bgGrad.addColorStop(1, 'rgba(255, 252, 232, 0)');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(BW * fx, BH * fy, fr * 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Subtle thin inner gold border line
    roundPath(ctx, 16, 16, BW - 32, BH - 32, 8);
    ctx.strokeStyle = 'rgba(255, 250, 224, 0.70)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4. Enlarged full-body pet cutout (centered spotlight showcase)
    const hasCutout = cutoutImg && (cutoutImg.naturalWidth || cutoutImg.width) > 0;
    if (hasCutout) {
      const iw = cutoutImg.naturalWidth || cutoutImg.width;
      const ih = cutoutImg.naturalHeight || cutoutImg.height;
      const availW = BW - 42;
      const availH = BH - (isLandscape ? 58 : 78);
      const fitScale = Math.min(availW / iw, availH / ih);
      const dw = iw * fitScale;
      const dh = ih * fitScale;
      const dx = (BW - dw) * 0.5;
      const dy = (BH - dh) * 0.5 + (isLandscape ? 2 : -2);

      // Soft bright rim backlight behind pet
      const aura = ctx.createRadialGradient(BW * 0.5, BH * 0.48, 12, BW * 0.5, BH * 0.48, Math.max(dw, dh) * 0.65);
      aura.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
      aura.addColorStop(0.55, 'rgba(255, 244, 198, 0.25)');
      aura.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(BW * 0.5, BH * 0.48, Math.max(dw, dh) * 0.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.shadowColor = 'rgba(84, 52, 12, 0.28)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(cutoutImg, dx, dy, dw, dh);
      ctx.restore();
    } else if (orbIcon && (orbIcon.naturalWidth || orbIcon.width)) {
      const r = 56;
      ctx.save();
      ctx.beginPath();
      ctx.arc(BW * 0.5, BH * 0.48, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(orbIcon, BW * 0.5 - r, BH * 0.48 - r, r * 2, r * 2);
      ctx.restore();
    }

    // 5. Minimalist Top Archive Header + Bottom Official CatchPet Orb Icon Seal & QR
    ctx.fillStyle = 'rgba(56, 36, 8, 0.82)';
    ctx.font = `800 8.5px ${MONO_STACK}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`CATCHPET · ${getCardDisplayTitle(card)}`, 24, 29);

    ctx.textAlign = 'right';
    ctx.font = `700 8px ${FONT_STACK}`;
    ctx.fillText(card.breedName || '全息萌宠典藏', BW - 24, 29);

    const badgeD = 38;
    const badgeR = badgeD * 0.5;
    const bx = 22 + badgeR;
    const by = BH - 21 - badgeR;

    // 嵌入上一版官方「双宠星环抓宠球」微章图标（外环精简、内芯放大清晰呈现双宠 icon）
    ctx.save();
    const glowGrad = ctx.createRadialGradient(bx, by, badgeR * 0.25, bx, by, badgeR * 1.35);
    glowGrad.addColorStop(0, 'rgba(255, 226, 128, 0.55)');
    glowGrad.addColorStop(1, 'rgba(255, 226, 128, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(bx, by, badgeR * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // 精灵球外圈红白渐变边框
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, Math.PI, 0, false);
    ctx.closePath();
    ctx.fillStyle = makeLinearGrad(ctx, bx - badgeR, by - badgeR, bx + badgeR, by, ['#ff8569', '#d62f42']);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = makeLinearGrad(ctx, bx - badgeR, by, bx + badgeR, by + badgeR, ['#f4f7fc', '#b6c2d6']);
    ctx.fill();

    // 中腰暗金分割带
    ctx.fillStyle = '#101624';
    ctx.fillRect(bx - badgeR, by - 2.2, badgeD, 4.4);

    // 外圈金框
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.strokeStyle = '#d49f2a';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 内芯完整呈现上一版官方双宠星环图标 (assets/app-icon.png)
    const coreR = badgeR * 0.78;
    ctx.beginPath();
    ctx.arc(bx, by, coreR + 1.4, 0, Math.PI * 2);
    ctx.fillStyle = '#0e1526';
    ctx.fill();

    if (orbIcon && (orbIcon.naturalWidth || orbIcon.width)) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, coreR, 0, Math.PI * 2);
      ctx.clip();
      const iw = orbIcon.naturalWidth || orbIcon.width;
      const ih = orbIcon.naturalHeight || orbIcon.height;
      const cov = Math.max((coreR * 2) / iw, (coreR * 2) / ih);
      const dw = iw * cov;
      const dh = ih * cov;
      ctx.drawImage(orbIcon, bx - dw * 0.5, by - dh * 0.5, dw, dh);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(bx, by, coreR, 0, Math.PI * 2);
      ctx.fillStyle = makeLinearGrad(ctx, bx - coreR, by - coreR, bx + coreR, by + coreR, energy.orb);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(bx, by, coreR, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffe58f';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 图标右侧印章文字
    const textX = bx + badgeR + 8;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(56, 36, 8, 0.86)';
    ctx.font = `800 8.5px ${FONT_STACK}`;
    ctx.fillText('抓宠大作战 · CATCHPET', textX, by - 5.5);

    ctx.fillStyle = 'rgba(72, 46, 12, 0.72)';
    ctx.font = `700 7.2px ${MONO_STACK}`;
    ctx.fillText(`${card.serialNumber || '001/165 ★'} · 63×88mm`, textX, by + 6.5);

    const showQR = card.showBackQRCode !== false;
    if (showQR) {
      const qSize = 40;
      const qx = BW - 22 - qSize;
      const qy = BH - 21 - qSize;

      roundPath(ctx, qx, qy, qSize, qSize, 6);
      ctx.fillStyle = 'rgba(250, 247, 238, 0.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(138, 96, 22, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const prevSmooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      drawQRToCanvas(ctx, 'https://catchcat-studio.netlify.app', qx + 3, qy + 3, qSize - 6, '#0b1221', '#faf7ee');
      ctx.imageSmoothingEnabled = prevSmooth;
    }

    ctx.restore();
    ctx.restore();
    ctx.restore();
    return;
  }

  // ── Variant 2: Classic CatchPet Collector Orb + Archive Plaque + QR ──
  const backGrad = ctx.createRadialGradient(W * 0.5, H * 0.40, 12, W * 0.5, H * 0.44, H * 0.68);
  backGrad.addColorStop(0, '#1e355e');
  backGrad.addColorStop(0.55, '#111d36');
  backGrad.addColorStop(1, '#090e1c');
  ctx.fillStyle = backGrad;
  ctx.fillRect(plate.x, plate.y, plate.w, plate.h);

  const cx = W * 0.5;
  const cy = 176;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(228, 189, 70, 0.16)';
  ctx.lineWidth = 1;
  for (let r = 42; r <= 190; r += 24) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let a = 0; a < 12; a += 1) {
    const rad = (a * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rad) * 40, Math.sin(rad) * 40);
    ctx.lineTo(Math.cos(rad) * 185, Math.sin(rad) * 185);
    ctx.stroke();
  }
  ctx.restore();

  roundPath(ctx, plate.x + 6, plate.y + 6, plate.w - 12, plate.h - 12, 10);
  ctx.strokeStyle = 'rgba(232, 190, 74, 0.62)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  roundPath(ctx, plate.x + 10, plate.y + 10, plate.w - 20, plate.h - 20, 8);
  ctx.strokeStyle = 'rgba(232, 190, 74, 0.25)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.fillStyle = '#e7be56';
  ctx.font = `800 9.5px ${MONO_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CATCHPET · COLLECTOR EDITION', W * 0.5, 34);

  const outerR = 54;
  const halo = ctx.createRadialGradient(cx, cy, 20, cx, cy, outerR + 34);
  halo.addColorStop(0, `${energy.orb[0]}58`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, outerR, Math.PI, 0, false);
  ctx.closePath();
  ctx.fillStyle = makeLinearGrad(ctx, cx - outerR, cy - outerR, cx + outerR, cy, ['#ff8569', '#d62f42']);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = makeLinearGrad(ctx, cx - outerR, cy, cx + outerR, cy + outerR, ['#f4f7fc', '#aebad0']);
  ctx.fill();

  ctx.fillStyle = '#101624';
  ctx.fillRect(cx - outerR, cy - 5.5, outerR * 2, 11);
  ctx.fillStyle = 'rgba(245, 215, 127, 0.72)';
  ctx.fillRect(cx - outerR + 1, cy - 5.5, outerR * 2 - 2, 1);
  ctx.fillRect(cx - outerR + 1, cy + 4.5, outerR * 2 - 2, 1);

  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = '#ebc454';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fillStyle = '#0e1526';
  ctx.fill();
  ctx.strokeStyle = '#ecc85c';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  const innerIconR = 29;
  if (orbIcon && (orbIcon.naturalWidth || orbIcon.width)) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, innerIconR, 0, Math.PI * 2);
    ctx.clip();
    const iw = orbIcon.naturalWidth || orbIcon.width;
    const ih = orbIcon.naturalHeight || orbIcon.height;
    const cov = Math.max((innerIconR * 2) / iw, (innerIconR * 2) / ih);
    const dw = iw * cov;
    const dh = ih * cov;
    ctx.drawImage(orbIcon, cx - dw * 0.5, cy - dh * 0.5, dw, dh);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, innerIconR, 0, Math.PI * 2);
    ctx.fillStyle = makeLinearGrad(ctx, cx - 20, cy - 20, cx + 20, cy + 20, energy.orb);
    ctx.fill();
    drawBadgeVector(ctx, badgeId, cx, cy + 0.5, 16, '#ffffff');
  }

  ctx.beginPath();
  ctx.arc(cx, cy, innerIconR, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffe58f';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const boxY = 248;
  roundPath(ctx, 28, boxY, W - 56, 92, 10);
  ctx.fillStyle = 'rgba(10, 15, 28, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 190, 74, 0.42)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f8f9fc';
  ctx.font = `800 15px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(getCardDisplayTitle(card), W * 0.5, boxY + 21);

  ctx.fillStyle = '#b9c6df';
  ctx.font = `600 10.5px ${FONT_STACK}`;
  ctx.fillText(`${card.breedName || '萌宠伙伴'} · ${card.coatPattern || '特色花色'}`, W * 0.5, boxY + 43);

  ctx.fillStyle = '#e7be56';
  ctx.font = `600 9.5px ${MONO_STACK}`;
  ctx.fillText(`${card.serialNumber || '001/165 ★'} · 性格 ${(card.personalityTag || card.abilityName || '元气粘人').slice(0, 6)}`, W * 0.5, boxY + 63);

  ctx.fillStyle = 'rgba(185, 198, 223, 0.78)';
  ctx.font = `500 9px ${FONT_STACK}`;
  ctx.fillText(`爱好：${(card.hobbyTag || card.attackName || '晒太阳贴贴').slice(0, 12)} · ${card.locationName || '抓宠大作战'}`, W * 0.5, boxY + 80);

  const showQR = card.showBackQRCode !== false;
  if (showQR) {
    const qSize = 60;
    const qx = W - 28 - qSize;
    const qy = 357;

    roundPath(ctx, qx, qy, qSize, qSize, 8);
    ctx.fillStyle = '#faf7ee';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 190, 74, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    drawQRToCanvas(ctx, 'https://catchcat-studio.netlify.app', qx + 4, qy + 4, qSize - 8, '#0b1221', '#faf7ee');
    ctx.imageSmoothingEnabled = prevSmooth;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e7be56';
    ctx.font = `800 9.5px ${FONT_STACK}`;
    ctx.fillText('抓宠大作战 · 全息萌宠闪卡', 30, 371);

    ctx.fillStyle = '#f2f5fc';
    ctx.font = `700 10.5px ${FONT_STACK}`;
    ctx.fillText('扫码直达 Web 制同款闪卡', 30, 390);

    ctx.fillStyle = 'rgba(185, 198, 223, 0.82)';
    ctx.font = `600 8px ${MONO_STACK}`;
    ctx.fillText('catchcat-studio.netlify.app', 30, 408);
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232, 190, 74, 0.75)';
    ctx.font = `700 8.5px ${MONO_STACK}`;
    ctx.fillText('AUTHENTICATED PET TRADING CARD · CATCHPET', W * 0.5, H - 34);
  }

  ctx.restore();
  ctx.restore();
}

export async function exportCard4KBlob(card, cutoutImg, { side = 'front' } = {}) {
  const offscreen = document.createElement('canvas');
  const resolvedImg = cutoutImg || (card.cutoutSrc ? await loadImageCached(card.cutoutSrc) : null);
  const printScale = CARD_EXPORT_PX_W / CARD_LOGICAL_W; // exact 3024 x 4224 (63mm x 88mm)
  if (side === 'back') {
    const emblem = await loadImageCached('assets/app-icon.png');
    renderCardBackToCanvas(offscreen, card, resolvedImg, printScale, emblem);
  } else {
    renderCardFrontToCanvas(offscreen, card, resolvedImg, printScale);
  }
  const rawBlob = await new Promise((resolve) => {
    offscreen.toBlob((blob) => resolve(blob), 'image/png');
  });
  return rawBlob ? injectPngPhysicalSize63x88(rawBlob, 48000) : null;
}

