// Edge Function: generate-ai-text
// Proxies "Ping AI" prompts to the model provider so the API key never ships
// to the browser. Only signed-in members can use it: the caller's session is
// checked with Supabase Auth below. That works with both the legacy JWT
// secret and the newer signing keys this project uses, so deploy it with
// "Verify JWT" OFF (the dashboard's legacy check would reject new tokens).
//
// Deploy:  supabase functions deploy generate-ai-text --no-verify-jwt
//          (or the dashboard editor, with Verify JWT turned off)
// Secret:  supabase secrets set GEMINI_API_KEY=<your key>
// Optional: supabase secrets set GEMINI_MODEL=<model id>  (default below;
//           Google retires old models, e.g. gemini-1.5-flash no longer works)
// (SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically.)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_PROMPT = 2000;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Signed-in members only: Supabase Auth confirms the session token.
  const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: req.headers.get('Authorization') ?? '', apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' },
  }).catch(() => null);
  if (!who || !who.ok) return json({ error: 'sign in required' }, 401);

  const { prompt } = await req.json().catch(() => ({}));
  if (typeof prompt !== 'string' || prompt.length === 0 || prompt.length > MAX_PROMPT) {
    return json({ error: `prompt (1-${MAX_PROMPT} chars) required` }, 400);
  }

  const key = Deno.env.get('GEMINI_API_KEY') ?? '';
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  // Key in a header, not the URL, so it can't end up in request logs.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });

  if (!res.ok) return json({ error: `provider ${res.status}` }, 502);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  return json({ text });
});
