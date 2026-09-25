// Ping Web Platform - Campaign Briefs (Supabase `live_briefs`, `brief_applications`)
import { supabase, watchTable } from './supabaseClient.js';
import { briefFromRow, briefToRow, applicationFromRow } from './mappers.js';

export async function fetchLiveBriefs() {
  const { data, error } = await supabase.from('live_briefs').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(briefFromRow);
}

// Live: fires now and whenever a brief is created/edited or its pitch count
// changes. Returns an unsubscribe function.
export function subscribeToLiveBriefs(callback) {
  const refetch = () => fetchLiveBriefs().then(callback)
    .catch(err => console.error('subscribeToLiveBriefs error:', err));
  refetch();
  return watchTable('live_briefs', refetch);
}

export async function createLiveBrief(brief) {
  const { data, error } = await supabase.from('live_briefs').insert(briefToRow(brief)).select().single();
  if (error) throw error;
  return briefFromRow(data);
}

// An application is a real row; a trigger bumps applications_count and
// notifies the brand. The fee is fixed by the brand, so there's no rate.
export async function applyToBriefRemote(briefId, creatorId, pitch) {
  const { error } = await supabase.from('brief_applications')
    .insert({ brief_id: briefId, creator_id: creatorId, pitch: (pitch || '').slice(0, 1000) });
  if (error) throw error;
}

// Every application this account may see - RLS scopes it: talent get their
// own (with the brief embedded), brands get the ones on their campaigns
// (with the applicant's profile embedded).
export async function fetchVisibleApplications() {
  const { data, error } = await supabase.from('brief_applications')
    .select('*, profiles(*), live_briefs(*)').order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(applicationFromRow);
}

// Live: fires now and on every new application or decision.
export function subscribeToApplications(callback) {
  const refetch = () => fetchVisibleApplications().then(callback)
    .catch(err => console.error('subscribeToApplications error:', err));
  refetch();
  return watchTable('brief_applications', refetch);
}

// The brand's swipe (see decide_application() in campaign_matching.sql).
export async function decideApplicationRemote(briefId, creatorId, decision, confirmConflict = false) {
  const { data, error } = await supabase.rpc('decide_application', {
    p_brief: briefId, p_creator: creatorId, p_decision: decision, p_confirm_conflict: confirmConflict
  });
  if (error) throw error;
  return data;
}

export async function deleteLiveBrief(briefId) {
  const { error } = await supabase.from('live_briefs').delete().eq('id', briefId);
  if (error) throw error;
}
