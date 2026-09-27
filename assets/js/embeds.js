// Ping - click-to-play players for show reels, mixes and tracks (YouTube,
// SoundCloud, Spotify, Mixcloud). Nothing from those sites loads until the
// visitor presses play, so a profile stays fast and private by default.
import { escapeHtml } from './domUtils.js';
import { safeUrl } from './talentTypes.js';

// The embeddable player for a link, or null when it isn't one of ours.
export function embedFor(url) {
  const u = safeUrl(url);
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/i);
  if (m) return { provider: 'YouTube', icon: 'ph-youtube-logo', size: 'video', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` };
  if (/^https:\/\/(www\.|m\.)?soundcloud\.com\/[^/?#]+\/[^/?#]+/i.test(u)) {
    return { provider: 'SoundCloud', icon: 'ph-soundcloud-logo', size: 'audio', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23e6ff1a&visual=false&show_comments=false&show_teaser=false` };
  }
  m = u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,30})/i);
  if (m) return { provider: 'Spotify', icon: 'ph-spotify-logo', size: m[1] === 'track' || m[1] === 'episode' ? 'audio-sm' : 'audio', src: `https://open.spotify.com/embed/${m[1]}/${m[2]}` };
  m = u.match(/mixcloud\.com(\/[^/?#]+\/[^/?#]+\/?)/i);
  if (m) return { provider: 'Mixcloud', icon: 'ph-waveform', size: 'audio-sm', src: `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&feed=${encodeURIComponent(m[1])}` };
  return null;
}

// A play card for one link ({ label, url }); swaps to the real player on click.
export function embedCardHtml(link) {
  const e = embedFor(link.url);
  if (!e) return '';
  const label = escapeHtml(link.label || e.provider);
  return `
    <div class="pk-embed is-${e.size}" data-embed-src="${escapeHtml(e.src)}" data-embed-title="${label} on ${e.provider}">
      <button type="button" class="pk-embed-play" aria-label="Play ${label} on ${e.provider}">
        <span class="pk-embed-btn"><i class="ph-fill ph-play"></i></span>
        <span class="pk-embed-text"><b>${label}</b><em><i class="ph-fill ${e.icon}"></i> ${e.provider}</em></span>
      </button>
      <a class="pk-embed-open" href="${escapeHtml(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer" aria-label="Open on ${e.provider}"><i class="ph-bold ph-arrow-up-right"></i></a>
    </div>`;
}

// One delegated listener per container: pressing play loads that player.
export function bindEmbeds(root) {
  if (!root || root.dataset.embedsBound) return;
  root.dataset.embedsBound = '1';
  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.pk-embed-play');
    if (!btn || !root.contains(btn)) return;
    const card = btn.closest('.pk-embed');
    const frame = document.createElement('iframe');
    frame.src = card.getAttribute('data-embed-src');
    frame.title = card.getAttribute('data-embed-title') || 'Player';
    frame.loading = 'lazy';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; clipboard-write';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    card.classList.add('is-playing');
    card.innerHTML = '';
    card.appendChild(frame);
  });
}
