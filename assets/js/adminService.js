// Ping Web Platform - admin actions on member profiles (Supabase `profiles`).
// The profiles update policy and the protect_profile_columns trigger in
// schema.sql only allow these fields to change when the signed-in user is an
// ADMIN. An update the policy filters out succeeds with zero rows instead of
// erroring, so the updated row is selected back to confirm it really changed.
import { supabase } from './supabaseClient.js';

async function updateMember(uid, row) {
  const { data, error } = await supabase.from('profiles').update(row).eq('id', uid).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Member not updated: not signed in as an admin, or the member no longer exists.');
}

export function setVerification(uid, approve) {
  return updateMember(uid, { verified: approve, verification_status: approve ? 'VERIFIED' : 'REJECTED' });
}

export function setMemberStatus(uid, status) {
  return updateMember(uid, { status });
}
