// Edge Function: send-notification-email
// Called by a database webhook every time a row is inserted into
// public.notifications (see supabase/email_notifications.sql). Emails the
// recipient unless they turned email notifications off in Settings.
//
// Deploy (webhooks carry no user JWT, so JWT verification is off and the
// shared secret below is what authenticates the call):
//   supabase functions deploy send-notification-email --no-verify-jwt
// Secrets:
//   supabase secrets set WEBHOOK_SECRET=<same value as in the SQL trigger>
//   supabase secrets set RESEND_API_KEY=<from resend.com>
//   supabase secrets set EMAIL_FROM="Ping <notifications@yourdomain.com>"
//   supabase secrets set SITE_URL=https://yourdomain.com
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }

  const { record } = await req.json().catch(() => ({}));
  if (!record?.user_id) return new Response('no record', { status: 400 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: profile } = await admin.from('profiles').select('name, settings').eq('id', record.user_id).maybeSingle();
  if (profile?.settings?.emailNotifications === false) return new Response('opted out');

  const { data: userData } = await admin.auth.admin.getUserById(record.user_id);
  const to = userData?.user?.email;
  if (!to) return new Response('no email');

  const site = Deno.env.get('SITE_URL') ?? '';
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#0a0a0a;color:#fff;border-radius:16px">
      <div style="font-size:20px;font-weight:800;color:#e6ff1a;margin-bottom:16px">⚡ Ping</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:8px">${esc(record.title)}</div>
      <div style="font-size:14px;color:#c9c9c9;line-height:1.5;margin-bottom:20px">${esc(record.text)}</div>
      ${site ? `<a href="${esc(site)}" style="display:inline-block;background:#e6ff1a;color:#000;font-weight:700;padding:10px 20px;border-radius:999px;text-decoration:none">Open Ping</a>` : ''}
      <div style="font-size:11px;color:#777;margin-top:24px">You can turn these emails off in Ping → Settings.</div>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM'), to, subject: record.title, html }),
  });
  return new Response(res.ok ? 'sent' : `resend error ${res.status}`, { status: res.ok ? 200 : 502 });
});
