// Ping Web Platform - Discovery View (Swipe Deck + Concierge Grid + AI Matchmaker)
import { store } from '../state.js';
import { aiService } from '../aiService.js';

export function renderDiscoveryView(container, onOpenChat, onShowToast) {
  const candidates = store.getDiscoveryCandidates();
  let currentMode = 'deck'; // 'deck' | 'grid'
  let activeTagFilter = 'ALL';
  let verifiedOnly = false;
  let currentDeckIndex = 0;

  function render() {
    // Filter candidates
    let filtered = candidates.filter(c => {
      if (verifiedOnly && !c.verified) return false;
      if (activeTagFilter !== 'ALL') {
        return c.tags && c.tags.includes(activeTagFilter);
      }
      return true;
    });

    // Unique tags from all candidates
    const allTags = ['ALL', ...new Set(candidates.flatMap(c => c.tags || []))].slice(0, 8);

    container.innerHTML = `
      <div class="discovery-container">
        <div class="view-header">
          <div class="view-title-group">
            <h1><i class="ph-fill ph-lightning" style="color:var(--gold-primary)"></i> Discovery Concierge</h1>
            <p>AI-assisted matchmaking between vetted creators and premier brands.</p>
          </div>
          <div class="discovery-controls">
            <div class="discovery-mode-toggles">
              <button class="mode-toggle-btn ${currentMode === 'deck' ? 'active' : ''}" id="toggleDeckMode">
                <i class="ph-bold ph-cards"></i> Swipe Deck
              </button>
              <button class="mode-toggle-btn ${currentMode === 'grid' ? 'active' : ''}" id="toggleGridMode">
                <i class="ph-bold ph-squares-four"></i> Concierge Grid
              </button>
            </div>
            <div class="discovery-filters">
              <button class="filter-chip ${verifiedOnly ? 'active' : ''}" id="toggleVerifiedFilter">
                <i class="ph-fill ph-seal-check"></i> Verified Only
              </button>
              ${allTags.map(tag => `
                <button class="filter-chip ${activeTagFilter === tag ? 'active' : ''}" data-tag="${tag}">
                  ${tag}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <div id="discoveryContentArea">
          ${currentMode === 'deck' 
            ? renderSwipeDeck(filtered, currentDeckIndex) 
            : renderConciergeGrid(filtered)}
        </div>
      </div>
    `;

    bindEvents(filtered);
  }

  function renderSwipeDeck(list, index) {
    if (!list || list.length === 0 || index >= list.length) {
      return `
        <div class="glass-panel" style="padding:60px 30px; text-align:center; max-width:500px; margin:40px auto;">
          <i class="ph-fill ph-check-circle" style="font-size:52px; color:var(--gold-primary); margin-bottom:16px;"></i>
          <h2 style="font-family:'Space Grotesk',sans-serif; font-size:24px; margin-bottom:8px;">You're All Caught Up!</h2>
          <p style="color:var(--text-secondary); font-size:14px; margin-bottom:24px;">
            You have reviewed all available profiles for your criteria. Check back soon for newly verified partners.
          </p>
          <button class="btn-primary" id="btnResetDeck" style="background:var(--gold-primary); color:#000; padding:10px 24px; border-radius:999px; font-weight:700; border:none; cursor:pointer;">
            Reset Discovery Deck
          </button>
        </div>
      `;
    }

    const current = list[index];
    const next = list[index + 1];
    const matchAnalysis = aiService.generateMatchAnalysis(store.currentUser, current);

    return `
      <div class="swipe-deck-stage">
        <!-- Next Card (Pre-stacked beneath) -->
        ${next ? `
          <div class="swipe-card stack-back">
            <div class="swipe-card-media">
              <img src="${next.avatar}" alt="${next.name}">
              <div class="swipe-card-gradient"></div>
            </div>
            <div class="swipe-card-body">
              <div class="card-name">${next.name}</div>
              <div class="card-headline">${next.company || next.jobTitle || next.role}</div>
            </div>
          </div>
        ` : ''}

        <!-- Active Front Card -->
        <div class="swipe-card stack-front" id="activeSwipeCard">
          <div class="swipe-card-media">
            <img src="${current.avatar}" alt="${current.name}">
            <div class="swipe-card-gradient"></div>

            <div class="card-ai-badge" id="btnTriggerAiInsight">
              <i class="ph-fill ph-sparkle"></i> ${matchAnalysis.score}% Match
            </div>

            <div class="card-location-badge">
              <i class="ph-fill ph-map-pin"></i> ${current.location || 'India'}
            </div>

            <div class="card-identity-overlay">
              <div class="card-name-row">
                <div class="card-name">${current.name}</div>
                ${current.verified ? '<i class="ph-fill ph-seal-check card-verified-icon"></i>' : ''}
              </div>
              <div class="card-headline">${current.company || current.jobTitle || current.role}</div>
            </div>
          </div>

          <div class="swipe-card-body">
            <p class="card-bio">${current.bio || 'Verified Ping network member.'}</p>

            <div class="card-stats-grid">
              <div class="stat-cell">
                <div class="stat-num">${current.stats?.followers || '100K+'}</div>
                <div class="stat-desc">Reach</div>
              </div>
              <div class="stat-cell">
                <div class="stat-num" style="color:var(--gold-primary)">${current.pingScore || 95}</div>
                <div class="stat-desc">PingScore</div>
              </div>
              <div class="stat-cell">
                <div class="stat-num">${current.stats?.engagement || '5.2%'}</div>
                <div class="stat-desc">Engagement</div>
              </div>
            </div>

            <div class="card-tags-row">
              ${(current.tags || []).slice(0, 4).map(t => `<span class="card-tag">#${t}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Action Bar -->
      <div class="swipe-actions-bar">
        <button class="swipe-action-btn swipe-btn-pass" id="btnPass" title="Pass">
          <i class="ph-bold ph-x"></i>
        </button>
        <button class="swipe-action-btn swipe-btn-super" id="btnSuperPing" title="Super-Ping (Instant Match)">
          <i class="ph-fill ph-lightning"></i>
        </button>
        <button class="swipe-action-btn swipe-btn-like" id="btnPing" title="Ping (Connect)">
          <i class="ph-fill ph-heart"></i>
        </button>
      </div>

      <!-- AI Matchmaker Modal for current profile -->
      <div class="app-modal-overlay" id="aiInsightModal">
        <div class="app-modal-box">
          <button class="app-modal-close" id="closeAiModal">&times;</button>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
            <i class="ph-fill ph-sparkle" style="color:var(--gold-primary); font-size:24px;"></i>
            <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px;">AI Concierge Match Report</h2>
          </div>
          <div style="background:rgba(255,215,0,0.08); border:1px solid var(--border-active); border-radius:14px; padding:16px; margin-bottom:20px;">
            <div style="font-size:16px; font-weight:700; color:var(--gold-primary); margin-bottom:4px;">
              ${matchAnalysis.reason}
            </div>
          </div>
          <h4 style="font-size:14px; text-transform:uppercase; color:var(--text-tertiary); letter-spacing:0.5px; margin-bottom:12px;">Strategic Collaboration Insights</h4>
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:24px;">
            ${matchAnalysis.insights.map(insight => `
              <div style="display:flex; align-items:flex-start; gap:10px; background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; border:1px solid var(--border-subtle); font-size:13.5px; line-height:1.45;">
                <i class="ph-fill ph-check-circle" style="color:var(--accent-cyan); font-size:18px; margin-top:2px;"></i>
                <span>${insight}</span>
              </div>
            `).join('')}
          </div>
          <button class="btn-primary" id="btnModalPing" style="width:100%; background:var(--gold-primary); color:#000; padding:12px; border-radius:999px; font-weight:700; border:none; cursor:pointer;">
            Connect with ${current.name}
          </button>
        </div>
      </div>
    `;
  }

  function renderConciergeGrid(list) {
    if (!list || list.length === 0) {
      return `
        <div class="glass-panel" style="padding:40px; text-align:center;">
          <p style="color:var(--text-secondary)">No profiles found matching your current filters.</p>
        </div>
      `;
    }

    return `
      <div class="concierge-grid">
        ${list.map(user => {
          const analysis = aiService.generateMatchAnalysis(store.currentUser, user);
          return `
            <div class="concierge-profile-card">
              <div class="concierge-thumb">
                <img src="${user.avatar}" alt="${user.name}">
                <div class="card-ai-badge" style="top:12px; left:12px;">
                  <i class="ph-fill ph-sparkle"></i> ${analysis.score}%
                </div>
              </div>
              <div class="concierge-body">
                <div>
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:700; color:#fff;">
                      ${user.name}
                      ${user.verified ? '<i class="ph-fill ph-seal-check" style="color:var(--gold-primary); margin-left:4px;"></i>' : ''}
                    </div>
                    <div style="font-size:12px; color:var(--text-tertiary);"><i class="ph-fill ph-map-pin"></i> ${user.location}</div>
                  </div>
                  <div style="font-size:13px; color:var(--gold-glow); margin-top:2px;">${user.company || user.jobTitle || user.role}</div>
                  <p style="font-size:12.5px; color:var(--text-secondary); margin-top:8px; line-height:1.4;">${user.bio?.slice(0, 100)}...</p>
                </div>

                <div>
                  <div class="card-stats-grid" style="margin:8px 0 14px;">
                    <div class="stat-cell"><div class="stat-num">${user.stats?.followers || 'N/A'}</div><div class="stat-desc">Reach</div></div>
                    <div class="stat-cell"><div class="stat-num" style="color:var(--gold-primary)">${user.pingScore}</div><div class="stat-desc">PingScore</div></div>
                    <div class="stat-cell"><div class="stat-num">${user.stats?.engagement || 'N/A'}</div><div class="stat-desc">Engage</div></div>
                  </div>
                  <button class="btn-primary btn-grid-connect" data-id="${user.id}" style="width:100%; background:var(--gold-primary); color:#000; padding:10px; border-radius:999px; font-weight:700; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                    <i class="ph-fill ph-lightning"></i> Connect & Pitch
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
    // Mode toggles
    const btnDeck = container.querySelector('#toggleDeckMode');
    const btnGrid = container.querySelector('#toggleGridMode');
    if (btnDeck) {
      btnDeck.onclick = () => {
        currentMode = 'deck';
        render();
      };
    }
    if (btnGrid) {
      btnGrid.onclick = () => {
        currentMode = 'grid';
        render();
      };
    }

    // Filter clicks
    const btnVerified = container.querySelector('#toggleVerifiedFilter');
    if (btnVerified) {
      btnVerified.onclick = () => {
        verifiedOnly = !verifiedOnly;
        currentDeckIndex = 0;
        render();
      };
    }

    container.querySelectorAll('.filter-chip[data-tag]').forEach(chip => {
      chip.onclick = () => {
        activeTagFilter = chip.getAttribute('data-tag');
        currentDeckIndex = 0;
        render();
      };
    });

    // Deck Action Buttons
    const btnPass = container.querySelector('#btnPass');
    const btnLike = container.querySelector('#btnPing');
    const btnSuper = container.querySelector('#btnSuperPing');
    const btnReset = container.querySelector('#btnResetDeck');

    if (btnReset) {
      btnReset.onclick = () => {
        store.swipes[store.currentUser.id] = [];
        store.save();
        currentDeckIndex = 0;
        render();
        onShowToast('Discovery deck refreshed!');
      };
    }

    if (btnPass) {
      btnPass.onclick = () => handleSwipe('LEFT', filtered);
    }
    if (btnLike) {
      btnLike.onclick = () => handleSwipe('RIGHT', filtered);
    }
    if (btnSuper) {
      btnSuper.onclick = () => handleSwipe('UP', filtered);
    }

    // AI Insights Modal
    const btnTriggerAi = container.querySelector('#btnTriggerAiInsight');
    const modal = container.querySelector('#aiInsightModal');
    const closeModal = container.querySelector('#closeAiModal');
    const btnModalPing = container.querySelector('#btnModalPing');

    if (btnTriggerAi && modal) {
      btnTriggerAi.onclick = () => modal.classList.add('active');
    }
    if (closeModal && modal) {
      closeModal.onclick = () => modal.classList.remove('active');
    }
    if (btnModalPing) {
      btnModalPing.onclick = () => {
        if (modal) modal.classList.remove('active');
        handleSwipe('RIGHT', filtered);
      };
    }

    // Grid connect buttons
    container.querySelectorAll('.btn-grid-connect').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const matched = store.recordSwipe(id, 'RIGHT');
        if (matched) {
          triggerMatchCelebration();
          onShowToast('It\'s a Match! Starting conversation...');
          setTimeout(() => onOpenChat(id), 1200);
        } else {
          onShowToast('Connection request sent!');
        }
      };
    });
  }

  function handleSwipe(direction, filtered) {
    if (currentDeckIndex >= filtered.length) return;
    const candidate = filtered[currentDeckIndex];
    const cardEl = container.querySelector('#activeSwipeCard');

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

    setTimeout(() => {
      const isMatch = store.recordSwipe(candidate.id, direction);
      if (isMatch) {
        triggerMatchCelebration();
        onShowToast(`It's a Match with ${candidate.name}! ⚡`);
      }
      currentDeckIndex++;
      render();
    }, 300);
  }

  function triggerMatchCelebration() {
    if (window.confetti) {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#00F2FE', '#FFFFFF']
      });
    }
  }

  render();
}
