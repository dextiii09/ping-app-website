// Ping Web Platform - Authentication & Profile Service (Supabase Auth)
// Email/password + Google/Facebook OAuth. The profile row in `profiles` is
// created by a database trigger from the signup metadata (see
// supabase/schema.sql handle_new_user), so it also works when email
// confirmation is on and there is no session immediately after signUp.
// User objects handed to callers keep the Firebase-style shape
// ({ uid, email, displayName, photoURL }) the bootstrap/onboarding code uses.
import { supabase } from './supabaseClient.js';
import { profileFromRow, profileFieldsToRow } from './mappers.js';

// A password-reset link signs the user in with a temporary session; the app
// must ask for a new password before letting them in. The URL carries
// type=recovery (read now, before supabase-js strips it) and supabase-js also
// emits PASSWORD_RECOVERY - either one flags it.
let recoveryPending = /type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search);
supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') recoveryPending = true; });
export const isPasswordRecovery = () => recoveryPending;
export const clearPasswordRecovery = () => { recoveryPending = false; };


function toAppUser(u) {
  const m = u.user_metadata || {};
  return {
    uid: u.id,
    email: u.email,
    displayName: m.name || m.full_name || '',
    photoURL: m.avatar_url || m.picture || null
  };
}

// Normalizes Supabase auth errors to the auth/* codes the UI already maps.
function wrapAuthError(error) {
  const msg = (error.message || '').toLowerCase();
  const c = error.code || '';
  let code = 'auth/unknown';
  if (c === 'user_already_exists' || msg.includes('already registered')) code = 'auth/email-already-in-use';
  else if (c === 'invalid_credentials' || msg.includes('invalid login')) code = 'auth/invalid-credential';
  else if (c === 'email_not_confirmed' || msg.includes('email not confirmed')) code = 'auth/email-not-confirmed';
  else if (c === 'weak_password' || msg.includes('password should be')) code = 'auth/weak-password';
  else if (error.status === 429 || msg.includes('rate limit')) code = 'auth/too-many-requests';
  else if (msg.includes('email') && msg.includes('invalid')) code = 'auth/invalid-email';
  else if (c === 'same_password' || msg.includes('different from the old')) code = 'auth/same-password';
  const e = new Error(error.message);
  e.code = code;
  return e;
}

// Fires once per actual user change (INITIAL_SESSION, SIGNED_IN and token
// refreshes all arrive for the same user - only the first matters to callers).
// Deferred with setTimeout: supabase-js deadlocks if you await another
// supabase call directly inside this callback.
export function onAuthChange(callback) {
  let last;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const uid = session?.user?.id ?? null;
    if (uid === last) return;
    last = uid;
    setTimeout(() => callback(session?.user ? toAppUser(session.user) : null), 0);
  });
  return () => data.subscription.unsubscribe();
}

export async function getUserProfile(uid) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: sess } = await supabase.auth.getSession();
  const email = sess.session?.user?.id === uid ? sess.session.user.email : undefined;
  return profileFromRow(data, email);
}

// role must be 'INFLUENCER' or 'BUSINESS' - the DB trigger/policies reject ADMIN.
export async function signUp({ email, password, name, role, company, location, tags, talentType }) {
  const cleanTags = (tags || []).map(t => t.trim()).filter(Boolean);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        name, role, company: company || '', location: location || 'India',
        tags: cleanTags.length ? cleanTags : ['New Member'],
        avatar: '', // no photo yet: shown as initials (see domUtils.initialsAvatar)
        ...(role === 'INFLUENCER' ? { talent_type: talentType || 'INFLUENCER' } : {}),
        bio: `${name} just joined Ping${cleanTags.length ? ` — specialized in ${cleanTags.join(', ')}` : ''}.`
      }
    }
  });
  if (error) throw wrapAuthError(error);
  // With confirmation on, Supabase answers a sign-up for an already-registered
  // email with a placeholder user that has no identities (and sends nothing).
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    const e = new Error('An account with this email already exists.');
    e.code = 'auth/email-already-in-use';
    throw e;
  }
  // Email confirmation is on: account exists but there is no session yet.
  if (!data.session) {
    const e = new Error('Confirm your email to finish signing up.');
    e.code = 'auth/confirm-email';
    throw e;
  }
  return null;
}

export async function updateUserProfile(uid, fields) {
  // Select the row back: an update that RLS filters out (e.g. the session
  // expired) "succeeds" with zero rows instead of returning an error.
  const { data, error } = await supabase.from('profiles').update(profileFieldsToRow(fields)).eq('id', uid).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Profile not saved: your session may have expired. Please log in again.');
}

// Profile photo: stored in the public `avatars` bucket, inside the member's
// own folder (see supabase/extras.sql). Returns the public URL.
export async function uploadAvatar(uid, blob) {
  const path = `${uid}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

// Best-effort clean-up of a replaced photo (only ever inside the member's own
// folder of the avatars bucket).
export async function removeAvatarFile(uid, url) {
  const marker = '/storage/v1/object/public/avatars/';
  const i = String(url || '').indexOf(marker);
  if (i === -1) return;
  const path = decodeURIComponent(url.slice(i + marker.length));
  if (!path.startsWith(`${uid}/`)) return;
  await supabase.storage.from('avatars').remove([path]);
}

export async function logIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw wrapAuthError(error);
}

// OAuth is a full-page redirect (no popup): the browser leaves, comes back
// signed in, and the bootstrap listener routes to onboarding if there is no
// profile row yet (Google/Facebook never carry a role/location/niche).
async function oauth(provider) {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
  if (error) throw wrapAuthError(error);
}
export const signInWithGoogle = () => oauth('google');
export const signInWithFacebook = () => oauth('facebook');

// Completes a first-time Google/Facebook sign-in once role/location/niche are picked.
export async function createSocialProfile({ uid, name, avatar, role, company, location, tags, talentType }) {
  const cleanTags = (tags || []).map(t => t.trim()).filter(Boolean);
  const { data, error } = await supabase.from('profiles').insert({
    id: uid,
    name,
    role,
    avatar: avatar || '',
    bio: `${name} just joined Ping${cleanTags.length ? ` — specialized in ${cleanTags.join(', ')}` : ''}.`,
    location: location || 'India',
    company: company || '',
    tags: cleanTags.length ? cleanTags : ['New Member'],
    job_title: role === 'INFLUENCER' ? 'Creator & Talent' : 'Brand Executive',
    talent_type: role === 'INFLUENCER' ? (talentType || 'INFLUENCER') : null,
    stats: { followers: 'New', engagement: 'N/A', budget: 'Custom' },
    social_stats: { instagramFollowers: '0', youtubeSubscribers: '0', tiktokFollowers: '0', avgEngagement: '0%' }
  }).select().single();
  if (error) throw error;
  const { data: sess } = await supabase.auth.getSession();
  return profileFromRow(data, sess.session?.user?.email);
}

export async function logOut() {
  await supabase.auth.signOut();
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw wrapAuthError(error);
}

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } });
  if (error) throw wrapAuthError(error);
}

// Used after a password-reset link: the recovery session is already active.
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw wrapAuthError(error);
  clearPasswordRecovery();
}
