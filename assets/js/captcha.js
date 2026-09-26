// Cloudflare Turnstile: a free, mostly invisible check that stops bots from
// signing up, logging in or requesting emails in bulk. Supabase verifies the
// token on its side once CAPTCHA protection is switched on in the dashboard
// (Authentication → Attack Protection → Turnstile, with the secret key).
//
// Until the site key below is set, no check runs and no token is sent, so the
// site keeps working either way. Turn Supabase's protection on only AFTER the
// site key is live, or every log-in would be rejected.

// Site key from the Cloudflare dashboard (public, safe to ship in client code).
export const TURNSTILE_SITE_KEY = '';

// Localhost uses Cloudflare's always-pass test key instead.
const TEST_SITE_KEY = '1x00000000000000000000BB';
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const siteKey = () => (TURNSTILE_SITE_KEY ? (isLocal ? TEST_SITE_KEY : TURNSTILE_SITE_KEY) : '');

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading = null;
let widgetId = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable')));
      s.onerror = () => { loading = null; reject(new Error('Turnstile failed to load')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

function captchaError(message) {
  const e = new Error(message);
  e.code = 'auth/captcha';
  return e;
}

// A fresh single-use token for the next auth request, or null when bot
// protection isn't set up. Usually invisible; if Cloudflare wants a human
// check, a small box appears in `host` for the member to tick.
export async function getCaptchaToken(host) {
  const key = siteKey();
  if (!key) return null;
  let ts;
  try {
    ts = await loadTurnstile();
  } catch (err) {
    throw captchaError('The bot check could not load');
  }
  if (widgetId !== null) {
    try { ts.remove(widgetId); } catch (err) { /* already gone */ }
    widgetId = null;
  }
  host.innerHTML = '';
  const el = document.createElement('div');
  host.appendChild(el);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(captchaError('The bot check timed out')), 120000);
    widgetId = ts.render(el, {
      sitekey: key,
      theme: 'dark',
      appearance: 'interaction-only',
      callback: (token) => { clearTimeout(timer); resolve(token); },
      'error-callback': () => { clearTimeout(timer); reject(captchaError('The bot check failed')); },
      'timeout-callback': () => { clearTimeout(timer); reject(captchaError('The bot check timed out')); }
    });
  });
}
