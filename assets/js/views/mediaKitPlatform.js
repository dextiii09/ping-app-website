// Ping Platform - Media Kit (creators) and Brand profile (brands).
// Edit on one tab, see exactly what the other side sees on the other. Also:
// a completeness checklist, a public link (pingapp.site/@handle), availability,
// photos of past work, audience numbers labelled as self-reported, and a
// save bar that appears as soon as something changes.
import { store } from '../state.js';
import { NICHE_TAGS } from '../mockData.js';
import { aiService } from '../aiService.js';
import { detectLocation } from '../geoService.js';
import { escapeHtml } from '../domUtils.js';
import { displayPingScore } from '../pingScoreService.js';
import { initCustomSelects } from '../customSelect.js';
import { TALENT_TYPES, talentMeta, talentTypeOf, talentHighlights, talentLinks, portfolioOf, talentBadge, safeUrl } from '../talentTypes.js';
import { campaignStatus, toDateInput, dateOnlyMs, startOfDay, briefWindow } from '../campaignUtils.js';
import { audienceOf, statsNote, completeness } from '../profileKit.js';
import { blockedWindows, upcoming, calendarHtml, rangeLabel } from '../availability.js';
import { bindEmbeds } from '../embeds.js';
import { applicantCardHtml, brandProfileHtml } from './profileCards.js';

const MAX_PHOTOS = 6;
const MAX_LINKS = 4;
const RESERVED = ['admin', 'administrator', 'ping', 'pingapp', 'support', 'help', 'team', 'official', 'login', 'signup', 'join', 'about', 'privacy', 'terms', 'api', 'www', 'mail', 'root', 'null', 'undefined'];

const INDUSTRIES = ['Food & Beverage', 'Fashion & Apparel', 'Fitness & Health', 'Beauty & Wellness', 'Tech', 'Lifestyle', 'Events'];
const TEAM_SIZES = ['1-5 employees', '5-10 employees', '10-20 employees', '20-50 employees', '50+ employees'];
const BUDGETS = ['₹10,000 - ₹50,000', '₹50,000 - ₹2,00,000', 'Enterprise (₹2,00,000+)'];

// Empty or zero audience figures mean "not added", not a real zero.
const cleanStat = (v) => (v && v !== '0' && v !== '0%' ? v : '');

