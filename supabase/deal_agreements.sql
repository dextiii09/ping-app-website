-- Apply after schema.sql and extras.sql. Existing acceptances have no
-- authoritative acceptance timestamp, so this records future replies only.
create table if not exists public.deal_agreements (
  proposal_id uuid primary key references public.proposals(id) on delete cascade,
  sender_id uuid not null,
  receiver_id uuid not null,
  accepted_at timestamptz not null default now(),
  terms jsonb not null
);

alter table public.deal_agreements enable row level security;
revoke all on public.deal_agreements from anon, authenticated;
grant select on public.deal_agreements to authenticated;
drop policy if exists agreement_participants_read on public.deal_agreements;
create policy agreement_participants_read on public.deal_agreements
  for select to authenticated using (auth.uid() in (sender_id, receiver_id));

create or replace function public.record_deal_agreement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.deal_agreements (proposal_id, sender_id, receiver_id, terms)
  values (old.id, old.sender_id, old.receiver_id, jsonb_build_object(
    'title', old.title, 'price', old.price, 'deadline', old.deadline,
    'description', old.description, 'offered_at', old.created_at
  )) on conflict (proposal_id) do nothing;
  return new;
end;
$$;
revoke all on function public.record_deal_agreement() from public, anon, authenticated;

drop trigger if exists record_deal_agreement on public.proposals;
create trigger record_deal_agreement after update of status on public.proposals
for each row when (old.status = 'PENDING' and new.status = 'ACCEPTED'
  and new.receiver_id = auth.uid())
execute function public.record_deal_agreement();
