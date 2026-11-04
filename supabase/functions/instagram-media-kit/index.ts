// Deploy with --no-verify-jwt. Validate every request with Supabase Auth.
const callback = 'https://pingapp.site/instagram-callback';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { headers, status });
const encoder = new TextEncoder();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) return json({ error: 'Sign in required' }, 401);
    const base = Deno.env.get('SUPABASE_URL');
    const auth = await fetch(`${base}/auth/v1/user`, {
      headers: { authorization, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
    });
    if (!auth.ok) return json({ error: 'Sign in required' }, 401);
    const { id } = await auth.json();
    const appId = Deno.env.get('INSTAGRAM_APP_ID');
    const secret = Deno.env.get('INSTAGRAM_APP_SECRET');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!appId || !secret || !serviceKey) return json({ error: 'Instagram connection unavailable' }, 503);

    const body = await request.json().catch(() => null);
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

    if (body?.action === 'start') {
      const payload = `${Date.now() + 10 * 60_000}.${crypto.randomUUID()}`;
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`instagram:${id}:${payload}`));
      const state = `${payload}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
      const url = new URL('https://www.instagram.com/oauth/authorize');
      url.search = new URLSearchParams({
        client_id: appId, redirect_uri: callback, response_type: 'code',
        scope: 'instagram_business_basic', state,
      }).toString();
      return json({ url: url.href, state });
    }

    const serviceHeaders = { authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
    let accessToken: string;
    let tokenToSave: string | null = null;
    if (body?.action === 'refresh') {
      const query = new URLSearchParams({ user_id: `eq.${id}`, select: 'access_token' });
      const connection = await fetch(`${base}/rest/v1/instagram_media_kit_connections?${query}`, {
        headers: serviceHeaders,
      });
      if (!connection.ok) return json({ error: 'Could not load Instagram connection' }, 502);
      const [saved] = await connection.json();
      if (!saved?.access_token) return json({ reconnect: true });
      accessToken = saved.access_token;
    } else {
    if (body?.action !== 'finish' || typeof body.code !== 'string' || !body.code ||
        body.code.length > 2048 || typeof body.state !== 'string') {
      return json({ error: 'Invalid authorization response' }, 400);
    }
    const parts = /^(\d{13})\.([a-f0-9-]{36})\.([A-Za-z0-9+/]{43}=)$/.exec(body.state);
    if (!parts || Number(parts[1]) < Date.now() || !await crypto.subtle.verify(
      'HMAC', key, Uint8Array.from(atob(parts[3]), c => c.charCodeAt(0)),
      encoder.encode(`instagram:${id}:${parts[1]}.${parts[2]}`),
    )) return json({ error: 'Instagram authorization expired or invalid' }, 400);

    const exchange = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: appId, client_secret: secret, grant_type: 'authorization_code',
        redirect_uri: callback, code: body.code,
      }),
    });
    if (!exchange.ok) return json({ error: 'Instagram authorization failed' }, 502);
    const token = await exchange.json();
    const shortToken = token.access_token ?? token.data?.[0]?.access_token;
    if (typeof shortToken !== 'string' || !shortToken) {
      return json({ error: 'Instagram authorization failed' }, 502);
    }
    const query = new URLSearchParams({
      grant_type: 'ig_exchange_token', client_secret: secret, access_token: shortToken,
    });
    const longToken = await fetch(`https://graph.instagram.com/access_token?${query}`);
    if (!longToken.ok) return json({ error: 'Could not keep Instagram connected' }, 502);
    const credentials = await longToken.json();
    if (!credentials.access_token) return json({ error: 'Could not keep Instagram connected' }, 502);
    accessToken = credentials.access_token;
    tokenToSave = accessToken;
    }
    const result = await fetch('https://graph.instagram.com/v25.0/me?fields=username,followers_count', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!result.ok) {
      const failure = await result.json().catch(() => null);
      if (body.action === 'refresh' && failure?.error?.code === 190) return json({ reconnect: true });
      return json({ error: 'Could not read Instagram profile' }, 502);
    }
    const profile = await result.json();
    if (!/^[A-Za-z0-9._]{1,30}$/.test(profile.username ?? '') ||
        !Number.isSafeInteger(profile.followers_count) || profile.followers_count < 0) {
      return json({ error: 'Instagram did not return a valid profile' }, 502);
    }

    const save = await fetch(`${base}/rest/v1/rpc/save_instagram_media_kit`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user: id, p_username: profile.username, p_followers: profile.followers_count, p_token: tokenToSave,
      }),
    });
    if (!save.ok || await save.json() !== true) return json({ error: 'Could not save your Media Kit' }, 502);
    return json({ connected: true, username: profile.username, followers: profile.followers_count, updatedAt: Date.now() });
  } catch {
    return json({ error: 'Could not connect Instagram' }, 502);
  }
});
