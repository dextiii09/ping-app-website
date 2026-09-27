// Ping - profile cards shared across views:
//  - applicantCardHtml: how a creator appears to a brand in the Connect list
//    (also the creator's own "Preview as brand" in the Media Kit);
//  - brandProfileHtml: a brand's profile as talent sees it (also the brand's
//    own "Preview as creator").
import { escapeHtml } from '../domUtils.js';
import { talentTypeOf, talentHighlights, talentLinks, portfolioOf, talentBadge, safeUrl } from '../talentTypes.js';
import { timeAgo, formatWindow } from '../campaignUtils.js';
import { statsNote, instagramUrl } from '../profileKit.js';
import { embedFor, embedCardHtml } from '../embeds.js';
import { rangeLabel } from '../availability.js';

export function applicantCardHtml(p, { pitch = '', createdAt = 0, armed = false, busy = null, preview = false } = {}) {
  const type = talentTypeOf(p) || 'INFLUENCER';
  const stats = talentHighlights(p);
  const photos = portfolioOf(p).filter((w) => w.image).slice(0, 3);
  const links = talentLinks(p).slice(0, 4);
  const players = links.filter((l) => embedFor(l.url));
  const plain = links.filter((l) => !embedFor(l.url));
  const ig = instagramUrl(p.socials?.instagram);
  const name = escapeHtml(p.name);
  const when = createdAt ? `Applied ${timeAgo(createdAt)}` : '';
  return `
    <li class="cm-applicant${preview ? ' is-preview' : ''}" data-creator="${escapeHtml(p.id)}">
      <div class="cm-applicant-head">
        <img class="cm-applicant-av" src="${escapeHtml(p.avatar)}" alt="">
        <div class="cm-applicant-id">
          <h3>${name}${p.verified ? ' <i class="ph-fill ph-seal-check" title="Verified by Ping: the team checked this profile and its links"></i>' : ''}</h3>
          <div class="cm-applicant-meta">
            ${talentBadge(type)}
            <span><i class="ph-fill ph-map-pin"></i> ${escapeHtml(p.location || 'Location not set')}</span>
            ${when ? `<span class="cm-applicant-when">${escapeHtml(when)}</span>` : ''}
            ${p.isDemo ? '<span class="cm-demo">Demo</span>' : ''}
          </div>
        </div>
      </div>
      ${busy ? `<p class="cm-busy is-${busy.kind}"><i class="ph-fill ph-calendar-x"></i>${busy.kind === 'booked' ? 'Booked on your dates' : 'Marked unavailable on your dates'} · ${escapeHtml(rangeLabel(busy))}</p>` : ''}
      ${stats.length ? `<div class="cm-app-stats">${stats.map((st) => `<div><b>${escapeHtml(st.value)}</b><span>${escapeHtml(st.label)}</span></div>`).join('')}</div>` : ''}
      ${type === 'INFLUENCER' && stats.length ? `<p class="cm-app-note">${escapeHtml(statsNote(p))}${ig ? ` · <a href="${escapeHtml(ig)}" target="_blank" rel="noopener noreferrer">Instagram <i class="ph-bold ph-arrow-up-right"></i></a>` : ''}</p>` : ''}
      <div class="cm-app-pitch${pitch ? '' : ' is-empty'}">
        <span>Pitch note</span>
        <p>${pitch ? escapeHtml(pitch) : 'No note. They applied with their profile.'}</p>
      </div>
      ${photos.length ? `<div class="cm-app-work">${photos.map((w) => `<a href="${escapeHtml(w.url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(w.url)}" alt="${escapeHtml(w.label || 'Past work')}" loading="lazy"></a>`).join('')}</div>` : ''}
      ${players.length ? `<div class="cm-app-players">${players.map(embedCardHtml).join('')}</div>` : ''}
      ${plain.length ? `<div class="cm-app-links">${plain.map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer"><i class="ph-bold ph-arrow-up-right"></i>${escapeHtml(l.label)}</a>`).join('')}</div>` : ''}
      ${!photos.length && !links.length && p.bio ? `<p class="cm-app-bio">${escapeHtml(p.bio)}</p>` : ''}
      <div class="cm-applicant-actions">
        <button type="button" class="btn-glass cm-pass${armed ? ' is-armed' : ''}" data-cm="pass" data-id="${escapeHtml(p.id)}" aria-label="${armed ? `Tap again to pass on ${name}` : `Pass on ${name}`}"${preview ? ' disabled' : ''}>${armed ? 'Tap again to pass' : 'Pass'}</button>
        <button type="button" class="btn-gold cm-connect" data-cm="connect" data-id="${escapeHtml(p.id)}" aria-label="Connect with ${name}"${preview ? ' disabled' : ''}><i class="ph-bold ph-user-plus"></i> Connect</button>
      </div>
    </li>`;
}

// `applyButton(campaign)` returns the action for each open campaign (or '').
export function brandProfileHtml(b, { campaigns = [], applyButton = null } = {}) {
  const site = safeUrl(b.website);
  const siteLabel = site ? site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';
  return `
    <div class="bp">
      <div class="bp-head">
        <img class="bp-logo" src="${escapeHtml(b.avatar)}" alt="">
        <div>
          <h2>${escapeHtml(b.company || b.name)}${b.verified ? ' <i class="ph-fill ph-seal-check" title="Verified by Ping"></i>' : ''}</h2>
          <p>${[b.industry, b.location].filter(Boolean).map(escapeHtml).join(' · ') || 'Local business'}</p>
        </div>
      </div>
      <p class="bp-about${b.bio ? '' : ' is-empty'}">${b.bio ? escapeHtml(b.bio) : 'No description yet.'}</p>
      <div class="bp-facts">
        ${b.companySize ? `<span><i class="ph-bold ph-users"></i>${escapeHtml(b.companySize)}</span>` : ''}
        ${site ? `<a href="${escapeHtml(site)}" target="_blank" rel="noopener noreferrer"><i class="ph-bold ph-globe"></i>${escapeHtml(siteLabel)}</a>` : ''}
        ${b.company && b.name && b.company !== b.name ? `<span><i class="ph-bold ph-user"></i>${escapeHtml(b.name)}</span>` : ''}
      </div>
      <h3 class="bp-sub">Open campaigns <b>${campaigns.length}</b></h3>
      ${campaigns.length ? `<ul class="bp-campaigns">${campaigns.map((c) => `
        <li>
          <div><b>${escapeHtml(c.title)}</b><span>${escapeHtml(c.budget)} fixed · ${escapeHtml(formatWindow(c))}</span></div>
          ${applyButton ? applyButton(c) : ''}
        </li>`).join('')}</ul>` : '<p class="bp-empty">No open campaigns right now.</p>'}
    </div>`;
}
