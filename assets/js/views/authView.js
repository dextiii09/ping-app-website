// Ping Web Platform - Sign up / Log in / Password reset / Social onboarding
// One split-screen shell (animated Ping map + role copy on the left, desktop
// only) and a small screen state machine on the right:
//   login -> forgot -> forgot-sent
//   signup (3 steps: account, about you, niche) -> verify (check your inbox)
//   reset  (after a password-reset link)
//   onboard (2 steps, first Google/Facebook sign-in)
// On a successful log-in it does NOT transition the UI itself - the caller's
// auth-state listener is the single source of truth and takes over.
import {
  signUp, logIn, signInWithGoogle, signInWithFacebook, resetPassword,
  resendConfirmation, updatePassword, createSocialProfile, logOut
} from '../authService.js';
import { detectLocation } from '../geoService.js';
import { NICHE_TAGS } from '../mockData.js';
import { escapeHtml } from '../domUtils.js';
import { PingMap } from '../landing/pingMap.js';

export const INTENDED_ROLE_KEY = 'ping_intended_role';

const MAX_TAGS = 3;
const MIN_PASSWORD = 6;
const RESEND_COOLDOWN = 30; // seconds

const MARK = '<svg class="lp-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#E6FF1A"/><path d="M37 7 15 36h15l-4 21 23-31H34l3-19Z" fill="#0A0A0A"/></svg>';
const ARROW = '<svg class="lp-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const GOOGLE = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.61z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"/></svg>';
const FACEBOOK = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#1877F2" d="M18 9a9 9 0 1 0-10.4 8.89v-6.29H5.31V9h2.29V7.02c0-2.26 1.35-3.51 3.41-3.51.99 0 2.02.18 2.02.18v2.22h-1.14c-1.12 0-1.47.7-1.47 1.41V9h2.5l-.4 2.6h-2.1v6.29A9 9 0 0 0 18 9z"/></svg>';

const NICHE_ICONS = {
  'Food & Café': 'ph-coffee',
  'Beauty & Salon': 'ph-scissors',
  'Fitness': 'ph-barbell',
  'Fashion & Boutique': 'ph-t-shirt',
  'Lifestyle': 'ph-sun-horizon',
  'Home & Decor': 'ph-armchair',
  'Events': 'ph-confetti',
  'Tech & Gadgets': 'ph-device-mobile'
};

const ASIDE = {
  INFLUENCER: {
    kicker: 'For creators',
    title: 'Get paid to create for the places <em>you already love.</em>',
    points: ['A media kit brands can browse', 'Pitch live briefs from local brands', 'Keep 100% during the pilot']
  },
  BUSINESS: {
    kicker: 'For brands',
    title: 'Find the creators your customers <em>already follow.</em>',
    points: ['Discover creators by neighbourhood and niche', 'Post a brief and let creators pitch', 'Agree deals in writing with Smart Proposals']
  },
  login: {
    kicker: 'Welcome back',
    title: 'Your street is <em>still pinging.</em>',
    points: ['Pick up your Deal Room chats', 'See who pinged you back', 'Check in on your live briefs']
  },
  suspended: {
    kicker: 'Account status',
    title: 'Ping works on <em>trust.</em>',
    points: ['Accounts can be suspended for breaking our Terms', 'Suspensions are reviewed by a person', 'Email us if you think it was a mistake']
  },
  reset: {
    kicker: 'Account security',
    title: 'A fresh password, <em>and you\'re back.</em>',
    points: ['Use 8 or more characters', 'Mix letters, numbers and a symbol', 'Don\'t reuse an old password']
  }
};

// Common email-domain typos -> suggestion.
const DOMAIN_FIXES = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmal.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com',
  'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com',
  'icloud.co': 'icloud.com', 'rediffmail.co': 'rediffmail.com'
};

