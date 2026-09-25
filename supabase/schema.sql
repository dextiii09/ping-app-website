-- Ping - Supabase schema (replaces the Firebase Auth + Firestore backend)
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Design notes (what changed vs Firestore):
--  * One `profiles` table replaces users/{uid} + public_profiles/{uid}. Email is
--    NOT stored here (it lives in auth.users), so the whole table can be
--    readable by signed-in users without leaking it.
--  * record_swipe() creates the match atomically server-side, replacing the
--    swipes/received_swipes handshake the client had to orchestrate itself.
--  * Notifications are written by database triggers, not by the other user's
--    browser - so they can't be spoofed and need no client write permission.
--  * Brief pitches are real rows (brief_applications), not just a counter.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 120),
  role                text not null check (role in ('BUSINESS','INFLUENCER','ADMIN')),
  avatar              text not null default '',
  bio                 text not null default '' check (char_length(bio) <= 1000),
  location            text not null default '',
  tags                text[] not null default '{}',
  company             text not null default '',
  job_title           text not null default '',
  industry            text not null default '',
  company_size        text not null default '',
  website             text not null default '',
  socials             jsonb not null default '{}'::jsonb,
  social_stats        jsonb not null default '{}'::jsonb,
  stats               jsonb not null default '{}'::jsonb,
  settings            jsonb not null default '{}'::jsonb,
  status              text not null default 'ACTIVE' check (status in ('ACTIVE','BANNED','SHADOW_BANNED')),
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','PENDING','VERIFIED','REJECTED')),
  verified            boolean not null default false,
  report_count        integer not null default 0,
  doc_url             text not null default '',
  joined_at           timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN');
$$;

-- Users may edit their own profile but never their own role/status/verified/
-- report_count, and may only move verification UNVERIFIED/REJECTED -> PENDING
-- (asking for review). Direct SQL / service_role (auth.uid() is null) is
-- unrestricted so an admin can be bootstrapped from the dashboard.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.verified is distinct from old.verified
       or new.report_count is distinct from old.report_count then
      raise exception 'Not allowed to change protected profile fields';
    end if;
    if new.verification_status is distinct from old.verification_status
       and not (new.verification_status = 'PENDING' and old.verification_status in ('UNVERIFIED','REJECTED')) then
      raise exception 'Not allowed to change verification status';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Auto-create the profile from signup metadata (works even when email
-- confirmation is on and there is no session yet). Social sign-ins carry no
-- role, so they skip this and go through the onboarding insert instead.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if m->>'role' in ('BUSINESS','INFLUENCER') then
    insert into public.profiles (id, name, role, location, tags, company, job_title, avatar, bio)
    values (
      new.id,
      left(coalesce(nullif(m->>'name',''), split_part(new.email,'@',1)), 120),
      m->>'role',
      left(coalesce(m->>'location',''), 200),
      coalesce(array(select jsonb_array_elements_text(m->'tags')), '{}'),
      left(coalesce(m->>'company',''), 120),
      case when m->>'role' = 'INFLUENCER' then 'Creator & Talent' else 'Brand Executive' end,
      coalesce(m->>'avatar',''),
      ''
    );
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = auth.uid() and role in ('BUSINESS','INFLUENCER')
              and status = 'ACTIVE' and verification_status = 'UNVERIFIED'
              and verified = false and report_count = 0);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- swipes + matches
-- ---------------------------------------------------------------------------
create table public.swipes (
  swiper_id  uuid not null references public.profiles(id) on delete cascade,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  direction  text not null check (direction in ('LEFT','RIGHT','UP')),
  created_at timestamptz not null default now(),
  primary key (swiper_id, target_id),
  check (swiper_id <> target_id)
);
alter table public.swipes enable row level security;
create policy swipes_own on public.swipes for select to authenticated using (swiper_id = auth.uid() or public.is_admin());
-- no direct insert/update: goes through record_swipe() so matching is atomic

create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references public.profiles(id) on delete cascade,
  user_b       uuid not null references public.profiles(id) on delete cascade,
  last_message text not null default '',
  last_sender  uuid references public.profiles(id) on delete set null,
  last_active  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
alter table public.matches enable row level security;
create policy matches_member_read on public.matches for select to authenticated
  using (auth.uid() in (user_a, user_b) or public.is_admin());
-- writes only via record_swipe() and the messages trigger below

create or replace function public.is_match_member(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matches where id = mid and auth.uid() in (user_a, user_b));
$$;

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('match','message','system','tip')),
  title      text not null check (char_length(title) between 1 and 120),
  text       text not null check (char_length(text) between 1 and 500),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_created on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
-- no insert policy: only the security-definer functions/triggers below create them

