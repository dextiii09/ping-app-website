// Ping - update watcher. Every commit stamps a new version into version.json
// and the <meta name="ping-version"> tag in index.html (a git pre-commit hook
// does it, see CLAUDE.md). An open tab compares the version it was loaded
// with against version.json every few minutes and whenever the member comes
// back to the tab:
//  - in a background tab with nothing half-done, it reloads quietly, so the
//    member comes back to the new version;
//  - while the member is using Ping it never reloads by itself: a small bar
//    offers "Refresh", and the reload reopens the screen they were on.

const CHECK_EVERY = 5 * 60 * 1000;
const RESUME_KEY = 'ping_resume_view';
const AUTO_KEY = 'ping_update_auto'; // the version this tab already reloaded itself for

let current = document.querySelector('meta[name="ping-version"]')?.content || null;
let latest = null;     // newest version seen on the server
let dismissed = null;  // version whose bar the member closed
let bar = null;

async function fetchVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.version === 'string' ? data.version : null;
  } catch (err) {
    return null; // offline: try again later
  }
}

// Something the member would lose on a reload: typing, an open form or
// dialog, a photo upload, or a sign-up / log-in in progress.
export function isBusy() {
  const active = document.activeElement;
  if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return true;
  if (document.querySelector('.platform-modal-backdrop.active, .cm-layer .platform-modal-backdrop, .lp-menu.is-open, .mk-avatar.is-busy')) return true;
  if (document.querySelector('.auth-steps[aria-valuenow]:not([aria-valuenow="1"])')) return true;
  const fields = document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea');
  for (const el of fields) {
    if (el.value !== el.defaultValue) return true;
    if (el.value && el.closest('.auth-card')) return true;
  }
  return false;
}

function reloadNow() {
  try {
    const view = window.pingPlatform && window.pingPlatform.currentView;
    if (view) sessionStorage.setItem(RESUME_KEY, view);
  } catch (err) { /* storage blocked: the app opens on its home screen */ }
  window.location.reload();
}

// A quiet reload happens at most once per new version. If the reloaded page
// still isn't that version (e.g. mid-deploy), offer the bar instead of
// reloading again and again.
function autoReload() {
  try {
    if (sessionStorage.getItem(AUTO_KEY) === latest) { showBar(); return; }
    sessionStorage.setItem(AUTO_KEY, latest);
  } catch (err) { showBar(); return; }
  reloadNow();
}

function hideBar() {
  if (bar) bar.remove();
  bar = null;
}

function showBar() {
  if (bar || latest === dismissed) return;
  bar = document.createElement('div');
  bar.className = 'ping-update';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `
    <span class="ping-update-dot" aria-hidden="true"></span>
    <span class="ping-update-text"><b>New version of Ping</b><span> Refresh to get the latest.</span></span>
    <button type="button" class="ping-update-btn">Refresh</button>
    <button type="button" class="ping-update-close" aria-label="Not now">&times;</button>`;
  bar.querySelector('.ping-update-btn').onclick = reloadNow;
  bar.querySelector('.ping-update-close').onclick = () => { dismissed = latest; hideBar(); };
  document.body.appendChild(bar);
}

// Resolves true when a newer version than this page's is live.
export async function checkNow() {
  const version = await fetchVersion();
  if (!version) return false;
  if (!current) { current = version; return false; } // no stamp on this page: start from now
  if (version === current) return false;
  latest = version;
  if (document.hidden && !isBusy()) autoReload();
  else showBar();
  return true;
}

export function startUpdateWatcher() {
  checkNow();
  setInterval(() => { checkNow(); }, CHECK_EVERY);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { checkNow(); return; }
    // Leaving the tab with an update waiting: reload now, so the member comes
    // back to the new version instead of watching it reload.
    if (latest && latest !== current && !isBusy()) autoReload();
  });
  window.addEventListener('online', () => { checkNow(); });
}
