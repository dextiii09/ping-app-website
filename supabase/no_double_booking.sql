-- Ping - no double-booking (run after campaign_matching.sql; safe to re-run).
-- Same code as the matching parts of campaign_matching.sql.

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