-- Atomic swipe. Returns the match id when this swipe completes a mutual match.
create or replace function public.record_swipe(p_target uuid, p_direction text)
returns table (matched boolean, match_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a uuid; b uuid; mid uuid; my_name text; other_dir text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_target = me then raise exception 'Cannot swipe yourself'; end if;
  if p_direction not in ('LEFT','RIGHT','UP') then raise exception 'Bad direction'; end if;

  insert into swipes (swiper_id, target_id, direction) values (me, p_target, p_direction)
  on conflict (swiper_id, target_id) do update set direction = excluded.direction, created_at = now();

  if p_direction = 'LEFT' then return query select false, null::uuid; return; end if;

  select direction into other_dir from swipes where swiper_id = p_target and target_id = me;
  if other_dir in ('RIGHT','UP') then
    a := least(me, p_target); b := greatest(me, p_target);
    insert into matches (user_a, user_b, last_message, last_sender)
    values (a, b, case when p_direction = 'UP' then 'Super-Pinged you!' else 'Connected on Ping' end, me)
    on conflict (user_a, user_b) do nothing
    returning id into mid;
    if mid is null then select id into mid from matches where user_a = a and user_b = b; end if;

    select name into my_name from profiles where id = me;
    insert into notifications (user_id, type, title, text)
    values (p_target, 'match', 'New Match!',
            case when p_direction = 'UP' then coalesce(my_name,'Someone') || ' sent you a Super-Ping'
                 else 'You matched with ' || coalesce(my_name,'someone') || '!' end);
    return query select true, mid;
  end if;
  return query select false, null::uuid;
end $$;
grant execute on function public.record_swipe(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- messages + proposals
-- ---------------------------------------------------------------------------
create table public.proposals (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references public.matches(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  receiver_id      uuid not null references public.profiles(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 120),
  price            text not null,
  deadline         text not null,
  description      text not null check (char_length(description) <= 1000),
  status           text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DECLINED')),
  sender_signature text not null default '',
  created_at       timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
alter table public.proposals enable row level security;
create policy proposals_read on public.proposals for select to authenticated
  using (auth.uid() in (sender_id, receiver_id) or public.is_admin());
create policy proposals_insert on public.proposals for insert to authenticated
  with check (sender_id = auth.uid() and status = 'PENDING' and public.is_match_member(match_id)
              and exists (select 1 from public.matches m where m.id = match_id
                          and receiver_id in (m.user_a, m.user_b) and receiver_id <> auth.uid()));
create policy proposals_admin_update on public.proposals for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  text        text not null check (char_length(text) <= 2000),
  type        text not null default 'text' check (type in ('text','proposal','attachment','contract','amendment')),
  proposal_id uuid references public.proposals(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index messages_match_created on public.messages (match_id, created_at);
alter table public.messages enable row level security;
create policy messages_read on public.messages for select to authenticated
  using (public.is_match_member(match_id) or public.is_admin());
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_match_member(match_id));

-- On every message: bump the match preview and notify the other participant.
create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record; other uuid; sender_name text;
begin
  select * into m from matches where id = new.match_id;
  update matches set last_message = left(new.text, 500), last_sender = new.sender_id, last_active = now()
   where id = new.match_id;
  other := case when m.user_a = new.sender_id then m.user_b else m.user_a end;
  select name into sender_name from profiles where id = new.sender_id;
  insert into notifications (user_id, type, title, text)
  values (other, 'message', left('New message from ' || coalesce(sender_name,'someone'), 120),
          left(case when new.type = 'proposal' then 'Sent you a Smart Proposal: ' || new.text else new.text end, 500));
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- ---------------------------------------------------------------------------
-- campaign briefs + pitches
-- ---------------------------------------------------------------------------
create table public.live_briefs (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references public.profiles(id) on delete cascade,
  brand_name         text not null default '',
  brand_avatar       text not null default '',
  title              text not null check (char_length(title) between 1 and 140),
  description        text not null default '' check (char_length(description) <= 1000),
  budget             text not null default '',
  location           text not null default '',
  deadline           timestamptz not null,
  tags               text[] not null default '{}',
  requirements       text[] not null default '{}',
  required_videos    integer not null default 1,
  required_stories   integer not null default 2,
  applications_count integer not null default 0,
  status             text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  created_at         timestamptz not null default now()
);
alter table public.live_briefs enable row level security;
create policy briefs_read on public.live_briefs for select to authenticated using (true);
create policy briefs_insert on public.live_briefs for insert to authenticated
  with check (brand_id = auth.uid() and applications_count = 0
              and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'BUSINESS'));
create policy briefs_update on public.live_briefs for update to authenticated
  using (brand_id = auth.uid() or public.is_admin()) with check (brand_id = auth.uid() or public.is_admin());
create policy briefs_delete on public.live_briefs for delete to authenticated
  using (brand_id = auth.uid() or public.is_admin());

create table public.brief_applications (
  brief_id   uuid not null references public.live_briefs(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  pitch      text not null default '' check (char_length(pitch) <= 1000),
  rate       text not null default '',
  created_at timestamptz not null default now(),
  primary key (brief_id, creator_id)
);
alter table public.brief_applications enable row level security;
create policy apps_read on public.brief_applications for select to authenticated
  using (creator_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.live_briefs b where b.id = brief_id and b.brand_id = auth.uid()));
create policy apps_insert on public.brief_applications for insert to authenticated
  with check (creator_id = auth.uid()
              and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'INFLUENCER'));

create or replace function public.on_application_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare b record; creator_name text;
begin
  update live_briefs set applications_count = applications_count + 1 where id = new.brief_id
  returning * into b;
  select name into creator_name from profiles where id = new.creator_id;
  insert into notifications (user_id, type, title, text)
  values (b.brand_id, 'system', 'New pitch on your brief',
          left(coalesce(creator_name,'A creator') || ' pitched on "' || b.title || '"', 500));
  return new;
end $$;
create trigger applications_after_insert after insert on public.brief_applications
  for each row execute function public.on_application_insert();

-- ---------------------------------------------------------------------------
-- blocking
-- ---------------------------------------------------------------------------
create table public.blocked_users (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  match_id   uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);
alter table public.blocked_users enable row level security;
create policy blocked_own on public.blocked_users for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- realtime (replaces Firestore onSnapshot)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.matches,
  public.notifications, public.profiles, public.live_briefs;

-- ---------------------------------------------------------------------------
-- bootstrap an admin (run manually after that person has signed up):
--   update public.profiles set role = 'ADMIN' where id = '<their auth.users id>';
-- ---------------------------------------------------------------------------
