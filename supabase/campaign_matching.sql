-- Ping - Campaign Matching Flow (Influencers, Comedians, DJs, Bands & Artists)
--
-- Brand posts a campaign brief (fixed fee per talent, number of slots, talent
-- type, deadline / event date) -> talent applies (optional pitch note, no
-- negotiation) -> the brand looks through the applicants and taps Connect or
-- Pass -> Connect fills a slot and opens a chat straight away -> once every slot is
-- filled, the remaining applicants are auto-rejected and notified.
--
-- Run once in the Supabase SQL Editor, after schema.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Talent types on profiles
-- ---------------------------------------------------------------------------
-- The list is meant to grow: to add a type, add it to the two
-- *_talent_type_check constraints below and to assets/js/talentTypes.js.
alter table public.profiles add column if not exists talent_type text;
alter table public.profiles add column if not exists talent_details jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists portfolio jsonb not null default '[]'::jsonb;
update public.profiles set talent_type = 'INFLUENCER' where role = 'INFLUENCER' and talent_type is null;

alter table public.profiles drop constraint if exists profiles_talent_type_check;
alter table public.profiles add constraint profiles_talent_type_check
  check (talent_type is null or talent_type in ('INFLUENCER','COMEDIAN','DJ','BAND','ARTIST'));
alter table public.profiles drop constraint if exists profiles_portfolio_check;
alter table public.profiles add constraint profiles_portfolio_check
  check (jsonb_typeof(portfolio) = 'array' and jsonb_array_length(portfolio) <= 10);

-- Sign-up now also carries the talent type (creators only).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if m->>'role' in ('BUSINESS','INFLUENCER') then
    insert into public.profiles (id, name, role, location, tags, company, job_title, avatar, bio, talent_type)
    values (
      new.id,
      left(coalesce(nullif(m->>'name',''), split_part(new.email,'@',1)), 120),
      m->>'role',
      left(coalesce(m->>'location',''), 200),
      coalesce(array(select jsonb_array_elements_text(m->'tags')), '{}'),
      left(coalesce(m->>'company',''), 120),
      case when m->>'role' = 'INFLUENCER' then 'Creator & Talent' else 'Brand Executive' end,
      coalesce(m->>'avatar',''),
      '',
      case when m->>'role' = 'INFLUENCER' then
        case when m->>'talent_type' in ('INFLUENCER','COMEDIAN','DJ','BAND','ARTIST') then m->>'talent_type' else 'INFLUENCER' end
      end
    );
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Campaign briefs: deliverables, fixed fee, slots, talent type, dates
-- ---------------------------------------------------------------------------
-- `budget` stays the fixed fee per selected talent (text, e.g. '₹5,000').
-- ends_on is the delivery deadline / event date; starts_on is optional (for
-- multi-day campaigns). Together they are the window used for clash checks.
alter table public.live_briefs add column if not exists deliverables text not null default '';
alter table public.live_briefs add column if not exists slots integer not null default 1;
alter table public.live_briefs add column if not exists slots_filled integer not null default 0;
alter table public.live_briefs add column if not exists talent_type text not null default 'ANY';
alter table public.live_briefs add column if not exists starts_on date;
alter table public.live_briefs add column if not exists ends_on date;
update public.live_briefs set ends_on = deadline::date where ends_on is null;

alter table public.live_briefs drop constraint if exists live_briefs_deliverables_check;
alter table public.live_briefs add constraint live_briefs_deliverables_check check (char_length(deliverables) <= 300);
alter table public.live_briefs drop constraint if exists live_briefs_slots_check;
alter table public.live_briefs add constraint live_briefs_slots_check
  check (slots between 1 and 50 and slots_filled between 0 and slots);
alter table public.live_briefs drop constraint if exists live_briefs_talent_type_check;
alter table public.live_briefs add constraint live_briefs_talent_type_check
  check (talent_type in ('ANY','INFLUENCER','COMEDIAN','DJ','BAND','ARTIST'));
