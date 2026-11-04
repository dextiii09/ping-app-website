-- Tokens are available only to the Edge Function's service role.
create table if not exists public.instagram_media_kit_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  access_token text not null
);
alter table public.instagram_media_kit_connections enable row level security;
revoke all on public.instagram_media_kit_connections from public, anon, authenticated;
grant select, insert, update on public.instagram_media_kit_connections to service_role;

-- Only the Edge Function can write the result of an Instagram authorization.
create or replace function public.save_instagram_media_kit(
  p_user uuid, p_username text, p_followers bigint, p_token text
) returns boolean language sql set search_path = '' as $$
  with updated as (
    update public.profiles
    set socials = socials || jsonb_build_object('instagram', p_username),
        social_stats = social_stats || jsonb_build_object(
          'instagramFollowers', p_followers::text,
          'updatedAt', floor(extract(epoch from now()) * 1000)::bigint
        )
    where id = p_user and role = 'INFLUENCER' and status <> 'BANNED'
    returning id
  ), connection as (
    insert into public.instagram_media_kit_connections (user_id, access_token)
    select id, p_token from updated where p_token is not null
    on conflict (user_id) do update set access_token = excluded.access_token
  )
  select exists(select 1 from updated);
$$;
revoke all on function public.save_instagram_media_kit(uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.save_instagram_media_kit(uuid, text, bigint, text)
  to service_role;
