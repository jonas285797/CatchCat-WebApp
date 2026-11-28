import { SAMPLE_CARDS } from './presets.js?v=20261128a';

const DB_NAME = 'CatchCatStudioDB';
const DB_VERSION = 1;
const STORE_CARDS = 'cards';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CARDS)) {
        db.createObjectStore(STORE_CARDS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllCards() {
  try {
    const db = await openDB();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CARDS, 'readonly');
      const req = tx.objectStore(STORE_CARDS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    const seededV4 = localStorage.getItem('CatchCat_Web_SeededV4') === '1';
    if (rows.length > 0 && seededV4) {
      return rows.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    }
    // 升级 V4 时更新官方示范卡为 15 套炫彩背景 + 智能性格贴合（保留用户自建卡不受影响）
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CARDS, 'readwrite');
      const store = tx.objectStore(STORE_CARDS);
      const existingById = new Map(rows.map((r) => [r.id, r]));
      for (const s of SAMPLE_CARDS) {
        const prev = existingById.get(s.id);
        if (!prev || !prev.cardBackStyle || !prev.petMood || prev.locationName === '抓宠大作战 示范馆' || prev.locationName === 'CatchCat 示范馆') {
          store.put({ ...s });
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    localStorage.setItem('CatchCat_Web_SeededV1', '1');
    localStorage.setItem('CatchCat_Web_SeededV2', '1');
    localStorage.setItem('CatchCat_Web_SeededV3', '1');
    localStorage.setItem('CatchCat_Web_SeededV4', '1');
    const merged = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CARDS, 'readonly');
      const req = tx.objectStore(STORE_CARDS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return merged.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  } catch {
    return [...SAMPLE_CARDS];
  }
}

export async function upsertCard(card) {
  const clone = { ...card, createdAt: card.createdAt || Date.now() };
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CARDS, 'readwrite');
      tx.objectStore(STORE_CARDS).put(clone);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // 静默降级至内存态
  }
  return clone;
}

export async function removeCard(id) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CARDS, 'readwrite');
      tx.objectStore(STORE_CARDS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

const LS_XP_KEY = 'CatchCat_Web_TrainerXP';

export function getTrainerLevelInfo() {
  const xp = Math.max(0, Number(localStorage.getItem(LS_XP_KEY) || 0));
  const level = Math.floor(xp / 40) + 1;
  return { level, xp, nextLevelAt: level * 40 };
}

export function grantTrainerXP(delta) {
  const prev = getTrainerLevelInfo();
  const nextXp = prev.xp + Math.max(0, Number(delta || 0));
  localStorage.setItem(LS_XP_KEY, String(nextXp));
  return getTrainerLevelInfo();
}