alter table public.live_briefs drop constraint if exists live_briefs_dates_check;
alter table public.live_briefs add constraint live_briefs_dates_check
  check (starts_on is null or ends_on is null or starts_on <= ends_on);
alter table public.live_briefs drop constraint if exists live_briefs_status_check;
alter table public.live_briefs add constraint live_briefs_status_check check (status in ('OPEN','FILLED','CLOSED'));

drop policy if exists briefs_insert on public.live_briefs;
create policy briefs_insert on public.live_briefs for insert to authenticated
  with check (brand_id = auth.uid() and applications_count = 0 and slots_filled = 0 and status = 'OPEN'
              and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'BUSINESS'));

-- Brands may edit their own campaign, but the counters and the FILLED status
-- belong to the review flow below (which sets ping.trusted for its writes).
-- A brand can still close a campaign by hand.
create or replace function public.protect_brief_columns()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('ping.trusted', true), '') <> 'on' then
    if new.applications_count is distinct from old.applications_count
       or new.slots_filled is distinct from old.slots_filled
       or new.brand_id is distinct from old.brand_id then
      raise exception 'Not allowed to change these campaign fields';
    end if;
    if new.status is distinct from old.status and new.status <> 'CLOSED' then
      raise exception 'A campaign can only be closed by hand';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists live_briefs_protect on public.live_briefs;
create trigger live_briefs_protect before update on public.live_briefs
  for each row execute function public.protect_brief_columns();

-- ---------------------------------------------------------------------------
-- 3. Applications: a status per applicant
-- ---------------------------------------------------------------------------
alter table public.brief_applications add column if not exists status text not null default 'PENDING';
alter table public.brief_applications add column if not exists decided_at timestamptz;
alter table public.brief_applications add column if not exists match_id uuid references public.matches(id) on delete set null;
alter table public.brief_applications drop constraint if exists brief_applications_status_check;
alter table public.brief_applications add constraint brief_applications_status_check
  check (status in ('PENDING','SELECTED','REJECTED','AUTO_REJECTED'));
create index if not exists brief_applications_creator_status on public.brief_applications (creator_id, status);

-- True when the signed-in talent is already booked (SELECTED) for another
-- campaign whose dates overlap this one. Only answers for yourself.
create or replace function public.has_date_clash(p_creator uuid, p_brief uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_creator = auth.uid() and exists (
    select 1
      from brief_applications oa
      join live_briefs ob on ob.id = oa.brief_id
      join live_briefs nb on nb.id = p_brief
     where oa.creator_id = p_creator and oa.status = 'SELECTED' and oa.brief_id <> p_brief
       and daterange(coalesce(ob.starts_on, ob.ends_on, ob.deadline::date), coalesce(ob.ends_on, ob.deadline::date), '[]')
        && daterange(coalesce(nb.starts_on, nb.ends_on, nb.deadline::date), coalesce(nb.ends_on, nb.deadline::date), '[]')
  );
$$;
revoke all on function public.has_date_clash(uuid, uuid) from public, anon;
grant execute on function public.has_date_clash(uuid, uuid) to authenticated;

-- Talent can apply to any number of OPEN briefs made for their talent type
-- (or open to all), until the deadline, as long as they aren't already
-- booked on those dates. The fee is fixed, so there is no
-- counter-offer: `rate` is no longer written. Decisions only happen through
-- decide_application(), so there is still no update policy.
drop policy if exists apps_insert on public.brief_applications;
create policy apps_insert on public.brief_applications for insert to authenticated
  with check (
    creator_id = auth.uid() and status = 'PENDING' and decided_at is null and match_id is null
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'INFLUENCER'
         and exists (
           select 1 from public.live_briefs b
            where b.id = brief_id and b.status = 'OPEN' and b.deadline >= now() and b.brand_id <> auth.uid()
              and (b.talent_type = 'ANY' or b.talent_type = coalesce(p.talent_type, 'INFLUENCER'))
         )
    )
    and not public.has_date_clash(auth.uid(), brief_id)
  );

