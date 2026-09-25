// Ping Platform — Media Kit & AI Bio Studio (Whole New Showcase Interface)
import { store } from '../state.js';
import { NICHE_TAGS } from '../mockData.js';
import { aiService } from '../aiService.js';
import { detectLocation } from '../geoService.js';
import { escapeHtml } from '../domUtils.js';
import { displayPingScore } from '../pingScoreService.js';
import { initCustomSelects } from '../customSelect.js';

// Empty or zero audience figures mean "not added", not a real zero.
const showStat = (v) => (!v || v === '0' || v === '0%' ? '—' : v);

export function renderMediaKitPlatform(container, onShowToast) {
  let isGeneratingBio = false;
  // Re-read from the store on every render (not captured once at view-open)
  // so a saved profile edit is reflected immediately instead of the form
  // reverting to pre-save values. `bindEvents()` below shares this same
  // variable via closure, so it always sees the latest value too.
  let user = store.currentUser;

  function render() {
    user = store.currentUser;
    const isCreator = user.role === 'INFLUENCER';
    const isBusiness = user.role === 'BUSINESS';
    const myPingScore = displayPingScore(user, { activeDeals: store.getMatchesForCurrentUser().length });

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
          <div style="width:116px; height:116px; border-radius:999px; border:3px solid var(--gold); overflow:hidden; box-shadow:0 0 35px rgba(230,255,26,0.25); margin-bottom:18px;">
            <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}" style="width:100%; height:100%; object-fit:cover;">
          </div>

          <div style="font-family:var(--font-heading); font-size:24px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
            ${escapeHtml(user.name)}
            ${user.verified ? '<i class="ph-fill ph-seal-check verified-gold-tick" style="font-size:22px;"></i>' : ''}
          </div>
          <div style="font-size:14px; color:var(--gold); font-weight:600; margin-top:2px;">${escapeHtml(user.company || user.jobTitle || user.role)}</div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:4px;"><i class="ph-fill ph-map-pin"></i> ${escapeHtml(user.location || 'India')}</div>

          <!-- PingScore Animated Circular Gauge -->
          <div style="margin:24px 0 16px; background:rgba(230,255,26,0.05); border:1px solid var(--border-gold); border-radius:var(--radius-md); padding:16px 20px; width:100%; display:flex; align-items:center; justify-content:space-between;">
            <div style="text-align:left;">
              <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.8px;">PingScore™ Metric</div>
              <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Verification &amp; Activity Signal</div>
            </div>
            <div style="font-family:var(--font-heading); font-size:36px; font-weight:700; color:var(--gold);">${myPingScore}</div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%; margin-bottom:20px;">
            <div class="metric-pill" style="padding:10px;">
              <div class="metric-pill-num" style="color:var(--accent-green)">${user.completionRate ? user.completionRate + "%" : (user.isDemo ? "98%" : "—")}</div>
              <div class="metric-pill-label">Completion</div>
            </div>
            <div class="metric-pill" style="padding:10px;">
              <div class="metric-pill-num">${user.responseTime || (user.isDemo ? '< 2h' : '—')}</div>
              <div class="metric-pill-label">Response</div>
            </div>
          </div>

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
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                  <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Display Name</label>
                  <input type="text" id="inputProfName" value="${escapeHtml(user.name || '')}" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
                </div>
                <div>
                  <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${isBusiness ? 'Company Name' : 'Creator Studio / Brand'}</label>
                  <input type="text" id="inputProfCompany" value="${escapeHtml(user.company || '')}" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
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
                <div style="border-top:1px solid var(--border-subtle); padding-top:18px;">
                  <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin-bottom:12px;">Rate Card</div>
                  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
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

                  <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin:18px 0 12px;">Social Handles</div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
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
                  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
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
                </div>
              ` : ''}

              ${isBusiness ? `
                <div style="border-top:1px solid var(--border-subtle); padding-top:18px;">
                  <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin-bottom:12px;">Business Details</div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
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
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
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
                  <div style="font-size:13.5px; color:var(--gold); font-weight:600;">${escapeHtml(user.company || user.jobTitle)}</div>
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

            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; background:rgba(0,0,0,0.5); padding:16px; border-radius:14px; margin-bottom:20px;">
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
