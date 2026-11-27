/**
 * CatchPet (抓宠大作战) Cloud Auth & Cross-Device Collection Sync Client
 * Connects Web IndexedDB seamlessly to /.netlify/functions/auth-* & cards-sync
 */

const LS_TOKEN = 'CatchPet_CloudToken_v1';
const LS_USER = 'CatchPet_CloudUser_v1';
const LS_PENDING_DELETES = 'CatchPet_CloudPendingDeletes_v1';

const API_BASE =
  typeof window !== 'undefined' && /^https?:/i.test(window.location.protocol)
    ? ''
    : 'https://catchcat-studio.netlify.app';

export function getCloudSession() {
  try {
    const token = localStorage.getItem(LS_TOKEN) || '';
    const rawUser = localStorage.getItem(LS_USER);
    const user = rawUser ? JSON.parse(rawUser) : null;
    if (!token || !user?.userId) return null;
    return { token, user };
  } catch {
    return null;
  }
}

function saveCloudSession(token, user) {
  if (token) localStorage.setItem(LS_TOKEN, token);
  if (user) localStorage.setItem(LS_USER, JSON.stringify(user));
}

export function logoutCloudAccount() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
  localStorage.removeItem(LS_PENDING_DELETES);
}

function getPendingDeletes() {
  try {
    const raw = localStorage.getItem(LS_PENDING_DELETES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addPendingDelete(cardId) {
  const list = getPendingDeletes();
  if (!list.includes(cardId)) {
    list.push(cardId);
    localStorage.setItem(LS_PENDING_DELETES, JSON.stringify(list));
  }
}

function removePendingDelete(cardId) {
  const next = getPendingDeletes().filter((id) => id !== cardId);
  localStorage.setItem(LS_PENDING_DELETES, JSON.stringify(next));
}

async function apiFetch(path, options = {}) {
  const sess = getCloudSession();
  const headers = { ...(options.headers || {}) };
  if (sess?.token && !headers.Authorization) {
    headers.Authorization = `Bearer ${sess.token}`;
  }
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const resp = await fetch(`${API_BASE}/.netlify/functions/${path}`, {
    ...options,
    headers
  });
  return resp;
}

export async function registerCloudAccount({ account, password, displayName }) {
  const resp = await apiFetch('auth-register', {
    method: 'POST',
    body: JSON.stringify({ account, password, displayName })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `注册失败 (${resp.status})`);
  }
  saveCloudSession(data.token, data.user);
  return data.user;
}

export async function loginCloudAccount({ account, password }) {
  const resp = await apiFetch('auth-login', {
    method: 'POST',
    body: JSON.stringify({ account, password })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `登录失败 (${resp.status})`);
  }
  saveCloudSession(data.token, data.user);
  return data.user;
}

export async function updateCloudTrainerStats({ displayName, trainerXP }) {
  if (!getCloudSession()) return null;
  try {
    const resp = await apiFetch('auth-me', {
      method: 'PATCH',
      body: JSON.stringify({ displayName, trainerXP })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.user) saveCloudSession(null, data.user);
    return data?.user || null;
  } catch {
    return null;
  }
}

async function renderImageToResizedBase64(src, maxDim = 900, mime = 'image/png') {
  if (!src) return null;
  if (src.startsWith('data:image/png;base64,') && mime === 'image/png' && src.length < 1_400_000) {
    return src;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w0 = img.naturalWidth || img.width || 1;
      const h0 = img.naturalHeight || img.height || 1;
      const s = Math.min(1, maxDim / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * s));
      const h = Math.max(1, Math.round(h0 * s));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL(mime, 0.88));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function fetchCloudCardCutoutDataUrl(cardId) {
  const resp = await apiFetch(`card-image?cardId=${encodeURIComponent(cardId)}&kind=cutout`);
  if (!resp.ok) return null;
  const blob = await resp.blob();
  return blobToDataUrl(blob);
}

export async function pushCardToCloud(card, { includeCutout = true } = {}) {
  const sess = getCloudSession();
  if (!sess) return null;

  let cutoutBase64 = null;
  if (includeCutout && card.cutoutSrc) {
    cutoutBase64 = await renderImageToResizedBase64(card.cutoutSrc, 900, 'image/png');
  }

  const cleanCard = { ...card };
  delete cleanCard.cutoutSrc;
  // Keep built-in preset asset path reference if present for cross-fallback
  if (typeof card.cutoutSrc === 'string' && card.cutoutSrc.startsWith('assets/')) {
    cleanCard.assetPath = card.cutoutSrc;
  }

  const resp = await apiFetch('cards-sync', {
    method: 'POST',
    body: JSON.stringify({ card: cleanCard, cutoutBase64 })
  });
  if (resp.status === 401) {
    logoutCloudAccount();
    throw new Error('登录状态已过期，请重新登录');
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `云同步失败 (${resp.status})`);
  }
  return data.card;
}

export async function deleteCardFromCloud(cardId) {
  if (!getCloudSession()) return false;
  try {
    const resp = await apiFetch(`cards-sync?id=${encodeURIComponent(cardId)}`, {
      method: 'DELETE'
    });
    if (resp.ok) {
      removePendingDelete(cardId);
      return true;
    }
  } catch {}
  addPendingDelete(cardId);
  return false;
}

/**
 * 双向智能合并：
 * 1. 先冲刷本地待删队列
 * 2. 拉取云端卡册（包含在 iOS App 或其它浏览器保存的卡片）
 * 3. 下载云端缺失或更新的透明抠图，合并入 IndexedDB
 * 4. 把本地独有的非默认示例卡增量上传至云端
 */
export async function syncCardsBidirectional(localCards, upsertLocalCard) {
  const sess = getCloudSession();
  if (!sess) return { cards: localCards, downloaded: 0, uploaded: 0 };

  const pendingDels = getPendingDeletes();
  for (const delId of pendingDels) {
    await deleteCardFromCloud(delId);
  }

  const resp = await apiFetch('cards-sync', { method: 'GET' });
  if (resp.status === 401) {
    logoutCloudAccount();
    throw new Error('登录状态已过期，请重新登录');
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `拉取云端卡册失败 (${resp.status})`);
  }

  if (data.user) {
    saveCloudSession(null, data.user);
  }

  const cloudCards = Array.isArray(data.cards) ? data.cards : [];
  const localById = new Map(localCards.map((c) => [c.id, c]));
  const cloudById = new Map(cloudCards.map((c) => [c.id, c]));

  let downloaded = 0;
  let uploaded = 0;

  // 1) Pull missing or newer cloud cards into local store
  for (const rc of cloudCards) {
    const lc = localById.get(rc.id);
    const cloudTime = Number(rc.updatedAt || rc.createdAt || 0);
    const localTime = Number(lc?.updatedAt || lc?.createdAt || 0);

    if (!lc || cloudTime > localTime + 500 || !lc.cutoutSrc) {
      let cutoutSrc = lc?.cutoutSrc || rc.assetPath || 'assets/cat-orange.png';
      if (rc.hasCutout) {
        const fetchedUrl = await fetchCloudCardCutoutDataUrl(rc.id).catch(() => null);
        if (fetchedUrl) cutoutSrc = fetchedUrl;
      }
      const mergedCard = {
        ...rc,
        cutoutSrc,
        cardBackStyle: rc.cardBackStyle || 'fullArtPet',
        cardBackOrientation: rc.cardBackOrientation || 'auto',
        showBackQRCode: rc.showBackQRCode !== false
      };
      await upsertLocalCard(mergedCard);
      localById.set(mergedCard.id, mergedCard);
      downloaded += 1;
    }
  }

  // 2) Push local non-sample cards (or locally newer cards) to cloud
  for (const lc of localCards) {
    const isSample = String(lc.id).startsWith('sample-');
    const rc = cloudById.get(lc.id);
    const localTime = Number(lc.updatedAt || lc.createdAt || 0);
    const cloudTime = Number(rc?.updatedAt || rc?.createdAt || 0);

    if ((!rc && !isSample) || (rc && localTime > cloudTime + 500)) {
      await pushCardToCloud(lc, { includeCutout: !rc?.hasCutout || localTime > cloudTime + 500 });
      uploaded += 1;
    }
  }

  const finalList = Array.from(localById.values()).sort(
    (a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)
  );
  return { cards: finalList, downloaded, uploaded, user: data.user || sess.user };
}

