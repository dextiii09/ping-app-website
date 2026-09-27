// Ping - a creator's public media kit at pingapp.site/@handle. Anyone can
// open it without an account. It shows only what public_media_kit() returns
// (supabase/media_kit.sql): part of the profile, never email, rates or
// chats, and only while the creator has their public link switched on.
import { supabase } from '../supabaseClient.js';
import { escapeHtml, isPlaceholderAvatar, initialsAvatar } from '../domUtils.js';
import { NICHE_TAGS } from '../mockData.js';
import { talentMeta, talentTypeOf, talentHighlights, talentLinks, portfolioOf } from '../talentTypes.js';
import { audienceOf, statsNote, instagramUrl, youtubeUrl, firstName } from '../profileKit.js';
import { embedFor, embedCardHtml, bindEmbeds } from '../embeds.js';
import { calendarHtml } from '../availability.js';
import { dateOnlyMs } from '../campaignUtils.js';

const MARK = '<svg class="lp-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#E6FF1A"/><path d="M37 7 15 36h15l-4 21 23-31H34l3-19Z" fill="#0A0A0A"/></svg>';

function shell(inner) {
  return `
    <div class="pk">
      <header class="pk-top">
        <a href="/" class="pk-brand" aria-label="Ping home">${MARK}<span>Ping</span></a>
        <a href="/#join-creator" class="pk-top-cta">Make your own media kit</a>
      </header>
      <main class="pk-main">${inner}</main>
      <footer class="pk-foot">
        <span>Media kit on Ping</span>
        <nav><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></nav>
      </footer>
    </div>`;
}

// The RPC's JSON in the shape the shared profile helpers expect.
function toUser(d) {
  return {
    role: 'INFLUENCER',
    name: String(d.name || ''),
    company: String(d.company || ''),
    avatar: isPlaceholderAvatar(d.avatar) ? initialsAvatar(d.name) : d.avatar,
    location: String(d.location || ''),
    bio: String(d.bio || ''),
    tags: Array.isArray(d.tags) ? d.tags : [],
    verified: !!d.verified,
    talentType: d.talentType,
    talentDetails: d.talentDetails || {},
    socials: d.socials || {},
    socialStats: d.socialStats || {},
    portfolio: Array.isArray(d.portfolio) ? d.portfolio : [],
    handle: d.handle
  };
}

