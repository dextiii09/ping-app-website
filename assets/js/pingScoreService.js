// Ping Web Platform - PingScore™ Computation
//
// Real accounts don't store a PingScore. Instead of a fixed number that
// reads as fake, this computes a deterministic, explainable score from real
// signals already on the profile every time it's displayed. It's never
// saved anywhere (a self-reported trust score would be a bad idea): it's a
// display-layer summary, not a server-authoritative number.
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
