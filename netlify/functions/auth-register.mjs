import crypto from 'node:crypto';
import {
  getCloudStore,
  jsonResponse,
  optionsResponse,
  normalizeAccount,
  accountKeyHash,
  hashPassword,
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
    const displayName = String(body?.displayName || '').trim().slice(0, 24) || account.split('@')[0].slice(0, 16) || '萌宠守护官';

    if (account.length < 3 || account.length > 64) {
      return jsonResponse({ error: '账号长度需在 3～64 位之间（支持手机号、邮箱或自定义用户名）' }, 400);
    }
    if (password.length < 6 || password.length > 72) {
      return jsonResponse({ error: '密码长度需至少 6 位' }, 400);
    }

    const store = getCloudStore();
    const accHash = accountKeyHash(account);
    const accKey = `users/by-account/${accHash}.json`;
    const userId = `u_${crypto.randomUUID().replace(/-/g, '')}`;
    const { salt, hash } = hashPassword(password);
    const now = Date.now();

    const accountRecord = { userId, account, salt, passwordHash: hash, createdAt: now };
    const { modified } = await store.setJSON(accKey, accountRecord, { onlyIfNew: true });
    if (!modified) {
      return jsonResponse({ error: '该账号已被注册，请直接登录或更换账号名' }, 409);
    }

    const userProfile = {
      userId,
      account,
      displayName,
      trainerXP: 0,
      createdAt: now,
      updatedAt: now
    };
    await store.setJSON(`users/by-id/${userId}.json`, userProfile);

    const token = await issueToken(store, userProfile);
    return jsonResponse({ token, user: publicUserView(userProfile) }, 201);
  } catch (err) {
    return jsonResponse({ error: '注册服务暂时异常: ' + String(err?.message || err) }, 500);
  }
};

