/**
 * 抓喵大作战 Web - 端侧零依赖发丝精抠 + 手涂微调引擎
 * 算法流水线:
 * 1. 上/侧边框多聚类背景色调采样 (避开底部中心宠身干扰)
 * 2. 色彩偏离度 + 2x2 降采样边缘势垒测地距离 (Geodesic Edge-Barrier)
 * 3. O(N) 可分离盒式导向滤波 (Separable Box Guided Filter)
 * 4. 主体邻近连通域筛选 + 游离残影清零 + 内部小孔洞修补
 * 5. 半透明发丝边缘去溢色 (Color Decontamination) + 手涂擦补通道
 */

export class WebCutoutEngine {
  constructor() {
    this.workCanvas = document.createElement('canvas');
    this.workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true });
    this.sourcePixels = null;
    this.width = 0;
    this.height = 0;
    this.baseAlpha = null;   // Float32Array [0..1]
    this.manualDelta = null; // Int8Array: 0=自动, +1=强制保留, -1=强制擦除
  }

  /**
   * 载入原图到最大 640px 内部工作区，保证移动端与桌面端实时调参流畅
   */
  loadImage(img, maxDim = 640) {
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(natW, natH));
    const w = Math.max(64, Math.round(natW * scale));
    const h = Math.max(64, Math.round(natH * scale));
    this.width = w;
    this.height = h;
    this.workCanvas.width = w;
    this.workCanvas.height = h;
    this.workCtx.clearRect(0, 0, w, h);
    this.workCtx.drawImage(img, 0, 0, w, h);
    const imgData = this.workCtx.getImageData(0, 0, w, h);
    this.sourcePixels = new Uint8ClampedArray(imgData.data);
    this.baseAlpha = new Float32Array(w * h);
    this.manualDelta = new Int8Array(w * h);
    return { w, h };
  }

  /**
   * 若导入的图片本身已是透明通道 PNG，直接沿用原透明通道
   */
  hasSourceTransparency(src, w, h) {
    let borderChecked = 0;
    let borderTransparent = 0;
    const step = 4;
    for (let x = 0; x < w; x += step) {
      borderChecked += 2;
      if (src[x * 4 + 3] < 40) borderTransparent++;
      if (src[((h - 1) * w + x) * 4 + 3] < 40) borderTransparent++;
    }
    for (let y = 0; y < h; y += step) {
      borderChecked += 2;
      if (src[y * w * 4 + 3] < 40) borderTransparent++;
      if (src[(y * w + (w - 1)) * 4 + 3] < 40) borderTransparent++;
    }
    return borderChecked > 0 && borderTransparent / borderChecked >= 0.14;
  }

  /**
   * 采样顶部、左右上半部分及底角作为背景颜色集群，防止底部的宠物身体污染背景原型
   */
  extractBorderClusters(src, w, h) {
    const padX = Math.max(4, Math.round(w * 0.06));
    const padY = Math.max(4, Math.round(h * 0.06));
    const maxSideY = Math.round(h * 0.80);
    const cornerX = Math.round(w * 0.14);
    const step = 3;

    const samples = [];
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const isTop = y < padY;
        const isUpperSides = y < maxSideY && (x < padX || x >= w - padX);
        const isBottomCorners = y >= h - padY && (x < cornerX || x >= w - cornerX);
        if (isTop || isUpperSides || isBottomCorners) {
          const i = (y * w + x) * 4;
          samples.push([src[i], src[i + 1], src[i + 2]]);
        }
      }
    }

    const clusters = [];
    const mergeDist = 30;
    for (let i = 0; i < samples.length; i++) {
      const [r, g, b] = samples[i];
      let matched = null;
      let bestDist = mergeDist;
      for (let k = 0; k < clusters.length; k++) {
        const c = clusters[k];
        const dr = r - c.r;
        const dg = g - c.g;
        const db = b - c.b;
        const d = Math.sqrt(dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11);
        if (d < bestDist) {
          bestDist = d;
          matched = c;
        }
      }
      if (matched) {
        matched.sr += r;
        matched.sg += g;
        matched.sb += b;
        matched.count += 1;
        matched.r = matched.sr / matched.count;
        matched.g = matched.sg / matched.count;
        matched.b = matched.sb / matched.count;
      } else if (clusters.length < 16) {
        clusters.push({ r, g, b, sr: r, sg: g, sb: b, count: 1 });
      }
    }

    clusters.sort((a, b) => b.count - a.count);
    const minVotes = Math.max(3, Math.floor(samples.length * 0.025));
    const filtered = clusters.filter((c, idx) => idx === 0 || c.count >= minVotes);
    return filtered.slice(0, 7).map((c) => [c.r, c.g, c.b]);
  }

  /**
   * 降采样边缘势垒测地距离 (Geodesic Edge-Barrier Distance)
   * 从上/侧边框向内传播背景可达性；遇到强轮廓边界时步进代价陡增，从而保护闭合在轮廓内的深色/白色毛发不被扣淡
   */
  computeGeodesicFg(mismatchMap, edgeMap, w, h) {
    const gw = Math.min(220, w);
    const gh = Math.max(48, Math.round((h * gw) / w));
    const gn = gw * gh;
    const stepMismatch = new Float32Array(gn);
    const stepEdge = new Float32Array(gn);
    const geo = new Float32Array(gn);

    const sx = w / gw;
    const sy = h / gh;

    for (let gy = 0; gy < gh; gy++) {
      const y0 = Math.min(h - 1, Math.floor(gy * sy));
      const y1 = Math.min(h - 1, Math.floor((gy + 1) * sy));
      for (let gx = 0; gx < gw; gx++) {
        const x0 = Math.min(w - 1, Math.floor(gx * sx));
        const x1 = Math.min(w - 1, Math.floor((gx + 1) * sx));
        let maxEdge = 0;
        let minMis = mismatchMap[y0 * w + x0];
        for (let py = y0; py <= y1; py++) {
          for (let px = x0; px <= x1; px++) {
            const idx = py * w + px;
            if (edgeMap[idx] > maxEdge) maxEdge = edgeMap[idx];
            if (mismatchMap[idx] < minMis) minMis = mismatchMap[idx];
          }
        }
        const gIdx = gy * gw + gx;
        stepMismatch[gIdx] = minMis;
        stepEdge[gIdx] = maxEdge;
        geo[gIdx] = 12.0;
      }
    }

    const sideCutY = Math.floor(gh * 0.82);
    const botCornerX = Math.floor(gw * 0.14);
    for (let gx = 0; gx < gw; gx++) {
      // 上边框为高置信背景种子
      geo[gx] = Math.min(1.0, Math.max(0, stepMismatch[gx] - 0.35) * 0.65);
      // 底边框仅角落作低代价种子，中间避免从爪/胸前漏入
      const botIdx = (gh - 1) * gw + gx;
      const isCorner = gx < botCornerX || gx >= gw - botCornerX;
      geo[botIdx] = isCorner
        ? Math.min(1.0, Math.max(0, stepMismatch[botIdx] - 0.30) * 0.75)
        : Math.min(1.2, 0.32 + Math.max(0, stepMismatch[botIdx] - 0.25) * 0.90);
    }
    for (let gy = 1; gy < gh - 1; gy++) {
      const leftIdx = gy * gw;
      const rightIdx = gy * gw + (gw - 1);
      if (gy < sideCutY) {
        geo[leftIdx] = Math.min(1.0, Math.max(0, stepMismatch[leftIdx] - 0.35) * 0.65);
        geo[rightIdx] = Math.min(1.0, Math.max(0, stepMismatch[rightIdx] - 0.35) * 0.65);
      } else {
        geo[leftIdx] = Math.min(1.1, 0.22 + Math.max(0, stepMismatch[leftIdx] - 0.30) * 0.85);
        geo[rightIdx] = Math.min(1.1, 0.22 + Math.max(0, stepMismatch[rightIdx] - 0.30) * 0.85);
      }
    }

    const relax = (idx, nbIdx, diag) => {
      const mis = Math.max(0, stepMismatch[idx] - 0.30);
      const edgeBarrier = Math.max(0, stepEdge[idx] - 0.10) * 0.78;
      const stepCost = (0.0008 + mis * 0.055 + edgeBarrier) * (diag ? 1.35 : 1.0);
      const cand = geo[nbIdx] + stepCost;
      if (cand < geo[idx]) geo[idx] = cand;
    };

    for (let iter = 0; iter < 2; iter++) {
      // Top-Left -> Bottom-Right
      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          const i = gy * gw + gx;
          if (gx > 0) relax(i, i - 1, false);
          if (gy > 0) relax(i, i - gw, false);
          if (gx > 0 && gy > 0) relax(i, i - gw - 1, true);
          if (gx < gw - 1 && gy > 0) relax(i, i - gw + 1, true);
        }
      }
      // Bottom-Right -> Top-Left
      for (let gy = gh - 1; gy >= 0; gy--) {
        for (let gx = gw - 1; gx >= 0; gx--) {
          const i = gy * gw + gx;
          if (gx < gw - 1) relax(i, i + 1, false);
          if (gy < gh - 1) relax(i, i + gw, false);
          if (gx < gw - 1 && gy < gh - 1) relax(i, i + gw + 1, true);
          if (gx > 0 && gy < gh - 1) relax(i, i + gw - 1, true);
        }
      }
      // Top-Right -> Bottom-Left
      for (let gy = 0; gy < gh; gy++) {
        for (let gx = gw - 1; gx >= 0; gx--) {
          const i = gy * gw + gx;
          if (gx < gw - 1) relax(i, i + 1, false);
          if (gy > 0) relax(i, i - gw, false);
          if (gx < gw - 1 && gy > 0) relax(i, i - gw + 1, true);
          if (gx > 0 && gy > 0) relax(i, i - gw - 1, true);
        }
      }
      // Bottom-Left -> Top-Right
      for (let gy = gh - 1; gy >= 0; gy--) {
        for (let gx = 0; gx < gw; gx++) {
          const i = gy * gw + gx;
          if (gx > 0) relax(i, i - 1, false);
          if (gy < gh - 1) relax(i, i + gw, false);
          if (gx > 0 && gy < gh - 1) relax(i, i + gw - 1, true);
          if (gx < gw - 1 && gy < gh - 1) relax(i, i + gw + 1, true);
        }
      }
    }

    // 双线性上采样到工作分辨率并映射为前景概率 [0..1]
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = ((y + 0.5) / h) * gh - 0.5;
      const y0 = Math.max(0, Math.min(gh - 1, Math.floor(fy)));
      const y1 = Math.max(0, Math.min(gh - 1, y0 + 1));
      const wy = Math.max(0, Math.min(1, fy - y0));
      for (let x = 0; x < w; x++) {
        const fx = ((x + 0.5) / w) * gw - 0.5;
        const x0 = Math.max(0, Math.min(gw - 1, Math.floor(fx)));
        const x1 = Math.max(0, Math.min(gw - 1, x0 + 1));
        const wx = Math.max(0, Math.min(1, fx - x0));

        const v00 = geo[y0 * gw + x0];
        const v10 = geo[y0 * gw + x1];
        const v01 = geo[y1 * gw + x0];
        const v11 = geo[y1 * gw + x1];
        const gVal = (v00 * (1 - wx) + v10 * wx) * (1 - wy) + (v01 * (1 - wx) + v11 * wx) * wy;
        out[y * w + x] = Math.min(1, Math.max(0, (gVal - 0.28) / 0.52));
      }
    }
    return out;
  }

  /**
   * 运行端侧智能前景抠图 + 测地势垒保护 + Guided Filter 边缘细化
   */
  runAutoMatting({ sensitivity = 0.54, feather = 2 } = {}) {
    if (!this.sourcePixels) return;
    const w = this.width;
    const h = this.height;
    const n = w * h;
    const src = this.sourcePixels;

    if (this.hasSourceTransparency(src, w, h)) {
      for (let i = 0; i < n; i++) {
        this.baseAlpha[i] = src[i * 4 + 3] / 255.0;
      }
      return this.buildCompositeResult();
    }

    const prototypes = this.extractBorderClusters(src, w, h);

    // 1. 像素亮度 + 与背景集群的感知色差映射
    const luma = new Float32Array(n);
    const mismatchMap = new Float32Array(n);
    const colorProb = new Float32Array(n);
    const distScale = 24 + (1 - sensitivity) * 60;

    for (let y = 0; y < h; y++) {
      const ny = (y / h - 0.50) * 2.0;
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const p4 = idx * 4;
        const r = src[p4], g = src[p4 + 1], b = src[p4 + 2];
        luma[idx] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

        let minD = 999;
        for (let k = 0; k < prototypes.length; k++) {
          const dr = r - prototypes[k][0];
          const dg = g - prototypes[k][1];
          const db = b - prototypes[k][2];
          const d = Math.sqrt(dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11);
          if (d < minD) minD = d;
        }

        const nx = (x / w - 0.50) * 2.0;
        const radial = Math.sqrt(nx * nx * 0.85 + ny * ny * 0.72);
        const centerPrior = Math.max(0, 1.0 - Math.max(0, radial - 0.35) * 1.15);

        const mis = minD / distScale;
        mismatchMap[idx] = mis;

        const rawScore = mis * (0.48 + 0.78 * centerPrior);
        colorProb[idx] = Math.min(1, Math.max(0, (rawScore - 0.50) / 0.56));
      }
    }

    // 2. 亮度 + 色彩双通道纹理轮廓强度 (解决等亮度毛发/植物边缘检测不足)
    const edgeMap = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const p4 = idx * 4;
        const gxL = Math.abs(luma[idx + 1] - luma[idx - 1]);
        const gyL = Math.abs(luma[idx + w] - luma[idx - w]);

        const pLeft = (idx - 1) * 4;
        const pRight = (idx + 1) * 4;
        const pUp = (idx - w) * 4;
        const pDown = (idx + w) * 4;
        const cGrad =
          (Math.abs(src[pRight] - src[pLeft]) +
            Math.abs(src[pRight + 1] - src[pLeft + 1]) +
            Math.abs(src[pRight + 2] - src[pLeft + 2]) +
            Math.abs(src[pDown] - src[pUp]) +
            Math.abs(src[pDown + 1] - src[pUp + 1]) +
            Math.abs(src[pDown + 2] - src[pUp + 2])) /
          (6 * 255);

        edgeMap[idx] = Math.min(1, Math.max(gxL + gyL, cGrad * 1.8) * 2.2);
      }
    }

    // 3. 测地边缘势垒先验 + 色彩概率融合
    const geoFg = this.computeGeodesicFg(mismatchMap, edgeMap, w, h);
    const coarse = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      const ny = (y / h - 0.5) * 2;
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const nx = (x / w - 0.5) * 2;
        const inCore = nx * nx + ny * ny < 0.78;
        const texBoost = inCore ? edgeMap[idx] * 0.16 : 0;
        coarse[idx] = Math.min(1, Math.max(0, 0.54 * colorProb[idx] + 0.46 * geoFg[idx] + texBoost));
      }
    }

    // 4. O(N) 可分离 Guided Filter（沿原图亮度做发丝边缘保持滤波）
    const radius = Math.max(2, Math.round(feather + 3));
    const refined = this.guidedFilterGray(luma, coarse, w, h, radius, 0.008);

    // 5. 收紧前景/背景置信并平滑过渡
    const cleaned = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let a = refined[i];
      if (a < 0.14) a = 0;
      else if (a > 0.85) a = 1;
      else a = (a - 0.14) / 0.71;
      cleaned[i] = a;
    }

    // 6. 主体连通域筛选（消灭远端游离杂物/半透明残影）+ 内部小孔洞修补
    const bestSize = this.pruneDisconnectedNoise(cleaned, w, h);
    this.fillSmallInteriorHoles(cleaned, colorProb, w, h, bestSize);

    this.baseAlpha.set(cleaned);
    return this.buildCompositeResult();
  }

  /**
   * Fast O(N) Prefix-Sum Guided Filter (He et al.)
   */
  guidedFilterGray(I, p, w, h, r, eps) {
    const n = w * h;
    const meanI = this.boxMean(I, w, h, r);
    const meanP = this.boxMean(p, w, h, r);

    const II = new Float32Array(n);
    const Ip = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      II[i] = I[i] * I[i];
      Ip[i] = I[i] * p[i];
    }

    const corrI = this.boxMean(II, w, h, r);
    const corrIp = this.boxMean(Ip, w, h, r);

    const a = new Float32Array(n);
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const varI = Math.max(0, corrI[i] - meanI[i] * meanI[i]);
      const covIp = corrIp[i] - meanI[i] * meanP[i];
      a[i] = covIp / (varI + eps);
      b[i] = meanP[i] - a[i] * meanI[i];
    }

    const meanA = this.boxMean(a, w, h, r);
    const meanB = this.boxMean(b, w, h, r);
    const q = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      q[i] = Math.min(1, Math.max(0, meanA[i] * I[i] + meanB[i]));
    }
    return q;
  }

  /**
   * O(N) 可分离一维前缀和均值滤波（无 2D Float64 SAT 内存分配，速度提升且边框严格对齐）
   */
  boxMean(src, w, h, r) {
    const n = w * h;
    const tmp = new Float32Array(n);
    const out = new Float32Array(n);
    const hPref = new Float32Array(w + 1);
    const vPref = new Float32Array(h + 1);

    // 水平方向
    for (let y = 0; y < h; y++) {
      const rowOff = y * w;
      hPref[0] = 0;
      for (let x = 0; x < w; x++) {
        hPref[x + 1] = hPref[x] + src[rowOff + x];
      }
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(w - 1, x + r);
        tmp[rowOff + x] = (hPref[x1 + 1] - hPref[x0]) / (x1 - x0 + 1);
      }
    }

    // 垂直方向
    for (let x = 0; x < w; x++) {
      vPref[0] = 0;
      for (let y = 0; y < h; y++) {
        vPref[y + 1] = vPref[y] + tmp[y * w + x];
      }
      for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - r);
        const y1 = Math.min(h - 1, y + r);
        out[y * w + x] = (vPref[y1 + 1] - vPref[y0]) / (y1 - y0 + 1);
      }
    }

    return out;
  }

  /**
   * 选出居中主连通块 + 仅保留其邻近范围内的小块（细须/耳尖/散叶），
   * 彻底清除远端孤立杂物（如画面边缘的笔/桌面物件）及所有 0.16..0.28 的游离灰影。
   */
  pruneDisconnectedNoise(alpha, w, h) {
    const n = w * h;
    const labels = new Int32Array(n);
    const compSizes = [0];
    const compCenterScores = [0];
    const queue = new Int32Array(n);
    let label = 0;

    for (let i = 0; i < n; i++) {
      if (alpha[i] < 0.28 || labels[i] !== 0) continue;
      label++;
      let count = 0;
      let centerSum = 0;
      let head = 0, tail = 0;
      queue[tail++] = i;
      labels[i] = label;

      while (head < tail) {
        const cur = queue[head++];
        count++;
        const x = cur % w;
        const y = (cur - x) / w;
        const nx = (x / w - 0.5) * 2;
        const ny = (y / h - 0.5) * 2;
        const cW = Math.max(0.05, 1.0 - Math.min(1.0, Math.sqrt(nx * nx + ny * ny) * 0.72));
        centerSum += cW;

        if (x > 0 && labels[cur - 1] === 0 && alpha[cur - 1] >= 0.28) {
          labels[cur - 1] = label;
          queue[tail++] = cur - 1;
        }
        if (x < w - 1 && labels[cur + 1] === 0 && alpha[cur + 1] >= 0.28) {
          labels[cur + 1] = label;
          queue[tail++] = cur + 1;
        }
        if (y > 0 && labels[cur - w] === 0 && alpha[cur - w] >= 0.28) {
          labels[cur - w] = label;
          queue[tail++] = cur - w;
        }
        if (y < h - 1 && labels[cur + w] === 0 && alpha[cur + w] >= 0.28) {
          labels[cur + w] = label;
          queue[tail++] = cur + w;
        }
      }
      compSizes.push(count);
      compCenterScores.push(centerSum);
    }

    if (label === 0) return 0;

    let bestLabel = 1;
    let bestRank = -1;
    for (let k = 1; k <= label; k++) {
      const avgCenter = compCenterScores[k] / Math.max(1, compSizes[k]);
      const rank = compSizes[k] * (0.22 + 0.78 * avgCenter);
      if (rank > bestRank) {
        bestRank = rank;
        bestLabel = k;
      }
    }
    const bestSize = compSizes[bestLabel];

    // 膨胀主连通块 2% 短边像素，检验次级连通块是否在主体紧邻范围内
    const primaryBin = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (labels[i] === bestLabel) primaryBin[i] = 1;
    }
    const keepGap = Math.max(7, Math.round(Math.min(w, h) * 0.02));
    const nearPrimary = this.boxMean(primaryBin, w, h, keepGap);

    const compTouchesPrimary = new Uint8Array(label + 1);
    compTouchesPrimary[bestLabel] = 1;
    for (let i = 0; i < n; i++) {
      const lb = labels[i];
      if (lb > 0 && nearPrimary[i] > 0) {
        compTouchesPrimary[lb] = 1;
      }
    }

    const minKeep = Math.max(16, Math.floor(bestSize * 0.018));
    const keepComp = new Uint8Array(label + 1);
    keepComp[bestLabel] = 1;
    for (let k = 1; k <= label; k++) {
      if (compTouchesPrimary[k] && compSizes[k] >= minKeep) {
        keepComp[k] = 1;
      }
    }

    // 仅允许紧贴已保留主体 4px 边缘之内的羽化半透明过渡留存，消灭全部游离淡影
    const keptBin = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const lb = labels[i];
      if (lb > 0 && keepComp[lb]) {
        keptBin[i] = 1;
      } else if (lb > 0) {
        alpha[i] = 0;
      }
    }
    const fringeZone = this.boxMean(keptBin, w, h, 4);
    for (let i = 0; i < n; i++) {
      if (labels[i] === 0 && fringeZone[i] <= 0.001) {
        alpha[i] = 0;
      }
    }

    return bestSize;
  }

  /**
   * 拓扑闭合修补：从画面四边注入“外部空景”洪水标记；
   * 仅修补面积小且自身具备一定前景线索的内部毛发缺口，避免把腿间被包住的地板/背景填实
   */
  fillSmallInteriorHoles(alpha, colorProb, w, h, bestSize) {
    if (bestSize <= 0) return;
    const n = w * h;
    const exterior = new Uint8Array(n);
    const queue = new Int32Array(n);
    let head = 0, tail = 0;

    const trySeed = (i) => {
      if (exterior[i] === 0 && alpha[i] < 0.35) {
        exterior[i] = 1;
        queue[tail++] = i;
      }
    };

    for (let x = 0; x < w; x++) {
      trySeed(x);
      trySeed((h - 1) * w + x);
    }
    for (let y = 1; y < h - 1; y++) {
      trySeed(y * w);
      trySeed(y * w + (w - 1));
    }

    while (head < tail) {
      const cur = queue[head++];
      const x = cur % w;
      const y = (cur - x) / w;
      if (x > 0) trySeed(cur - 1);
      if (x < w - 1) trySeed(cur + 1);
      if (y > 0) trySeed(cur - w);
      if (y < h - 1) trySeed(cur + w);
    }

    const maxHoleArea = Math.min(1200, Math.max(30, Math.floor(bestSize * 0.025)));
    const visited = new Uint8Array(n);
    const holeQueue = new Int32Array(n);

    for (let i = 0; i < n; i++) {
      if (exterior[i] || visited[i] || alpha[i] >= 0.85) continue;
      let hHead = 0, hTail = 0;
      holeQueue[hTail++] = i;
      visited[i] = 1;

      let alphaSum = 0;
      let probSum = 0;
      while (hHead < hTail) {
        const cur = holeQueue[hHead++];
        alphaSum += alpha[cur];
        probSum += colorProb[cur];
        const x = cur % w;
        const y = (cur - x) / w;
        const nbs = [
          x > 0 ? cur - 1 : -1,
          x < w - 1 ? cur + 1 : -1,
          y > 0 ? cur - w : -1,
          y < h - 1 ? cur + w : -1
        ];
        for (const nb of nbs) {
          if (nb >= 0 && !exterior[nb] && !visited[nb] && alpha[nb] < 0.85) {
            visited[nb] = 1;
            holeQueue[hTail++] = nb;
          }
        }
      }

      const avgAlpha = alphaSum / Math.max(1, hTail);
      const avgProb = probSum / Math.max(1, hTail);
      if (hTail <= maxHoleArea && (avgAlpha >= 0.18 || avgProb >= 0.35)) {
        for (let k = 0; k < hTail; k++) {
          const p = holeQueue[k];
          if (alpha[p] < 0.94) alpha[p] = 0.94;
        }
      }
    }
  }

  /**
   * 交互式手指/鼠标涂抹微调通道：mode='erase' 擦除多余背景，'restore' 恢复毛发
   */
  applyBrush(normX, normY, radiusPx, mode) {
    if (!this.manualDelta) return;
    const cx = Math.round(normX * this.width);
    const cy = Math.round(normY * this.height);
    const r = Math.max(2, Math.round((radiusPx / 640) * Math.max(this.width, this.height)));
    const r2 = r * r;
    const val = mode === 'restore' ? 1 : -1;

    const x0 = Math.max(0, cx - r);
    const x1 = Math.min(this.width - 1, cx + r);
    const y0 = Math.max(0, cy - r);
    const y1 = Math.min(this.height - 1, cy + r);

    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy <= r2) {
          this.manualDelta[y * this.width + x] = val;
        }
      }
    }
  }

  resetManualEdits() {
    if (this.manualDelta) this.manualDelta.fill(0);
  }

  /**
   * 合成最终带边缘色溢校正 (Decontaminate Colors) 的紧凑裁剪透明 PNG Canvas + DataURL
   */
  buildCompositeResult() {
    const w = this.width;
    const h = this.height;
    const n = w * h;
    const src = this.sourcePixels;
    const alpha = this.baseAlpha;
    const manual = this.manualDelta;

    const effectiveAlpha = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let a = alpha[i];
      if (manual[i] === 1) a = 1;
      else if (manual[i] === -1) a = 0;
      effectiveAlpha[i] = a;
    }

    const out = new ImageData(w, h);
    const dst = out.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const p4 = idx * 4;
        const a = effectiveAlpha[idx];

        let r = src[p4];
        let g = src[p4 + 1];
        let b = src[p4 + 2];

        // 对半透明边缘发丝进行去溢色，吸取邻近高置信实心前景像素色彩减轻浅灰/白边
        if (a > 0.06 && a < 0.88) {
          let sr = 0, sg = 0, sb = 0, hits = 0;
          const x0 = Math.max(0, x - 2), x1 = Math.min(w - 1, x + 2);
          const y0 = Math.max(0, y - 2), y1 = Math.min(h - 1, y + 2);
          for (let ny = y0; ny <= y1; ny++) {
            for (let nx = x0; nx <= x1; nx++) {
              const ni = ny * w + nx;
              if (effectiveAlpha[ni] >= 0.88) {
                const np4 = ni * 4;
                sr += src[np4];
                sg += src[np4 + 1];
                sb += src[np4 + 2];
                hits++;
              }
            }
          }
          if (hits > 0) {
            const mix = (1 - a) * 0.52;
            r = Math.round(r * (1 - mix) + (sr / hits) * mix);
            g = Math.round(g * (1 - mix) + (sg / hits) * mix);
            b = Math.round(b * (1 - mix) + (sb / hits) * mix);
          }
        }

        dst[p4] = r;
        dst[p4 + 1] = g;
        dst[p4 + 2] = b;
        dst[p4 + 3] = Math.round(a * 255);

        if (a > 0.15) {
          hasPixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    this.workCtx.putImageData(out, 0, 0);

    // 紧致裁切包围盒（保留 3% 安全呼吸余量），便于主子自动精准居于卡框舞台中央
    if (!hasPixels) {
      return {
        previewCanvas: this.workCanvas,
        tightDataUrl: this.workCanvas.toDataURL('image/png')
      };
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const margin = Math.round(Math.max(bw, bh) * 0.03);
    const sx = Math.max(0, minX - margin);
    const sy = Math.max(0, minY - margin);
    const sw = Math.min(w - sx, bw + margin * 2);
    const sh = Math.min(h - sy, bh + margin * 2);

    const tight = document.createElement('canvas');
    tight.width = sw;
    tight.height = sh;
    tight.getContext('2d').drawImage(this.workCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    return {
      previewCanvas: this.workCanvas,
      tightDataUrl: tight.toDataURL('image/png')
    };
  }

  /**
   * 整张不抠图直接做干净原图回退
   */
  exportUncroppedOriginal() {
    if (!this.sourcePixels) return null;
    const out = new ImageData(new Uint8ClampedArray(this.sourcePixels), this.width, this.height);
    const c = document.createElement('canvas');
    c.width = this.width;
    c.height = this.height;
    c.getContext('2d').putImageData(out, 0, 0);
    return c.toDataURL('image/png');
  }
}
