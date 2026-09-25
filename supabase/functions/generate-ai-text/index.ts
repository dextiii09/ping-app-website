// Edge Function: generate-ai-text
// Proxies "Ping AI" prompts to the model provider so the API key never ships
// to the browser. Supabase verifies the caller's JWT before this runs (the
// default), so only signed-in users can call it.
//
// Deploy:  supabase functions deploy generate-ai-text
// Secret:  supabase secrets set GEMINI_API_KEY=<your key>
// Optional: supabase secrets set GEMINI_MODEL=<model id>  (default below;
//           Google retires old models, e.g. gemini-1.5-flash no longer works)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_PROMPT = 2000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const { prompt } = await req.json().catch(() => ({}));
  if (typeof prompt !== 'string' || prompt.length === 0 || prompt.length > MAX_PROMPT) {
    return new Response(JSON.stringify({ error: `prompt (1-${MAX_PROMPT} chars) required` }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const key = Deno.env.get('GEMINI_API_KEY') ?? '';
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  // Key in a header, not the URL, so it can't end up in request logs.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: `provider ${res.status}` }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  return new Response(JSON.stringify({ text }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
