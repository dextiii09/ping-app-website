// Ping Platform - Explore & Match: spotlight deck / grid of people to ping.
function rateLine(u) {
  if (u.isDemo) return u.stats?.budget ? `Rates: ${u.stats.budget}` : 'Rates on request';
  if (u.role === 'BUSINESS') return u.settings?.budgetRange ? `Budget: ${u.settings.budgetRange}` : 'Budget on request';
  const rc = u.settings?.rateCard || {};
  if (rc.reel) return `Reel from ${rc.reel}`;
  if (rc.storySequence) return `Stories from ${rc.storySequence}`;
  if (rc.eventAppearance) return `Store visit from ${rc.eventAppearance}`;
  return 'Rates on request';
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// Demo profiles have no account behind them, so pinging one sends nothing.
function isDemoProfile(id) {
  return !!store.users.find(u => u.id === id)?.isDemo;
}
import { store } from '../state.js';
import { aiService } from '../aiService.js';
import { NICHE_TAGS } from '../mockData.js';
import { escapeHtml } from '../domUtils.js';
import { displayPingScore } from '../pingScoreService.js';

export function renderDiscoveryPlatform(container, onOpenDealRoom, onShowToast) {
  // Reassigned (not just read) at the top of every render() - this view
  // used to capture the candidate pool once at mount and never refresh it,
  // so live updates (a new real business signing up, a live brief loading
  // in) never reached an already-open Explore & Match screen. Every other
  // view in this app subscribes to the store and re-renders; this one now
  // does too (see the store.subscribe() call at the bottom of this function).
  let candidates = store.getDiscoveryCandidates();
  let currentMode = 'spotlight'; // 'spotlight' | 'bento'
  let activeTagFilter = 'ALL';
  let verifiedOnly = false;
  let currentIndex = 0;
  // Id of the card on top of the deck. The candidate list drops everyone
  // already swiped (and can change under us from live updates or a radar
  // quick-ping), so the position alone would point at a different person
  // after a re-render; render() re-finds this id instead.
  let topId = null;
  let swipeLocked = false;
  let activeSidebarTab = 'radar'; // 'radar' | 'briefs' | 'insight'

  function render() {
    candidates = store.getDiscoveryCandidates();
    let filtered = candidates.filter(c => {
      if (verifiedOnly && !c.verified) return false;
      if (activeTagFilter !== 'ALL') {
        return c.tags && c.tags.includes(activeTagFilter);
      }
      return true;
    });
    if (topId) {
      const i = filtered.findIndex(c => c.id === topId);
      if (i !== -1) currentIndex = i;
    }
    // Past the end but people are left (ones skipped via the radar): go round again.
    if (currentIndex >= filtered.length) currentIndex = 0;
    topId = filtered[currentIndex]?.id || null;

    const tags = ['ALL', ...NICHE_TAGS];
    const user = store.currentUser;
    const isBusinessUser = user.role === 'BUSINESS';

    // Real, computed HUD stats - this card used to show two literally
    // hardcoded numbers (₹18,500 escrow, 96.2% "AI Match Precision") that
    // never changed for any account, plus a "Campaign Briefs" count that was
    // actually every brief on the platform, not this business's own. Escrow
    // isn't a real feature yet (see AUDIT_REPORT.md / project notes - no
    // contracts/escrow schema exists), so rather than fake a number for it,
    // it's replaced with Active Deals, which is genuinely computed.
    const myActiveDeals = store.getMatchesForCurrentUser().length;
    const allBriefs = store.briefs || [];
    const myBriefsCount = isBusinessUser
      ? allBriefs.filter(b => b.brandId === user.id).length
      : allBriefs.length;
    const briefsLabel = isBusinessUser ? 'My Live Briefs' : 'Open Briefs';
    const verificationDisplay = {
      VERIFIED: { label: 'Verified', color: 'var(--accent-green)', icon: 'ph-seal-check' },
      PENDING: { label: 'Pending Review', color: 'var(--gold)', icon: 'ph-clock' },
      REJECTED: { label: 'Unverified', color: 'var(--text-dim)', icon: 'ph-seal' },
      UNVERIFIED: { label: 'Unverified', color: 'var(--text-dim)', icon: 'ph-seal' }
    }[user.verificationStatus] || { label: 'Unverified', color: 'var(--text-dim)', icon: 'ph-seal' };

    container.innerHTML = `
      <div class="app-greet">
        <div class="app-greet-left">
          <img src="${escapeHtml(user.avatar)}" alt="" class="app-greet-av">
          <div>
            <p class="app-greet-hi">${greeting()}, ${escapeHtml((user.name || '').split(' ')[0] || 'there')}</p>
            <h1 class="section-title">Find <em>${isBusinessUser ? 'creators' : 'brands'}</em></h1>
          </div>
        </div>
        <div class="app-stats">
          <div class="app-stat" title="Matches you're in conversation with"><b>${myActiveDeals}</b><span>Active deals</span></div>
          <div class="app-stat" title="Trust signal from verification, profile completeness and activity"><b class="is-lime">${displayPingScore(user, { activeDeals: myActiveDeals })}</b><span>PingScore</span></div>
          <div class="app-stat" title="Identity verification status"><b style="color:${verificationDisplay.color};">${verificationDisplay.label}</b><span>Verification</span></div>
          <div class="app-stat" title="${isBusinessUser ? 'Campaign briefs you have live' : 'Campaign briefs open on Ping'}"><b>${myBriefsCount}</b><span>${briefsLabel}</span></div>
        </div>
      </div>

      <div class="app-toolbar">
        <div class="view-mode-switch">
          <button class="view-mode-btn ${currentMode === 'spotlight' ? 'active' : ''}" id="btnModeSpotlight">
            <i class="ph-bold ph-cards"></i> Spotlight
          </button>
          <button class="view-mode-btn ${currentMode === 'bento' ? 'active' : ''}" id="btnModeBento">
            <i class="ph-bold ph-squares-four"></i> Grid
          </button>
        </div>
        <div class="tag-filter-list app-chip-row">
          <button class="tag-filter-chip ${verifiedOnly ? 'active' : ''}" id="btnFilterVerified">
            <i class="ph-fill ph-seal-check"></i> Verified
          </button>
          ${tags.map(t => `
            <button class="tag-filter-chip ${activeTagFilter === t ? 'active' : ''}" data-tag="${t}">${t === 'ALL' ? 'All' : t}</button>
          `).join('')}
        </div>
      </div>

      <!-- Dynamic Platform Content Viewport -->
      <div id="discoveryViewport">
        ${currentMode === 'spotlight' ? renderPanoramicSpotlight(filtered) : renderBentoRoster(filtered)}
      </div>
    `;

    bindEvents(filtered);
  }

  function renderPanoramicSpotlight(list) {
    if (!list || list.length === 0 || currentIndex >= list.length) {
      return `
        <div class="glass-box" style="padding:60px 30px; text-align:center; max-width:560px; margin:40px auto;">
          <i class="ph-fill ph-check-circle" style="font-size:58px; color:var(--gold); margin-bottom:16px; display:inline-block;"></i>
          <h2 style="font-family:var(--font-heading); font-size:26px; margin-bottom:8px;">You're all caught up</h2>
          <p style="color:var(--text-muted); font-size:14px; margin-bottom:24px; line-height:1.5;">
            You've seen everyone for now. New creators and brands join regularly, so check back soon, start over, or switch to the grid.
          </p>
          <button class="btn-gold" id="btnResetDiscovery">
            <i class="ph-bold ph-arrow-counter-clockwise"></i> Start over
          </button>
        </div>
      `;
    }

    const current = list[currentIndex];
    const next = list[currentIndex + 1];
    const nextNext = list[currentIndex + 2];
    const analysis = aiService.generateMatchAnalysis(store.currentUser, current);
    const radarPeers = candidates.filter(c => c.id !== current.id).slice(0, 3);
    const hotBriefs = (store.briefs || []).slice(0, 2);

    return `
      <div class="panoramic-discovery-layout">
        <!-- Left: Cinematic Spotlight Deck -->
        <div class="panoramic-spotlight-col">
          <div class="spotlight-stage">
            ${nextNext ? `
              <div class="spotlight-card depth-2">
                <div class="spotlight-media">
                  <img src="${escapeHtml(nextNext.avatar)}" alt="${escapeHtml(nextNext.name)}">
                  <div class="spotlight-gradient"></div>
                </div>
              </div>
            ` : ''}

            ${next ? `
              <div class="spotlight-card depth-1">
                <div class="spotlight-media">
                  <img src="${escapeHtml(next.avatar)}" alt="${escapeHtml(next.name)}">
                  <div class="spotlight-gradient"></div>
                </div>
                <div class="spotlight-body">
                  <div class="spotlight-name">${escapeHtml(next.name)}</div>
                  <div class="spotlight-role">${escapeHtml(next.company || next.jobTitle || next.role)}</div>
                </div>
              </div>
            ` : ''}

            <div class="spotlight-card top-card" id="activeSpotlightCard">
              <div class="swipe-stamp swipe-stamp-ping" id="stampPing">PING</div>
              <div class="swipe-stamp swipe-stamp-pass" id="stampPass">PASS</div>
              <div class="swipe-stamp swipe-stamp-super" id="stampSuper">SUPER</div>
              <div class="spotlight-media">
                <img src="${escapeHtml(current.avatar)}" alt="${escapeHtml(current.name)}">
                <div class="spotlight-gradient"></div>

                <!-- Animated SVG AI Match Dial -->
                <div class="match-dial-badge" id="btnOpenMatchDossier" title="Why this match?">
                  <svg class="match-dial-svg" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E6FF1A" stroke-width="3" stroke-dasharray="${analysis.score}, 100" />
                  </svg>
                  <span class="match-dial-score">${analysis.score}% Match</span>
                </div>

                <div style="position:absolute; top:18px; right:18px; display:flex; gap:6px;">
                  ${current.isDemo ? `<span style="background:rgba(157,78,221,0.85); backdrop-filter:blur(12px); color:#fff; padding:6px 12px; border-radius:999px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Demo</span>` : ''}
                  <div style="background:rgba(10,10,14,0.8); backdrop-filter:blur(12px); border:1px solid var(--border-subtle); color:#fff; padding:6px 14px; border-radius:999px; font-size:12px; font-weight:600;">
                    <i class="ph-fill ph-map-pin" style="color:var(--gold)"></i> ${escapeHtml(current.location || 'India')}
                  </div>
                </div>

                <div class="spotlight-identity">
                  <div class="spotlight-name-row">
                    <div class="spotlight-name">${escapeHtml(current.name)}</div>
                    ${current.verified ? '<i class="ph-fill ph-seal-check verified-gold-tick" title="Verified Member"></i>' : ''}
                  </div>
                  <div class="spotlight-role">${escapeHtml(current.company || current.jobTitle || current.role)}</div>
                </div>
              </div>

              <div class="spotlight-body">
                <p class="spotlight-bio">${escapeHtml(current.bio || 'No bio yet.')}</p>

                <div class="spotlight-stats-row">
                  <div class="metric-pill">
                    <div class="metric-pill-num">${escapeHtml(current.isDemo ? current.stats?.followers : (current.socialStats?.instagramFollowers && current.socialStats.instagramFollowers !== '0' ? current.socialStats.instagramFollowers : '—'))}</div>
                    <div class="metric-pill-label">Audience</div>
                  </div>
                  <div class="metric-pill">
                    <div class="metric-pill-num" style="color:var(--gold)">${displayPingScore(current)}</div>
                    <div class="metric-pill-label">PingScore™</div>
                  </div>
                  <div class="metric-pill">
                    <div class="metric-pill-num" style="color:var(--accent-green)">${escapeHtml(current.isDemo ? current.stats?.engagement : (current.socialStats?.avgEngagement && current.socialStats.avgEngagement !== '0%' ? current.socialStats.avgEngagement : '—'))}</div>
                    <div class="metric-pill-label">Engagement</div>
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${(current.tags || []).slice(0, 4).map(t => `
                      <span style="font-size:11.5px; padding:3px 10px; border-radius:999px; background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid var(--border-subtle);">#${escapeHtml(t)}</span>
                    `).join('')}
                  </div>
                  <div style="font-size:12px; font-weight:700; color:var(--gold);">
                    ${escapeHtml(rateLine(current))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Bar Dock -->
          <div class="spotlight-actions">
            <button class="action-circle-btn action-btn-pass" id="btnSwipePass" title="Pass (Skip Candidate)">
              <i class="ph-bold ph-x"></i>
            </button>
            <button class="action-circle-btn action-btn-super" id="btnSwipeSuper" title="Super-Ping: stand out in their notifications">
              <i class="ph-fill ph-lightning"></i>
            </button>
            <button class="action-circle-btn action-btn-ping" id="btnSwipePing" title="Ping & Connect (Establish Match)">
              <i class="ph-fill ph-heart"></i>
            </button>
          </div>
        </div>

        <!-- Right: AI Match Radar & Opportunity Hub - one tabbed card
             instead of three stacked ones, so this column stops eating so
             much vertical space for content most people only glance at. -->
        <div class="panoramic-radar-col">
          <div class="radar-card sidebar-tabbed-card">
            <div class="radar-card-header">
              <div class="view-mode-switch sidebar-tab-switch">
                <button class="view-mode-btn ${activeSidebarTab === 'radar' ? 'active' : ''}" data-sidebar-tab="radar" title="Suggested matches">
                  <i class="ph-fill ph-users-three"></i> Suggested
                </button>
                <button class="view-mode-btn ${activeSidebarTab === 'briefs' ? 'active' : ''}" data-sidebar-tab="briefs" title="Open campaign briefs">
                  <i class="ph-fill ph-megaphone-simple"></i> Briefs
                </button>
                <button class="view-mode-btn ${activeSidebarTab === 'insight' ? 'active' : ''}" data-sidebar-tab="insight" title="Why this match">
                  <i class="ph-fill ph-sparkle"></i> Why
                </button>
              </div>
              
            </div>

            ${activeSidebarTab === 'radar' ? `
              <div class="radar-list">
                ${radarPeers.length === 0 ? `
                  <div style="text-align:center; padding:18px 10px; font-size:12px; color:var(--text-dim);">
                    No other live matches right now — check back soon.
                  </div>
                ` : radarPeers.map((p, i) => {
                  const pAnalysis = aiService.generateMatchAnalysis(store.currentUser, p);
                  return `
                    <div class="radar-item" data-id="${p.id}" title="Click to view ${escapeHtml(p.name)}" style="animation-delay:${i * 0.06}s;">
                      <div class="radar-item-left">
                        <img src="${escapeHtml(p.avatar)}" alt="${escapeHtml(p.name)}" class="radar-item-avatar">
                        <div>
                          <div class="radar-item-name">${escapeHtml(p.name)} ${p.isDemo ? '<span style="font-size:9px; font-weight:700; text-transform:uppercase; color:#9d4edd; letter-spacing:0.4px;">Demo</span>' : ''}</div>
                          <div class="radar-item-role">${escapeHtml(p.company || p.jobTitle || p.role)}</div>
                        </div>
                      </div>
                      <div class="radar-item-actions">
                        <div class="radar-item-score">
                          <i class="ph-fill ph-sparkle"></i> ${pAnalysis.score}%
                        </div>
                        <button class="radar-item-ping-btn btn-radar-ping" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Quick-Ping ${escapeHtml(p.name)}">
                          <i class="ph-fill ph-lightning"></i>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}

            ${activeSidebarTab === 'briefs' ? `
              <div class="bounties-quick-list">
                ${hotBriefs.length === 0 ? `
                  <div style="text-align:center; padding:18px 10px; font-size:12px; color:var(--text-dim);">
                    No live campaign briefs right now.
                  </div>
                ` : hotBriefs.map((b, i) => `
                  <div class="bounty-quick-card" data-brief-id="${b.id}" style="animation-delay:${i * 0.06}s;">
                    <div class="bounty-quick-title">${escapeHtml(b.title)}</div>
                    <div class="bounty-quick-meta">
                      <span style="color:var(--text-muted); font-size:11px;">By ${escapeHtml(b.brandName || 'A local brand')}</span>
                      <span class="bounty-budget-tag">${escapeHtml(b.budget || 'Custom')}</span>
                    </div>
                    ${store.currentUser.role === 'INFLUENCER' ? `
                      <button class="btn-bounty-quick-pitch" data-brief-id="${b.id}" title="Pitch for this brief">
                        <i class="ph-fill ph-paper-plane-tilt"></i> Quick Pitch
                      </button>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
              <button class="btn-glass" id="btnSidebarViewBriefs" style="width:100%; margin-top:12px; padding:8px; font-size:12px;">View All Campaign Briefs</button>
            ` : ''}

            ${activeSidebarTab === 'insight' ? `
              <div class="concierge-tab-content">
                <p style="font-size:12.5px; color:var(--text-muted); line-height:1.5;">
                  ${escapeHtml(analysis.reason)}
                </p>
                <div style="margin-top:10px; font-size:11px; color:var(--gold); font-weight:600;">
                  Tip: Agree on deliverables and deadlines in writing in Deal Room before you start production.
                </div>
                <div style="display:flex; gap:8px; margin-top:14px;">
                  <button class="btn-concierge-action" id="btnCopyInsight" title="Copy this insight to use in your outreach message">
                    <i class="ph-bold ph-copy"></i> Copy Insight
                  </button>
                  <button class="btn-concierge-action" id="btnViewFullDossier" title="See the full AI match breakdown">
                    <i class="ph-bold ph-magnifying-glass"></i> Full Dossier
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- AI Matchmaker Dossier Modal -->
      <div class="platform-modal-backdrop" id="matchDossierModal">
        <div class="platform-modal-window">
          <button class="platform-modal-close" id="closeDossierModal">&times;</button>
          
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
            <div class="app-modal-icon"><i class="ph-fill ph-sparkle"></i></div>
            <div>
              <h2 class="app-modal-title">Why you <em>match</em></h2>
              <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(store.currentUser.name)} ✕ ${escapeHtml(current.name)}</div>
            </div>
          </div>

          <div style="background:rgba(230,255,26,0.08); border:1px solid var(--border-gold); border-radius:var(--radius-md); padding:18px; margin-bottom:20px;">
            <div style="font-size:15px; font-weight:700; color:var(--gold); line-height:1.4;">
              ${escapeHtml(analysis.reason)}
            </div>
          </div>

          <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--text-dim); letter-spacing:0.8px; margin-bottom:12px;">What you have in common</div>
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:24px;">
            ${analysis.insights.map(item => `
              <div style="display:flex; align-items:flex-start; gap:12px; background:rgba(255,255,255,0.025); border:1px solid var(--border-subtle); padding:12px 16px; border-radius:var(--radius-sm); font-size:13.5px;">
                <i class="ph-fill ph-check-circle" style="color:var(--accent-cyan); font-size:18px; margin-top:2px; flex-shrink:0;"></i>
                <span style="color:var(--text-muted);">${escapeHtml(item)}</span>
              </div>
            `).join('')}
          </div>

          <button class="btn-gold" id="btnDossierConnect" style="width:100%; padding:14px;">
            <i class="ph-fill ph-lightning"></i> Connect with ${escapeHtml(current.name)}
          </button>
        </div>
      </div>
    `;
  }

  function renderBentoRoster(list) {
    if (!list || list.length === 0) {
      return `
        <div class="glass-box" style="padding:60px 30px; text-align:center; max-width:480px; margin:20px auto;">
          <i class="ph-fill ph-funnel-simple" style="font-size:44px; color:var(--text-dim); margin-bottom:14px; display:inline-block;"></i>
          <h3 style="font-family:var(--font-heading); font-size:19px; color:#fff; margin-bottom:6px;">No Members Match Your Filters</h3>
          <p style="color:var(--text-muted); font-size:13.5px; line-height:1.5;">
            Try a different niche tag, or turn off "Verified Only" to widen the search.
          </p>
        </div>
      `;
    }

    return `
      <div class="bento-roster-grid">
        ${list.map(u => {
          const analysis = aiService.generateMatchAnalysis(store.currentUser, u);
          return `
            <div class="bento-member-card">
              <div class="bento-member-thumb">
                <img src="${escapeHtml(u.avatar)}" alt="${escapeHtml(u.name)}">
                <div style="position:absolute; top:12px; left:12px; background:rgba(0,0,0,0.8); border:1px solid var(--border-gold); padding:4px 10px; border-radius:999px; font-size:11.5px; font-weight:700; color:var(--gold); display:flex; align-items:center; gap:5px;">
                  <i class="ph-fill ph-sparkle"></i> ${analysis.score}% Match
                </div>
                ${u.isDemo ? `<div style="position:absolute; top:44px; left:12px; background:rgba(157,78,221,0.85); padding:3px 10px; border-radius:999px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:#fff;">Demo</div>` : ''}
                <div style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.7); padding:4px 10px; border-radius:999px; font-size:11px; color:#fff;">
                  <i class="ph-fill ph-map-pin"></i> ${escapeHtml(u.location || 'India')}
                </div>
              </div>

              <div class="bento-member-body">
                <div>
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-family:var(--font-heading); font-size:19px; font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
                      ${escapeHtml(u.name)}
                      ${u.verified ? '<i class="ph-fill ph-seal-check verified-gold-tick" style="font-size:18px;"></i>' : ''}
                    </div>
                  </div>
                  <div style="font-size:13px; color:var(--gold-glow); margin-top:2px;">${escapeHtml(u.company || u.jobTitle || u.role)}</div>
                  <p style="font-size:13px; color:var(--text-muted); margin-top:8px; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                    ${escapeHtml(u.bio || 'No bio yet.')}
                  </p>
                </div>

                <div>
                  <div class="spotlight-stats-row" style="margin:8px 0 16px;">
                    <div class="metric-pill"><div class="metric-pill-num">${escapeHtml(u.isDemo ? u.stats?.followers : (u.socialStats?.instagramFollowers && u.socialStats.instagramFollowers !== '0' ? u.socialStats.instagramFollowers : '—'))}</div><div class="metric-pill-label">Reach</div></div>
                    <div class="metric-pill"><div class="metric-pill-num" style="color:var(--gold)">${displayPingScore(u)}</div><div class="metric-pill-label">PingScore™</div></div>
                    <div class="metric-pill"><div class="metric-pill-num" style="color:var(--accent-green)">${escapeHtml(u.isDemo ? u.stats?.engagement : (u.socialStats?.avgEngagement && u.socialStats.avgEngagement !== '0%' ? u.socialStats.avgEngagement : '—'))}</div><div class="metric-pill-label">Engage</div></div>
                  </div>

                  <button class="btn-gold btn-roster-connect" data-id="${u.id}" style="width:100%;">
                    <i class="ph-fill ph-lightning"></i> Connect & Deal
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function bindEvents(filtered) {
    // Mode switcher
    const btnSpotlight = container.querySelector('#btnModeSpotlight');
    const btnBento = container.querySelector('#btnModeBento');
    if (btnSpotlight) {
      btnSpotlight.onclick = () => {
        currentMode = 'spotlight';
        render();
      };
    }
    if (btnBento) {
      btnBento.onclick = () => {
        currentMode = 'bento';
        render();
      };
    }

    // Sidebar tab switcher (Radar / Briefs / Insight)
    container.querySelectorAll('[data-sidebar-tab]').forEach(btn => {
      btn.onclick = () => {
        activeSidebarTab = btn.getAttribute('data-sidebar-tab');
        render();
      };
    });

    // Tag filters
    const btnVerified = container.querySelector('#btnFilterVerified');
    if (btnVerified) {
      btnVerified.onclick = () => {
        verifiedOnly = !verifiedOnly;
        currentIndex = 0;
        topId = null;
        render();
      };
    }

    container.querySelectorAll('.tag-filter-chip[data-tag]').forEach(chip => {
      chip.onclick = () => {
        activeTagFilter = chip.getAttribute('data-tag');
        currentIndex = 0;
        topId = null;
        render();
      };
    });

    // Reset button
    const btnReset = container.querySelector('#btnResetDiscovery');
    if (btnReset) {
      btnReset.onclick = () => {
        currentIndex = 0;
        topId = null;
        store.swipes[store.currentUser.id] = [];
        store.save();
        render();
        onShowToast('Spotlight deck refreshed! ⚡');
      };
    }

    // Swipe action buttons
    const btnPass = container.querySelector('#btnSwipePass');
    const btnPing = container.querySelector('#btnSwipePing');
    const btnSuper = container.querySelector('#btnSwipeSuper');

    if (btnPass) btnPass.onclick = () => handleSwipe('LEFT', filtered);
    if (btnPing) btnPing.onclick = () => handleSwipe('RIGHT', filtered);
    if (btnSuper) btnSuper.onclick = () => handleSwipe('UP', filtered);

    // Drag-to-swipe (Tinder-style): pointer follows the card with tilt +
    // live PING/PASS/SUPER stamp opacity, released past a threshold commits
    // the swipe, otherwise it springs back to center.
    bindCardDrag(filtered);

    // AI Dossier Modal
    const btnDossier = container.querySelector('#btnOpenMatchDossier');
    const modal = container.querySelector('#matchDossierModal');
    const closeModal = container.querySelector('#closeDossierModal');
    const btnConnect = container.querySelector('#btnDossierConnect');

    if (btnDossier && modal) btnDossier.onclick = () => modal.classList.add('active');
    if (closeModal && modal) closeModal.onclick = () => modal.classList.remove('active');
    if (btnConnect) {
      btnConnect.onclick = () => {
        if (modal) modal.classList.remove('active');
        handleSwipe('RIGHT', filtered);
      };
    }

    // Concierge Strategist quick actions
    const btnViewFullDossier = container.querySelector('#btnViewFullDossier');
    if (btnViewFullDossier && modal) {
      btnViewFullDossier.onclick = () => modal.classList.add('active');
    }

    const btnCopyInsight = container.querySelector('#btnCopyInsight');
    if (btnCopyInsight) {
      btnCopyInsight.onclick = async () => {
        // analysis (from renderPanoramicSpotlight) isn't in scope here -
        // recompute for the card currently on top of the deck.
        const activeCandidate = filtered[currentIndex];
        if (!activeCandidate) return;
        const currentAnalysis = aiService.generateMatchAnalysis(store.currentUser, activeCandidate);
        try {
          await navigator.clipboard.writeText(currentAnalysis.reason);
          onShowToast('Insight copied — paste it into your outreach message!');
        } catch (err) {
          console.error('Clipboard write failed:', err);
          onShowToast('Could not copy — your browser may be blocking clipboard access.');
        }
      };
    }

    // Radar item clicks - jump the spotlight deck to that candidate
    container.querySelectorAll('.radar-item[data-id]').forEach(item => {
      item.onclick = () => {
        const id = item.getAttribute('data-id');
        const targetIdx = filtered.findIndex(f => f.id === id);
        if (targetIdx !== -1) {
          currentIndex = targetIdx;
          topId = id;
          render();
        } else {
          onShowToast('That match is outside your current filter — clear filters to view them.');
        }
      };
    });

    // Radar quick-ping - connect directly from the sidebar without leaving
    // the current spotlight card. Independent of currentIndex/handleSwipe
    // since the target usually isn't the card currently on screen.
    container.querySelectorAll('.btn-radar-ping').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name') || 'this member';
        btn.disabled = true;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i>';
        try {
          const isMatch = await store.recordSwipe(id, 'RIGHT');
          btn.classList.add('pinged');
          btn.innerHTML = '<i class="ph-fill ph-check"></i>';
          if (isMatch) {
            triggerConfetti();
            onShowToast(`High-Intent Match with ${name}! ⚡ Opening Deal Room...`);
            setTimeout(() => onOpenDealRoom(id), 1000);
          } else if (isDemoProfile(id)) {
            onShowToast(`${name} is a demo profile, so no ping was sent.`);
          } else {
            onShowToast(`Ping sent to ${name}!`);
          }
        } catch (err) {
          console.error('Radar quick-ping failed:', err);
          btn.disabled = false;
          btn.innerHTML = originalHtml;
          onShowToast('Could not send ping — please try again.');
        }
      };
    });

    // View All briefs link
    const btnBriefs = container.querySelector('#btnSidebarViewBriefs');
    if (btnBriefs && window.pingPlatform) {
      btnBriefs.onclick = () => window.pingPlatform.switchView('briefs');
    }

    // Quick bounty clicks - jump to Campaign Briefs, scrolled to that brief
    container.querySelectorAll('.bounty-quick-card[data-brief-id]').forEach(card => {
      card.onclick = () => {
        if (window.pingPlatform) window.pingPlatform.switchView('briefs', card.getAttribute('data-brief-id'));
      };
    });

    // Quick Pitch - same destination, but auto-opens the pitch modal too
    // (see briefsPlatform.js's focusBriefId handling) instead of making the
    // creator find and click "Pitch" again themselves.
    container.querySelectorAll('.btn-bounty-quick-pitch').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (window.pingPlatform) window.pingPlatform.switchView('briefs', btn.getAttribute('data-brief-id'));
      };
    });

    // Bento Connect Buttons
    container.querySelectorAll('.btn-roster-connect').forEach(btn => {
      btn.onclick = async () => {
        if (btn.disabled) return;
        const id = btn.getAttribute('data-id');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Connecting...';
        try {
          const isMatch = await store.recordSwipe(id, 'RIGHT');
          if (isMatch) {
            triggerConfetti();
            onShowToast('High-Intent Match Established! Opening Deal Room...');
            setTimeout(() => onOpenDealRoom(id), 1000);
          } else if (isDemoProfile(id)) {
            btn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Demo profile';
            onShowToast('That was a demo profile, so no invite was sent.');
          } else {
            btn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Invite Sent';
            onShowToast('Partnership invite sent!');
          }
        } catch (err) {
          console.error('Connect failed:', err);
          btn.disabled = false;
          btn.innerHTML = originalHtml;
          onShowToast('Could not send invite — please try again.');
        }
      };
    });
  }

  function bindCardDrag(filtered) {
    const cardEl = container.querySelector('#activeSpotlightCard');
    if (!cardEl) return;

    const stampPing = container.querySelector('#stampPing');
    const stampPass = container.querySelector('#stampPass');
    const stampSuper = container.querySelector('#stampSuper');

    const SWIPE_THRESHOLD = 110;
    const UP_THRESHOLD = 90;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;

    function setStamps(x, y) {
      const rightStrength = Math.min(1, Math.max(0, x) / SWIPE_THRESHOLD);
      const leftStrength = Math.min(1, Math.max(0, -x) / SWIPE_THRESHOLD);
      const upStrength = Math.min(1, Math.max(0, -y - Math.abs(x) * 0.5) / UP_THRESHOLD);
      if (stampPing) stampPing.style.opacity = rightStrength.toString();
      if (stampPass) stampPass.style.opacity = leftStrength.toString();
      if (stampSuper) stampSuper.style.opacity = upStrength.toString();
    }

    function onPointerMove(e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      const rotate = dx / 18;
      cardEl.style.transition = 'none';
      cardEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;
      setStamps(dx, dy);
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      cardEl.releasePointerCapture?.(cardEl._activePointerId);
      cardEl.style.transition = '';

      const wentUp = -dy - Math.abs(dx) * 0.5 > UP_THRESHOLD;
      const wentRight = dx > SWIPE_THRESHOLD;
      const wentLeft = dx < -SWIPE_THRESHOLD;

      if (wentUp) {
        handleSwipe('UP', filtered);
      } else if (wentRight) {
        handleSwipe('RIGHT', filtered);
      } else if (wentLeft) {
        handleSwipe('LEFT', filtered);
      } else {
        // Spring back to center
        cardEl.style.transform = 'translate(0, 0) rotate(0deg)';
        setStamps(0, 0);
      }
    }

    cardEl.addEventListener('pointerdown', (e) => {
      // Ignore drags started on the AI dossier badge so its click still works.
      if (e.target.closest('#btnOpenMatchDossier')) return;
      // A swipe is already committing (fly-off + cascade in progress) -
      // don't let a fresh drag interrupt it or fight handleSwipe's lock.
      if (swipeLocked) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      dy = 0;
      cardEl._activePointerId = e.pointerId;
      cardEl.setPointerCapture?.(e.pointerId);
    });
    cardEl.addEventListener('pointermove', onPointerMove);
    cardEl.addEventListener('pointerup', onPointerUp);
    cardEl.addEventListener('pointercancel', onPointerUp);
  }

  function handleSwipe(direction, filtered) {
    if (currentIndex >= filtered.length) return;
    // Guards against a rapid double-click/double-drag firing a second swipe
    // on the same candidate before the 320ms cascade + re-render settles.
    if (swipeLocked) return;
    swipeLocked = true;
    const actionsBar = container.querySelector('.spotlight-actions');
    if (actionsBar) actionsBar.style.pointerEvents = 'none';
    const target = filtered[currentIndex];
    const cardEl = container.querySelector('#activeSpotlightCard');
    const depth1El = container.querySelector('.spotlight-card.depth-1');
    const depth2El = container.querySelector('.spotlight-card.depth-2');

    if (cardEl) {
      if (direction === 'LEFT') {
        cardEl.style.transform = 'translateX(-120%) rotate(-25deg)';
        cardEl.style.opacity = '0';
      } else if (direction === 'RIGHT') {
        cardEl.style.transform = 'translateX(120%) rotate(25deg)';
        cardEl.style.opacity = '0';
      } else if (direction === 'UP') {
        cardEl.style.transform = 'translateY(-120%) scale(1.1)';
        cardEl.style.opacity = '0';
      }
    }

    // Cascade the stack forward immediately: promote the cards behind into
    // the top/depth-1 slots using the SAME elements (not a rebuild), so the
    // existing CSS transition on .spotlight-card animates them smoothly into
    // place while the top card is still flying off. The full re-render 320ms
    // later then swaps in fresh, fully-detailed markup at those exact same
    // resting positions, so it reads as a seamless cascade rather than a cut.
    if (depth1El) {
      depth1El.classList.remove('depth-1');
      depth1El.classList.add('top-card');
    }
    if (depth2El) {
      depth2El.classList.remove('depth-2');
      depth2El.classList.add('depth-1');
    }

    // The swiped person drops out of the candidate list, so the next card
    // takes over this same position - hence topId, not currentIndex++.
    const successor = filtered[currentIndex + 1];
    setTimeout(async () => {
      try {
        const isMatch = await store.recordSwipe(target.id, direction);
        topId = successor ? successor.id : null;
        if (isMatch) {
          triggerConfetti();
          onShowToast(`High-Intent Match with ${target.name}! ⚡`);
        }
      } catch (err) {
        console.error('Swipe failed:', err);
        topId = target.id; // not saved: bring the card back
        onShowToast("That didn't save. Check your connection and try again.");
      }
      swipeLocked = false;
      render();
    }, 320);
  }

  function triggerConfetti() {
    if (window.confetti) {
      window.confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#E6FF1A', '#00F2FE', '#FFFFFF']
      });
    }
  }

  render();

  // Live updates (a new real candidate signing up, a live brief loading in,
  // a block/unblock, etc.) should reach this screen while it's open, not
  // just on next visit. Skipped mid-swipe (swipeLocked) so a reactive
  // render doesn't yank out the depth1/depth2 elements handleSwipe is
  // mid-way through cascading into place - the explicit render() at the end
  // of that 320ms window already picks up fresh data on its own.
  const unsubscribeStore = store.subscribe(() => {
    if (!swipeLocked) render();
  });
  return unsubscribeStore;
}
