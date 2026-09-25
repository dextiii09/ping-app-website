// Ping Web Platform - First-Time Social Sign-In Onboarding
// Google/Facebook only give us an identity (name, email, avatar), never a
// role, location or niche. Shown by index.html's bootstrap whenever a
// signed-in user has no profile row yet (for social sign-in: first visit).
// It's the "onboard" screen of the shared sign-up flow in authView.js.
import { renderAuthGate } from './authView.js';

export function renderSocialOnboarding(container, user, onComplete) {
  return renderAuthGate(container, { mode: 'onboard', user, onComplete });
}
