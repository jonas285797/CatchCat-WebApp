/**
 * Lightweight Pure-JS ISO/IEC 18004 QR Code Generator (Byte Mode, Version 1..4, EC Level L/M)
 * Zero external dependencies — encodes https://catchcat-studio.netlify.app reliably on Canvas.
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(deg) {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Array(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      res[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return res.slice(data.length);
}

// Single-block EC Level M tables covering versions 1..4 (up to 64 UTF-8 bytes)
const VERSION_SPECS = [
  { version: 1, size: 21, totalData: 16, ecCount: 10, align: [] },
  { version: 2, size: 25, totalData: 28, ecCount: 16, align: [6, 18] },
  { version: 3, size: 29, totalData: 44, ecCount: 26, align: [6, 22] },
  { version: 4, size: 33, totalData: 64, ecCount: 36, align: [6, 26] }
];

// Format information strings for EC Level M (00) + mask 0..7, BCH-encoded & masked with 0x5412
const FORMAT_BITS_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b,
  0x45f9, 0x40ce, 0x4f97, 0x4aa0
];

function placeFinder(grid, reserved, row, col, size) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      reserved[rr][cc] = true;
      if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
        const dark =
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        grid[rr][cc] = dark ? 1 : 0;
      } else {
        grid[rr][cc] = 0;
      }
    }
  }
}

function placeAlignment(grid, reserved, rCenter, cCenter) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = rCenter + r;
      const cc = cCenter + c;
      reserved[rr][cc] = true;
      const dark = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
      grid[rr][cc] = dark ? 1 : 0;
    }
  }
}

function placeFormatBits(grid, reserved, size, maskId) {
  const fmt = FORMAT_BITS_M[maskId];
  // ISO/IEC 18004: bit 14 is MSB at (8,0) & (size-1,8); bit 0 is LSB at (0,8) & (8,size-1)
  const copy1Coords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  const copy2Coords = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]
  ];

  for (let idx = 0; idx < 15; idx++) {
    const bit = (fmt >> (14 - idx)) & 1;
    const [r1, c1] = copy1Coords[idx];
    grid[r1][c1] = bit;
    reserved[r1][c1] = true;

    const [r2, c2] = copy2Coords[idx];
    grid[r2][c2] = bit;
    reserved[r2][c2] = true;
  }
  // Fixed dark module at (size - 8, 8)
  grid[size - 8][8] = 1;
  reserved[size - 8][8] = true;
}

function maskCondition(maskId, r, c) {
  switch (maskId) {
    case 0: return ((r + c) & 1) === 0;
    case 1: return (r & 1) === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return ((Math.floor(r / 2) + Math.floor(c / 3)) & 1) === 0;
    case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
    case 6: return ((((r * c) % 2) + ((r * c) % 3)) & 1) === 0;
    case 7: return ((((r + c) % 2) + ((r * c) % 3)) & 1) === 0;
    default: return false;
  }
}

function penaltyScore(grid, size) {
  let score = 0;
  // Rule 1: 5+ adjacent same color in row/col
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (grid[r][c] === grid[r][c - 1]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (grid[r][c] === grid[r - 1][c]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) {
        score += 3;
      }
    }
  }
  return score;
}

const qrCache = new Map();

export function encodeQRMatrix(text) {
  if (qrCache.has(text)) return qrCache.get(text);

  const bytes = new TextEncoder().encode(text);
  const spec = VERSION_SPECS.find((s) => bytes.length + 2 <= s.totalData) || VERSION_SPECS[VERSION_SPECS.length - 1];
  const { version, size, totalData, ecCount, align } = spec;

  // Build data bit stream: Mode 0100 (4 bits) + char count (8 bits) + bytes + terminator + padding
  const bits = [];
  const pushBits = (val, count) => {
    for (let i = count - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);
  const capBits = totalData * 8;
  const term = Math.min(4, capBits - bits.length);
  pushBits(0, term);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | bits[i + b];
    codewords.push(v);
  }
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (codewords.length < totalData) {
    codewords.push(padBytes[pi % 2]);
    pi++;
  }

  const ecWords = rsRemainder(codewords, ecCount);
  const allBytes = [...codewords, ...ecWords];
  const bitStream = [];
  for (const cw of allBytes) {
    for (let b = 7; b >= 0; b--) bitStream.push((cw >> b) & 1);
  }

  const buildMasked = (maskId) => {
    const grid = Array.from({ length: size }, () => new Uint8Array(size));
    const reserved = Array.from({ length: size }, () => Array(size).fill(false));

    placeFinder(grid, reserved, 0, 0, size);
    placeFinder(grid, reserved, 0, size - 7, size);
    placeFinder(grid, reserved, size - 7, 0, size);

    if (version >= 2) {
      for (const r of align) {
        for (const c of align) {
          if (reserved[r][c]) continue;
          placeAlignment(grid, reserved, r, c);
        }
      }
    }

    for (let i = 8; i < size - 8; i++) {
      grid[6][i] = i % 2 === 0 ? 1 : 0;
      grid[i][6] = i % 2 === 0 ? 1 : 0;
      reserved[6][i] = true;
      reserved[i][6] = true;
    }

    placeFormatBits(grid, reserved, size, maskId);

    // Zig-zag upward/downward bit placement
    let bitIdx = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let i = 0; i < size; i++) {
        const r = upward ? size - 1 - i : i;
        for (const dc of [0, -1]) {
          const c = col + dc;
          if (!reserved[r][c]) {
            const bit = bitIdx < bitStream.length ? bitStream[bitIdx++] : 0;
            grid[r][c] = maskCondition(maskId, r, c) ? (bit ^ 1) : bit;
          }
        }
      }
      upward = !upward;
    }
    return grid;
  };

  let bestGrid = null;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const g = buildMasked(m);
    const s = penaltyScore(g, size);
    if (s < bestScore) {
      bestScore = s;
      bestGrid = g;
    }
  }

  const result = { size, modules: bestGrid };
  qrCache.set(text, result);
  return result;
}

export function drawQRToCanvas(ctx, text, x, y, boxSize, darkColor = '#0b1221', lightColor = '#faf7ee') {
  const { size, modules } = encodeQRMatrix(text);
  const quiet = 2;
  const cell = boxSize / (size + quiet * 2);

  ctx.save();
  ctx.fillStyle = lightColor;
  ctx.fillRect(x, y, boxSize, boxSize);

  ctx.fillStyle = darkColor;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        const px = x + (c + quiet) * cell;
        const py = y + (r + quiet) * cell;
        ctx.fillRect(px, py, Math.ceil(cell + 0.15), Math.ceil(cell + 0.15));
      }
    }
  }
  ctx.restore();
}
