import {
  getCloudStore,
  jsonResponse,
  optionsResponse,
  authenticateRequest,
  publicUserView
} from '../lib/cloud.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const store = getCloudStore();
  const profile = await authenticateRequest(req, store);
  if (!profile) {
    return jsonResponse({ error: '未登录或登录凭证已过期' }, 401);
  }

  if (req.method === 'GET') {
    return jsonResponse({ user: publicUserView(profile) });
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    try {
      const body = await req.json();
      if (typeof body?.displayName === 'string') {
        const clean = body.displayName.trim().slice(0, 24);
        if (clean) profile.displayName = clean;
      }
      if (typeof body?.trainerXP === 'number' && Number.isFinite(body.trainerXP)) {
        profile.trainerXP = Math.max(Number(profile.trainerXP || 0), Math.floor(body.trainerXP));
      }
      profile.updatedAt = Date.now();
      await store.setJSON(`users/by-id/${profile.userId}.json`, profile);
      return jsonResponse({ user: publicUserView(profile) });
    } catch (err) {
      return jsonResponse({ error: String(err?.message || err) }, 400);
    }
  }

  return jsonResponse({ error: 'Method Not Allowed' }, 405);
};

