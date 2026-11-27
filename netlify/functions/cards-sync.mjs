import {
  getCloudStore,
  jsonResponse,
  optionsResponse,
  authenticateRequest,
  sanitizeId,
  publicUserView
} from '../lib/cloud.mjs';

function stripDataUrlPrefix(b64) {
  const s = String(b64 || '').trim();
  const idx = s.indexOf('base64,');
  return idx >= 0 ? s.slice(idx + 7) : s;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const store = getCloudStore();
  const user = await authenticateRequest(req, store);
  if (!user) {
    return jsonResponse({ error: '未登录或登录凭证已过期' }, 401);
  }

  const cardsPrefix = `cards/${user.userId}/`;

  if (req.method === 'GET') {
    try {
      const { blobs } = await store.list({ prefix: cardsPrefix });
      const rows = await Promise.all(
        blobs.map(async (b) => {
          const item = await store.get(b.key, { type: 'json', consistency: 'strong' });
          return item;
        })
      );
      const valid = rows
        .filter((r) => r && r.id && !r.deleted)
        .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));

      return jsonResponse({
        user: publicUserView(user),
        cards: valid
      });
    } catch (err) {
      return jsonResponse({ error: '读取云端卡册失败: ' + String(err?.message || err) }, 500);
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const cardInput = body?.card;
      if (!cardInput || typeof cardInput !== 'object') {
        return jsonResponse({ error: '缺少卡牌对象' }, 400);
      }

      const safeId = sanitizeId(cardInput.id);
      if (!safeId) {
        return jsonResponse({ error: '无效的卡牌 ID' }, 400);
      }

      const cutoutB64 = stripDataUrlPrefix(body?.cutoutBase64);
      const origB64 = stripDataUrlPrefix(body?.originalBase64);

      if (cutoutB64) {
        const buf = Buffer.from(cutoutB64, 'base64');
        if (buf.length > 4_200_000) {
          return jsonResponse({ error: '抠图文件过大（上限 4MB）' }, 413);
        }
        await store.set(`images/${user.userId}/${safeId}_cutout.png`, buf, {
          metadata: { contentType: 'image/png', updatedAt: Date.now() }
        });
      }

      if (origB64) {
        const buf = Buffer.from(origB64, 'base64');
        if (buf.length > 4_200_000) {
          return jsonResponse({ error: '原图文件过大（上限 4MB）' }, 413);
        }
        await store.set(`images/${user.userId}/${safeId}_orig.jpg`, buf, {
          metadata: { contentType: 'image/jpeg', updatedAt: Date.now() }
        });
      }

      const existing = await store.get(`${cardsPrefix}${safeId}.json`, { type: 'json', consistency: 'strong' });
      const now = Date.now();

      // 切勿把前端本地 data URL / 绝对文件路径存进云端 JSON
      const cleanCard = { ...cardInput, id: safeId };
      if (typeof cleanCard.cutoutSrc === 'string' && cleanCard.cutoutSrc.startsWith('data:')) {
        delete cleanCard.cutoutSrc;
      }
      delete cleanCard.localImageData;
      delete cleanCard.cutoutImageData;

      const record = {
        ...cleanCard,
        ownerId: user.userId,
        hasCutout: Boolean(cutoutB64 || existing?.hasCutout || cleanCard.cutoutSrc),
        hasOriginal: Boolean(origB64 || existing?.hasOriginal),
        createdAt: Number(cleanCard.createdAt || existing?.createdAt || now),
        updatedAt: Math.max(Number(cleanCard.updatedAt || 0), now)
      };

      await store.setJSON(`${cardsPrefix}${safeId}.json`, record);
      return jsonResponse({ card: record }, 200);
    } catch (err) {
      return jsonResponse({ error: '上传卡牌至云端失败: ' + String(err?.message || err) }, 500);
    }
  }

  if (req.method === 'DELETE') {
    try {
      const url = new URL(req.url);
      let safeId = sanitizeId(url.searchParams.get('id'));
      if (!safeId) {
        try {
          const body = await req.json();
          safeId = sanitizeId(body?.id);
        } catch {}
      }
      if (!safeId) return jsonResponse({ error: '缺少卡牌 ID' }, 400);

      await Promise.all([
        store.delete(`${cardsPrefix}${safeId}.json`),
        store.delete(`images/${user.userId}/${safeId}_cutout.png`),
        store.delete(`images/${user.userId}/${safeId}_orig.jpg`)
      ]);

      return jsonResponse({ deleted: safeId }, 200);
    } catch (err) {
      return jsonResponse({ error: '删除云端卡牌失败: ' + String(err?.message || err) }, 500);
    }
  }

  return jsonResponse({ error: 'Method Not Allowed' }, 405);
};

