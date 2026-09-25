// Ping Platform - Campaign Briefs: brands post what they need, creators pitch.
import { store } from '../state.js';
import { escapeHtml } from '../domUtils.js';

export function renderBriefsPlatform(container, onShowToast, focusBriefId = null) {
  const isBusiness = store.currentUser.role === 'BUSINESS' || store.currentUser.role === 'ADMIN';
  let hasAppliedFocus = false;

  function render() {
    const briefs = store.briefs;

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h1 class="section-title">Campaign <em>briefs</em></h1>
          <p class="section-subtitle">${isBusiness ? 'Post what you need and let local creators pitch to you.' : 'Local brands looking for creators. Pitch the ones that fit you.'}</p>
        </div>

        ${isBusiness ? `
          <button class="btn-gold" id="btnLaunchNewBrief">
            <i class="ph-bold ph-plus"></i> Post a brief
          </button>
        ` : ''}
      </div>

      ${briefs.length === 0 ? `
        <div class="app-empty">
          <div class="app-empty-icon"><i class="ph-fill ph-megaphone-simple"></i></div>
          <h2>${isBusiness ? 'Post your first <em>brief</em>' : 'No briefs <em>yet</em>'}</h2>
          <p>${isBusiness
              ? 'Describe what you need and your budget. Creators near you can pitch to it directly.'
              : 'No local brands have posted a brief yet. Meanwhile, you can find brands and ping them directly.'}</p>
          <div class="app-empty-actions">
            ${isBusiness
              ? '<button class="btn-gold" id="btnEmptyNewBrief"><i class="ph-bold ph-plus"></i> Post a brief</button>'
              : '<button class="btn-gold" data-goto="explore"><i class="ph-bold ph-compass"></i> Find brands</button>'}
          </div>
        </div>
      ` : `
      <div class="briefs-market-grid">
        ${briefs.map(b => {
          const hasApplied = store.hasAppliedToBrief(b.id);
          const daysLeft = Math.max(1, Math.ceil((b.deadline - Date.now()) / (1000 * 60 * 60 * 24)));

          return `
            <div class="market-brief-card" id="brief-${b.id}">
              <div>
                <div class="brief-brand-header">
                  <div class="brand-profile-snippet">
                    <div class="brand-avatar-circle">
                      <img src="${escapeHtml(b.brandAvatar)}" alt="${escapeHtml(b.brandName)}">
                    </div>
                    <div>
                      <div style="font-weight:700; color:#fff; font-size:15px; display:flex; align-items:center; gap:6px;">
                        ${escapeHtml(b.brandName)}
                        ${b.isDemo ? `<span style="background:rgba(157,78,221,0.85); color:#fff; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; padding:2px 8px; border-radius:999px;">Demo</span>` : ''}
                      </div>
                      <div style="font-size:12px; color:var(--text-dim);"><i class="ph-fill ph-map-pin"></i> ${escapeHtml(b.location)}</div>
                    </div>
                  </div>
                  <div class="brief-budget-badge-pill">${escapeHtml(b.budget)}</div>
                </div>

                <h3 class="brief-heading-title" style="margin-top:16px;">${escapeHtml(b.title)}</h3>
                <p class="brief-body-text" style="margin-top:10px;">${escapeHtml(b.description)}</p>

                <!-- Deliverables & Requirements -->
                ${(b.requirements || []).length ? `<div class="brief-reqs">
                  <div class="brief-reqs-title">What they're asking for</div>
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    ${(b.requirements || []).map(r => `
                      <div style="font-size:12.5px; color:var(--text-muted); display:flex; align-items:center; gap:8px;">
                        <i class="ph-fill ph-check-circle" style="color:var(--gold); font-size:15px;"></i> ${escapeHtml(r)}
                      </div>
                    `).join('')}
                  </div>
                </div>` : ''}

                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  ${(b.tags || []).map(t => `
                    <span style="font-size:11px; padding:3px 10px; border-radius:999px; background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid var(--border-subtle);">#${escapeHtml(t)}</span>
                  `).join('')}
                </div>
              </div>

              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-dim); border-top:1px solid var(--border-subtle); padding-top:14px; margin-bottom:14px;">
                  <span><i class="ph-fill ph-clock"></i> ${daysLeft} day${daysLeft === 1 ? '' : 's'} left</span>
                  <span><i class="ph-fill ph-users"></i> ${b.applicationsCount || 0} pitch${(b.applicationsCount || 0) === 1 ? '' : 'es'}</span>
                </div>

                ${isBusiness ? '' : (hasApplied ? `
                  <div style="width:100%; text-align:center; background:rgba(0,230,118,0.12); color:var(--accent-green); border:1px solid rgba(0,230,118,0.3); padding:10px; border-radius:var(--radius-full); font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;">
                    <i class="ph-fill ph-check-circle"></i> Pitch sent
                  </div>
                ` : `
                  <button class="btn-gold btn-pitch-brief" data-id="${b.id}" data-title="${escapeHtml(b.title)}" data-budget="${escapeHtml(b.budget)}" style="width:100%;">
                    <i class="ph-fill ph-paper-plane-tilt"></i> Pitch for this
                  </button>
                `)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      `}

      <!-- Launch Brief Modal -->
      <div class="platform-modal-backdrop" id="modalLaunchBrief">
        <div class="platform-modal-window">
          <button class="platform-modal-close" id="closeLaunchModal">&times;</button>
          
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <div class="app-modal-icon"><i class="ph-fill ph-megaphone-simple"></i></div>
            <div>
              <h2 class="app-modal-title">Post a campaign <em>brief</em></h2>
              <div class="app-modal-sub">Creators on Ping can read it and pitch to you.</div>
            </div>
          </div>

          <form id="formLaunchBrief" style="display:flex; flex-direction:column; gap:16px;">
            <div>
              <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Campaign Title</label>
              <input type="text" id="inputBriefTitle" placeholder="e.g. Cold brew launch this month" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
            </div>

            <div>
              <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">What you need</label>
              <textarea id="inputBriefDesc" rows="3" placeholder="The product, the kind of content you want, key points to mention, who it's for…" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px; resize:vertical;"></textarea>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Budget (₹)</label>
                <input type="text" id="inputBriefBudget" placeholder="e.g. 85,000" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
              </div>
              <div>
                <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Duration (Days)</label>
                <input type="number" id="inputBriefDays" value="14" min="3" max="60" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
              </div>
            </div>

            <div>
              <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Target Tags (Comma separated)</label>
              <input type="text" id="inputBriefTags" placeholder="Tech, Audio, Cinematography, Setup" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
            </div>

            <button type="submit" class="btn-gold" style="margin-top:8px; padding:14px;">
              Publish Brief to Verified Creators
            </button>
          </form>
        </div>
      </div>

      <!-- Pitch Application Modal -->
      <div class="platform-modal-backdrop" id="modalPitchBrief">
        <div class="platform-modal-window">
          <button class="platform-modal-close" id="closePitchModal">&times;</button>
          
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
            <div class="platform-brand-icon"><i class="ph-fill ph-paper-plane-tilt"></i></div>
            <div>
              <h2 style="font-family:var(--font-heading); font-size:22px; color:#fff;">Submit Campaign Pitch</h2>
              <div id="pitchBriefContextSubtitle" style="font-size:13px; color:var(--gold); margin-top:2px;"></div>
            </div>
          </div>

          <form id="formPitchBrief" style="display:flex; flex-direction:column; gap:16px;">
            <input type="hidden" id="pitchTargetBriefId">

            <div>
              <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Your Creative Angle & Deliverables</label>
              <textarea id="inputPitchText" rows="4" placeholder="Detail your pitch: e.g. 1 4K YouTube review + 2 aesthetic reels with high-retention storytelling..." required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px; resize:vertical;"></textarea>
            </div>

            <div>
              <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Proposed Rate (₹)</label>
              <input type="text" id="inputPitchRate" placeholder="e.g. ₹85,000" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
            </div>

            <button type="submit" class="btn-gold" style="margin-top:8px; padding:14px;">
              Dispatch Pitch to Brand
            </button>
          </form>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const emptyNew = container.querySelector('#btnEmptyNewBrief');
    if (emptyNew) emptyNew.onclick = () => { const m = container.querySelector('#modalLaunchBrief'); if (m) m.classList.add('active'); };
    container.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.onclick = () => window.pingPlatform && window.pingPlatform.switchView(btn.getAttribute('data-goto'));
    });
    // Launch Brief Modal
    const btnOpen = container.querySelector('#btnLaunchNewBrief');
    const modalLaunch = container.querySelector('#modalLaunchBrief');
    const closeLaunch = container.querySelector('#closeLaunchModal');
    const formLaunch = container.querySelector('#formLaunchBrief');

    if (btnOpen && modalLaunch) btnOpen.onclick = () => modalLaunch.classList.add('active');
    if (closeLaunch && modalLaunch) closeLaunch.onclick = () => modalLaunch.classList.remove('active');

    if (formLaunch) {
      formLaunch.onsubmit = async (e) => {
        e.preventDefault();
        const title = container.querySelector('#inputBriefTitle').value.trim();
        const description = container.querySelector('#inputBriefDesc').value.trim();
        const budget = container.querySelector('#inputBriefBudget').value.trim();
        const days = container.querySelector('#inputBriefDays').value.trim();
        const tags = container.querySelector('#inputBriefTags').value.split(',').map(t => t.trim()).filter(Boolean);

        modalLaunch.classList.remove('active');
        try {
          await store.createBrief({ title, description, budget, days, tags });
          onShowToast('Campaign brief published to network! 🚀');
        } catch (err) {
          onShowToast('Could not publish brief — please try again.');
          console.error('createBrief failed:', err);
        }
        render();
      };
    }

    // Pitch Application Modal
    const modalPitch = container.querySelector('#modalPitchBrief');
    const closePitch = container.querySelector('#closePitchModal');
    const formPitch = container.querySelector('#formPitchBrief');

    function openPitchModalFor(id, title, budget) {
      container.querySelector('#pitchTargetBriefId').value = id;
      container.querySelector('#pitchBriefContextSubtitle').textContent = `${title} • ${budget}`;
      container.querySelector('#inputPitchRate').value = budget;
      modalPitch.classList.add('active');
    }

    container.querySelectorAll('.btn-pitch-brief').forEach(btn => {
      btn.onclick = () => {
        openPitchModalFor(btn.getAttribute('data-id'), btn.getAttribute('data-title'), btn.getAttribute('data-budget'));
      };
    });

    if (closePitch && modalPitch) closePitch.onclick = () => modalPitch.classList.remove('active');

    // Arrived here via a "Quick Pitch" shortcut elsewhere (e.g. the AI Match
    // Radar sidebar's Live Campaign Bounties) - scroll to that brief and open
    // its pitch modal directly instead of making the creator hunt for it.
    // Guarded to fire once, since this view re-renders reactively on every
    // store update (new briefs, pitch counts, etc.).
    if (focusBriefId && !hasAppliedFocus) {
      hasAppliedFocus = true;
      const targetBtn = container.querySelector(`.btn-pitch-brief[data-id="${focusBriefId}"]`);
      const targetCard = container.querySelector(`#brief-${focusBriefId}`);
      if (targetBtn && targetCard && !isBusiness) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.classList.add('brief-card-focused');
        openPitchModalFor(targetBtn.getAttribute('data-id'), targetBtn.getAttribute('data-title'), targetBtn.getAttribute('data-budget'));
      } else if (targetCard) {
        // Business/admin viewer, or no pitch button rendered for them -
        // still worth scrolling to the brief they asked to see.
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.classList.add('brief-card-focused');
      } else {
        // The brief this shortcut pointed at is no longer in store.briefs -
        // most likely the live Firestore fetch swapped out the seed/mock
        // data it was shown from a moment earlier. Fail loud, not silent.
        onShowToast('That brief is no longer available.');
      }
    }

    if (formPitch) {
      formPitch.onsubmit = async (e) => {
        e.preventDefault();
        const briefId = container.querySelector('#pitchTargetBriefId').value;
        const pitch = container.querySelector('#inputPitchText').value.trim();
        const rate = container.querySelector('#inputPitchRate').value.trim();

        modalPitch.classList.remove('active');
        try {
          const { alreadyPitched } = await store.applyToBrief(briefId, pitch, rate);
          onShowToast(alreadyPitched ? "You've already pitched on this brief." : 'Pitch sent to the brand! 🌟');
        } catch (err) {
          onShowToast('Could not submit pitch — please try again.');
          console.error('applyToBrief failed:', err);
        }
        render();
      };
    }
  }

  render();

  // Live briefs arrive via a Firestore subscription in state.js (see
  // loadRealBriefs), which calls store.notify() - re-render here so a new
  // brief or an updated pitch count shows up without a manual refresh.
  const unsubscribeStore = store.subscribe(() => { render(); });
  return unsubscribeStore;
}
