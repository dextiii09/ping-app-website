// Ping Platform — Media Kit & AI Bio Studio (Whole New Showcase Interface)
import { store } from '../state.js';
import { NICHE_TAGS } from '../mockData.js';
import { aiService } from '../aiService.js';
import { detectLocation } from '../geoService.js';
import { escapeHtml } from '../domUtils.js';
import { displayPingScore } from '../pingScoreService.js';
import { initCustomSelects } from '../customSelect.js';
import { TALENT_TYPES, talentMeta, talentTypeOf, talentHighlights, talentLinks, portfolioOf, talentBadge, safeUrl } from '../talentTypes.js';

// Empty or zero audience figures mean "not added", not a real zero.
const showStat = (v) => (!v || v === '0' || v === '0%' ? '—' : v);

export function renderMediaKitPlatform(container, onShowToast) {
  let isGeneratingBio = false;
  // Type-specific details typed so far, kept across talent-type switches.
  let draftDetails = {};

  function talentFieldsHtml(type, details) {
    const meta = talentMeta(type);
    if (!meta.fields.length) {
      return '<p class="mk-section-help">Influencers show their reach with the Audience numbers below.</p>';
    }
    return `<div class="mk-talent-grid">${meta.fields.map(f => `
      <div>
        <label for="mkTd_${f.key}" style="font-size:11px; color:var(--text-muted);">${escapeHtml(f.label)}</label>
        <input type="text" inputmode="${f.url ? 'url' : 'text'}" id="mkTd_${f.key}" data-td="${f.key}" data-td-url="${f.url ? '1' : ''}" value="${escapeHtml(details[f.key] || '')}" placeholder="${escapeHtml(f.placeholder)}" maxlength="${f.url ? 300 : 80}" style="width:100%; margin-top:6px;">
      </div>`).join('')}</div>`;
  }

  const VERIFY = {
    VERIFIED: { label: 'Verified by Ping', text: 'Your profile shows the verified badge.', icon: 'ph-seal-check', action: '' },
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
    const links = [u.socials?.instagram, u.socials?.youtube, u.website, ...(Array.isArray(u.portfolio) ? u.portfolio : [])];
    const detailLinks = Object.values(u.talentDetails || {}).filter(v => /^https?:\/\//i.test(String(v || '')));
    return !!String(u.bio || '').trim() && (links.some(Boolean) || detailLinks.length > 0);
  }

  function workRowHtml(item = {}) {
    return `
      <div class="mk-work-row">
        <input type="text" class="mk-work-label" value="${escapeHtml(item.label || '')}" placeholder="What it was, e.g. Café launch reel" maxlength="60">
        <input type="text" inputmode="url" class="mk-work-url" value="${escapeHtml(item.url || '')}" placeholder="https://…" maxlength="300">
        <button type="button" class="mk-work-del" aria-label="Remove link"><i class="ph-bold ph-x"></i></button>
      </div>`;
  }
  // Re-read from the store on every render (not captured once at view-open)
  // so a saved profile edit is reflected immediately instead of the form
  // reverting to pre-save values. `bindEvents()` below shares this same
  // variable via closure, so it always sees the latest value too.
  let user = store.currentUser;
  const mountId = container.dataset.mount;

  function render() {
    // An upload or save that finishes after the member has left the media
    // kit must not redraw it over the screen they're on now.
    if (container.dataset.mount !== mountId) return;
    user = store.currentUser;
    const isCreator = user.role === 'INFLUENCER';
    const isBusiness = user.role === 'BUSINESS';
    const myPingScore = displayPingScore(user, { activeDeals: store.getMatchesForCurrentUser().length });
    const talentType = isCreator ? talentTypeOf(user) : null;
    const highlights = isCreator ? talentHighlights(user) : [];
    const links = isCreator ? talentLinks(user) : [];
    draftDetails = { ...(user.talentDetails || {}) };

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h1 class="section-title">Your media <em>kit</em></h1>
          <p class="section-subtitle">This is what ${isBusiness ? 'creators' : 'brands'} see when they find you. Keep it up to date.</p>
        </div>

        <button class="btn-gold" id="btnExportMediaKit">
          <i class="ph-bold ph-printer"></i> Print media kit
        </button>
      </div>

      <div class="media-kit-grid">
        <!-- Identity & Trust Showcase Card -->
        <div class="glass-box" style="padding:32px; display:flex; flex-direction:column; align-items:center; text-align:center;">
          <div class="mk-avatar">
            <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}">
            <label class="mk-avatar-edit" title="Change photo">
              <i class="ph-bold ph-camera"></i><span>Change photo</span>
              <input type="file" id="mkAvatarInput" accept="image/jpeg,image/png,image/webp" hidden>
            </label>
          </div>

          <div style="font-family:var(--font-heading); font-size:24px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
            ${escapeHtml(user.name)}
            ${user.verified ? '<i class="ph-fill ph-seal-check verified-gold-tick" style="font-size:22px;"></i>' : ''}
          </div>
          <div style="font-size:14px; color:var(--gold); font-weight:600; margin-top:2px;">${escapeHtml(user.company || user.jobTitle || user.role)}</div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:4px;"><i class="ph-fill ph-map-pin"></i> ${escapeHtml(user.location || 'India')}</div>
          ${isCreator ? `<div class="mk-type-row">${talentBadge(talentType)}</div>` : ''}

          <!-- PingScore Animated Circular Gauge -->
          <div style="margin:24px 0 16px; background:rgba(230,255,26,0.05); border:1px solid var(--border-gold); border-radius:var(--radius-md); padding:16px 20px; width:100%; display:flex; align-items:center; justify-content:space-between;">
            <div style="text-align:left;">
              <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.8px;">PingScore™ Metric</div>
              <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Verification &amp; Activity Signal</div>
            </div>
            <div style="font-family:var(--font-heading); font-size:36px; font-weight:700; color:var(--gold);">${myPingScore}</div>
          </div>

          ${verificationPanel(user)}

          ${isCreator && talentType !== 'INFLUENCER' ? `
            <div class="mk-highlights">
              <div class="mk-block-title">${escapeHtml(talentMeta(talentType).label)} details</div>
              ${highlights.length
                ? highlights.map(h => `<div class="mk-hl-row"><span>${escapeHtml(h.label)}</span><strong>${escapeHtml(h.value)}</strong></div>`).join('')
                : '<p class="mk-hl-empty">Add your details in the form so brands can see them.</p>'}
              ${links.length ? `<div class="cm-app-links">${links.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer"><i class="ph-bold ph-arrow-up-right"></i>${escapeHtml(l.label)}</a>`).join('')}</div>` : ''}
            </div>
          ` : ''}

          <!-- Social Reach Breakdown -->
          <div style="width:100%; text-align:left; border-top:1px solid var(--border-subtle); padding-top:16px;">
            <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--text-dim); letter-spacing:0.6px; margin-bottom:12px;">Audience Metrics</div>
            <div style="display:flex; flex-direction:column; gap:10px; font-size:13.5px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted);"><i class="ph-fill ph-instagram-logo" style="color:#E1306C"></i> Instagram</span>
                <strong style="color:#fff;">${escapeHtml(showStat(user.socialStats?.instagramFollowers))}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted);"><i class="ph-fill ph-youtube-logo" style="color:#FF0000"></i> YouTube</span>
                <strong style="color:#fff;">${escapeHtml(showStat(user.socialStats?.youtubeSubscribers))}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted);"><i class="ph-fill ph-tiktok-logo" style="color:#00F2FE"></i> TikTok / Shorts</span>
                <strong style="color:#fff;">${escapeHtml(showStat(user.socialStats?.tiktokFollowers))}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted);"><i class="ph-fill ph-chart-line-up" style="color:var(--gold)"></i> Avg Engagement</span>
                <strong style="color:var(--gold);">${escapeHtml(showStat(user.socialStats?.avgEngagement))}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Bio Studio & Profile Editor -->
        <div style="display:flex; flex-direction:column; gap:24px;">
          <!-- Ping AI Bio Studio -->
          <div class="glass-box" style="padding:28px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div class="platform-brand-icon"><i class="ph-fill ph-sparkle"></i></div>
                <div>
                  <h3 style="font-family:var(--font-heading); font-size:19px; font-weight:700; color:#fff;">Ping AI Bio Studio</h3>
                  <div style="font-size:12px; color:var(--text-muted);">Generates high-conversion bios calibrated for brand deals.</div>
                </div>
              </div>

              <div style="display:flex; align-items:center; gap:8px;">
                <select id="selectBioTone" style="background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); border-radius:var(--radius-full); color:#fff; font-size:12.5px; padding:6px 12px; outline:none; font-family:inherit;">
                  <option value="Professional">Professional</option>
                  <option value="Creative">Editorial / Creative</option>
                  <option value="Witty">Streetwise / Witty</option>
                  <option value="Hype">High-Energy / Hype</option>
                </select>

                <button class="btn-gold" id="btnTriggerAiBio" ${isGeneratingBio ? 'disabled' : ''} style="padding:7px 16px; font-size:12.5px;">
                  ${isGeneratingBio ? '<i class="ph-bold ph-spinner ph-spin"></i> Generating...' : '<i class="ph-fill ph-magic-wand"></i> Optimize Bio'}
                </button>
              </div>
            </div>

            <div style="background:rgba(0,0,0,0.35); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:18px; font-size:14.5px; line-height:1.55; color:#fff;" id="displayProfileBio">
              ${escapeHtml(user.bio || 'Add a bio to showcase your story.')}
            </div>
          </div>

          <!-- Edit Profile Form -->
          <div class="glass-box" style="padding:28px;">
            <h3 style="font-family:var(--font-heading); font-size:19px; font-weight:700; color:#fff; margin-bottom:20px;">Profile Information</h3>

            <form id="formEditProfile" style="display:flex; flex-direction:column; gap:18px;">
              <div class="app-cols" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                  <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Display Name</label>
                  <input type="text" id="inputProfName" value="${escapeHtml(user.name || '')}" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
                </div>
                <div>
                  <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${isBusiness ? 'Company Name' : 'Creator Studio / Brand'}</label>
                  <input type="text" id="inputProfCompany" value="${escapeHtml(user.company || '')}" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
                </div>
              </div>

              <div class="app-cols" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                  <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Location</label>
                  <div style="display:flex; gap:8px; margin-top:6px;">
                    <input type="text" id="inputProfLocation" value="${escapeHtml(user.location || '')}" style="flex:1; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
                    <button type="button" id="btnDetectProfLocation" class="btn-glass" style="padding:0 12px; white-space:nowrap; font-size:12px;" title="Use my current location">
                      <i class="ph-fill ph-map-pin"></i>
                    </button>
                  </div>
                  <div id="profLocationStatus" style="font-size:10.5px; color:var(--text-dim); margin-top:4px; min-height:13px;"></div>
                </div>
                <div>
                  <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Niches <span style="text-transform:none; font-weight:500; color:var(--text-dim);">(up to 3)</span></label>
                  <input type="hidden" id="inputProfTags" value="${escapeHtml((user.tags || []).filter(t => NICHE_TAGS.includes(t)).join(', '))}">
                  <div class="mk-niche-chips">
                    ${NICHE_TAGS.map(t => `<button type="button" class="tag-filter-chip mk-niche-chip ${(user.tags || []).includes(t) ? 'active' : ''}" data-niche="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
                  </div>
                </div>
              </div>

              <div>
                <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Bio Description</label>
                <textarea id="inputProfBio" rows="3" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px; resize:vertical;">${escapeHtml(user.bio || '')}</textarea>
              </div>

              ${isCreator ? `
                <div class="mk-section">
                  <div class="mk-section-title">What you do</div>
                  <div class="cm-choice-row" id="mkTalentChips" role="radiogroup" aria-label="Talent type">
                    ${TALENT_TYPES.map(t => `<button type="button" class="cm-choice ${t.id === talentType ? 'is-on' : ''}" role="radio" aria-checked="${t.id === talentType}" data-talent-type="${t.id}"><i class="ph-fill ${t.icon}"></i>${escapeHtml(t.label)}</button>`).join('')}
                  </div>
                  <p class="mk-section-help">Brands post campaigns for a talent type. You'll see the ones made for yours, plus the ones open to everyone.</p>
                  <div id="mkTalentFields">${talentFieldsHtml(talentType, draftDetails)}</div>
                </div>
              ` : ''}

              ${isCreator ? `
                <div style="border-top:1px solid var(--border-subtle); padding-top:18px;">
                  <div id="mkRateCard" ${talentType !== 'INFLUENCER' ? 'hidden' : ''}>
                  <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin-bottom:12px;">Rate Card</div>
                  <div class="app-cols" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Dedicated Reel</label>
                      <input type="text" id="inputRateReel" value="${escapeHtml(user.settings?.rateCard?.reel || '')}" placeholder="e.g. ₹8,000" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px;">
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Story Sequence</label>
                      <input type="text" id="inputRateStory" value="${escapeHtml(user.settings?.rateCard?.storySequence || '')}" placeholder="e.g. ₹2,500" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px;">
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Store/Event Visit</label>
                      <input type="text" id="inputRateEvent" value="${escapeHtml(user.settings?.rateCard?.eventAppearance || '')}" placeholder="e.g. ₹15,000" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px;">
                    </div>
                  </div>
                  </div>

                  <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin:18px 0 12px;">Social Handles</div>
                  <div class="app-cols" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Instagram</label>
                      <input type="text" id="inputSocialInstagram" value="${escapeHtml(user.socials?.instagram || '')}" placeholder="@handle" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px;">
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">YouTube</label>
                      <input type="text" id="inputSocialYoutube" value="${escapeHtml(user.socials?.youtube || '')}" placeholder="channel handle or link" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px;">
                    </div>
                  </div>

                  <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin:18px 0 4px;">Audience</div>
                  <div style="font-size:12px; color:var(--text-dim); margin-bottom:12px;">Self-reported. Shown on your card so brands can see your reach.</div>
                  <div class="app-cols" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Instagram followers</label>
                      <input type="text" id="inputStatIg" value="${escapeHtml(user.socialStats?.instagramFollowers && user.socialStats.instagramFollowers !== '0' ? user.socialStats.instagramFollowers : '')}" placeholder="e.g. 32K" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px;">
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">YouTube subscribers</label>
                      <input type="text" id="inputStatYt" value="${escapeHtml(user.socialStats?.youtubeSubscribers && user.socialStats.youtubeSubscribers !== '0' ? user.socialStats.youtubeSubscribers : '')}" placeholder="e.g. 4K" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px;">
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Avg engagement</label>
                      <input type="text" id="inputStatEng" value="${escapeHtml(user.socialStats?.avgEngagement && user.socialStats.avgEngagement !== '0%' ? user.socialStats.avgEngagement : '')}" placeholder="e.g. 6.8%" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px;">
                    </div>
                  </div>

                  <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin:18px 0 4px;">Past work</div>
                  <div style="font-size:12px; color:var(--text-dim); margin-bottom:12px;">Up to 5 links brands can open from your application: reels, sets, shows, anything you're proud of.</div>
                  <div id="mkPortfolio">${portfolioOf(user).filter(w => !w.image).map(w => workRowHtml(w)).join('')}</div>
                  <button type="button" class="btn-glass mk-add-work" id="mkAddWork"><i class="ph-bold ph-plus"></i> Add a link</button>
                </div>
              ` : ''}

              ${isBusiness ? `
                <div style="border-top:1px solid var(--border-subtle); padding-top:18px;">
                  <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin-bottom:12px;">Business Details</div>
                  <div class="app-cols" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Industry</label>
                      <select id="inputBizIndustry" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px; outline:none; font-family:inherit;">
                        ${['Food & Beverage', 'Fashion & Apparel', 'Fitness & Health', 'Beauty & Wellness', 'Tech', 'Lifestyle', 'Events'].map(opt => `
                          <option value="${opt}" ${user.industry === opt ? 'selected' : ''}>${opt}</option>
                        `).join('')}
                      </select>
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Company Size</label>
                      <select id="inputBizCompanySize" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px; outline:none; font-family:inherit;">
                        ${['1-5 employees', '5-10 employees', '10-20 employees', '20-50 employees', '50+ employees'].map(opt => `
                          <option value="${opt}" ${user.companySize === opt ? 'selected' : ''}>${opt}</option>
                        `).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="app-cols" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Website / Instagram</label>
                      <input type="text" id="inputBizWebsite" value="${escapeHtml(user.website || '')}" placeholder="https://..." style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px;">
                    </div>
                    <div>
                      <label style="font-size:11px; color:var(--text-muted);">Monthly Collaboration Budget</label>
                      <select id="inputBizBudget" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; color:#fff; font-size:13.5px; outline:none; font-family:inherit;">
                        ${['₹10,000 - ₹50,000', '₹50,000 - ₹2,00,000', 'Enterprise (₹2,00,000+)'].map(opt => `
                          <option value="${opt}" ${user.settings?.budgetRange === opt ? 'selected' : ''}>${opt}</option>
                        `).join('')}
                      </select>
                    </div>
                  </div>
                </div>
              ` : ''}

              <button type="submit" class="btn-gold" style="align-self:flex-start; padding:12px 26px;">
                Save Profile Changes
              </button>
            </form>
          </div>
        </div>
      </div>

      <!-- Printable Media Kit Sheet Modal -->
      <div class="platform-modal-backdrop" id="modalPrintableMediaKit">
        <div class="platform-modal-window" style="max-width:700px;">
          <button class="platform-modal-close" id="closePrintableModal">&times;</button>
          
          <div style="background:linear-gradient(135deg, #181712 0%, #0c0c10 100%); border:1px solid var(--gold); border-radius:20px; padding:32px; box-shadow:0 0 50px rgba(230,255,26,0.18);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
              <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:68px; height:68px; border-radius:999px; overflow:hidden; border:2px solid var(--gold);">
                  <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div>
                  <div style="font-family:var(--font-heading); font-size:24px; font-weight:700; color:#fff;">${escapeHtml(user.name)}</div>
                  <div style="font-size:13.5px; color:var(--gold); font-weight:600;">${escapeHtml(user.company || user.jobTitle)}${isCreator ? ` · ${escapeHtml(talentMeta(talentType).label)}` : ''}</div>
                  <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(user.location)} • ${user.verified ? 'Verified on Ping' : 'Ping media kit'}</div>
                </div>
              </div>

              <div style="text-align:right;">
                <div style="font-family:var(--font-heading); font-size:32px; font-weight:700; color:var(--gold);">${myPingScore}</div>
                <div style="font-size:10.5px; color:var(--text-dim); text-transform:uppercase;">PingScore™ Trust</div>
              </div>
            </div>

            <p style="font-size:14px; line-height:1.55; color:var(--text-muted); margin-bottom:24px;">
              ${escapeHtml(user.bio)}
            </p>

            ${isCreator && talentType !== 'INFLUENCER' && highlights.length ? `
              <div class="mk-print-stats" style="display:grid; grid-template-columns:repeat(${highlights.length}, 1fr); gap:12px; background:rgba(0,0,0,0.5); padding:16px; border-radius:14px; margin-bottom:12px;">
                ${highlights.map(h => `<div style="text-align:center;"><div style="font-size:17px; font-weight:700; color:#fff;">${escapeHtml(h.value)}</div><div style="font-size:10.5px; color:var(--text-dim);">${escapeHtml(h.label)}</div></div>`).join('')}
              </div>
            ` : ''}

            <div class="mk-print-stats" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; background:rgba(0,0,0,0.5); padding:16px; border-radius:14px; margin-bottom:20px;">
              <div style="text-align:center;">
                <div style="font-size:17px; font-weight:700; color:#fff;">${escapeHtml(showStat(user.socialStats?.instagramFollowers))}</div>
                <div style="font-size:10.5px; color:var(--text-dim);">Instagram</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:17px; font-weight:700; color:#fff;">${escapeHtml(showStat(user.socialStats?.youtubeSubscribers))}</div>
                <div style="font-size:10.5px; color:var(--text-dim);">YouTube</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:17px; font-weight:700; color:var(--gold);">${escapeHtml(showStat(user.socialStats?.avgEngagement))}</div>
                <div style="font-size:10.5px; color:var(--text-dim);">Engagement</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:17px; font-weight:700; color:var(--accent-green);">${user.completionRate ? user.completionRate + "%" : (user.isDemo ? "98%" : "—")}</div>
                <div style="font-size:10.5px; color:var(--text-dim);">Completion</div>
              </div>
            </div>

            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${(user.tags || []).map(t => `
                <span style="background:rgba(230,255,26,0.1); color:var(--gold); font-size:11px; padding:3px 10px; border-radius:999px;">#${escapeHtml(t)}</span>
              `).join('')}
            </div>
          </div>

          <div style="margin-top:22px; display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn-gold" id="btnTriggerNativePrint">
              <i class="ph-bold ph-printer"></i> Print / Save as PDF
            </button>
          </div>
        </div>
      </div>
    `;

    initCustomSelects(container);
    bindEvents();
  }

  function bindEvents() {
    // Location Detect
    const btnDetectLoc = container.querySelector('#btnDetectProfLocation');
    const profLocationInput = container.querySelector('#inputProfLocation');
    const profLocationStatus = container.querySelector('#profLocationStatus');
    if (btnDetectLoc && profLocationInput) {
      btnDetectLoc.onclick = async () => {
        btnDetectLoc.disabled = true;
        profLocationStatus.textContent = 'Detecting your location...';
        profLocationStatus.style.color = 'var(--text-dim)';
        try {
          const { label } = await detectLocation();
          profLocationInput.value = label;
          profLocationStatus.textContent = 'Location detected — feel free to edit it.';
          profLocationStatus.style.color = 'var(--accent-green)';
        } catch (err) {
          profLocationStatus.textContent = err.message;
          profLocationStatus.style.color = 'var(--accent-crimson)';
        } finally {
          btnDetectLoc.disabled = false;
        }
      };
    }

    // AI Bio Optimize
    const btnBio = container.querySelector('#btnTriggerAiBio');
    const selectTone = container.querySelector('#selectBioTone');
    const displayBio = container.querySelector('#displayProfileBio');
    const inputBio = container.querySelector('#inputProfBio');

    if (btnBio) {
      btnBio.onclick = async () => {
        isGeneratingBio = true;
        btnBio.disabled = true;
        btnBio.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Optimizing with Ping AI...';

        const tone = selectTone ? selectTone.value : 'Professional';
        const newBio = await aiService.generateBio(user.name, user.role, user.tags, tone);

        isGeneratingBio = false;
        // A draft, not a save: it lands in the Bio field below for the
        // member to read and edit, and only goes live with "Save".
        if (displayBio) displayBio.textContent = newBio;
        if (inputBio) {
          inputBio.value = newBio;
          inputBio.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        onShowToast('Draft bio added below. Edit it if you like, then save.');
        btnBio.disabled = false;
        btnBio.innerHTML = '<i class="ph-fill ph-magic-wand"></i> Optimize Bio';
      };
    }

    const avatarInput = container.querySelector('#mkAvatarInput');
    if (avatarInput) {
      avatarInput.onchange = async () => {
        const file = avatarInput.files && avatarInput.files[0];
        if (!file) return;
        const holder = avatarInput.closest('.mk-avatar');
        holder.classList.add('is-busy');
        try {
          await store.updateAvatar(file);
          onShowToast('Photo updated.');
          render();
        } catch (err) {
          console.error('Photo upload failed:', err);
          holder.classList.remove('is-busy');
          onShowToast(err?.message && !/fetch|network|storage|bucket|jwt|row-level/i.test(err.message) ? err.message : "Couldn't upload that photo. Please try again.");
        } finally {
          avatarInput.value = '';
        }
      };
    }

    const btnVerify = container.querySelector('#mkRequestVerify');
    if (btnVerify) {
      btnVerify.onclick = async () => {
        if (!hasSomethingToVerify(user)) {
          onShowToast('Add a bio and at least one social handle or link first, so the team has something to check.');
          return;
        }
        btnVerify.disabled = true;
        try {
          await store.requestVerification();
          onShowToast("Request sent. We'll let you know when you're verified.");
          render();
        } catch (err) {
          console.error('Verification request failed:', err);
          btnVerify.disabled = false;
          onShowToast("Couldn't send the request. Please try again.");
        }
      };
    }

    // Talent type chips swap the type-specific fields without a full
    // re-render, so anything typed elsewhere in the form stays.
    const talentChips = container.querySelector('#mkTalentChips');
    if (talentChips) {
      talentChips.onclick = (e) => {
        const chip = e.target.closest('[data-talent-type]');
        if (!chip) return;
        container.querySelectorAll('[data-td]').forEach((inp) => { draftDetails[inp.getAttribute('data-td')] = inp.value; });
        const type = chip.getAttribute('data-talent-type');
        talentChips.querySelectorAll('[data-talent-type]').forEach((c) => {
          c.classList.toggle('is-on', c === chip);
          c.setAttribute('aria-checked', String(c === chip));
        });
        container.querySelector('#mkTalentFields').innerHTML = talentFieldsHtml(type, draftDetails);
        const rateCard = container.querySelector('#mkRateCard');
        if (rateCard) rateCard.hidden = type !== 'INFLUENCER';
      };
    }

    const workList = container.querySelector('#mkPortfolio');
    const addWork = container.querySelector('#mkAddWork');
    if (workList && addWork) {
      addWork.onclick = () => {
        if (workList.querySelectorAll('.mk-work-row').length >= 5) { onShowToast('You can add up to 5 links.'); return; }
        workList.insertAdjacentHTML('beforeend', workRowHtml());
        workList.lastElementChild.querySelector('input').focus();
      };
      workList.onclick = (e) => {
        const del = e.target.closest('.mk-work-del');
        if (del) del.closest('.mk-work-row').remove();
      };
    }

    // Niche chips (up to 3) keep the hidden comma-separated input in sync.
    const tagsInput = container.querySelector('#inputProfTags');
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
      };
    });

    // Save profile form
    const form = container.querySelector('#formEditProfile');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btnSave = form.querySelector('button[type="submit"]');
        if (btnSave?.disabled) return;
        const name = container.querySelector('#inputProfName').value.trim();
        const company = container.querySelector('#inputProfCompany').value.trim();
        const location = container.querySelector('#inputProfLocation').value.trim();
        const tags = container.querySelector('#inputProfTags').value.split(',').map(t => t.trim()).filter(Boolean);
        const bio = container.querySelector('#inputProfBio').value.trim();
        const fields = { name, company, location, tags, bio };

        if (user.role === 'INFLUENCER') {
          fields.settings = {
            ...(user.settings || {}),
            rateCard: {
              reel: container.querySelector('#inputRateReel').value.trim(),
              storySequence: container.querySelector('#inputRateStory').value.trim(),
              eventAppearance: container.querySelector('#inputRateEvent').value.trim()
            }
          };
          fields.socials = {
            ...(user.socials || {}),
            instagram: container.querySelector('#inputSocialInstagram').value.trim(),
            youtube: container.querySelector('#inputSocialYoutube').value.trim()
          };
          // Talent type, its details and past-work links. Links are
          // normalised to https and anything that isn't a web link is refused.
          const chosen = container.querySelector('#mkTalentChips [data-talent-type].is-on');
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
          fields.portfolio = work.slice(0, 5);

          const eng = container.querySelector('#inputStatEng').value.trim();
          fields.socialStats = {
            ...(user.socialStats || {}),
            instagramFollowers: container.querySelector('#inputStatIg').value.trim() || '0',
            youtubeSubscribers: container.querySelector('#inputStatYt').value.trim() || '0',
            avgEngagement: eng ? (eng.endsWith('%') ? eng : `${eng}%`) : '0%'
          };
        }

        if (user.role === 'BUSINESS') {
          fields.industry = container.querySelector('#inputBizIndustry').value;
          fields.companySize = container.querySelector('#inputBizCompanySize').value;
          fields.website = container.querySelector('#inputBizWebsite').value.trim();
          fields.settings = {
            ...(user.settings || {}),
            budgetRange: container.querySelector('#inputBizBudget').value
          };
        }

        if (btnSave) {
          btnSave.disabled = true;
          btnSave.textContent = 'Saving...';
        }
        try {
          await store.updateCurrentUserProfile(fields);
          onShowToast('Profile details updated! 💾');
          render();
        } catch (err) {
          console.error('Profile save failed:', err);
          onShowToast("Couldn't save your changes. Check your connection and try again.");
          if (btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'Save Profile Changes';
          }
        }
      };
    }

    // Media Kit Modal
    const btnExport = container.querySelector('#btnExportMediaKit');
    const modalKit = container.querySelector('#modalPrintableMediaKit');
    const closeKit = container.querySelector('#closePrintableModal');
    const btnPrint = container.querySelector('#btnTriggerNativePrint');

    if (btnExport && modalKit) btnExport.onclick = () => modalKit.classList.add('active');
    if (closeKit && modalKit) closeKit.onclick = () => modalKit.classList.remove('active');
    if (btnPrint) btnPrint.onclick = () => window.print();
  }

  render();
}
