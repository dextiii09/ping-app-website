// Ping Web Platform - Campaign Briefs (Supabase `live_briefs`, `brief_applications`)
import { supabase, watchTable } from './supabaseClient.js';
import { briefFromRow, briefToRow } from './mappers.js';

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

// A pitch is a real row now (the business can see who pitched); a trigger
// bumps applications_count and notifies the brand.
export async function applyToBriefRemote(briefId, creatorId, pitch, rate) {
  const { error } = await supabase.from('brief_applications')
    .insert({ brief_id: briefId, creator_id: creatorId, pitch: pitch || '', rate: rate || '' });
  if (error) throw error;
}

// This creator's own pitches, so "already pitched" survives a new device.
export async function fetchMyPitches(creatorId) {
  const { data, error } = await supabase.from('brief_applications')
    .select('brief_id, pitch, rate, created_at').eq('creator_id', creatorId);
  if (error) throw error;
  return data.map(r => ({ briefId: r.brief_id, pitch: r.pitch, rate: r.rate, timestamp: new Date(r.created_at).getTime() }));
}

export async function deleteLiveBrief(briefId) {
  const { error } = await supabase.from('live_briefs').delete().eq('id', briefId);
  if (error) throw error;
}
