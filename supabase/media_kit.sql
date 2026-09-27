-- Ping - media kit extras (run after campaign_matching.sql and
-- no_double_booking.sql; safe to re-run):
--   1. a public link creators can switch on: pingapp.site/@handle;
--   2. days a creator marks as unavailable;
--   3. free/busy for the creators who applied to your campaigns.

-- ─── 1 + 2. New profile columns ────────────────────────────────────────────
-- handle: 3-30 lowercase letters, numbers, dots or underscores, not starting
-- or ending with a dot/underscore, unique, and not a reserved word.
-- blocked_dates: [{"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}], at most 30.
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists public_kit boolean not null default false;
alter table public.profiles add column if not exists blocked_dates jsonb not null default '[]'::jsonb;

alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles add constraint profiles_handle_format check (
  handle is null or (
    handle ~ '^[a-z0-9._]{3,30}$'
    and handle !~ '^[._]' and handle !~ '[._]$'
    and handle not in ('admin', 'administrator', 'ping', 'pingapp', 'support', 'help', 'team', 'official',
                       'login', 'signup', 'join', 'about', 'privacy', 'terms', 'api', 'www', 'mail',
                       'root', 'null', 'undefined')
  )
);
create unique index if not exists profiles_handle_key on public.profiles (handle) where handle is not null;

-- A public media kit needs a link name.
alter table public.profiles drop constraint if exists profiles_public_kit_handle;
alter table public.profiles add constraint profiles_public_kit_handle check (not public_kit or handle is not null);

create or replace function public.valid_blocked_dates(v jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  e jsonb;
begin
  if v is null or jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 30 then
    return false;
  end if;
  for e in select value from jsonb_array_elements(v) loop
    if jsonb_typeof(e) <> 'object' or length(e::text) > 64
       or coalesce(e->>'from', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or coalesce(e->>'to', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or (e->>'from')::date > (e->>'to')::date then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false; -- not a real date, e.g. 2026-02-31
end;
$$;

alter table public.profiles drop constraint if exists profiles_blocked_dates_check;
alter table public.profiles add constraint profiles_blocked_dates_check check (public.valid_blocked_dates(blocked_dates));

-- ─── The public media kit ──────────────────────────────────────────────────
-- Only when the creator switched it on, and only part of their profile:
-- never email, settings, rates, verification documents or chats. Busy days
-- are dates only (never which campaign), for the next ~3 months.
create or replace function public.public_media_kit(p_handle text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'handle', p.handle,
    'name', p.name,
    'company', p.company,
    'avatar', p.avatar,
    'location', p.location,
    'bio', p.bio,
    'tags', to_jsonb(p.tags),
    'verified', p.verified,
    'talentType', coalesce(p.talent_type, 'INFLUENCER'),
    'talentDetails', p.talent_details,
    'socials', jsonb_build_object('instagram', p.socials->'instagram', 'youtube', p.socials->'youtube'),
    'socialStats', p.social_stats,
    'portfolio', p.portfolio,
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('start', w.s, 'end', w.e) order by w.s)
        from (
          select coalesce(b.starts_on, b.ends_on, b.deadline::date) as s, coalesce(b.ends_on, b.deadline::date) as e
            from brief_applications a
            join live_briefs b on b.id = a.brief_id
           where a.creator_id = p.id and a.status = 'SELECTED'
          union all
          select (d->>'from')::date, (d->>'to')::date
            from jsonb_array_elements(p.blocked_dates) d
        ) w
       where w.e >= current_date and w.s <= current_date + 100
    ), '[]'::jsonb)
  )
    from profiles p
   where p.handle = lower(trim(p_handle))
     and p.public_kit and p.role = 'INFLUENCER' and p.status = 'ACTIVE';
$$;
revoke all on function public.public_media_kit(text) from public;
grant execute on function public.public_media_kit(text) to anon, authenticated;

-- ─── Free/busy for applicants ──────────────────────────────────────────────
-- Dates only: campaigns a creator is booked for and days they marked
-- unavailable. A brand gets it for people who applied to its campaigns, a
-- creator for themselves, the admin for anyone.
create or replace function public.talent_busy_windows(p_creators uuid[])
returns table (creator_id uuid, starts_on date, ends_on date, kind text)
language sql stable security definer set search_path = public as $$
  with allowed as (
    select c.id
      from unnest(p_creators[1:100]) as c(id)
     where c.id = auth.uid()
        or public.is_admin()
        or exists (
          select 1
            from brief_applications a
            join live_briefs b on b.id = a.brief_id
           where a.creator_id = c.id and b.brand_id = auth.uid()
        )
  )
  select a.creator_id, coalesce(b.starts_on, b.ends_on, b.deadline::date), coalesce(b.ends_on, b.deadline::date), 'booked'
    from brief_applications a
    join live_briefs b on b.id = a.brief_id
   where a.creator_id in (select id from allowed) and a.status = 'SELECTED'
     and coalesce(b.ends_on, b.deadline::date) >= current_date
  union all
  select p.id, (d->>'from')::date, (d->>'to')::date, 'blocked'
    from profiles p
    cross join lateral jsonb_array_elements(p.blocked_dates) d
   where p.id in (select id from allowed)
     and (d->>'to')::date >= current_date;
$$;
revoke all on function public.talent_busy_windows(uuid[]) from public, anon;
grant execute on function public.talent_busy_windows(uuid[]) to authenticated;
