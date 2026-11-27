import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

export const STORE_NAME = 'catchpet-cloud-v1';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export function getCloudStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS
    }
  });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function normalizeAccount(raw) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
}

export function accountKeyHash(normalizedAccount) {
  return crypto.createHash('sha256').update(normalizedAccount).digest('hex');
}

export function sanitizeId(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 72);
}

export async function getAuthSecret(store) {
  const envSecret =
    (typeof Netlify !== 'undefined' && Netlify.env?.get('CATCHPET_AUTH_SECRET')) ||
    process.env.CATCHPET_AUTH_SECRET;
  if (envSecret && envSecret.length >= 16) return envSecret;

  const existing = await store.get('_sys/hmac_secret', { type: 'text', consistency: 'strong' });
  if (existing && existing.length >= 32) return existing;

  const generated = crypto.randomBytes(32).toString('hex');
  await store.set('_sys/hmac_secret', generated, { onlyIfNew: true });
  return (await store.get('_sys/hmac_secret', { type: 'text', consistency: 'strong' })) || generated;
}

export function hashPassword(password, existingSalt = null) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash: derived };
}

export function verifyPassword(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function toBase64Url(bufOrStr) {
  return Buffer.from(bufOrStr)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(str) {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  return Buffer.from(padded, 'base64');
}

export async function issueToken(store, user) {
  const secret = await getAuthSecret(store);
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.userId,
      acc: user.account,
      iat: nowSec,
      exp: nowSec + 90 * 24 * 3600
    })
  );
  const sig = toBase64Url(crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

export async function authenticateRequest(req, store) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const secret = await getAuthSecret(store);
  const expectedSig = crypto.createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
  let actualSig;
  try {
    actualSig = fromBase64Url(sigB64);
  } catch {
    return null;
  }
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadB64).toString('utf8'));
    if (!payload?.sub || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    const profile = await store.get(`users/by-id/${payload.sub}.json`, { type: 'json', consistency: 'strong' });
    if (!profile) return null;
    return profile;
  } catch {
    return null;
  }
}

export function publicUserView(profile) {
  return {
    userId: profile.userId,
    account: profile.account,
    displayName: profile.displayName,
    trainerXP: Number(profile.trainerXP || 0),
    trainerLevel: Math.floor(Number(profile.trainerXP || 0) / 40) + 1,
    createdAt: profile.createdAt
  };
}

