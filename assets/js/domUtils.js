// Escapes user-controlled text before it is interpolated into an innerHTML
// template string. Firestore rules validate field TYPE and length, not
// content, so any string field a user can write (name, bio, tags, messages,
// brief text, company, etc.) can contain arbitrary HTML/script unless every
// render site escapes it here first.
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

// Members without a photo get their initials on a Ping-coloured tile rather
// than a stock photo of a real person. Older accounts were created with this
// one stock photo as a default, so it's treated as "no photo" too.
export const LEGACY_DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

export function isPlaceholderAvatar(src) {
  return !src || src === LEGACY_DEFAULT_AVATAR || String(src).startsWith('data:image/svg+xml');
}

export function initialsAvatar(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((w) => Array.from(w)[0]).join('').toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#1c1c1a"/><text x="60" y="60" dy="0.35em" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="600" fill="#E6FF1A">${escapeHtml(initials)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
