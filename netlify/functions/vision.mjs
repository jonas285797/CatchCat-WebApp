/**
 * CatchCat Web Same-Origin Vision Proxy (Netlify Function v2)
 * Solves browser CORS and routes through Netlify's edge network to VisionProxy / Gemini.
 */

const UPSTREAM_VISION_URL = 'https://catchcat-vision-proxy.visionproxy.workers.dev';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405, headers: CORS_HEADERS });
  }

  try {
    const rawBody = await request.text();
    const targetUrl = (typeof Netlify !== 'undefined' && Netlify.env?.get('VISION_PROXY_URL')) || UPSTREAM_VISION_URL;

    const upstreamResp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CatchCat-Netlify-Relay/1.0'
      },
      body: rawBody,
      signal: AbortSignal.timeout(12000)
    });

    const text = await upstreamResp.text();
    return new Response(text, {
      status: upstreamResp.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...CORS_HEADERS
      }
    });
  } catch (err) {
    return Response.json(
      { error: String(err?.message || err) },
      { status: 502, headers: CORS_HEADERS }
    );
  }
};
