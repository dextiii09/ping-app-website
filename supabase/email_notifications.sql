-- Email notifications: every new row in public.notifications calls the
-- send-notification-email Edge Function (this is exactly what the dashboard's
-- Integrations -> Database Webhooks screen generates).
--
-- BEFORE running: replace CHANGE_ME_SECRET with a long random string, and use
-- the same value for `supabase secrets set WEBHOOK_SECRET=...`.
-- Run AFTER the function is deployed (see the function's header comment).

drop trigger if exists notifications_send_email on public.notifications;
create trigger notifications_send_email
  after insert on public.notifications
  for each row execute function supabase_functions.http_request(
    'https://iemhqbzlticeypaeecjd.supabase.co/functions/v1/send-notification-email',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"CHANGE_ME_SECRET"}',
    '{}',
    '5000'
  );
