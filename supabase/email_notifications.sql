-- Email notifications: every new row in public.notifications calls the
-- send-notification-email Edge Function (this is exactly what the dashboard's
-- Integrations -> Database Webhooks screen generates).
--
-- BEFORE running: replace CHANGE_ME_SECRET with a long random string, and use
-- the same value for `supabase secrets set WEBHOOK_SECRET=...`.
-- Run AFTER the function is deployed (see the function's header comment).
--
-- Do ONE of the two, never both: this file, or the same hook made in the
-- dashboard (Database -> Webhooks: table notifications, Insert, Supabase Edge
-- Function send-notification-email, header x-webhook-secret, timeout 5000).
-- Each one sends its own email, so having both sends every email twice.

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
