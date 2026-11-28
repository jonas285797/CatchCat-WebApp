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
  if (!blob || blob.size < 64) return Promise.resolve(null);
  const typedBlob = blob.type && blob.type.startsWith('image/')
    ? blob
    : new Blob([blob], { type: 'image/png' });
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(typedBlob);
  });
}

function canDecodeDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve((im.naturalWidth || im.width) > 4);
    im.onerror = () => resolve(false);
    im.src = dataUrl;
  });
}

function normalizeOverlapKey(card) {
  const title = String(card?.customNickname || card?.name || '').trim().toLowerCase();
  const breed = String(card?.breedName || '').trim().toLowerCase();
  const coat = String(card?.coatPattern || '').trim().toLowerCase();
  const hp = Number(card?.hp || 0);
  const tsBucket = Math.round(Number(card?.createdAt || 0) / 60000);
  return `${title}|${breed}|${coat}|${hp}|${tsBucket}`;
}

export async function fetchCloudCardCutoutDataUrl(cardId) {
  const resp = await apiFetch(`card-image?cardId=${encodeURIComponent(cardId)}&kind=cutout`);
  if (!resp.ok) return null;
  const blob = await resp.blob();
  const dataUrl = await blobToDataUrl(blob);
  const valid = await canDecodeDataUrl(dataUrl);
  return valid ? dataUrl : null;
}

export async function pushCardToCloud(card, { includeCutout = true, overrideId = null } = {}) {
  const sess = getCloudSession();
  if (!sess) return null;

  let cutoutBase64 = null;
  if (includeCutout && card.cutoutSrc) {
    cutoutBase64 = await renderImageToResizedBase64(card.cutoutSrc, 900, 'image/png');
  }

  const cleanCard = { ...card };
  if (overrideId) cleanCard.id = overrideId;
  delete cleanCard.cutoutSrc;
  // 仅保留官方示例资源路径引用；用户卡牌必须上传真实 PNG 抠图，绝不用橘猫照片代替其它宠物
  if (typeof card.cutoutSrc === 'string' && card.cutoutSrc.startsWith('assets/') && String(card.id).startsWith('sample-')) {
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
 * 集合并集去重双向同步（iOS <-> 云端 <-> Web）：
 * 1. 先冲刷本地待删队列
 * 2. 收集本端与云端全部卡牌，分别按 ID 与特征签名（overlapKey）识别完全重叠卡，重叠卡不重复生成
 * 3. 本端缺失的云端卡（含真实 PNG 抠图）全量拉取合并；修复旧同步遗留的错图/空图
 * 4. 云端缺失的本端卡（或云端缺少 PNG 的卡）全量上传补齐
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
  const localByOverlap = new Map();
  for (const c of localCards) {
    const ok = normalizeOverlapKey(c);
    if (!localByOverlap.has(ok)) localByOverlap.set(ok, c);
  }
  const cloudById = new Map(cloudCards.map((c) => [c.id, c]));
  const cloudByOverlap = new Map();
  for (const rc of cloudCards) {
    const ok = normalizeOverlapKey(rc);
    if (!cloudByOverlap.has(ok)) cloudByOverlap.set(ok, rc);
  }

  let downloaded = 0;
  let uploaded = 0;
  let skipped = 0;
  const touchedLocalIds = new Set();

  // 1) Pull missing, newer, or cutout-corrupted/missing cloud cards into local store
  for (const rc of cloudCards) {
    const lc = localById.get(rc.id) || localByOverlap.get(normalizeOverlapKey(rc));
    const cloudTime = Number(rc.updatedAt || rc.createdAt || 0);
    const localTime = Number(lc?.updatedAt || lc?.createdAt || 0);
    const isPoisonedOrange = Boolean(
      lc &&
      !String(lc.id).startsWith('sample-') &&
      lc.cutoutSrc === 'assets/cat-orange.png' &&
      !String(lc.breedName || '').includes('橘')
    );

    if (!lc || cloudTime > localTime + 500 || isPoisonedOrange || (rc.hasCutout && !lc?.cutoutSrc)) {
      let cutoutSrc = isPoisonedOrange ? '' : (lc?.cutoutSrc || '');
      if (!cutoutSrc && rc.assetPath && String(rc.id).startsWith('sample-')) {
        cutoutSrc = rc.assetPath;
      }
      if (rc.hasCutout) {
        const fetchedUrl = await fetchCloudCardCutoutDataUrl(rc.id).catch(() => null);
        if (fetchedUrl) cutoutSrc = fetchedUrl;
      }

      const mergedCard = {
        ...rc,
        id: lc?.id && lc.id === rc.id ? rc.id : (lc?.id || rc.id),
        cutoutSrc,
        cardBackStyle: rc.cardBackStyle || lc?.cardBackStyle || 'fullArtPet',
        cardBackOrientation: rc.cardBackOrientation || lc?.cardBackOrientation || 'auto',
        showBackQRCode: rc.showBackQRCode !== false,
        createdAt: Number(rc.createdAt || lc?.createdAt || Date.now()),
        updatedAt: Math.max(cloudTime, localTime)
      };
      await upsertLocalCard(mergedCard);
      localById.set(mergedCard.id, mergedCard);
      touchedLocalIds.add(mergedCard.id);
      downloaded += 1;
    } else if (lc) {
      touchedLocalIds.add(lc.id);
    }
  }

  // 2) Push missing local cards OR repair cloud cards that still lack real PNG cutout
  for (const lc of localCards) {
    const isBuiltInSample = String(lc.id).startsWith('sample-') && lc.locationName === '抓宠大作战 示范馆';
    const rc = cloudById.get(lc.id) || cloudByOverlap.get(normalizeOverlapKey(lc));
    const localTime = Number(lc.updatedAt || lc.createdAt || 0);
    const cloudTime = Number(rc?.updatedAt || rc?.createdAt || 0);
    const hasLocalRealImage = Boolean(lc.cutoutSrc && (!lc.cutoutSrc.startsWith('assets/') || String(lc.id).startsWith('sample-')));

    if (isBuiltInSample && rc) continue;
    if (!rc || localTime > cloudTime + 500 || (hasLocalRealImage && rc.hasCutout === false)) {
      if (isBuiltInSample && !rc) continue;
      await pushCardToCloud(lc, {
        includeCutout: hasLocalRealImage && (!rc?.hasCutout || localTime > cloudTime + 500),
        overrideId: rc?.id || null
      });
      uploaded += 1;
    } else if (rc && touchedLocalIds.has(lc.id)) {
      skipped += 1;
    }
  }

  const finalList = Array.from(localById.values()).sort(
    (a, b) => Number(b.createdAt || b.updatedAt || 0) - Number(a.createdAt || a.updatedAt || 0)
  );
  return { cards: finalList, downloaded, uploaded, skipped, user: data.user || sess.user };
}

