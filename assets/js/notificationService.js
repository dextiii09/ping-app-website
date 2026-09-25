// Ping Web Platform - Real Notifications (Supabase `notifications`)
// Rows are created by database triggers (new match, new message, new pitch) -
// never by another user's browser - and each user can only read/update/delete
// their own (RLS). See supabase/schema.sql.
import { supabase, watchTable } from './supabaseClient.js';
import { notificationFromRow } from './mappers.js';

const NOTIF_LIMIT = 20;

export function subscribeToNotifications(userId, callback) {
  const refetch = async () => {
    const { data, error } = await supabase.from('notifications').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(NOTIF_LIMIT);
    if (error) return console.error('subscribeToNotifications error:', error);
    callback(data.map(notificationFromRow));
  };
  refetch();
  return watchTable('notifications', refetch, `user_id=eq.${userId}`);
}

export async function markAllNotificationsRead(userId, notifications) {
  const ids = notifications.filter(n => !n.read).map(n => n.id);
  if (ids.length === 0) return;
  const { error } = await supabase.from('notifications').update({ read: true }).in('id', ids);
  if (error) throw error;
}