// A dropdown that keeps the saved value (even an older one that's no longer
// in the list) and says "Choose…" until something is picked, so saving never
// quietly fills in the first option.
function optionsHtml(list, current) {
  const opts = current && !list.includes(current) ? [current, ...list] : list;
  return `${current ? '' : '<option value="" selected>Choose…</option>'}${opts.map(o => `<option value="${escapeHtml(o)}"${o === current ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}`;
}

function handleProblem(h) {
  if (!h) return 'Choose your link name first.';
  if (!/^[a-z0-9._]{3,30}$/.test(h)) return 'Use 3–30 letters, numbers, dots or underscores.';
  if (/^[._]|[._]$/.test(h)) return "Your link can't start or end with a dot or underscore.";
  if (RESERVED.includes(h)) return 'That link name is reserved. Try another.';
  return '';
}

export function renderMediaKitPlatform(container, onShowToast) {
  let user = store.currentUser;
  const mountId = container.dataset.mount;
  let mode = 'edit';
  let dirty = false;
  let isGeneratingBio = false;
  let draftDetails = {};   // type-specific details, kept across talent-type switches
  let draftPhotos = [];    // [{ label, url, photo: true }]
  let draftBlocked = [];   // [{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }]
  let uploading = 0;
  let epoch = 0;                  // bumped on every redraw; older uploads are dropped
  const uploadedNow = new Set();  // photos uploaded since the last save
  const removedSaved = new Set(); // saved photos removed in this edit

  const isCreator = () => user.role === 'INFLUENCER';

  // ─── Small templates ───────────────────────────────────────────────────

  function talentFieldsHtml(type, details) {
    const meta = talentMeta(type);
    if (!meta.fields.length) {
      return '<p class="mk-section-help">Influencers show their reach with the audience numbers below.</p>';
    }
    return `<div class="mk-talent-grid">${meta.fields.map(f => `
      <div>
        <label for="mkTd_${f.key}">${escapeHtml(f.label)}</label>
        <input type="text" inputmode="${f.url ? 'url' : 'text'}" id="mkTd_${f.key}" data-td="${f.key}" data-td-url="${f.url ? '1' : ''}" value="${escapeHtml(details[f.key] || '')}" placeholder="${escapeHtml(f.placeholder)}" maxlength="${f.url ? 300 : 80}">
      </div>`).join('')}</div>`;
  }

  const VERIFY = {
    VERIFIED: { label: 'Verified by Ping', text: 'The Ping team checked your profile and links.', icon: 'ph-seal-check', action: '' },
    PENDING: { label: 'Verification requested', text: 'The Ping team is reviewing your profile.', icon: 'ph-hourglass', action: '' },
    REJECTED: { label: 'Not verified yet', text: 'Add more detail, like your links and socials, then ask again.', icon: 'ph-seal', action: 'Ask again' },
    UNVERIFIED: { label: 'Get verified', text: 'The Ping team checks your profile and links, then adds the verified badge.', icon: 'ph-seal', action: 'Request' }
  };

  function verificationPanel(u) {
    const v = VERIFY[u.verified ? 'VERIFIED' : u.verificationStatus] || VERIFY.UNVERIFIED;
    const key = u.verified ? 'verified' : String(u.verificationStatus || 'unverified').toLowerCase();
    return `
      <div class="mk-verify is-${key}">
        <i class="ph-fill ${v.icon}"></i>
        <div><b>${v.label}</b><span>${v.text}</span></div>
        ${v.action ? `<button type="button" class="btn-glass" id="mkRequestVerify">${v.action}</button>` : ''}
      </div>`;
  }

  // Something the Ping team can actually check: a bio plus a link or handle.
  function hasSomethingToVerify(u) {
    const links = [u.socials?.instagram, u.socials?.youtube, u.website, ...portfolioOf(u).map(p => p.url)];
    const detailLinks = Object.values(u.talentDetails || {}).filter(v => /^https?:\/\//i.test(String(v || '')));
    return !!String(u.bio || '').trim() && (links.some(Boolean) || detailLinks.length > 0);
  }

  function progressHtml() {
    const { percent, items } = completeness(user);
    const missing = items.filter(i => !i.done);
    const what = isCreator() ? 'media kit' : 'profile';
    return `
      <div class="mk-progress-top">
        <div class="mk-ring" style="--p:${percent}"><span>${percent}%</span></div>
        <div class="mk-progress-text">
          <b>${percent === 100 ? `Your ${what} is complete` : `Your ${what} is ${percent}% done`}</b>
          <span>${percent === 100 ? (isCreator() ? 'Brands see everything they need.' : 'Creators see everything they need.') : (isCreator() ? 'Complete media kits get more Connects.' : 'A complete profile helps creators trust your campaigns.')}</span>
        </div>
      </div>
      ${missing.length ? `<div class="mk-todo">${missing.map(i => `<button type="button" class="mk-todo-item" data-jump="${i.target}"><i class="ph-bold ph-plus"></i>${escapeHtml(i.label)}</button>`).join('')}</div>` : ''}`;
  }

  function previewHtml() {
    if (isCreator()) {
      return `
        <p class="mk-preview-note"><i class="ph-fill ph-info"></i><span>This is the card brands see in their list when you apply to a campaign.${dirty ? ' <b>Save your changes to see them here.</b>' : ''}</span></p>
        <ul class="cm-apps">${applicantCardHtml(user, { pitch: 'Your pitch note for the campaign shows here.', createdAt: Date.now(), preview: true })}</ul>
        ${user.publicKit && user.handle ? `<p class="mk-preview-note"><i class="ph-fill ph-link"></i><span>Your public media kit: <a href="/@${escapeHtml(user.handle)}" target="_blank" rel="noopener">${escapeHtml(window.location.host)}/@${escapeHtml(user.handle)}</a></span></p>` : ''}`;
    }
    const open = store.getMyCampaigns().filter(b => campaignStatus(b) === 'OPEN');
    return `
      <p class="mk-preview-note"><i class="ph-fill ph-info"></i><span>This is what creators see when they tap your name on a campaign.${dirty ? ' <b>Save your changes to see them here.</b>' : ''}</span></p>
      <div class="glass-box mk-preview-brand">${brandProfileHtml(user, { campaigns: open })}</div>`;
  }

  function workRowHtml(item = {}) {
    return `
      <div class="mk-work-row">
        <input type="text" class="mk-work-label" value="${escapeHtml(item.label || '')}" placeholder="What it was, e.g. Café launch reel" maxlength="60" aria-label="Link title">
        <input type="text" inputmode="url" class="mk-work-url" value="${escapeHtml(item.url || '')}" placeholder="https://…" maxlength="300" aria-label="Link">
        <button type="button" class="mk-work-del" aria-label="Remove link"><i class="ph-bold ph-x"></i></button>
      </div>`;
  }

  function photosHtml() {
    const tiles = draftPhotos.map((p, i) => `
      <div class="mk-photo">
        <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.label || 'Photo of past work')}" loading="lazy">
        <button type="button" class="mk-photo-del" data-photo="${i}" aria-label="Remove photo"><i class="ph-bold ph-x"></i></button>
      </div>`).join('');
    const busyTiles = '<div class="mk-photo is-loading"><i class="ph-bold ph-spinner ph-spin"></i></div>'.repeat(Math.max(0, uploading));
    const room = MAX_PHOTOS - draftPhotos.length - uploading;
    return `${tiles}${busyTiles}${room > 0 ? `
      <label class="mk-photo-add">
        <i class="ph-bold ph-image-square"></i><span>Add photo</span>
        <input type="file" id="mkPhotoInput" class="mk-file" accept="image/jpeg,image/png,image/webp" multiple>
      </label>` : ''}`;
  }

  function myBookedWindows() {
    return store.getMyApplications()
      .filter(a => a.status === 'SELECTED' && a.brief)
      .map((a) => { const [start, end] = briefWindow(a.brief); return { start, end, kind: 'booked' }; });
  }

  function availabilityHtml() {
    const windows = [...myBookedWindows(), ...blockedWindows(draftBlocked)];
    const blocked = upcoming(blockedWindows(draftBlocked));
    const booked = upcoming(myBookedWindows());
    return `
      ${calendarHtml(windows)}
      ${booked.length ? `<p class="mk-card-help">Booked: ${booked.map(w => escapeHtml(rangeLabel(w))).join(', ')}</p>` : ''}
      <div class="mk-block-form">
        <label>From<input type="date" id="mkBlockFrom" min="${toDateInput(Date.now())}"></label>
        <label>To<input type="date" id="mkBlockTo" min="${toDateInput(Date.now())}"></label>
        <button type="button" class="btn-glass" id="mkBlockAdd"><i class="ph-bold ph-prohibit"></i> Mark unavailable</button>
      </div>
      ${blocked.length ? `<ul class="mk-blocked">${blocked.map(w => `
        <li><span><i class="ph-bold ph-prohibit"></i>${escapeHtml(rangeLabel(w))}</span><button type="button" class="mk-blocked-del" data-unblock="${toDateInput(w.start)}|${toDateInput(w.end)}" aria-label="Remove ${escapeHtml(rangeLabel(w))}"><i class="ph-bold ph-x"></i></button></li>`).join('')}</ul>` : ''}`;
  }

  function audienceHtml() {
    const aud = audienceOf(user);
    return `
      <div class="mk-card-head"><h3><i class="ph-fill ph-users-three"></i> Audience</h3><span class="mk-selfrep">${escapeHtml(statsNote(user))}</span></div>
      ${aud.length ? `<ul class="mk-aud">${aud.map(a => `
        <li><span><i class="ph-fill ${a.icon}"></i>${escapeHtml(a.label)}</span>${a.href
          ? `<a href="${escapeHtml(a.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.value)} <i class="ph-bold ph-arrow-up-right"></i></a>`
          : `<b>${escapeHtml(a.value)}</b>`}</li>`).join('')}</ul>`
        : '<p class="mk-card-help">Add your numbers in the form so brands can see your reach.</p>'}`;
  }

  // ─── The page ──────────────────────────────────────────────────────────

  function render() {
    // An upload or save that finishes after the member has left this screen
    // must not redraw it over the screen they're on now.
    if (container.dataset.mount !== mountId) return;
    user = store.currentUser;
    const creator = isCreator();
    const talentType = creator ? talentTypeOf(user) : null;
    const highlights = creator ? talentHighlights(user) : [];
    const typeLinks = creator ? talentLinks(user).filter(l => !portfolioOf(user).some(p => p.url === l.url)) : [];
    const myPingScore = displayPingScore(user, { activeDeals: store.getMatchesForCurrentUser().length });
    draftDetails = { ...(user.talentDetails || {}) };
    draftPhotos = portfolioOf(user).filter(w => w.image).map(w => ({ label: w.label, url: w.url, photo: true }));
    draftBlocked = (user.blockedDates || []).filter(b => dateOnlyMs(b && b.to) >= startOfDay(Date.now())).map(b => ({ from: b.from, to: b.to }));
    uploading = 0;
    epoch += 1;
    const links = portfolioOf(user).filter(w => !w.image);
    const s = user.socialStats || {};
    const handle = user.handle || '';

    container.innerHTML = `
      <div class="section-header mk-head">
        <div>
          <h1 class="section-title">${creator ? 'Your media <em>kit</em>' : 'Your brand <em>profile</em>'}</h1>
          <p class="section-subtitle">${creator ? 'This is what brands see when you apply. Keep it up to date.' : 'This is what creators see when they look at your campaigns.'}</p>
        </div>
        ${creator ? `
          <div class="mk-head-actions">
            ${user.publicKit && handle ? '<button type="button" class="btn-glass" data-copy-link><i class="ph-bold ph-link"></i> Copy link</button>' : ''}
            <button type="button" class="btn-gold" id="btnExportMediaKit"><i class="ph-bold ph-printer"></i> Print / PDF</button>
          </div>` : ''}
      </div>

      <div class="glass-box mk-progress" id="mkProgress">${progressHtml()}</div>

      <div class="mk-modes" role="tablist" aria-label="Edit or preview">
        <button type="button" role="tab" class="mk-mode${mode === 'edit' ? ' is-on' : ''}" data-mode="edit" aria-selected="${mode === 'edit'}"><i class="ph-bold ph-pencil-simple"></i> Edit</button>
        <button type="button" role="tab" class="mk-mode${mode === 'preview' ? ' is-on' : ''}" data-mode="preview" aria-selected="${mode === 'preview'}"><i class="ph-bold ph-eye"></i> ${creator ? 'Preview as a brand' : 'Preview as a creator'}</button>
      </div>

      <div class="mk-preview" id="mkPreview"${mode === 'preview' ? '' : ' hidden'}>${previewHtml()}</div>

      <div class="media-kit-grid" id="mkEdit"${mode === 'edit' ? '' : ' hidden'}>
        <div class="mk-side">
          <div class="glass-box mk-identity" id="mkIdentity">
            <div class="mk-avatar">
              <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}">
              <label class="mk-avatar-edit" title="${creator ? 'Change photo' : 'Change logo'}">
                <i class="ph-bold ph-camera"></i><span>${creator ? 'Change photo' : 'Change logo'}</span>
                <input type="file" id="mkAvatarInput" accept="image/jpeg,image/png,image/webp" hidden>
              </label>
            </div>
            <div class="mk-name">${escapeHtml(creator ? user.name : (user.company || user.name))}${user.verified ? ' <i class="ph-fill ph-seal-check verified-gold-tick" title="Verified by Ping"></i>' : ''}</div>
            <div class="mk-role">${escapeHtml(creator ? (user.company || user.jobTitle || 'Creator') : (user.industry || 'Local business'))}</div>
            <div class="mk-loc"><i class="ph-fill ph-map-pin"></i> ${escapeHtml(user.location || 'Location not set')}</div>
            ${creator ? `<div class="mk-type-row">${talentBadge(talentType)}</div>` : ''}
            <div class="mk-score">
              <div><b>PingScore™</b><span>Verification &amp; activity signal</span></div>
              <strong>${myPingScore}</strong>
            </div>
            <div id="mkVerify">${verificationPanel(user)}</div>
            ${creator && talentType !== 'INFLUENCER' ? `
              <div class="mk-highlights">
                <div class="mk-block-title">${escapeHtml(talentMeta(talentType).label)} details</div>
                ${highlights.length
                  ? highlights.map(h => `<div class="mk-hl-row"><span>${escapeHtml(h.label)}</span><strong>${escapeHtml(h.value)}</strong></div>`).join('')
                  : '<p class="mk-hl-empty">Add your details in the form so brands can see them.</p>'}
                ${typeLinks.length ? `<div class="cm-app-links">${typeLinks.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer"><i class="ph-bold ph-arrow-up-right"></i>${escapeHtml(l.label)}</a>`).join('')}</div>` : ''}
              </div>` : ''}
          </div>

          ${creator ? `
            <div class="glass-box mk-card" id="mkPublic">
              <div class="mk-card-head">
                <h3><i class="ph-fill ph-link"></i> Public link</h3>
                <label class="mk-switch" title="Make my media kit public">
                  <input type="checkbox" id="mkPublicToggle"${user.publicKit ? ' checked' : ''}><span aria-hidden="true"></span><em>Public media kit</em>
                </label>
              </div>
              <p class="mk-card-help">One link for your Instagram bio. Anyone can open it, no login needed. It shows your media kit and the days you're busy, never your email, rates or chats.</p>
              <div class="mk-handle"><span>${escapeHtml(window.location.host)}/@</span><input type="text" id="mkHandle" value="${escapeHtml(handle)}" placeholder="yourname" maxlength="30" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Your link name"></div>
              <p class="mk-handle-hint" id="mkHandleHint">3–30 letters, numbers, dots or underscores.</p>
              ${user.publicKit && handle ? `
                <div class="mk-public-actions">
                  <a class="btn-glass" href="/@${escapeHtml(handle)}" target="_blank" rel="noopener"><i class="ph-bold ph-arrow-square-out"></i> View</a>
                  <button type="button" class="btn-glass" data-copy-link><i class="ph-bold ph-copy"></i> Copy link</button>
                </div>` : ''}
            </div>

            <div class="glass-box mk-card" id="mkAvailability">
              <div class="mk-card-head"><h3><i class="ph-fill ph-calendar-dots"></i> Availability</h3></div>
              <p class="mk-card-help">Brands see these days when you apply. Campaigns you're booked for are added automatically.</p>
              <div id="mkAvailBody">${availabilityHtml()}</div>
            </div>

            <div class="glass-box mk-card" id="mkAudience">${audienceHtml()}</div>
          ` : ''}
        </div>

        <div class="mk-main">
          <div class="glass-box mk-card" id="mkAi">
            <div class="mk-ai-head">
              <div class="mk-ai-title">
                <div class="platform-brand-icon"><i class="ph-fill ph-sparkle"></i></div>
                <div>
                  <h3>${creator ? 'Ping AI Bio Studio' : 'Ping AI: write your About'}</h3>
                  <span>${creator ? 'Drafts a bio from your niches. You edit it, then save.' : 'Drafts a short About from your details. You edit it, then save.'}</span>
                </div>
              </div>
              <div class="mk-ai-actions">
                <select id="selectBioTone" aria-label="Tone">
                  <option value="Professional">Professional</option>
                  <option value="Creative">Editorial / Creative</option>
                  <option value="Witty">Streetwise / Witty</option>
                  <option value="Hype">High-Energy / Hype</option>
                </select>
                <button type="button" class="btn-gold" id="btnTriggerAiBio"${isGeneratingBio ? ' disabled' : ''}>
                  ${isGeneratingBio ? '<i class="ph-bold ph-spinner ph-spin"></i> Writing…' : '<i class="ph-fill ph-magic-wand"></i> Write it for me'}
                </button>
              </div>
            </div>
          </div>

          <form id="formEditProfile" class="glass-box mk-card mk-form" novalidate>
            <h3 class="mk-form-title">${creator ? 'Profile' : 'Business details'}</h3>

            <div class="app-cols mk-cols">
              <div>
                <label for="inputProfName">${creator ? 'Display name' : 'Your name'}</label>
                <input type="text" id="inputProfName" value="${escapeHtml(user.name || '')}" maxlength="120" required>
              </div>
              <div>
                <label for="inputProfCompany">${creator ? 'Creator studio / brand' : 'Business name'}</label>
                <input type="text" id="inputProfCompany" value="${escapeHtml(user.company || '')}" maxlength="120">
              </div>
            </div>

            <div class="app-cols mk-cols">
              <div>
                <label for="inputProfLocation">Location</label>
                <div class="mk-loc-row">
                  <input type="text" id="inputProfLocation" value="${escapeHtml(user.location || '')}" maxlength="200">
                  <button type="button" id="btnDetectProfLocation" class="btn-glass" title="Use my current location" aria-label="Use my current location"><i class="ph-fill ph-map-pin"></i></button>
                </div>
                <div id="profLocationStatus" class="mk-status"></div>
              </div>
              <div id="mkNiches">
                <label>Niches <span class="mk-opt">(up to 3)</span></label>
                <input type="hidden" id="inputProfTags" value="${escapeHtml((user.tags || []).filter(t => NICHE_TAGS.includes(t)).join(', '))}">
                <div class="mk-niche-chips">
                  ${NICHE_TAGS.map(t => `<button type="button" class="tag-filter-chip mk-niche-chip ${(user.tags || []).includes(t) ? 'active' : ''}" data-niche="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
                </div>
              </div>
            </div>

            <div>
              <label for="inputProfBio">${creator ? 'Bio' : 'About your business'}</label>
              <textarea id="inputProfBio" rows="4" maxlength="1000" placeholder="${creator ? 'Who you are, what you make and who follows you.' : 'What you do, where you are and the kind of creators you like working with.'}">${escapeHtml(user.bio || '')}</textarea>
            </div>

            ${creator ? `
              <div class="mk-section" id="mkWhat">
                <div class="mk-section-title">What you do</div>
                <div class="cm-choice-row" id="mkTalentChips" role="radiogroup" aria-label="Talent type">
                  ${TALENT_TYPES.map(t => `<button type="button" class="cm-choice ${t.id === talentType ? 'is-on' : ''}" role="radio" aria-checked="${t.id === talentType}" data-talent-type="${t.id}"><i class="ph-fill ${t.icon}"></i>${escapeHtml(t.label)}</button>`).join('')}
                </div>
                <p class="mk-section-help">Brands post campaigns for a talent type. You'll see the ones made for yours, plus the ones open to everyone.</p>
                <div id="mkTalentFields">${talentFieldsHtml(talentType, draftDetails)}</div>
              </div>

              <div class="mk-section" id="mkRates"${talentType !== 'INFLUENCER' ? ' hidden' : ''}>
                <div class="mk-section-title">Rate card</div>
                <div class="app-cols mk-cols-3">
                  <div><label for="inputRateReel">Dedicated Reel</label><input type="text" id="inputRateReel" value="${escapeHtml(user.settings?.rateCard?.reel || '')}" placeholder="e.g. ₹8,000" maxlength="40"></div>
                  <div><label for="inputRateStory">Story sequence</label><input type="text" id="inputRateStory" value="${escapeHtml(user.settings?.rateCard?.storySequence || '')}" placeholder="e.g. ₹2,500" maxlength="40"></div>
                  <div><label for="inputRateEvent">Store / event visit</label><input type="text" id="inputRateEvent" value="${escapeHtml(user.settings?.rateCard?.eventAppearance || '')}" placeholder="e.g. ₹15,000" maxlength="40"></div>
                </div>
              </div>

              <div class="mk-section">
                <div class="mk-section-title">Social handles</div>
                <div class="app-cols mk-cols">
                  <div><label for="inputSocialInstagram">Instagram</label><input type="text" id="inputSocialInstagram" value="${escapeHtml(user.socials?.instagram || '')}" placeholder="@handle" maxlength="100" autocapitalize="off" spellcheck="false"></div>
                  <div><label for="inputSocialYoutube">YouTube</label><input type="text" id="inputSocialYoutube" value="${escapeHtml(user.socials?.youtube || '')}" placeholder="@channel or link" maxlength="200" autocapitalize="off" spellcheck="false"></div>
                </div>
              </div>

              <div class="mk-section">
                <div class="mk-section-title">Audience numbers</div>
                <p class="mk-section-help">Self-reported: brands see them marked that way, with the date you last updated them.</p>
                <div class="app-cols mk-cols">
                  <div><label for="inputStatIg">Instagram followers</label><input type="text" id="inputStatIg" value="${escapeHtml(cleanStat(s.instagramFollowers))}" placeholder="e.g. 32K" maxlength="20"></div>
                  <div><label for="inputStatReels">Avg Reel views</label><input type="text" id="inputStatReels" value="${escapeHtml(cleanStat(s.avgReelViews))}" placeholder="e.g. 12K" maxlength="20"></div>
                  <div><label for="inputStatEng">Avg engagement</label><input type="text" id="inputStatEng" value="${escapeHtml(cleanStat(s.avgEngagement))}" placeholder="e.g. 6.8%" maxlength="10"></div>
                  <div><label for="inputStatYt">YouTube subscribers</label><input type="text" id="inputStatYt" value="${escapeHtml(cleanStat(s.youtubeSubscribers))}" placeholder="e.g. 4K" maxlength="20"></div>
                </div>
              </div>

              <div class="mk-section" id="mkWork">
                <div class="mk-section-title">Photos of your work</div>
                <p class="mk-section-help">Up to ${MAX_PHOTOS} photos: shoots, events, sets, shows. They appear on your card and your public link.</p>
                <div class="mk-photos" id="mkPhotos">${photosHtml()}</div>
                <div class="mk-section-title mk-links-title">Links to past work</div>
                <p class="mk-section-help">Up to ${MAX_LINKS} links. YouTube, SoundCloud, Spotify and Mixcloud links play right on your card.</p>
                <div id="mkPortfolio">${links.slice(0, MAX_LINKS).map(w => workRowHtml(w)).join('')}</div>
                <button type="button" class="btn-glass mk-add-work" id="mkAddWork"><i class="ph-bold ph-plus"></i> Add a link</button>
              </div>
            ` : `
              <div class="mk-section">
                <div class="app-cols mk-cols">
                  <div>
                    <label for="inputBizIndustry">Industry</label>
                    <select id="inputBizIndustry">${optionsHtml(INDUSTRIES, user.industry || '')}</select>
                  </div>
                  <div>
                    <label for="inputBizCompanySize">Team size</label>
                    <select id="inputBizCompanySize">${optionsHtml(TEAM_SIZES, user.companySize || '')}</select>
                  </div>
                </div>
                <div class="app-cols mk-cols">
                  <div><label for="inputBizWebsite">Website / Instagram</label><input type="text" id="inputBizWebsite" value="${escapeHtml(user.website || '')}" placeholder="https://..." maxlength="300" inputmode="url"></div>
                  <div>
                    <label for="inputBizBudget">Monthly collaboration budget</label>
                    <select id="inputBizBudget">${optionsHtml(BUDGETS, user.settings?.budgetRange || '')}</select>
                  </div>
                </div>
              </div>
            `}

            <button type="submit" class="btn-gold mk-save-inline">Save changes</button>
          </form>
        </div>
      </div>

      <div class="mk-savebar" id="mkSaveBar" role="region" aria-label="Unsaved changes">
        <span class="mk-savebar-text"><i class="ph-fill ph-circle"></i> Unsaved changes</span>
        <div class="mk-savebar-actions">
          <button type="button" class="btn-glass" id="mkDiscard">Discard</button>
          <button type="button" class="btn-gold" id="mkSave">Save changes</button>
        </div>
      </div>

      ${creator ? printSheetHtml(talentType, highlights, myPingScore) : ''}
    `;

    setDirty(false);
    initCustomSelects(container);
    bindEmbeds(container.querySelector('#mkPreview'));
    bindEvents();
  }

  function printSheetHtml(talentType, highlights, myPingScore) {
    const aud = audienceOf(user);
    const handle = user.publicKit && user.handle ? `${window.location.host}/@${user.handle}` : '';
    return `
      <div class="platform-modal-backdrop" id="modalPrintableMediaKit">
        <div class="platform-modal-window" style="max-width:700px;">
          <button class="platform-modal-close" id="closePrintableModal" aria-label="Close">&times;</button>
          <div class="mk-sheet">
            <div class="mk-sheet-head">
              <div class="mk-sheet-id">
                <img src="${escapeHtml(user.avatar)}" alt="">
                <div>
                  <b>${escapeHtml(user.name)}</b>
                  <span>${escapeHtml(user.company || user.jobTitle || '')}${talentType ? ` · ${escapeHtml(talentMeta(talentType).label)}` : ''}</span>
                  <em>${escapeHtml(user.location || '')}${user.verified ? ' · Verified on Ping' : ''}</em>
                </div>
              </div>
              <div class="mk-sheet-score"><strong>${myPingScore}</strong><span>PingScore™</span></div>
            </div>
            ${user.bio ? `<p class="mk-sheet-bio">${escapeHtml(user.bio)}</p>` : ''}
            ${talentType !== 'INFLUENCER' && highlights.length ? `
              <div class="mk-print-stats">${highlights.map(h => `<div><b>${escapeHtml(h.value)}</b><span>${escapeHtml(h.label)}</span></div>`).join('')}</div>` : ''}
            ${aud.length ? `
              <div class="mk-print-stats">${aud.map(a => `<div><b>${escapeHtml(a.value)}</b><span>${escapeHtml(a.short)}</span></div>`).join('')}</div>
              <p class="mk-sheet-note">${escapeHtml(statsNote(user))}</p>` : ''}
            ${user.settings?.rateCard && Object.values(user.settings.rateCard).some(Boolean) ? `
              <div class="mk-sheet-rates">${[['Reel', user.settings.rateCard.reel], ['Story sequence', user.settings.rateCard.storySequence], ['Store / event visit', user.settings.rateCard.eventAppearance]].filter(r => r[1]).map(r => `<span>${escapeHtml(r[0])} <b>${escapeHtml(r[1])}</b></span>`).join('')}</div>` : ''}
            <div class="mk-sheet-tags">${(user.tags || []).filter(t => NICHE_TAGS.includes(t)).map(t => `<span>#${escapeHtml(t)}</span>`).join('')}</div>
            ${handle ? `<p class="mk-sheet-link">${escapeHtml(handle)}</p>` : ''}
          </div>
          <div class="mk-sheet-actions">
            <button class="btn-gold" id="btnTriggerNativePrint"><i class="ph-bold ph-printer"></i> Print / Save as PDF</button>
          </div>
        </div>
      </div>`;
  }

  // ─── Unsaved changes ───────────────────────────────────────────────────

  function setDirty(value) {
    dirty = value;
    const bar = container.querySelector('#mkSaveBar');
    if (bar) bar.classList.toggle('is-on', value);
    document.body.classList.toggle('mk-dirty', value);
  }

  function onBeforeUnload(e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  }
  window.addEventListener('beforeunload', onBeforeUnload);

  function refreshSummary() {
    const progress = container.querySelector('#mkProgress');
    if (progress) progress.innerHTML = progressHtml();
    const preview = container.querySelector('#mkPreview');
    if (preview) preview.innerHTML = previewHtml();
  }

  function discard() {
    store.removeWorkPhotos([...uploadedNow]);
    uploadedNow.clear();
    removedSaved.clear();
    render();
  }

  // ─── Save ──────────────────────────────────────────────────────────────

  async function save() {
    const btns = container.querySelectorAll('#mkSave, .mk-save-inline');
    if ([...btns].some(b => b.disabled)) return;
    if (uploading) { onShowToast('Wait for your photos to finish uploading.'); return; }
    const q = (sel) => container.querySelector(sel);
    const name = q('#inputProfName').value.trim();
    if (!name) { onShowToast('Add your name first.'); q('#inputProfName').focus(); return; }
    const fields = {
      name,
      company: q('#inputProfCompany').value.trim(),
      location: q('#inputProfLocation').value.trim(),
      tags: q('#inputProfTags').value.split(',').map(t => t.trim()).filter(Boolean),
      bio: q('#inputProfBio').value.trim()
    };

    if (isCreator()) {
      fields.settings = {
        ...(user.settings || {}),
        rateCard: {
          reel: q('#inputRateReel').value.trim(),
          storySequence: q('#inputRateStory').value.trim(),
          eventAppearance: q('#inputRateEvent').value.trim()
        }
      };
      fields.socials = {
        ...(user.socials || {}),
        instagram: q('#inputSocialInstagram').value.trim(),
        youtube: q('#inputSocialYoutube').value.trim()
      };
      // Talent type and its details; links are normalised to https and
      // anything that isn't a web link is refused.
      const chosen = q('#mkTalentChips [data-talent-type].is-on');
      fields.talentType = chosen ? chosen.getAttribute('data-talent-type') : talentTypeOf(user);
      const details = { ...draftDetails };
      let badLink = '';
      container.querySelectorAll('[data-td]').forEach((inp) => {
        const v = inp.value.trim();
        if (inp.getAttribute('data-td-url') && v) {
          const safe = safeUrl(v);
          if (!safe) badLink = v;
          details[inp.getAttribute('data-td')] = safe;
        } else {
          details[inp.getAttribute('data-td')] = v;
        }
      });
      const work = [];
      container.querySelectorAll('.mk-work-row').forEach((row) => {
        const url = row.querySelector('.mk-work-url').value.trim();
        const label = row.querySelector('.mk-work-label').value.trim();
        if (!url && !label) return;
        const safe = safeUrl(url);
        if (!safe) { badLink = url || label; return; }
        work.push({ label: label || 'Past work', url: safe });
      });
      if (badLink) {
        onShowToast(`"${badLink.slice(0, 40)}" doesn't look like a link. Use a full web address like https://…`);
        return;
      }
      fields.talentDetails = details;
      fields.portfolio = [...draftPhotos.slice(0, MAX_PHOTOS), ...work.slice(0, MAX_LINKS)].slice(0, 10);

      const eng = q('#inputStatEng').value.trim();
      const stats = {
        instagramFollowers: q('#inputStatIg').value.trim() || '0',
        avgReelViews: q('#inputStatReels').value.trim() || '0',
        youtubeSubscribers: q('#inputStatYt').value.trim() || '0',
        avgEngagement: eng ? (eng.endsWith('%') ? eng : `${eng}%`) : '0%'
      };
      const old = user.socialStats || {};
      const changed = ['instagramFollowers', 'avgReelViews', 'youtubeSubscribers', 'avgEngagement']
        .some(k => (cleanStat(old[k]) || '') !== (cleanStat(stats[k]) || ''));
      fields.socialStats = { ...old, ...stats, updatedAt: changed ? Date.now() : (old.updatedAt || null) };

      // Public link and availability: only sent when changed.
      const handle = q('#mkHandle').value.trim().toLowerCase();
      const wantPublic = q('#mkPublicToggle').checked;
      if (wantPublic || handle !== (user.handle || '')) {
        const problem = handle ? handleProblem(handle) : (wantPublic ? handleProblem('') : '');
        if (problem) {
          onShowToast(problem);
          q('#mkHandle').focus();
          return;
        }
      }
      if (handle !== (user.handle || '')) fields.handle = handle || null;
      if (wantPublic !== !!user.publicKit) fields.publicKit = wantPublic;
      const blocked = draftBlocked.map(b => ({ from: b.from, to: b.to }));
      const key = (list) => (list || []).map(b => `${b.from}|${b.to}`).join(',');
      if (key(blocked) !== key(user.blockedDates)) fields.blockedDates = blocked;
    } else {
      fields.industry = q('#inputBizIndustry').value;
      fields.companySize = q('#inputBizCompanySize').value;
      fields.website = q('#inputBizWebsite').value.trim();
      if (fields.website && !safeUrl(fields.website)) {
        onShowToast("Your website doesn't look like a link. Use a full web address like https://…");
        return;
      }
      fields.settings = { ...(user.settings || {}), budgetRange: q('#inputBizBudget').value };
    }

    btns.forEach((b) => { b.disabled = true; });
    const saveBtn = q('#mkSave');
    if (saveBtn) saveBtn.textContent = 'Saving…';
    try {
      await store.updateCurrentUserProfile(fields);
      store.removeWorkPhotos([...removedSaved]);
      uploadedNow.clear();
      removedSaved.clear();
      onShowToast(isCreator() ? 'Media kit saved.' : 'Profile saved.');
      render();
    } catch (err) {
      console.error('Profile save failed:', err);
      const msg = String(err?.message || '');
      btns.forEach((b) => { b.disabled = false; });
      if (saveBtn) saveBtn.textContent = 'Save changes';
      if (err?.code === '23505' || /duplicate key/i.test(msg)) {
        onShowToast('That link name is taken. Try another.');
        q('#mkHandle')?.focus();
      } else if (err?.code === '23514' && /handle/i.test(msg)) {
        onShowToast("That link name isn't allowed. Try another.");
        q('#mkHandle')?.focus();
      } else if (err?.code === 'PGRST204' || /handle|public_kit|blocked_dates/i.test(msg)) {
        // The media_kit.sql columns aren't there yet.
        onShowToast("Public links and availability aren't switched on yet, so nothing was saved. Undo those changes to save the rest.");
      } else {
        onShowToast("Couldn't save your changes. Check your connection and try again.");
      }
    }
  }

  // ─── Events ────────────────────────────────────────────────────────────

  function jumpTo(id) {
    if (mode !== 'edit') setMode('edit');
    let el = container.querySelector(`#${id}`);
    if (!el) return;
    // Dropdowns are drawn by customSelect.js; the real <select> is hidden.
    const themed = el.tagName === 'SELECT' && el.closest('.custom-select-wrap');
    if (themed) el = themed.querySelector('.custom-select-trigger');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const isField = el.matches('input, textarea, select, button');
    const handleInput = id === 'mkPublic' && container.querySelector('#mkHandle');
    const focusable = isField ? el
      : handleInput && !handleInput.value ? handleInput
        : el.querySelector('input:not([type="hidden"]):not([type="file"]), textarea, select');
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 350);
    // A short glow around the field (or card) the checklist item points to.
    const box = isField ? (el.closest('.mk-cols > div, .mk-cols-3 > div') || el.parentElement) : el;
    box.classList.remove('mk-flash');
    void box.offsetWidth;
    box.classList.add('mk-flash');
    box.addEventListener('animationend', () => box.classList.remove('mk-flash'), { once: true });
  }

  function setMode(next) {
    mode = next;
    container.querySelectorAll('.mk-mode').forEach((b) => {
      const on = b.getAttribute('data-mode') === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
    container.querySelector('#mkEdit').hidden = mode !== 'edit';
    const preview = container.querySelector('#mkPreview');
    preview.hidden = mode !== 'preview';
    if (mode === 'preview') preview.innerHTML = previewHtml();
  }

  async function addPhotos(files) {
    const room = MAX_PHOTOS - draftPhotos.length - uploading;
    const list = [...files].slice(0, Math.max(0, room));
    if (files.length > list.length) onShowToast(`You can add up to ${MAX_PHOTOS} photos.`);
    if (!list.length) return;
    const myEpoch = epoch;
    uploading += list.length;
    container.querySelector('#mkPhotos').innerHTML = photosHtml();
    for (const file of list) {
      let url = null;
      try {
        url = await store.uploadWorkPhoto(file);
      } catch (err) {
        console.error('Work photo upload failed:', err);
        onShowToast(err?.message && !/fetch|network|storage|bucket|jwt|row-level/i.test(err.message) ? err.message : "Couldn't upload that photo. Please try again.");
      }
      // Left the screen, saved or discarded meanwhile: this photo isn't used.
      if (container.dataset.mount !== mountId || epoch !== myEpoch) {
        if (url) store.removeWorkPhotos([url]);
        continue;
      }
      uploading -= 1;
      if (url) {
        draftPhotos.push({ label: 'Photo', url, photo: true });
        uploadedNow.add(url);
        setDirty(true);
      }
      const g = container.querySelector('#mkPhotos');
      if (g) g.innerHTML = photosHtml();
    }
  }

  function bindEvents() {
    const q = (sel) => container.querySelector(sel);

    // Anything typed in the editor is an unsaved change, except file pickers,
    // the Ping AI tone and unavailable dates that haven't been added yet.
    const edit = q('#mkEdit');
    const markFromEvent = (e) => {
      const t = e.target;
      if (!t.matches || !t.matches('input, textarea, select')) return;
      if (t.type === 'file' || ['mkBlockFrom', 'mkBlockTo', 'selectBioTone'].includes(t.id)) return;
      setDirty(true);
    };
    edit.addEventListener('input', markFromEvent);
    edit.addEventListener('change', markFromEvent);

    container.querySelectorAll('.mk-mode').forEach((b) => { b.onclick = () => setMode(b.getAttribute('data-mode')); });

    q('#mkProgress').onclick = (e) => {
      const item = e.target.closest('[data-jump]');
      if (item) jumpTo(item.getAttribute('data-jump'));
    };

    q('#mkSave').onclick = save;
    q('#mkDiscard').onclick = discard;
    q('#formEditProfile').onsubmit = (e) => { e.preventDefault(); save(); };

    container.querySelectorAll('[data-copy-link]').forEach((b) => {
      b.onclick = async () => {
        const link = `${window.location.origin}/@${user.handle}`;
        try {
          await navigator.clipboard.writeText(link);
          onShowToast('Link copied. Paste it in your Instagram bio.');
        } catch (err) {
          window.prompt('Copy your link:', link);
        }
      };
    });

    // Location
    const btnDetectLoc = q('#btnDetectProfLocation');
    const profLocationInput = q('#inputProfLocation');
    const profLocationStatus = q('#profLocationStatus');
    btnDetectLoc.onclick = async () => {
      btnDetectLoc.disabled = true;
      profLocationStatus.textContent = 'Detecting your location…';
      profLocationStatus.className = 'mk-status';
      try {
        const { label } = await detectLocation();
        profLocationInput.value = label;
        profLocationStatus.textContent = 'Location detected. Feel free to edit it.';
        profLocationStatus.className = 'mk-status is-ok';
        setDirty(true);
      } catch (err) {
        profLocationStatus.textContent = err.message;
        profLocationStatus.className = 'mk-status is-err';
      } finally {
        btnDetectLoc.disabled = false;
      }
    };

    // Ping AI writes a draft into the bio field; it goes live with Save.
    const btnBio = q('#btnTriggerAiBio');
    btnBio.onclick = async () => {
      isGeneratingBio = true;
      btnBio.disabled = true;
      btnBio.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Writing…';
      const tone = q('#selectBioTone')?.value || 'Professional';
      const tags = q('#inputProfTags').value.split(',').map(t => t.trim()).filter(Boolean);
      const newBio = await aiService.generateBio(q('#inputProfName').value.trim() || user.name, user.role, tags.length ? tags : user.tags, tone);
      isGeneratingBio = false;
      if (container.dataset.mount !== mountId) return; // left the screen meanwhile
      // The page may have been redrawn while Ping AI was writing.
      const btnNow = q('#btnTriggerAiBio');
      btnNow.disabled = false;
      btnNow.innerHTML = '<i class="ph-fill ph-magic-wand"></i> Write it for me';
      const inputBio = q('#inputProfBio');
      inputBio.value = newBio;
      setDirty(true);
      if (mode !== 'edit') setMode('edit');
      inputBio.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onShowToast(`Draft added to your ${isCreator() ? 'bio' : 'About'}. Edit it if you like, then save.`);
    };

    // Profile photo / logo: saved straight away. Unsaved edits stay put.
    const avatarInput = q('#mkAvatarInput');
    avatarInput.onchange = async () => {
      const file = avatarInput.files && avatarInput.files[0];
      if (!file) return;
      const holder = avatarInput.closest('.mk-avatar');
      holder.classList.add('is-busy');
      try {
        await store.updateAvatar(file);
        onShowToast(isCreator() ? 'Photo updated.' : 'Logo updated.');
        if (container.dataset.mount !== mountId) return;
        if (dirty || uploading) {
          user = store.currentUser;
          holder.querySelector('img').src = user.avatar;
          holder.classList.remove('is-busy');
          refreshSummary();
        } else {
          render();
        }
      } catch (err) {
        console.error('Photo upload failed:', err);
        holder.classList.remove('is-busy');
        onShowToast(err?.message && !/fetch|network|storage|bucket|jwt|row-level/i.test(err.message) ? err.message : "Couldn't upload that photo. Please try again.");
      } finally {
        avatarInput.value = '';
      }
    };

    // Verification request: saved straight away. Unsaved edits stay put.
    const verifyBox = q('#mkVerify');
    verifyBox.onclick = async (e) => {
      const btnVerify = e.target.closest('#mkRequestVerify');
      if (!btnVerify) return;
      if (!hasSomethingToVerify(user)) {
        onShowToast('Add a bio and at least one social handle or link first (and save), so the team has something to check.');
        return;
      }
      btnVerify.disabled = true;
      try {
        await store.requestVerification();
        user = store.currentUser;
        onShowToast("Request sent. We'll let you know when you're verified.");
        verifyBox.innerHTML = verificationPanel(user);
        refreshSummary();
      } catch (err) {
        console.error('Verification request failed:', err);
        btnVerify.disabled = false;
        onShowToast("Couldn't send the request. Please try again.");
      }
    };

    // Niche chips (up to 3) keep the hidden input in sync.
    const tagsInput = q('#inputProfTags');
    container.querySelectorAll('.mk-niche-chip').forEach((chip) => {
      chip.onclick = () => {
        const current = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
        const tag = chip.getAttribute('data-niche');
        let next;
        if (current.includes(tag)) next = current.filter(t => t !== tag);
        else if (current.length < 3) next = [...current, tag];
        else { onShowToast('You can pick up to 3 niches.'); return; }
        tagsInput.value = next.join(', ');
        chip.classList.toggle('active', next.includes(tag));
        setDirty(true);
      };
    });

    if (!isCreator()) return;

    // Talent type chips swap the type-specific fields without a full
    // re-render, so anything typed elsewhere stays.
    const talentChips = q('#mkTalentChips');
    talentChips.onclick = (e) => {
      const chip = e.target.closest('[data-talent-type]');
      if (!chip) return;
      container.querySelectorAll('[data-td]').forEach((inp) => { draftDetails[inp.getAttribute('data-td')] = inp.value; });
      const type = chip.getAttribute('data-talent-type');
      talentChips.querySelectorAll('[data-talent-type]').forEach((c) => {
        c.classList.toggle('is-on', c === chip);
        c.setAttribute('aria-checked', String(c === chip));
      });
      q('#mkTalentFields').innerHTML = talentFieldsHtml(type, draftDetails);
      q('#mkRates').hidden = type !== 'INFLUENCER';
      setDirty(true);
    };

    // Links to past work
    const workList = q('#mkPortfolio');
    q('#mkAddWork').onclick = () => {
      if (workList.querySelectorAll('.mk-work-row').length >= MAX_LINKS) { onShowToast(`You can add up to ${MAX_LINKS} links.`); return; }
      workList.insertAdjacentHTML('beforeend', workRowHtml());
      workList.lastElementChild.querySelector('input').focus();
      setDirty(true);
    };
    workList.onclick = (e) => {
      const del = e.target.closest('.mk-work-del');
      if (!del) return;
      del.closest('.mk-work-row').remove();
      setDirty(true);
    };

    // Photos of work
    const photos = q('#mkPhotos');
    photos.addEventListener('change', (e) => {
      if (e.target.id !== 'mkPhotoInput') return;
      const files = e.target.files ? [...e.target.files] : [];
      e.target.value = '';
      addPhotos(files);
    });
    photos.addEventListener('click', (e) => {
      const del = e.target.closest('[data-photo]');
      if (!del) return;
      const [removed] = draftPhotos.splice(Number(del.getAttribute('data-photo')), 1);
      if (removed) {
        if (uploadedNow.has(removed.url)) { uploadedNow.delete(removed.url); store.removeWorkPhotos([removed.url]); }
        else removedSaved.add(removed.url);
      }
      photos.innerHTML = photosHtml();
      setDirty(true);
    });

    // Public link: the name is lowercase letters, numbers, dots, underscores.
    const handleInput = q('#mkHandle');
    const hint = q('#mkHandleHint');
    const toggle = q('#mkPublicToggle');
    const checkHandle = () => {
      const problem = handleInput.value ? handleProblem(handleInput.value) : '';
      hint.textContent = problem || (handleInput.value ? `Your link: ${window.location.host}/@${handleInput.value}` : '3–30 letters, numbers, dots or underscores.');
      hint.classList.toggle('is-err', !!problem);
    };
    handleInput.addEventListener('input', () => {
      const clean = handleInput.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30);
      if (clean !== handleInput.value) handleInput.value = clean;
      checkHandle();
    });
    toggle.addEventListener('change', () => {
      if (toggle.checked && !handleInput.value) {
        hint.textContent = 'Choose your link name, then save.';
        hint.classList.add('is-err');
        handleInput.focus();
      } else {
        checkHandle();
      }
    });
    checkHandle();

    // Availability: mark days unavailable (saved with the rest).
    const avail = q('#mkAvailBody');
    avail.addEventListener('input', (e) => {
      // The last day can't come before the first.
      if (e.target.id !== 'mkBlockFrom') return;
      const toInput = q('#mkBlockTo');
      toInput.min = e.target.value || toDateInput(Date.now());
      if (toInput.value && e.target.value && toInput.value < e.target.value) toInput.value = e.target.value;
    });
    avail.addEventListener('click', (e) => {
      if (e.target.closest('#mkBlockAdd')) {
        const from = q('#mkBlockFrom').value;
        const to = q('#mkBlockTo').value || from;
        if (!from) { onShowToast('Pick the first unavailable day.'); q('#mkBlockFrom').focus(); return; }
        if (dateOnlyMs(to) < dateOnlyMs(from)) { onShowToast("The last day can't be before the first."); return; }
        if (dateOnlyMs(to) < startOfDay(Date.now())) { onShowToast('Pick dates from today onwards.'); return; }
        if (draftBlocked.some(b => b.from === from && b.to === to)) { onShowToast('Those days are already marked.'); return; }
        if (draftBlocked.length >= 30) { onShowToast('You can mark up to 30 date ranges.'); return; }
        draftBlocked.push({ from, to });
        draftBlocked.sort((a, b) => dateOnlyMs(a.from) - dateOnlyMs(b.from));
        avail.innerHTML = availabilityHtml();
        setDirty(true);
        return;
      }
      const un = e.target.closest('[data-unblock]');
      if (un) {
        const [from, to] = un.getAttribute('data-unblock').split('|');
        draftBlocked = draftBlocked.filter(b => !(toDateInput(dateOnlyMs(b.from)) === from && toDateInput(dateOnlyMs(b.to)) === to));
        avail.innerHTML = availabilityHtml();
        setDirty(true);
      }
    });

    // Print
    const modalKit = q('#modalPrintableMediaKit');
    q('#btnExportMediaKit').onclick = () => modalKit.classList.add('active');
    q('#closePrintableModal').onclick = () => modalKit.classList.remove('active');
    q('#btnTriggerNativePrint').onclick = () => window.print();
  }

  render();

  const cleanup = () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.body.classList.remove('mk-dirty');
    // Photos uploaded but never saved aren't used anywhere.
    if (uploadedNow.size) store.removeWorkPhotos([...uploadedNow]);
  };
  // platform.switchView asks this before leaving the screen.
  cleanup.canLeave = () => !dirty || window.confirm(`You have unsaved changes in your ${isCreator() ? 'media kit' : 'brand profile'}. Leave without saving them?`);
  return cleanup;
}
