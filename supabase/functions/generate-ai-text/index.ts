// Edge Function: generate-ai-text
// Proxies "Ping AI" prompts to the model provider so API keys never ship to
// the browser. Only signed-in members can use it: the caller's session is
// checked with Supabase Auth below (works with this project's ES256 signing
// keys), so deploy it with "Verify JWT" OFF.
//
// Providers, tried in order (any that has a key set):
//   1. OpenRouter  - secret OPENROUTER_API_KEY, optional OPENROUTER_MODEL
//   2. Gemini      - secret GEMINI_API_KEY, optional GEMINI_MODEL
// If none answers, the app falls back to its built-in text.
// (SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically.)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_PROMPT = 2000;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function askOpenRouter(prompt: string): Promise<string | null> {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) return null;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://pingapp.site',
      'X-Title': 'Ping',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENROUTER_MODEL') ?? 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // Some models (e.g. Qwen) put their reasoning in <think>...</think>; drop it.
  const text = String(data?.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  return text.trim() || null;
}

async function askGemini(prompt: string): Promise<string | null> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return null;
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  // Key in a header, not the URL, so it can't end up in request logs.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

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

  for (const ask of [askOpenRouter, askGemini]) {
    const text = await ask(prompt).catch(() => null);
    if (text) return json({ text });
  }
  return json({ error: 'no AI provider answered' }, 502);
});
