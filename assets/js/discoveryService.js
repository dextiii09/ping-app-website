// Ping Web Platform - Discovery & Blocking (Supabase `profiles`, `blocked_users`)
// profiles is readable by every signed-in user (email lives in auth.users, not
// here), so the old separate public_profiles mirror + syncPublicProfile step no
// longer exists.
import { supabase, watchTable } from './supabaseClient.js';
import { profileFromRow } from './mappers.js';

export async function fetchDiscoverableProfiles(excludeUid) {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return data.map(r => profileFromRow(r)).filter(p => p.id !== excludeUid);
}

// Live: fires with the full current list now and on every profile change
// (new signup, edit, verification status change) - also what makes the admin
// verification queue update live. Returns an unsubscribe function.
export function subscribeToDiscoverableProfiles(excludeUid, callback) {
  const refetch = () => fetchDiscoverableProfiles(excludeUid).then(callback)
    .catch(err => console.error('subscribeToDiscoverableProfiles error:', err));
  refetch();
  return watchTable('profiles', refetch);
}

export async function blockUser(myUid, blockedUserId, matchId = null) {
  const { error } = await supabase.from('blocked_users')
    .upsert({ user_id: myUid, blocked_id: blockedUserId, match_id: matchId });
  if (error) throw error;
}

export async function unblockUser(myUid, blockedUserId) {
  const { error } = await supabase.from('blocked_users').delete()
    .eq('user_id', myUid).eq('blocked_id', blockedUserId);
  if (error) throw error;
}

export async function fetchBlockedUsers(myUid) {
  const { data, error } = await supabase.from('blocked_users').select('*').eq('user_id', myUid);
  if (error) throw error;
  return data.map(r => ({ id: r.blocked_id, matchId: r.match_id, blockedAt: new Date(r.created_at).getTime() }));
}