create or replace function public.on_application_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare b record; creator_name text;
begin
  perform set_config('ping.trusted', 'on', true);
  update live_briefs set applications_count = applications_count + 1 where id = new.brief_id
  returning * into b;
  select name into creator_name from profiles where id = new.creator_id;
  insert into notifications (user_id, type, title, text)
  values (b.brand_id, 'system', 'New applicant',
          left(coalesce(creator_name,'Someone') || ' applied to "' || b.title || '"', 500));
  return new;
end $$;

-- Live updates for applicants (brand) and application status (talent).
-- RLS still decides which rows each subscriber receives.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'brief_applications') then
    alter publication supabase_realtime add table public.brief_applications;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Chat: a 'system' note opens every campaign chat
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type in ('text','proposal','attachment','contract','amendment','system'));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and type <> 'system' and public.is_match_member(match_id));

create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record; other uuid; sender_name text;
begin
  select * into m from matches where id = new.match_id;
  update matches set last_message = left(new.text, 500), last_sender = new.sender_id, last_active = now()
   where id = new.match_id;
  -- The "selected" note comes with its own notification (decide_application).
  if new.type = 'system' then return new; end if;
  other := case when m.user_a = new.sender_id then m.user_b else m.user_a end;
  select name into sender_name from profiles where id = new.sender_id;
  insert into notifications (user_id, type, title, text)
  values (other, 'message', left('New message from ' || coalesce(sender_name,'someone'), 120),
          left(case when new.type = 'proposal' then 'Sent you a Smart Proposal: ' || new.text else new.text end, 500));
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 5. The brand's Connect / Pass: decide_application()
-- ---------------------------------------------------------------------------
-- p_decision: 'SELECT' (Connect) or 'REJECT' (Pass).
-- Returns jsonb with status:
--   SELECTED  {match_id, slots, slots_filled, auto_rejected}
--   REJECTED
--   CONFLICT  {conflicts: [{title, starts_on, ends_on}]} - nothing changed:
--             they're already booked on overlapping dates, so they can't be
--             selected (p_confirm_conflict is ignored; kept for old clients)
--   FULL      the campaign has no open slots left
--   ALREADY_DECIDED {application_status}
-- The brief row is locked, so two quick Connects can't overfill it.
create or replace function public.decide_application(
  p_brief uuid, p_creator uuid, p_decision text, p_confirm_conflict boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b live_briefs%rowtype;
  app brief_applications%rowtype;
  win_start date;
  win_end date;
  conflicts jsonb;
  ua uuid; ub uuid; mid uuid;
  brand_name text;
  when_text text;
  n_auto integer := 0;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_decision not in ('SELECT','REJECT') then raise exception 'Bad decision'; end if;

  select * into b from live_briefs where id = p_brief for update;
  if not found then raise exception 'Campaign not found'; end if;
  if b.brand_id <> me then raise exception 'Not your campaign'; end if;

  select * into app from brief_applications where brief_id = p_brief and creator_id = p_creator for update;
  if not found then raise exception 'Application not found'; end if;
  if app.status <> 'PENDING' then
    return jsonb_build_object('status', 'ALREADY_DECIDED', 'application_status', app.status);
  end if;

  perform set_config('ping.trusted', 'on', true);

  if p_decision = 'REJECT' then
    update brief_applications set status = 'REJECTED', decided_at = now()
     where brief_id = p_brief and creator_id = p_creator;
    insert into notifications (user_id, type, title, text)
    values (p_creator, 'system', 'Application update',
            left('Your application for "' || b.title || '" wasn''t selected this time.', 500));
    return jsonb_build_object('status', 'REJECTED');
  end if;

  if b.status <> 'OPEN' or b.slots_filled >= b.slots then
    return jsonb_build_object('status', 'FULL');
  end if;

  -- Clash check against the talent's other accepted campaigns.
  win_end := coalesce(b.ends_on, b.deadline::date);
  win_start := coalesce(b.starts_on, win_end);
  select coalesce(jsonb_agg(jsonb_build_object(
           'title', ob.title,
           'starts_on', coalesce(ob.starts_on, ob.ends_on, ob.deadline::date),
           'ends_on', coalesce(ob.ends_on, ob.deadline::date))), '[]'::jsonb)
    into conflicts
    from brief_applications oa
    join live_briefs ob on ob.id = oa.brief_id
   where oa.creator_id = p_creator and oa.status = 'SELECTED' and oa.brief_id <> p_brief
     and daterange(coalesce(ob.starts_on, ob.ends_on, ob.deadline::date), coalesce(ob.ends_on, ob.deadline::date), '[]')
         && daterange(win_start, win_end, '[]');

  if jsonb_array_length(conflicts) > 0 then
    return jsonb_build_object('status', 'CONFLICT', 'conflicts', conflicts);
  end if;

  -- Open (or reuse) the brand <-> talent chat.
  ua := least(me, p_creator);
  ub := greatest(me, p_creator);
  insert into matches (user_a, user_b, last_message, last_sender)
  values (ua, ub, left('Selected for "' || b.title || '"', 500), me)
  on conflict (user_a, user_b) do nothing
  returning id into mid;
  if mid is null then select id into mid from matches where user_a = ua and user_b = ub; end if;

  update brief_applications set status = 'SELECTED', decided_at = now(), match_id = mid
   where brief_id = p_brief and creator_id = p_creator;

  update live_briefs
     set slots_filled = slots_filled + 1,
         status = case when slots_filled + 1 >= slots then 'FILLED' else status end
   where id = p_brief
  returning * into b;

  when_text := case when win_start = win_end then to_char(win_end, 'DD Mon YYYY')
                    else to_char(win_start, 'DD Mon') || ' - ' || to_char(win_end, 'DD Mon YYYY') end;
  insert into messages (match_id, sender_id, text, type)
  values (mid, me, left('Selected for "' || b.title || '" · ' || b.budget || ' fixed · ' || when_text, 2000), 'system');

  select coalesce(nullif(company, ''), name) into brand_name from profiles where id = me;
  insert into notifications (user_id, type, title, text)
  values (p_creator, 'match', 'You''re in!',
          left(coalesce(brand_name, 'A brand') || ' selected you for "' || b.title || '". Your chat is open in the Deal Room.', 500));

  -- They're booked for these dates now: close their other pending
  -- applications that overlap, so no brand can double-book them.
  with closed as (
    update brief_applications oa set status = 'AUTO_REJECTED', decided_at = now()
      from live_briefs ob
     where ob.id = oa.brief_id and oa.creator_id = p_creator and oa.status = 'PENDING' and oa.brief_id <> p_brief
       and daterange(coalesce(ob.starts_on, ob.ends_on, ob.deadline::date), coalesce(ob.ends_on, ob.deadline::date), '[]')
           && daterange(win_start, win_end, '[]')
    returning ob.title
  )
  insert into notifications (user_id, type, title, text)
  select p_creator, 'system', 'Application closed',
         left('Your application for "' || closed.title || '" was closed because you''re booked for "' || b.title || '" on the same dates.', 500)
    from closed;

  -- Last slot filled: everyone still waiting is told the campaign is filled.
  if b.status = 'FILLED' then
    with rejected as (
      update brief_applications set status = 'AUTO_REJECTED', decided_at = now()
       where brief_id = p_brief and status = 'PENDING'
      returning creator_id
    )
    insert into notifications (user_id, type, title, text)
    select creator_id, 'system', 'Campaign filled', left('This campaign has been filled: "' || b.title || '".', 500)
      from rejected;
    get diagnostics n_auto = row_count;
  end if;

  return jsonb_build_object('status', 'SELECTED', 'match_id', mid, 'slots', b.slots,
                            'slots_filled', b.slots_filled, 'auto_rejected', n_auto);
end $$;

revoke all on function public.decide_application(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.decide_application(uuid, uuid, text, boolean) to authenticated;