const MAILBOXES = [
  { match: /@(gmail|googlemail)\.com$/i, label: 'Open Gmail', url: 'https://mail.google.com/mail/u/0/#inbox' },
  { match: /@(outlook|hotmail|live|msn)\.[a-z.]+$/i, label: 'Open Outlook', url: 'https://outlook.live.com/mail/' },
  { match: /@yahoo\.[a-z.]+$/i, label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/' },
  { match: /@(icloud|me)\.com$/i, label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail' }
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordScore(pw) {
  if (!pw) return 0;
  if (pw.length < MIN_PASSWORD) return 1;
  let score = 2;
  if (pw.length >= 10) score++;
  if (/[a-z]/i.test(pw) && /\d/.test(pw) && (/[^a-z0-9]/i.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw)))) score++;
  return Math.min(score, 4);
}
const SCORE_LABEL = ['', 'Too short', 'Okay', 'Good', 'Strong'];

function emailSuggestion(email) {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const fix = DOMAIN_FIXES[email.slice(at + 1).toLowerCase()];
  return fix ? `${email.slice(0, at)}@${fix}` : null;
}

// opts:
//   mode: 'login' | 'signup' | 'reset' | 'onboard' | 'suspended'
//   role: 'INFLUENCER' | 'BUSINESS'  (signup/onboard preselect)
//   onBack(): show "Back to Ping" (landing)            [login/signup]
//   user, onComplete(profile): social onboarding       [onboard]
//   onDone(): password saved                            [reset]
// Returns a cleanup function.
export function renderAuthGate(container, opts = {}) {
  const { onBack = null, user = null, onComplete = null, onDone = null } = opts;
  let intended = opts.role;
  if (!intended) {
    try { intended = sessionStorage.getItem(INTENDED_ROLE_KEY) || undefined; } catch (e) { /* storage blocked */ }
  }
  const s = {
    screen: opts.mode || 'login',
    step: 1,
    anim: 'in',
    role: intended === 'BUSINESS' ? 'BUSINESS' : 'INFLUENCER',
    values: { email: '', name: (user && user.displayName) || '', company: '', location: '' },
    tags: [],
    busy: false,
    notice: null,   // { type: 'error' | 'success' | 'info', text, action?: { id, label } }
    errors: {},
    resendAt: 0
  };
  let password = ''; // kept in memory only, never rendered into HTML
  let resendTimer = 0;
  const touch = window.matchMedia('(hover: none)').matches;

  container.innerHTML = `
    <div class="auth-shell">
      <aside class="auth-aside" aria-hidden="true">
        <canvas class="auth-map"></canvas>
        <div class="auth-aside-shade"></div>
        <a href="#" class="auth-brand" tabindex="-1">${MARK}<span>Ping</span></a>
        <div class="auth-aside-copy"></div>
        <p class="auth-aside-foot"><span class="lp-live"></span> Free during the pilot · by ReachUp Media</p>
      </aside>
      <main class="auth-main">
        <div class="auth-card"></div>
      </main>
    </div>
  `;
  const card = container.querySelector('.auth-card');
  const asideCopy = container.querySelector('.auth-aside-copy');

  let map = null;
  if (window.matchMedia('(min-width: 1025px)').matches) {
    map = new PingMap(container.querySelector('.auth-map'), {
      density: 1.1, focus: [0.6, 0.3], narrowFocus: [0.6, 0.3], avoidLeft: 0, nameLabels: false
    });
  }

  // ─── Templates ─────────────────────────────────────────────────────────

  const isBrand = () => s.role === 'BUSINESS';

  function renderAside() {
    const key = s.screen === 'reset' || s.screen === 'suspended' ? s.screen
      : ['login', 'forgot', 'forgot-sent'].includes(s.screen) ? 'login' : s.role;
    const copy = ASIDE[key];
    asideCopy.innerHTML = `
      <p class="lp-kicker">${copy.kicker}</p>
      <h2 class="auth-aside-title">${copy.title}</h2>
      <ul class="auth-points">${copy.points.map((p) => `<li><i class="ph-bold ph-check"></i>${p}</li>`).join('')}</ul>`;
  }

  function topBar() {
    let right = '';
    if (s.screen === 'onboard') right = '<a href="#" class="auth-back" data-go="signout">Not you? Sign out</a>';
    else if (onBack) right = `<a href="#" class="auth-back" data-go="home">${ARROW} Back to Ping</a>`;
    return `<div class="auth-top"><a href="#" class="auth-mobile-brand" data-go="home">${MARK}<span>Ping</span></a>${right}</div>`;
  }

  function steps(labels) {
    return `
      <div class="auth-steps" role="progressbar" aria-valuemin="1" aria-valuemax="${labels.length}" aria-valuenow="${s.step}" aria-label="Step ${s.step} of ${labels.length}">
        ${labels.map((label, i) => {
          const n = i + 1;
          const state = n < s.step ? 'is-done' : n === s.step ? 'is-current' : '';
          return `<div class="auth-step ${state}"><span class="auth-step-bar"></span><span class="auth-step-label">${n < s.step ? '<i class="ph-bold ph-check"></i>' : `<b>${n}</b>`}${label}</span></div>`;
        }).join('')}
      </div>`;
  }

  function notice() {
    if (!s.notice) return '';
    const icon = { error: 'ph-warning-circle', success: 'ph-check-circle', info: 'ph-info' }[s.notice.type];
    return `
      <div class="auth-notice is-${s.notice.type}" role="${s.notice.type === 'error' ? 'alert' : 'status'}">
        <i class="ph-fill ${icon}"></i>
        <span>${escapeHtml(s.notice.text)}${s.notice.action ? ` <button type="button" class="auth-notice-action" data-action="${s.notice.action.id}">${s.notice.action.label}</button>` : ''}</span>
      </div>`;
  }

  function field({ id, label, type = 'text', value = '', placeholder = '', autocomplete = 'off', hint = '', labelAside = '', after = '' }) {
    const err = s.errors[id];
    return `
      <div class="auth-field${err ? ' has-error' : ''}">
        <div class="auth-label-row"><label class="auth-label" for="${id}">${label}</label>${labelAside}</div>
        <div class="auth-inline${type === 'password' ? ' auth-pass' : ''}">
          <input class="auth-input" id="${id}" type="${type}" value="${escapeHtml(value)}" placeholder="${placeholder}" autocomplete="${autocomplete}" aria-invalid="${err ? 'true' : 'false'}" aria-describedby="${id}Msg">
          ${type === 'password' ? `<button type="button" class="auth-eye" data-eye="${id}" aria-label="Show password" aria-pressed="false"><i class="ph ph-eye"></i></button>` : ''}
          ${after}
        </div>
        <div class="auth-msg${err ? ' is-bad' : ''}" id="${id}Msg" aria-live="polite">${err ? escapeHtml(err) : hint}</div>
      </div>`;
  }

  function passwordField(id, label, { withMeter = false, autocomplete = 'new-password', labelAside = '' } = {}) {
    return `
      ${field({ id, label, type: 'password', placeholder: withMeter ? `At least ${MIN_PASSWORD} characters` : 'Your password', autocomplete, labelAside })}
      <div class="auth-caps" data-caps-for="${id}" hidden><i class="ph-fill ph-arrow-fat-up"></i> Caps Lock is on</div>
      ${withMeter ? `<div class="auth-strength" data-meter-for="${id}" data-score="0"><span></span><span></span><span></span><span></span><em></em></div>` : ''}`;
  }

  function socialButtons(verb) {
    return `
      <div class="auth-social">
        <button type="button" class="auth-social-btn" data-social="google" ${s.busy ? 'disabled' : ''}>${GOOGLE} ${verb} with Google</button>
        <button type="button" class="auth-social-btn" data-social="facebook" ${s.busy ? 'disabled' : ''}>${FACEBOOK} ${verb} with Facebook</button>
      </div>
      <div class="auth-divider">or with email</div>`;
  }

  function submit(label, { icon = true } = {}) {
    return `<button type="submit" class="auth-submit" ${s.busy ? 'disabled' : ''}>${s.busy ? '<span class="auth-spinner" aria-hidden="true"></span> Please wait' : `${label} ${icon ? ARROW : ''}`}</button>`;
  }

  function roleCards() {
    const option = (value, icon, title, text) => `
      <button type="button" role="radio" class="auth-role ${s.role === value ? 'is-on' : ''}" aria-checked="${s.role === value}" data-role="${value}">
        <i class="ph-fill ${icon}"></i><span><b>${title}</b><small>${text}</small></span><span class="auth-role-dot"></span>
      </button>`;
    return `
      <div class="auth-field">
        <span class="auth-label" id="authRoleLabel">I'm joining as</span>
        <div class="auth-roles" role="radiogroup" aria-labelledby="authRoleLabel">
          ${option('INFLUENCER', 'ph-camera', 'Creator', 'I make content')}
          ${option('BUSINESS', 'ph-storefront', 'Brand', 'I run a business')}
        </div>
      </div>`;
  }

  function aboutFields() {
    return `
      ${field({ id: 'authName', label: isBrand() ? 'Your name' : 'Full name', value: s.values.name, placeholder: isBrand() ? 'e.g. Priya Sharma' : 'e.g. Simran Kaur', autocomplete: 'name' })}
      ${isBrand() ? field({ id: 'authCompany', label: 'Business name', value: s.values.company, placeholder: 'e.g. Brew Lab Café', autocomplete: 'organization' }) : ''}
      ${field({
        id: 'authLocation', label: 'Location', value: s.values.location, placeholder: 'City or neighbourhood', autocomplete: 'address-level2',
        hint: 'We use this to show you people nearby.',
        after: '<button type="button" id="btnDetectLocation" class="auth-detect" title="Use my current location"><i class="ph-bold ph-crosshair"></i> Detect</button>'
      })}`;
  }

  function nicheTiles() {
    const full = s.tags.length >= MAX_TAGS;
    return `
      <div class="auth-field${s.errors.tags ? ' has-error' : ''}">
        <div class="auth-label-row"><span class="auth-label">${isBrand() ? 'Categories' : 'Niches'}</span><span class="auth-counter" id="authTagCount">${s.tags.length} of ${MAX_TAGS}</span></div>
        <div class="auth-niches" role="group" aria-label="Pick up to ${MAX_TAGS}">
          ${NICHE_TAGS.map((tag) => {
            const on = s.tags.includes(tag);
            return `<button type="button" class="auth-niche ${on ? 'is-on' : ''} ${!on && full ? 'is-muted' : ''}" aria-pressed="${on}" data-tag="${escapeHtml(tag)}"><i class="ph-fill ${NICHE_ICONS[tag] || 'ph-tag'}"></i><span>${escapeHtml(tag)}</span><span class="auth-niche-check"><i class="ph-bold ph-check"></i></span></button>`;
          }).join('')}
        </div>
        <div class="auth-msg${s.errors.tags ? ' is-bad' : ''}" aria-live="polite">${s.errors.tags || ''}</div>
      </div>`;
  }

  const legal = (verb) => `<p class="auth-legal">By ${verb} you agree to our <a href="/terms.html" target="_blank" rel="noopener">Terms</a> and <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>`;

  const mailIcon = () => '<div class="auth-mail-icon" aria-hidden="true"><span></span><span></span><i class="ph-fill ph-envelope-simple-open"></i></div>';

  function mailboxButton() {
    const box = MAILBOXES.find((m) => m.match.test(s.values.email));
    return box ? `<a class="auth-submit auth-mailbox" href="${box.url}" target="_blank" rel="noopener">${box.label} ${ARROW}</a>` : '';
  }

  function resendButton(id, label) {
    const left = Math.max(0, Math.ceil((s.resendAt - Date.now()) / 1000));
    return `<button type="button" class="auth-ghost-btn" id="${id}" ${left > 0 || s.busy ? 'disabled' : ''}>${left > 0 ? `${label} in ${left}s` : label}</button>`;
  }

  const SIGNUP_STEPS = ['Account', 'About you', 'Your niche'];
  const ONBOARD_STEPS = ['About you', 'Your niche'];
  const nicheTitle = () => (isBrand() ? 'What do you <em>do?</em>' : 'Pick your <em>niche</em>');
  const nicheSub = () => `Choose up to ${MAX_TAGS}. We use these to match you with the right ${isBrand() ? 'creators' : 'brands'}.`;

  const SCREENS = {
    login: () => `
      ${topBar()}
      <h1 class="auth-title" tabindex="-1">Welcome <em>back</em></h1>
      <p class="auth-sub">Log in to pick up where you left off.</p>
      ${notice()}
      ${socialButtons('Continue')}
      <form class="auth-form" id="authForm" novalidate>
        ${field({ id: 'authEmail', label: 'Email', type: 'email', value: s.values.email, placeholder: 'you@example.com', autocomplete: 'email' })}
        ${passwordField('authPassword', 'Password', { autocomplete: 'current-password', labelAside: '<a href="#" class="auth-link-sm" data-go="forgot">Forgot password?</a>' })}
        ${submit('Log in')}
      </form>
      <p class="auth-switch">New to Ping? <a href="#" data-go="signup">Create a free account</a></p>`,

    forgot: () => `
      ${topBar()}
      <h1 class="auth-title" tabindex="-1">Reset your <em>password</em></h1>
      <p class="auth-sub">Enter the email you signed up with and we'll send you a link to set a new one.</p>
      ${notice()}
      <form class="auth-form" id="authForm" novalidate>
        ${field({ id: 'authEmail', label: 'Email', type: 'email', value: s.values.email, placeholder: 'you@example.com', autocomplete: 'email' })}
        ${submit('Send reset link')}
      </form>
      <p class="auth-switch">Remembered it? <a href="#" data-go="login">Back to log in</a></p>`,

    'forgot-sent': () => `
      ${topBar()}
      ${mailIcon()}
      <h1 class="auth-title" tabindex="-1">Check your <em>inbox</em></h1>
      <p class="auth-sub">If there's a Ping account for <b>${escapeHtml(s.values.email)}</b>, a password reset link is on its way. It can take a minute, and it may land in spam.</p>
      ${notice()}
      ${mailboxButton()}
      <div class="auth-row">${resendButton('authResendReset', 'Resend link')}<button type="button" class="auth-ghost-btn" data-go="login">Back to log in</button></div>`,

    signup: () => {
      if (s.step === 1) return `
        ${topBar()}
        ${steps(SIGNUP_STEPS)}
        <h1 class="auth-title" tabindex="-1">Join as a <em>${isBrand() ? 'brand' : 'creator'}</em></h1>
        <p class="auth-sub">Free during the pilot. Takes about two minutes.</p>
        ${roleCards()}
        ${notice()}
        ${socialButtons('Sign up')}
        <form class="auth-form" id="authForm" novalidate>
          ${field({ id: 'authEmail', label: 'Email', type: 'email', value: s.values.email, placeholder: 'you@example.com', autocomplete: 'email' })}
          ${passwordField('authPassword', 'Create a password', { withMeter: true })}
          ${submit('Continue')}
        </form>
        ${legal('signing up')}
        <p class="auth-switch">Already on Ping? <a href="#" data-go="login">Log in</a></p>`;
      if (s.step === 2) return `
        ${topBar()}
        ${steps(SIGNUP_STEPS)}
        <h1 class="auth-title" tabindex="-1">${isBrand() ? 'About your <em>business</em>' : 'Tell us about <em>you</em>'}</h1>
        <p class="auth-sub">${isBrand() ? 'This is what creators see when they find you.' : 'This is what brands see when they find you.'}</p>
        ${notice()}
        <form class="auth-form" id="authForm" novalidate>
          ${aboutFields()}
          <div class="auth-actions"><button type="button" class="auth-ghost-btn" data-go="prev"><i class="ph-bold ph-arrow-left"></i> Back</button>${submit('Continue')}</div>
        </form>`;
      return `
        ${topBar()}
        ${steps(SIGNUP_STEPS)}
        <h1 class="auth-title" tabindex="-1">${nicheTitle()}</h1>
        <p class="auth-sub">${nicheSub()}</p>
        ${notice()}
        <form class="auth-form" id="authForm" novalidate>
          ${nicheTiles()}
          <div class="auth-actions"><button type="button" class="auth-ghost-btn" data-go="prev"><i class="ph-bold ph-arrow-left"></i> Back</button>${submit('Create my account')}</div>
        </form>
        ${legal('creating an account')}`;
    },

    verify: () => `
      ${topBar()}
      ${mailIcon()}
      <h1 class="auth-title" tabindex="-1">Check your <em>inbox</em></h1>
      <p class="auth-sub">We sent a confirmation link to <b>${escapeHtml(s.values.email)}</b>. Click it to activate your account, then log in. It may take a minute, and it sometimes lands in spam.</p>
      ${notice()}
      ${mailboxButton()}
      <div class="auth-row">${resendButton('authResendSignup', 'Resend email')}<button type="button" class="auth-ghost-btn" data-go="login">I've confirmed, log in</button></div>
      <p class="auth-switch">Wrong email? <a href="#" data-go="signup-edit">Change it</a></p>`,

    reset: () => `
      ${topBar()}
      <h1 class="auth-title" tabindex="-1">Set a new <em>password</em></h1>
      <p class="auth-sub">Choose a new password for your Ping account.</p>
      ${notice()}
      <form class="auth-form" id="authForm" novalidate>
        ${passwordField('authPassword', 'New password', { withMeter: true })}
        ${passwordField('authPassword2', 'Confirm new password')}
        ${submit('Save password')}
      </form>`,

    suspended: () => `
      ${topBar()}
      <h1 class="auth-title" tabindex="-1">Account <em>suspended</em></h1>
      <p class="auth-sub">Your Ping account has been suspended, so you can't use Ping right now. If you think this is a mistake, email <a href="mailto:letstalk@reachupmedia.in">letstalk@reachupmedia.in</a> and we'll take a look.</p>
      <div class="auth-row"><button type="button" class="auth-ghost-btn" data-go="signout">Sign out</button></div>`,

    onboard: () => {
      const who = user ? `
        <div class="auth-signedin">
          ${user.photoURL ? `<span class="auth-signedin-av" style="background-image:url('${escapeHtml(user.photoURL)}')"></span>` : '<span class="auth-signedin-av"><i class="ph-fill ph-user"></i></span>'}
          <span>Signed in as <b>${escapeHtml(user.email || '')}</b></span>
        </div>` : '';
      const first = escapeHtml((s.values.name || '').split(' ')[0] || 'there');
      if (s.step === 1) return `
        ${topBar()}
        ${who}
        ${steps(ONBOARD_STEPS)}
        <h1 class="auth-title" tabindex="-1">Almost there, <em>${first}</em></h1>
        <p class="auth-sub">A couple of details so we can match you with the right people.</p>
        ${notice()}
        <form class="auth-form" id="authForm" novalidate>
          ${roleCards()}
          ${aboutFields()}
          ${submit('Continue')}
        </form>`;
      return `
        ${topBar()}
        ${who}
        ${steps(ONBOARD_STEPS)}
        <h1 class="auth-title" tabindex="-1">${nicheTitle()}</h1>
        <p class="auth-sub">${nicheSub()}</p>
        ${notice()}
        <form class="auth-form" id="authForm" novalidate>
          ${nicheTiles()}
          <div class="auth-actions"><button type="button" class="auth-ghost-btn" data-go="prev"><i class="ph-bold ph-arrow-left"></i> Back</button>${submit('Finish setting up')}</div>
        </form>
        ${legal('finishing sign-up')}`;
    }
  };

  // ─── Rendering ─────────────────────────────────────────────────────────

  function render({ focus = false } = {}) {
    card.dataset.anim = s.anim;
    card.innerHTML = SCREENS[s.screen]();
    s.anim = 'none';
    // The password lives only in memory: put it back after a re-render.
    const pw = card.querySelector('#authPassword');
    if (pw && password && (s.screen === 'signup' || s.screen === 'reset')) {
      pw.value = password;
      updateMeter(pw);
    }
    bindInputs();
    startResendTicker();
    if (focus) focusFirst();
  }

  function focusFirst() {
    const target = card.querySelector('.auth-field.has-error .auth-input')
      || (!touch && [...card.querySelectorAll('.auth-input')].find((i) => !i.value))
      || card.querySelector('.auth-title');
    if (target) target.focus({ preventScroll: true });
  }

  function go(screen, { step = 1, anim = 'fwd' } = {}) {
    s.screen = screen;
    s.step = step;
    s.anim = anim;
    s.errors = {};
    s.notice = null;
    renderAside();
    render({ focus: true });
    window.scrollTo(0, 0);
  }

  function startResendTicker() {
    clearInterval(resendTimer);
    if (s.resendAt <= Date.now()) return;
    resendTimer = setInterval(() => {
      const btn = card.querySelector('#authResendSignup, #authResendReset');
      if (!btn) { clearInterval(resendTimer); return; }
      const left = Math.ceil((s.resendAt - Date.now()) / 1000);
      const base = btn.id === 'authResendSignup' ? 'Resend email' : 'Resend link';
      if (left <= 0) {
        btn.disabled = false;
        btn.textContent = base;
        clearInterval(resendTimer);
      } else {
        btn.textContent = `${base} in ${left}s`;
      }
    }, 1000);
  }

  function updateMeter(input) {
    const meter = card.querySelector(`[data-meter-for="${input.id}"]`);
    if (!meter) return;
    const score = passwordScore(input.value);
    meter.dataset.score = String(score);
    meter.querySelector('em').textContent = SCORE_LABEL[score];
  }

  function setFieldError(id, text) {
    const input = card.querySelector(`#${id}`);
    const msg = card.querySelector(`#${id}Msg`);
    const wrap = input && input.closest('.auth-field');
    if (!wrap) return;
    wrap.classList.toggle('has-error', !!text);
    input.setAttribute('aria-invalid', text ? 'true' : 'false');
    if (msg) { msg.classList.toggle('is-bad', !!text); msg.textContent = text || ''; }
    if (text) s.errors[id] = text; else delete s.errors[id];
  }

  function validateEmail(showEmpty = true) {
    const input = card.querySelector('#authEmail');
    if (!input) return true;
    const email = input.value.trim();
    s.values.email = email;
    if (!email) { if (showEmpty) setFieldError('authEmail', 'Please enter your email.'); return false; }
    if (!EMAIL_RE.test(email)) { setFieldError('authEmail', 'That doesn\'t look like a valid email.'); return false; }
    setFieldError('authEmail', '');
    const fix = emailSuggestion(email);
    if (fix) {
      card.querySelector('#authEmailMsg').innerHTML = `Did you mean <button type="button" class="auth-fix" data-fix="${escapeHtml(fix)}">${escapeHtml(fix)}</button>?`;
    }
    return true;
  }

  function requireValue(id, message) {
    const input = card.querySelector(`#${id}`);
    if (!input) return true;
    if (!input.value.trim()) { setFieldError(id, message); return false; }
    setFieldError(id, '');
    return true;
  }

  function readAbout() {
    const v = (id) => { const el = card.querySelector(`#${id}`); return el ? el.value.trim() : ''; };
    s.values.name = v('authName');
    if (card.querySelector('#authCompany')) s.values.company = v('authCompany');
    s.values.location = v('authLocation');
    let ok = requireValue('authName', 'Please enter your name.');
    if (isBrand()) ok = requireValue('authCompany', 'Please enter your business name.') && ok;
    ok = requireValue('authLocation', 'Add your city or neighbourhood, or tap Detect.') && ok;
    return ok;
  }

  function friendlyError(err) {
    const code = (err && err.code) || '';
    if (code.includes('email-not-confirmed')) return 'Please confirm your email first. Check your inbox for the link.';
    if (code.includes('email-already-in-use')) return 'An account with this email already exists.';
    if (code.includes('invalid-email')) return 'That email address looks invalid.';
    if (code.includes('weak-password')) return `Password should be at least ${MIN_PASSWORD} characters.`;
    if (code.includes('same-password')) return 'Your new password must be different from the old one.';
    if (code.includes('invalid-credential')) return 'Incorrect email or password.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a minute and try again.';
    console.error('Auth error:', err);
    return `Something went wrong${code && code !== 'auth/unknown' ? ` (${code})` : ''}. Please try again.`;
  }

  // ─── Actions ───────────────────────────────────────────────────────────

  function rememberIntendedRole() {
    try { sessionStorage.setItem(INTENDED_ROLE_KEY, s.role); } catch (e) { /* storage blocked */ }
  }

  async function runSocial(provider) {
    if (s.screen === 'signup') rememberIntendedRole();
    s.notice = null;
    s.busy = true;
    render();
    try {
      await (provider === 'google' ? signInWithGoogle() : signInWithFacebook());
      // Full-page redirect; the auth listener takes over when we come back.
    } catch (err) {
      s.busy = false;
      s.notice = { type: 'error', text: friendlyError(err) };
      render();
    }
  }

  async function withBusy(fn) {
    s.busy = true;
    s.notice = null;
    render();
    try { await fn(); } finally { s.busy = false; }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (s.busy) return;
    const pwInput = card.querySelector('#authPassword');
    if (pwInput) password = pwInput.value;

    if (s.screen === 'login') {
      const okEmail = validateEmail();
      const okPw = !!password;
      setFieldError('authPassword', okPw ? '' : 'Please enter your password.');
      if (!okEmail || !okPw) { focusFirst(); return; }
      await withBusy(async () => {
        try {
          await logIn(s.values.email, password);
          // Success: index.html's auth listener takes it from here.
        } catch (err) {
          const code = (err && err.code) || '';
          s.notice = code.includes('email-not-confirmed')
            ? { type: 'info', text: 'Your email isn\'t confirmed yet. Check your inbox for the link.', action: { id: 'resend-confirm', label: 'Resend it' } }
            : { type: 'error', text: friendlyError(err) };
        }
      });
      render({ focus: !!s.notice });
      return;
    }

    if (s.screen === 'forgot') {
      if (!validateEmail()) { focusFirst(); return; }
      await withBusy(async () => {
        try {
          await resetPassword(s.values.email);
          s.resendAt = Date.now() + RESEND_COOLDOWN * 1000;
          s.screen = 'forgot-sent';
          s.anim = 'fwd';
        } catch (err) {
          s.notice = { type: 'error', text: friendlyError(err) };
        }
      });
      render({ focus: true });
      return;
    }

    if (s.screen === 'reset') {
      const confirm = card.querySelector('#authPassword2').value;
      let ok = true;
      if (password.length < MIN_PASSWORD) { setFieldError('authPassword', `Use at least ${MIN_PASSWORD} characters.`); ok = false; } else setFieldError('authPassword', '');
      if (confirm !== password) { setFieldError('authPassword2', 'Passwords don\'t match.'); ok = false; } else setFieldError('authPassword2', '');
      if (!ok) { focusFirst(); return; }
      let saved = false;
      await withBusy(async () => {
        try {
          await updatePassword(password);
          saved = true;
          s.notice = { type: 'success', text: 'Password saved. Taking you in…' };
        } catch (err) {
          s.notice = { type: 'error', text: friendlyError(err) };
        }
      });
      render();
      if (saved && onDone) setTimeout(onDone, 900);
      return;
    }

    if (s.screen === 'signup' && s.step === 1) {
      const okEmail = validateEmail();
      const okPw = password.length >= MIN_PASSWORD;
      setFieldError('authPassword', okPw ? '' : (password ? `Use at least ${MIN_PASSWORD} characters.` : 'Please create a password.'));
      if (!okEmail || !okPw) { focusFirst(); return; }
      go('signup', { step: 2 });
      return;
    }

    const aboutStep = s.screen === 'signup' ? 2 : 1;
    if (s.step === aboutStep) {
      if (!readAbout()) { focusFirst(); return; }
      go(s.screen, { step: s.step + 1 });
      return;
    }

    // Final step: niches -> create the account / profile.
    if (s.tags.length === 0) {
      s.errors.tags = 'Pick at least one so we can match you with the right people.';
      render();
      return;
    }

    if (s.screen === 'signup') {
      await withBusy(async () => {
        try {
          await signUp({
            email: s.values.email, password, name: s.values.name, role: s.role,
            company: isBrand() ? s.values.company : '', location: s.values.location, tags: s.tags
          });
          // Only reached if email confirmation is off: the auth listener takes over.
        } catch (err) {
          const code = (err && err.code) || '';
          if (code.includes('confirm-email')) {
            s.resendAt = Date.now() + RESEND_COOLDOWN * 1000;
            s.screen = 'verify';
            s.anim = 'fwd';
          } else if (code.includes('email-already-in-use')) {
            s.step = 1;
            s.anim = 'back';
            s.errors.authEmail = 'An account with this email already exists.';
            s.notice = { type: 'info', text: 'Looks like you already have an account.', action: { id: 'to-login', label: 'Log in instead' } };
          } else if (code.includes('weak-password') || code.includes('invalid-email')) {
            s.step = 1;
            s.anim = 'back';
            s.errors[code.includes('weak-password') ? 'authPassword' : 'authEmail'] = friendlyError(err);
          } else {
            s.notice = { type: 'error', text: friendlyError(err) };
          }
        }
      });
      renderAside();
      render({ focus: true });
      return;
    }

    if (s.screen === 'onboard') {
      let created = null;
      await withBusy(async () => {
        try {
          created = await createSocialProfile({
            uid: user.uid, name: s.values.name, avatar: user.photoURL, role: s.role,
            company: isBrand() ? s.values.company : '', location: s.values.location, tags: s.tags
          });
        } catch (err) {
          console.error('createSocialProfile failed:', err);
          s.notice = { type: 'error', text: 'Could not finish setting up your account. Please try again.' };
        }
      });
      if (created) {
        try { sessionStorage.removeItem(INTENDED_ROLE_KEY); } catch (e) { /* ignore */ }
        if (onComplete) onComplete(created);
        return;
      }
      render();
    }
  }

  async function resend(kind) {
    if (s.resendAt > Date.now() || s.busy) return;
    await withBusy(async () => {
      try {
        if (kind === 'signup') await resendConfirmation(s.values.email);
        else await resetPassword(s.values.email);
        s.resendAt = Date.now() + RESEND_COOLDOWN * 1000;
        s.notice = { type: 'success', text: `Sent again to ${s.values.email}.` };
      } catch (err) {
        s.notice = { type: 'error', text: friendlyError(err) };
      }
    });
    render();
  }

  const INPUT_KEYS = { authEmail: 'email', authName: 'name', authCompany: 'company', authLocation: 'location' };

  function setRole(role) {
    if (role === s.role) return;
    // Keep whatever was typed on this screen before re-rendering.
    card.querySelectorAll('.auth-input').forEach((input) => {
      if (INPUT_KEYS[input.id]) s.values[INPUT_KEYS[input.id]] = input.value.trim();
      if (input.id === 'authPassword') password = input.value;
    });
    s.role = role;
    if (s.screen === 'signup') rememberIntendedRole();
    renderAside();
    render();
  }

  function toggleTag(tag) {
    if (s.tags.includes(tag)) s.tags = s.tags.filter((t) => t !== tag);
    else if (s.tags.length < MAX_TAGS) s.tags = [...s.tags, tag];
    else return;
    delete s.errors.tags;
    const full = s.tags.length >= MAX_TAGS;
    card.querySelectorAll('.auth-niche').forEach((btn) => {
      const on = s.tags.includes(btn.getAttribute('data-tag'));
      btn.classList.toggle('is-on', on);
      btn.classList.toggle('is-muted', !on && full);
      btn.setAttribute('aria-pressed', String(on));
    });
    const count = card.querySelector('#authTagCount');
    if (count) count.textContent = `${s.tags.length} of ${MAX_TAGS}`;
    const wrap = card.querySelector('.auth-niches').closest('.auth-field');
    wrap.classList.remove('has-error');
    wrap.querySelector('.auth-msg').textContent = '';
  }

  async function detect() {
    const btn = card.querySelector('#btnDetectLocation');
    const input = card.querySelector('#authLocation');
    const msg = card.querySelector('#authLocationMsg');
    if (!btn || !input) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="auth-spinner is-light" aria-hidden="true"></span> Finding';
    msg.className = 'auth-msg';
    msg.textContent = 'Finding your location…';
    try {
      const { label } = await detectLocation();
      input.value = label;
      s.values.location = label;
      setFieldError('authLocation', '');
      msg.className = 'auth-msg is-ok';
      msg.textContent = 'Found you. Feel free to edit it.';
    } catch (err) {
      msg.className = 'auth-msg is-bad';
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ph-bold ph-crosshair"></i> Detect';
    }
  }

  // ─── Events ────────────────────────────────────────────────────────────

  function bindInputs() {
    const form = card.querySelector('#authForm');
    if (form) form.onsubmit = onSubmit;
    card.querySelectorAll('.auth-input').forEach((input) => {
      input.oninput = () => {
        if (INPUT_KEYS[input.id]) s.values[INPUT_KEYS[input.id]] = input.value;
        if (input.id === 'authPassword') { password = input.value; updateMeter(input); }
        if (s.errors[input.id]) setFieldError(input.id, '');
      };
      if (input.type === 'password') {
        const caps = (e) => {
          const hint = card.querySelector(`[data-caps-for="${input.id}"]`);
          if (hint && e.getModifierState) hint.hidden = !e.getModifierState('CapsLock');
        };
        input.onkeydown = caps;
        input.onkeyup = caps;
        input.onblur = () => { const hint = card.querySelector(`[data-caps-for="${input.id}"]`); if (hint) hint.hidden = true; };
      }
    });
    const email = card.querySelector('#authEmail');
    if (email) email.onblur = () => { if (email.value.trim()) validateEmail(false); };
  }

  // One delegated click handler for the card (its contents re-render often).
  const onCardClick = async (e) => {
    const goEl = e.target.closest('[data-go]');
    if (goEl) {
      e.preventDefault();
      const to = goEl.getAttribute('data-go');
      if (to === 'home') { if (onBack) onBack(); return; }
      if (to === 'signout') { await logOut(); window.location.reload(); return; }
      if (to === 'prev') {
        if (s.step === (s.screen === 'signup' ? 2 : 1)) readAbout();
        go(s.screen, { step: s.step - 1, anim: 'back' });
        return;
      }
      if (to === 'signup-edit') { go('signup', { step: 1, anim: 'back' }); return; }
      go(to, { anim: to === 'login' ? 'back' : 'fwd' });
      return;
    }
    const role = e.target.closest('[data-role]');
    if (role) { setRole(role.getAttribute('data-role')); return; }
    const niche = e.target.closest('[data-tag]');
    if (niche) { toggleTag(niche.getAttribute('data-tag')); return; }
    const social = e.target.closest('[data-social]');
    if (social) { runSocial(social.getAttribute('data-social')); return; }
    const eye = e.target.closest('[data-eye]');
    if (eye) {
      const input = card.querySelector(`#${eye.getAttribute('data-eye')}`);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', String(show));
      eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      eye.innerHTML = `<i class="ph ${show ? 'ph-eye-slash' : 'ph-eye'}"></i>`;
      input.focus();
      return;
    }
    const fix = e.target.closest('[data-fix]');
    if (fix) {
      const input = card.querySelector('#authEmail');
      input.value = fix.getAttribute('data-fix');
      s.values.email = input.value;
      validateEmail();
      input.focus();
      return;
    }
    if (e.target.closest('#btnDetectLocation')) { detect(); return; }
    if (e.target.closest('#authResendSignup')) { resend('signup'); return; }
    if (e.target.closest('#authResendReset')) { resend('reset'); return; }
    const action = e.target.closest('[data-action]');
    if (action) {
      const id = action.getAttribute('data-action');
      if (id === 'to-login') go('login', { anim: 'back' });
      if (id === 'resend-confirm') { s.resendAt = 0; await resend('signup'); }
    }
  };
  card.addEventListener('click', onCardClick);
  const brand = container.querySelector('.auth-brand');
  const onBrand = (e) => { e.preventDefault(); if (onBack) onBack(); };
  brand.addEventListener('click', onBrand);

  renderAside();
  render({ focus: !touch });

  return function destroy() {
    clearInterval(resendTimer);
    card.removeEventListener('click', onCardClick);
    brand.removeEventListener('click', onBrand);
    if (map) map.destroy();
  };
}
