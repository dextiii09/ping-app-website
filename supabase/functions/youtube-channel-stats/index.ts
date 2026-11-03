// Deploy with --no-verify-jwt. Validate the session against Auth below.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { headers, status });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) return json({ error: 'Sign in required' }, 401);
    const user = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: { authorization, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
    });
    if (!user.ok) return json({ error: 'Sign in required' }, 401);

    const body = await request.json().catch(() => null);
    const channel = typeof body?.channel === 'string' ? body.channel.trim() : '';
    const match = channel.match(/^(?:(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel\/)?|@)?(@?[\p{L}\p{N}._-]{1,100})\/?$/u);
    if (!match) return json({ error: 'Enter a YouTube handle or channel URL' }, 400);

    const key = Deno.env.get('YOUTUBE_API_KEY');
    if (!key) return json({ error: 'YouTube sync is unavailable' }, 503);
    const identifier = match[1];
    const parameter = /^UC[A-Za-z0-9_-]{22}$/.test(identifier) ? 'id' : 'forHandle';
    const query = new URLSearchParams({ part: 'statistics', [parameter]: identifier, key });
    const result = await fetch(`https://www.googleapis.com/youtube/v3/channels?${query}`);
    if (!result.ok) return json({ error: 'YouTube lookup failed' }, 502);
    const data = await result.json();
    const stats = data.items?.[0]?.statistics;
    if (!stats) return json({ error: 'Channel not found' }, 404);
    return json({
      subscribers: stats.hiddenSubscriberCount ? null : stats.subscriberCount ?? null,
      views: stats.viewCount ?? null,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return json({ error: 'YouTube lookup failed' }, 502);
  }
});
