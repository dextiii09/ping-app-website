// Ping Web Platform - Live Briefs View (Campaign Marketplace & Application Tracker)
import { store } from '../state.js';

export function renderBriefsView(container, onShowToast) {
  const isBusiness = store.currentUser.role === 'BUSINESS' || store.currentUser.role === 'ADMIN';

  function render() {
    const briefs = store.briefs;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1><i class="ph-fill ph-megaphone-simple" style="color:var(--gold-primary)"></i> Live Campaign Briefs</h1>
          <p>Verified brand campaigns with guaranteed milestone escrow and transparent deliverables.</p>
        </div>
        ${isBusiness ? `
          <button class="btn-primary" id="btnOpenCreateBrief" style="background:var(--gold-primary); color:#000; padding:10px 22px; border-radius:999px; font-weight:700; border:none; cursor:pointer; display:flex; align-items:center; gap:8px;">
            <i class="ph-bold ph-plus-circle"></i> Launch Live Brief
          </button>
        ` : ''}
      </div>

      <div class="briefs-grid">
        ${briefs.map(b => {
          const hasApplied = store.hasAppliedToBrief(b.id);
          const daysLeft = Math.max(1, Math.ceil((b.deadline - Date.now()) / (1000 * 60 * 60 * 24)));

          return `
            <div class="brief-card">
              <div>
                <div class="brief-brand-row">
                  <div class="brief-brand-info">
                    <div class="brief-brand-avatar">
                      <img src="${b.brandAvatar}" alt="${b.brandName}">
                    </div>
                    <div>
                      <div style="font-size:14px; font-weight:700; color:#fff;">${b.brandName}</div>
                      <div style="font-size:12px; color:var(--text-tertiary);"><i class="ph-fill ph-map-pin"></i> ${b.location}</div>
                    </div>
                  </div>
                  <div class="brief-budget-badge">${b.budget}</div>
                </div>

                <h3 class="brief-title" style="margin-top:16px;">${b.title}</h3>
                <p class="brief-desc" style="margin-top:10px;">${b.description}</p>

                <div style="margin:16px 0; display:flex; flex-direction:column; gap:6px;">
                  <div style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700;">Requirements</div>
                  ${(b.requirements || []).map(r => `
                    <div style="font-size:12.5px; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
                      <i class="ph-fill ph-check" style="color:var(--gold-primary)"></i> ${r}
                    </div>
                  `).join('')}
                </div>

                <div class="card-tags-row" style="margin-top:10px;">
                  ${(b.tags || []).map(t => `<span class="card-tag">#${t}</span>`).join('')}
                </div>
              </div>

              <div>
                <div class="brief-meta-bar">
                  <span><i class="ph-fill ph-clock"></i> ${daysLeft} days remaining</span>
                  <span><i class="ph-fill ph-users"></i> ${b.applicationsCount || 0} Pitches</span>
                </div>

                <div style="margin-top:14px;">
                  ${hasApplied ? `
                    <button class="btn-primary" style="width:100%; background:rgba(0,230,118,0.15); color:var(--accent-green); border:1px solid rgba(0,230,118,0.3); padding:10px; border-radius:999px; font-weight:700; cursor:default; display:flex; align-items:center; justify-content:center; gap:6px;">
                      <i class="ph-fill ph-check-circle"></i> Pitch Submitted
                    </button>
                  ` : `
                    <button class="btn-primary btn-apply-brief" data-id="${b.id}" data-title="${b.title}" data-budget="${b.budget}" style="width:100%; background:var(--gold-primary); color:#000; padding:10px; border-radius:999px; font-weight:700; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                      <i class="ph-fill ph-paper-plane-tilt"></i> Submit Pitch
                    </button>
                  `}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Create Brief Modal -->
      <div class="app-modal-overlay" id="createBriefModal">
        <div class="app-modal-box">
          <button class="app-modal-close" id="closeCreateModal">&times;</button>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
            <i class="ph-fill ph-megaphone-simple" style="color:var(--gold-primary); font-size:26px;"></i>
            <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px;">Launch New Campaign Brief</h2>
          </div>

          <form id="createBriefForm" style="display:flex; flex-direction:column; gap:14px;">
            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Campaign Title</label>
              <input type="text" id="briefTitleInput" placeholder="e.g. Flagship Product Launch Integration" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
            </div>

            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Brief Description & Creative Direction</label>
              <textarea id="briefDescInput" rows="3" placeholder="Outline campaign expectations, key talking points, and visual style..." required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px; resize:vertical;"></textarea>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Total Budget (₹)</label>
                <input type="text" id="briefBudgetInput" placeholder="e.g. 75,000" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Timeline (Days)</label>
                <input type="number" id="briefDaysInput" value="14" min="3" max="60" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
              </div>
            </div>

            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Target Tags (Comma separated)</label>
              <input type="text" id="briefTagsInput" placeholder="Tech, Gadgets, Cinematography" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
            </div>

            <button type="submit" class="btn-primary" style="margin-top:10px; background:var(--gold-primary); color:#000; padding:12px; border-radius:999px; font-weight:700; border:none; cursor:pointer;">
              Publish to Verified Network
            </button>
          </form>
        </div>
      </div>

      <!-- Apply / Pitch Modal -->
      <div class="app-modal-overlay" id="applyModal">
        <div class="app-modal-box">
          <button class="app-modal-close" id="closeApplyModal">&times;</button>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
            <i class="ph-fill ph-paper-plane-tilt" style="color:var(--gold-primary); font-size:26px;"></i>
            <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px;">Submit Campaign Pitch</h2>
          </div>

          <div id="applyBriefTargetHeader" style="background:rgba(255,255,255,0.04); padding:14px; border-radius:12px; margin-bottom:18px; border:1px solid var(--border-subtle);">
            <div id="applyModalBriefTitle" style="font-weight:700; color:#fff;"></div>
            <div id="applyModalBriefBudget" style="font-size:13px; color:var(--gold-primary); margin-top:2px;"></div>
          </div>

          <form id="applyPitchForm" style="display:flex; flex-direction:column; gap:14px;">
            <input type="hidden" id="applyTargetBriefId">
            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Your Proposed Deliverables & Concept</label>
              <textarea id="pitchTextInput" rows="4" placeholder="Describe your creative angle, estimated reach, and why your audience is the perfect match..." required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px; resize:vertical;"></textarea>
            </div>

            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Your Proposed Rate (₹)</label>
              <input type="text" id="pitchRateInput" placeholder="e.g. 75,000" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
            </div>

            <button type="submit" class="btn-primary" style="margin-top:10px; background:var(--gold-primary); color:#000; padding:12px; border-radius:999px; font-weight:700; border:none; cursor:pointer;">
              Send Pitch Directly to Brand
            </button>
          </form>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Create Brief Modal
    const btnOpenCreate = container.querySelector('#btnOpenCreateBrief');
    const createModal = container.querySelector('#createBriefModal');
    const closeCreate = container.querySelector('#closeCreateModal');
    const createForm = container.querySelector('#createBriefForm');

    if (btnOpenCreate && createModal) {
      btnOpenCreate.onclick = () => createModal.classList.add('active');
    }
    if (closeCreate && createModal) {
      closeCreate.onclick = () => createModal.classList.remove('active');
    }
    if (createForm) {
      createForm.onsubmit = (e) => {
        e.preventDefault();
        const title = container.querySelector('#briefTitleInput').value.trim();
        const description = container.querySelector('#briefDescInput').value.trim();
        const budget = container.querySelector('#briefBudgetInput').value.trim();
        const days = container.querySelector('#briefDaysInput').value.trim();
        const tags = container.querySelector('#briefTagsInput').value.split(',').map(t => t.trim()).filter(Boolean);

        store.createBrief({ title, description, budget, days, tags });
        createModal.classList.remove('active');
        onShowToast('Campaign brief published successfully! 🚀');
        render();
      };
    }

    // Apply Modal
    const applyModal = container.querySelector('#applyModal');
    const closeApply = container.querySelector('#closeApplyModal');
    const applyForm = container.querySelector('#applyPitchForm');

    container.querySelectorAll('.btn-apply-brief').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        const budget = btn.getAttribute('data-budget');

        container.querySelector('#applyTargetBriefId').value = id;
        container.querySelector('#applyModalBriefTitle').textContent = title;
        container.querySelector('#applyModalBriefBudget').textContent = `Target Budget: ${budget}`;
        container.querySelector('#pitchRateInput').value = budget;
        applyModal.classList.add('active');
      };
    });

    if (closeApply && applyModal) {
      closeApply.onclick = () => applyModal.classList.remove('active');
    }

    if (applyForm) {
      applyForm.onsubmit = (e) => {
        e.preventDefault();
        const briefId = container.querySelector('#applyTargetBriefId').value;
        const pitch = container.querySelector('#pitchTextInput').value.trim();
        const rate = container.querySelector('#pitchRateInput').value.trim();

        store.applyToBrief(briefId, pitch, rate);
        applyModal.classList.remove('active');
        onShowToast('Pitch submitted to brand! 🌟');
        render();
      };
    }
  }

  render();
}
