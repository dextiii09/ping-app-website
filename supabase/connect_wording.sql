-- Ping - Connect wording: the chat note says "Connected for ..." and the
-- notification says "<brand> connected with you for ...". Safe to re-run.
-- (Same function as in campaign_matching.sql.)

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
  values (ua, ub, left('Connected for "' || b.title || '"', 500), me)
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
  values (mid, me, left('Connected for "' || b.title || '" · ' || b.budget || ' fixed · ' || when_text, 2000), 'system');

  select coalesce(nullif(company, ''), name) into brand_name from profiles where id = me;
  insert into notifications (user_id, type, title, text)
  values (p_creator, 'match', 'You''re in!',
          left(coalesce(brand_name, 'A brand') || ' connected with you for "' || b.title || '". Your chat is open in the Deal Room.', 500));

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
