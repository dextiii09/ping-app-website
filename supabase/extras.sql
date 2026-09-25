-- Ping - profile photos, Ping-team announcements, Smart Proposal replies.
--
-- Run once in the Supabase SQL Editor, AFTER campaign_matching.sql (the
-- proposal replies post a 'system' chat note, which that file allows).
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Profile photos (Supabase Storage)
-- ---------------------------------------------------------------------------
-- A public bucket, so photos load anywhere by URL. Members can only write
-- inside their own folder: avatars/<their user id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read_own on storage.objects;
create policy avatars_read_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 2. Announcements from the Ping team (admin)
-- ---------------------------------------------------------------------------
-- Everyone can read them; only admin_broadcast() writes them, and it drops a
-- copy in every active member's notifications (and so their email, if the
-- email notifications from email_notifications.sql are set up).
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 120),
  body       text not null check (char_length(body) between 1 and 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to authenticated using (true);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('match', 'message', 'system', 'tip', 'announcement'));

create or replace function public.admin_broadcast(p_title text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  aid uuid;
  sent integer;
  t text := left(trim(coalesce(p_title, '')), 120);
  b text := left(trim(coalesce(p_body, '')), 500);
begin
  if not public.is_admin() then raise exception 'Only the Ping team can send announcements'; end if;
  if t = '' or b = '' then raise exception 'A title and a message are both needed'; end if;
  insert into announcements (title, body, created_by) values (t, b, auth.uid()) returning id into aid;
  insert into notifications (user_id, type, title, text)
  select id, 'announcement', t, b from profiles where status = 'ACTIVE' and id <> auth.uid();
  get diagnostics sent = row_count;
  return jsonb_build_object('id', aid, 'recipients', sent);
end $$;
revoke all on function public.admin_broadcast(text, text) from public, anon;
grant execute on function public.admin_broadcast(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Smart Proposal replies: the person it was sent to accepts or declines
-- ---------------------------------------------------------------------------
-- A written record of what both sides agreed; payment is still arranged
-- between them, outside Ping. Posts a note in the chat (so both sides see the
-- new status live) and notifies the sender.
create or replace function public.respond_to_proposal(p_proposal uuid, p_response text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pr proposals%rowtype;
  me uuid := auth.uid();
  my_name text;
  accepted boolean := p_response = 'ACCEPTED';
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_response not in ('ACCEPTED', 'DECLINED') then raise exception 'Bad response'; end if;

  select * into pr from proposals where id = p_proposal for update;
  if not found then raise exception 'Proposal not found'; end if;
  if pr.receiver_id <> me then raise exception 'Only the person it was sent to can reply'; end if;
  if pr.status <> 'PENDING' then return jsonb_build_object('status', pr.status, 'changed', false); end if;

  update proposals set status = p_response where id = p_proposal;
  select nullif(trim(name), '') into my_name from profiles where id = me;
  my_name := coalesce(my_name, 'Your match');

  insert into messages (match_id, sender_id, text, type)
  values (pr.match_id, me,
          left(my_name || case when accepted then ' accepted the Smart Proposal: ' else ' declined the Smart Proposal: ' end || pr.title, 2000),
          'system');

  insert into notifications (user_id, type, title, text)
  values (pr.sender_id, 'message',
          case when accepted then 'Proposal accepted' else 'Proposal declined' end,
          left(coalesce(my_name, 'Your match') || case when accepted then ' accepted "' else ' declined "' end || pr.title || '"', 500));

  return jsonb_build_object('status', p_response, 'changed', true);
end $$;
revoke all on function public.respond_to_proposal(uuid, text) from public, anon;
grant execute on function public.respond_to_proposal(uuid, text) to authenticated;
