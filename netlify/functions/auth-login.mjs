import {
  getCloudStore,
  jsonResponse,
  optionsResponse,
  normalizeAccount,
  accountKeyHash,
  verifyPassword,
  issueToken,
  publicUserView
} from '../lib/cloud.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  try {
    const body = await req.json();
    const account = normalizeAccount(body?.account);
    const password = String(body?.password || '');

    if (!account || !password) {
      return jsonResponse({ error: '请输入账号和密码' }, 400);
    }

    const store = getCloudStore();
    const accKey = `users/by-account/${accountKeyHash(account)}.json`;
    const accRecord = await store.get(accKey, { type: 'json', consistency: 'strong' });

    if (!accRecord || !verifyPassword(password, accRecord.salt, accRecord.passwordHash)) {
      return jsonResponse({ error: '账号不存在或密码不正确' }, 401);
    }

    let profile = await store.get(`users/by-id/${accRecord.userId}.json`, { type: 'json', consistency: 'strong' });
    if (!profile) {
      profile = {
        userId: accRecord.userId,
        account: accRecord.account,
        displayName: accRecord.account.split('@')[0].slice(0, 16) || '萌宠守护官',
        trainerXP: 0,
        createdAt: accRecord.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      await store.setJSON(`users/by-id/${accRecord.userId}.json`, profile);
    }

    const token = await issueToken(store, profile);
    return jsonResponse({ token, user: publicUserView(profile) }, 200);
  } catch (err) {
    return jsonResponse({ error: '登录验证异常: ' + String(err?.message || err) }, 500);
  }
};