function kitHtml(u, busy) {
  const type = talentTypeOf(u);
  const meta = talentMeta(type);
  const name = escapeHtml(u.name);
  const first = escapeHtml(firstName(u.name) || u.name);
  const niches = u.tags.filter((t) => NICHE_TAGS.includes(t));
  const aud = audienceOf(u);
  const highlights = type === 'INFLUENCER' ? [] : talentHighlights(u);
  const photos = portfolioOf(u).filter((w) => w.image).slice(0, 6);
  const links = talentLinks(u);
  const players = links.filter((l) => embedFor(l.url));
  const plain = links.filter((l) => !embedFor(l.url));
  const ig = instagramUrl(u.socials.instagram);
  const yt = youtubeUrl(u.socials.youtube);
  const socialLink = (href, icon, label) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><i class="ph-fill ${icon}"></i>${label}<i class="ph-bold ph-arrow-up-right"></i></a>`;

  return `
    <section class="pk-hero">
      <img class="pk-avatar" src="${escapeHtml(u.avatar)}" alt="${name}">
      <div class="pk-id">
        <p class="pk-kicker"><i class="ph-fill ${meta.icon}"></i>${escapeHtml(meta.label)} · Media kit</p>
        <h1>${name}${u.verified ? ' <i class="ph-fill ph-seal-check pk-tick" title="Verified by Ping: the team checked this profile and its links"></i>' : ''}</h1>
        <p class="pk-meta">
          ${u.location ? `<span><i class="ph-fill ph-map-pin"></i>${escapeHtml(u.location)}</span>` : ''}
          ${u.company ? `<span>${escapeHtml(u.company)}</span>` : ''}
          ${u.verified ? '<span class="pk-verified">Verified by Ping</span>' : ''}
        </p>
        ${niches.length ? `<div class="pk-tags">${niches.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${ig || yt ? `<div class="pk-socials">${ig ? socialLink(ig, 'ph-instagram-logo', 'Instagram') : ''}${yt ? socialLink(yt, 'ph-youtube-logo', 'YouTube') : ''}</div>` : ''}
      </div>
    </section>

    ${u.bio ? `<p class="pk-bio">${escapeHtml(u.bio)}</p>` : ''}

    ${aud.length ? `
      <section class="pk-section">
        <h2 class="pk-h">Audience</h2>
        <div class="pk-stats">${aud.map((a) => `<div><b>${escapeHtml(a.value)}</b><span>${escapeHtml(a.label)}</span></div>`).join('')}</div>
        <p class="pk-note">${escapeHtml(statsNote(u))}${ig ? ` · <a href="${escapeHtml(ig)}" target="_blank" rel="noopener noreferrer">See the profile on Instagram</a>` : ''}</p>
      </section>` : ''}

    ${highlights.length ? `
      <section class="pk-section">
        <h2 class="pk-h">${escapeHtml(meta.label)} details</h2>
        <div class="pk-stats">${highlights.map((h) => `<div><b>${escapeHtml(h.value)}</b><span>${escapeHtml(h.label)}</span></div>`).join('')}</div>
      </section>` : ''}

    ${photos.length ? `
      <section class="pk-section">
        <h2 class="pk-h">Work</h2>
        <div class="pk-gallery">${photos.map((p) => `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.label || `Work by ${u.name}`)}" loading="lazy"></a>`).join('')}</div>
      </section>` : ''}

    ${players.length || plain.length ? `
      <section class="pk-section">
        <h2 class="pk-h">${players.length ? 'Watch &amp; listen' : 'Links'}</h2>
        ${players.length ? `<div class="pk-players">${players.map(embedCardHtml).join('')}</div>` : ''}
        ${plain.length ? `<div class="pk-links">${plain.map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}<i class="ph-bold ph-arrow-up-right"></i></a>`).join('')}</div>` : ''}
      </section>` : ''}

    <section class="pk-section">
      <h2 class="pk-h">Availability</h2>
      <p class="pk-note pk-note-top">Days ${first} is booked or unavailable, as marked on Ping.</p>
      ${calendarHtml(busy, { busyOnly: true })}
    </section>

    <section class="pk-cta">
      <h2>Want to work with <em>${first}</em>?</h2>
      <p>Post a campaign with a fixed fee on Ping. Local creators like ${first} apply, you Connect with the ones you want, and the chat opens straight away. Free during the pilot.</p>
      <div class="pk-cta-actions">
        <a class="pk-btn" href="/#join-brand">Post a campaign</a>
        <a class="pk-btn is-ghost" href="/#join-creator">I'm a creator</a>
      </div>
    </section>`;
}

function missingHtml(handle) {
  return `
    <section class="pk-missing">
      <p class="pk-kicker">Media kit</p>
      <h1>Nothing <em>here</em></h1>
      <p>There's no public media kit at ${escapeHtml(window.location.host)}/@${escapeHtml(handle)}. It may have been renamed or made private.</p>
      <a class="pk-btn" href="/">Go to Ping</a>
    </section>`;
}

function setMeta(selector, attr, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

export async function renderPublicKit(root, handle) {
  root.innerHTML = shell('<div class="pk-loading" role="status" aria-label="Loading media kit"><span></span></div>');
  const main = root.querySelector('.pk-main');
  bindEmbeds(main);

  let data = null;
  try {
    const { data: kit, error } = await supabase.rpc('public_media_kit', { p_handle: handle });
    if (error) throw error;
    data = kit;
  } catch (err) {
    console.error('Public media kit failed to load:', err);
    main.innerHTML = `
      <section class="pk-missing">
        <p class="pk-kicker">Media kit</p>
        <h1>Couldn't <em>load</em></h1>
        <p>Check your connection and try again.</p>
        <button type="button" class="pk-btn" data-retry>Try again</button>
      </section>`;
    main.querySelector('[data-retry]').onclick = () => renderPublicKit(root, handle);
    return;
  }

  if (!data) {
    document.title = 'Media kit not found · Ping';
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute('content', 'noindex');
    main.innerHTML = missingHtml(handle);
    return;
  }

  const u = toUser(data);
  const busy = (Array.isArray(data.busy) ? data.busy : [])
    .map((w) => ({ start: dateOnlyMs(w.start), end: dateOnlyMs(w.end), kind: 'busy' }))
    .filter((w) => w.start && w.end);
  const url = `${window.location.origin}/@${u.handle || handle}`;
  document.title = `${u.name} · Media kit on Ping`;
  setMeta('link[rel="canonical"]', 'href', url);
  setMeta('meta[property="og:url"]', 'content', url);
  setMeta('meta[name="description"]', 'content', `${u.name}'s media kit on Ping: ${talentMeta(talentTypeOf(u)).label.toLowerCase()}${u.location ? ` in ${u.location}` : ''}.`);
  main.innerHTML = kitHtml(u, busy);
}
