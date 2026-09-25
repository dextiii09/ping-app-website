// Ping Web Platform - Deal Room chat & Smart Proposals (Supabase)
//   matches - created when a brand selects someone for a campaign
//             (decide_application() in campaign_matching.sql).
//   matches / messages / proposals - RLS limits each to its participants.
//   A trigger on messages bumps the match preview and notifies the recipient.
//
// Proposals are a written record: the person a proposal was sent to can
// accept or decline it (respond_to_proposal() in extras.sql). There is no
// signing, escrow or payment.
import { supabase, watchTable } from './supabaseClient.js';
import { matchFromRow, messageFromRow, proposalFromRow } from './mappers.js';

export async function fetchMatchesForUser(uid) {
  const { data, error } = await supabase.from('matches').select('*')
    .or(`user_a.eq.${uid},user_b.eq.${uid}`).order('last_active', { ascending: false });
  if (error) throw error;
  return data.map(matchFromRow);
}

// Live: fires now and on any match change (new match, new last message).
export function subscribeToMatches(uid, callback) {
  const refetch = () => fetchMatchesForUser(uid).then(callback)
    .catch(err => console.error('subscribeToMatches error:', err));
  refetch();
  return watchTable('matches', refetch);
}

export async function fetchMessagesForMatch(matchId) {
  const { data, error } = await supabase.from('messages').select('*')
    .eq('match_id', matchId).order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(messageFromRow);
}

// Live version - also resolves proposal references so the rendered card always
// reflects the latest data. Returns an unsubscribe function.
export function subscribeToMessages(matchId, callback) {
  const refetch = async () => {
    try {
      const raw = await fetchMessagesForMatch(matchId);
      const resolved = await Promise.all(raw.map(async (msg) => {
        if (msg.type === 'proposal' && msg.proposalId) {
          const proposal = await fetchProposal(msg.proposalId);
          if (proposal) return { ...msg, proposalData: proposal };
        }
        return msg;
      }));
      callback(resolved);
    } catch (err) {
      console.error('subscribeToMessages error:', err);
    }
  };
  refetch();
  return watchTable('messages', refetch, `match_id=eq.${matchId}`);
}

export async function sendMessageRemote(matchId, senderId, text, type = 'text', proposalId = null) {
  const row = { match_id: matchId, sender_id: senderId, text, type };
  if (proposalId) row.proposal_id = proposalId;
  const { data, error } = await supabase.from('messages').insert(row).select().single();
  if (error) throw error;
  return messageFromRow(data);
}

// A proposal is its title, price, deadline and description.
export async function createProposalRemote(matchId, senderId, receiverId, proposal) {
  const { data, error } = await supabase.from('proposals').insert({
    match_id: matchId,
    sender_id: senderId,
    receiver_id: receiverId,
    title: proposal.title,
    price: proposal.price,
    deadline: proposal.deadline,
    description: proposal.description,
    sender_signature: proposal.senderSignature || ''
  }).select('id').single();
  if (error) throw error;
  return { id: data.id };
}

// Accept or decline a proposal sent to you. Resolves { status, changed }.
export async function respondToProposalRemote(proposalId, response) {
  const { data, error } = await supabase.rpc('respond_to_proposal', { p_proposal: proposalId, p_response: response });
  if (error) throw error;
  return data;
}

export async function fetchProposal(proposalId) {
  const { data, error } = await supabase.from('proposals').select('*').eq('id', proposalId).maybeSingle();
  if (error) throw error;
  return data ? proposalFromRow(data) : null;
}
