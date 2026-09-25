// Ping Web Platform - PingScore™ Computation
//
// Real accounts' `pingScore` field is written once at signup (Firestore
// rules force it to exactly 85 on create - see firestore.rules
// `validUserDocument`'s create block) and CANNOT be changed by the user
// afterward - `pingScore` isn't in the users/{userId} update rule's allowed
// diff-affectedKeys list at all, only an admin write can touch it. With no
// Cloud Function recomputing it server-side yet, every real account was
// permanently frozen at the same number forever, which is exactly why it
// read as fake (see AUDIT_REPORT.md / backlog item #14).
//
// Rather than keep showing that frozen, meaningless 85, this computes a
// genuine, deterministic, explainable score from real signals already on
// the profile every time it's displayed. It's intentionally NOT written
// back to Firestore - current rules don't allow a client write to
// `pingScore` (and shouldn't; a self-reported trust score is a bad idea).
// This is a display-layer improvement, not a claim that the number is
// server-authoritative or persisted anywhere.
import { isPlaceholderAvatar } from './domUtils.js';

export function computePingScore(user, { activeDeals = 0 } = {}) {
  if (!user) return 55;

  let score = 55; // baseline for any active, signed-up member

  if (user.verificationStatus === 'VERIFIED') score += 20;
  else if (user.verificationStatus === 'PENDING') score += 5;

  if (user.bio && user.bio.trim().length >= 30) score += 5;
  if (!isPlaceholderAvatar(user.avatar)) score += 5;
  if (user.tags && user.tags.length >= 2) score += 5;

  // Deal activity - only known for the account viewing its own profile
  // (public_profiles doesn't expose other users' match counts).
  score += Math.min(activeDeals * 3, 10);

  return Math.max(0, Math.min(100, score));
}

// Seed/mock candidates (isDemo: true) aren't backed by a real account or
// real signals, so they keep their curated seed pingScore instead of being
// run through the formula above.
export function displayPingScore(user, opts = {}) {
  if (!user) return 85;
  if (user.isDemo) return user.pingScore || 90;
  return computePingScore(user, opts);
}
