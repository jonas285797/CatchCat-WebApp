import {
  getCloudStore,
  jsonResponse,
  optionsResponse,
  CORS_HEADERS,
  authenticateRequest,
  sanitizeId
} from '../lib/cloud.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'GET') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  const store = getCloudStore();
  const user = await authenticateRequest(req, store);
  if (!user) {
    return jsonResponse({ error: '未登录或登录凭证已过期' }, 401);
  }

  const url = new URL(req.url);
  const safeId = sanitizeId(url.searchParams.get('cardId'));
  const kind = url.searchParams.get('kind') === 'orig' ? 'orig' : 'cutout';
  if (!safeId) return jsonResponse({ error: '缺少 cardId' }, 400);

  const key =
    kind === 'orig'
      ? `images/${user.userId}/${safeId}_orig.jpg`
      : `images/${user.userId}/${safeId}_cutout.png`;

  const entry = await store.getWithMetadata(key, { type: 'arrayBuffer', consistency: 'strong' });
  if (!entry || !entry.data) {
    return jsonResponse({ error: 'Not Found' }, 404);
  }

  return new Response(entry.data, {
    status: 200,
    headers: {
      'Content-Type': kind === 'orig' ? 'image/jpeg' : 'image/png',
      'Cache-Control': 'private, max-age=86400',
      ...CORS_HEADERS
    }
  });
};
