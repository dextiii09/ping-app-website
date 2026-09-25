// Ping Web Platform - Supabase client (replaces firebaseClient.js).
// The anon key is designed to be public - it only grants what the Row Level
// Security policies in supabase/schema.sql allow a signed-in user to do.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm';

const SUPABASE_URL = 'https://iemhqbzlticeypaeecjd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllbWhxYnpsdGljZXlwYWVlY2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NzQwMDcsImV4cCI6MjEwNTM1MDAwN30.ipcYQ5euzxg1VD_hA5Z-cGP30jPj4Mt4p0lVZS7hdDo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Re-fetch-on-change realtime helper: subscribes to postgres changes on a
// table and calls `refetch` whenever anything matching changes. Simple and
// robust (RLS still decides what each user can read); returns an unsubscribe.
let channelCounter = 0;
export function watchTable(table, refetch, filter) {
  const name = `${table}-${++channelCounter}`;
  const opts = { event: '*', schema: 'public', table };
  if (filter) opts.filter = filter;
  const channel = supabase.channel(name).on('postgres_changes', opts, () => refetch()).subscribe();
  return () => { supabase.removeChannel(channel); };
}
