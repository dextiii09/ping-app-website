// Ping Web Platform - Profile & Media Kit View with AI Bio Optimizer
import { store } from '../state.js';
import { aiService } from '../aiService.js';

export function renderProfileView(container, onShowToast) {
  const user = store.currentUser;
  let isGeneratingBio = false;

  function render() {
    const isCreator = user.role === 'INFLUENCER';
    const isBusiness = user.role === 'BUSINESS';

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1><i class="ph-fill ph-user-circle" style="color:var(--gold-primary)"></i> Profile & Media Kit</h1>
          <p>Manage your public showcase, PingScore trust verification, and AI-optimized bio.</p>
        </div>
        <button class="btn-primary" id="btnPreviewMediaKit" style="background:var(--gold-primary); color:#000; padding:10px 22px; border-radius:999px; font-weight:700; border:none; cursor:pointer; display:flex; align-items:center; gap:8px;">
          <i class="ph-bold ph-cards"></i> Shareable Media Kit
        </button>
      </div>

      <div class="profile-view-layout">
        <!-- Profile Identity & Trust Column -->
        <div class="profile-card-hero">
          <div class="profile-avatar-large">
            <img src="${user.avatar}" alt="${user.name}">
          </div>
          <div style="font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
            ${user.name}
            ${user.verified ? '<i class="ph-fill ph-seal-check" style="color:var(--gold-primary); font-size:20px;"></i>' : ''}
          </div>
          <div style="font-size:13.5px; color:var(--gold-glow); margin-top:2px;">${user.company || user.jobTitle || user.role}</div>
          <div style="font-size:12.5px; color:var(--text-tertiary); margin-top:4px;"><i class="ph-fill ph-map-pin"></i> ${user.location || 'India'}</div>

          <!-- PingScore Trust Meter -->
          <div class="pingscore-gauge">
            <div>
              <div style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--gold-primary); letter-spacing:0.5px;">PingScore™ Trust</div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Completion & Escrow Vetted</div>
            </div>
            <div class="pingscore-value">${user.pingScore || 96}</div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%; margin-bottom:18px;">
            <div class="stat-cell" style="padding:10px;">
              <div class="stat-num" style="color:#00E676">${user.completionRate || 98}%</div>
              <div class="stat-desc">Contract Completion</div>
            </div>
            <div class="stat-cell" style="padding:10px;">
              <div class="stat-num">${user.responseTime || '< 2h'}</div>
              <div class="stat-desc">Avg Response</div>
            </div>
          </div>

          <div style="width:100%; text-align:left; border-top:1px solid var(--border-subtle); padding-top:14px;">
            <div style="font-size:11.5px; font-weight:700; color:var(--text-tertiary); text-transform:uppercase; margin-bottom:8px;">Verified Social Reach</div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-secondary)"><i class="ph-fill ph-instagram-logo" style="color:#E1306C"></i> Instagram</span>
                <span style="font-weight:700; color:#fff;">${user.socialStats?.instagramFollowers || '210K'}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-secondary)"><i class="ph-fill ph-youtube-logo" style="color:#FF0000"></i> YouTube</span>
                <span style="font-weight:700; color:#fff;">${user.socialStats?.youtubeSubscribers || '110K'}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-secondary)"><i class="ph-fill ph-tiktok-logo" style="color:#00F2FE"></i> TikTok / Shorts</span>
                <span style="font-weight:700; color:#fff;">${user.socialStats?.tiktokFollowers || '45K'}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-secondary)"><i class="ph-fill ph-chart-line-up" style="color:var(--gold-primary)"></i> Engagement</span>
                <span style="font-weight:700; color:var(--gold-primary);">${user.socialStats?.avgEngagement || '5.4%'}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Bio Optimizer & Profile Details -->
        <div style="display:flex; flex-direction:column; gap:20px;">
          <!-- AI Bio Optimizer Card -->
          <div class="glass-panel" style="padding:24px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <i class="ph-fill ph-sparkle" style="color:var(--gold-primary); font-size:20px;"></i>
                <h3 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:700; color:#fff;">AI Bio Optimizer (Gemini Engine)</h3>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <label style="font-size:11px; color:var(--text-tertiary); text-transform:uppercase;">Tone:</label>
                <select id="bioToneSelect" style="background:rgba(255,255,255,0.08); border:1px solid var(--border-subtle); border-radius:6px; color:#fff; font-size:12px; padding:4px 8px; outline:none;">
                  <option value="Professional">Professional & Clean</option>
                  <option value="Creative">Creative & Cinematic</option>
                  <option value="Witty">Witty & Direct</option>
                  <option value="Hype">High-Energy / Hype</option>
                </select>
                <button class="btn-primary" id="btnGenerateAiBio" ${isGeneratingBio ? 'disabled' : ''} style="background:var(--gold-primary); color:#000; padding:6px 14px; border-radius:999px; font-size:12px; font-weight:700; border:none; cursor:pointer; display:flex; align-items:center; gap:5px;">
                  ${isGeneratingBio ? '<i class="ph-bold ph-spinner ph-spin"></i> Generating...' : '<i class="ph-fill ph-magic-wand"></i> Optimize'}
                </button>
              </div>
            </div>

            <p style="font-size:14px; line-height:1.55; color:var(--text-primary); background:rgba(0,0,0,0.3); padding:16px; border-radius:12px; border:1px solid var(--border-subtle);" id="profileBioDisplay">
              ${user.bio || 'Add a bio to showcase your story.'}
            </p>
          </div>

          <!-- Edit Profile Form -->
          <div class="glass-panel" style="padding:24px;">
            <h3 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:700; color:#fff; margin-bottom:18px;">Profile Information</h3>

            <form id="editProfileForm" style="display:flex; flex-direction:column; gap:16px;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                <div>
                  <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Display Name</label>
                  <input type="text" id="profNameInput" value="${user.name || ''}" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
                </div>
                <div>
                  <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">${isBusiness ? 'Company Name' : 'Creator Brand / Studio'}</label>
                  <input type="text" id="profCompanyInput" value="${user.company || ''}" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                <div>
                  <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Location</label>
                  <input type="text" id="profLocationInput" value="${user.location || ''}" placeholder="e.g. Mumbai, MH" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
                </div>
                <div>
                  <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Tags & Niches (Comma separated)</label>
                  <input type="text" id="profTagsInput" value="${(user.tags || []).join(', ')}" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
                </div>
              </div>

              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Bio Description</label>
                <textarea id="profBioInput" rows="3" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px; resize:vertical;">${user.bio || ''}</textarea>
              </div>

              <button type="submit" class="btn-primary" style="align-self:flex-start; background:var(--gold-primary); color:#000; padding:11px 24px; border-radius:999px; font-weight:700; border:none; cursor:pointer;">
                Save Profile Changes
              </button>
            </form>
          </div>
        </div>
      </div>

      <!-- Shareable Media Kit Modal -->
      <div class="app-modal-overlay" id="mediaKitModal">
        <div class="app-modal-box" style="max-width:680px;">
          <button class="app-modal-close" id="closeMediaKitModal">&times;</button>
          
          <div style="background:linear-gradient(135deg, #1f1d14 0%, #0d0d10 100%); border:1px solid var(--gold-primary); border-radius:18px; padding:28px; box-shadow:0 0 40px rgba(255,215,0,0.15);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <div style="width:64px; height:64px; border-radius:999px; overflow:hidden; border:2px solid var(--gold-primary);">
                  <img src="${user.avatar}" alt="${user.name}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div>
                  <div style="font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:700; color:#fff;">${user.name}</div>
                  <div style="font-size:13px; color:var(--gold-primary); font-weight:600;">${user.company || user.jobTitle}</div>
                  <div style="font-size:12px; color:var(--text-tertiary);">${user.location} • Verified on Ping</div>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-family:'Space Grotesk',sans-serif; font-size:28px; font-weight:700; color:var(--gold-primary);">${user.pingScore || 96}</div>
                <div style="font-size:10px; color:var(--text-tertiary); text-transform:uppercase;">PingScore™</div>
              </div>
            </div>

            <p style="font-size:13.5px; line-height:1.5; color:var(--text-secondary); margin-bottom:20px;">${user.bio}</p>

            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; background:rgba(0,0,0,0.4); padding:14px; border-radius:12px; margin-bottom:20px;">
              <div style="text-align:center;">
                <div style="font-size:16px; font-weight:700; color:#fff;">${user.socialStats?.instagramFollowers || '210K'}</div>
                <div style="font-size:10px; color:var(--text-tertiary);">Instagram</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:16px; font-weight:700; color:#fff;">${user.socialStats?.youtubeSubscribers || '110K'}</div>
                <div style="font-size:10px; color:var(--text-tertiary);">YouTube</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:16px; font-weight:700; color:var(--gold-primary);">${user.socialStats?.avgEngagement || '5.4%'}</div>
                <div style="font-size:10px; color:var(--text-tertiary);">Engagement</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:16px; font-weight:700; color:#00E676;">${user.completionRate || 98}%</div>
                <div style="font-size:10px; color:var(--text-tertiary);">Completion</div>
              </div>
            </div>

            <div class="card-tags-row">
              ${(user.tags || []).map(t => `<span class="card-tag" style="background:rgba(255,215,0,0.1); color:var(--gold-primary);">#${t}</span>`).join('')}
            </div>
          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
            <button class="btn-exit-app" id="btnPrintMediaKit" style="padding:10px 18px; border-radius:999px;">
              <i class="ph-bold ph-printer"></i> Print / Save PDF
            </button>
            <button class="btn-primary" id="btnCopyMediaKitLink" style="background:var(--gold-primary); color:#000; padding:10px 20px; border-radius:999px; font-weight:700; border:none; cursor:pointer; display:flex; align-items:center; gap:6px;">
              <i class="ph-bold ph-link"></i> Copy Verified Link
            </button>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Generate AI Bio
    const btnAiBio = container.querySelector('#btnGenerateAiBio');
    const toneSelect = container.querySelector('#bioToneSelect');
    const bioDisplay = container.querySelector('#profileBioDisplay');
    const bioInput = container.querySelector('#profBioInput');

    if (btnAiBio) {
      btnAiBio.onclick = async () => {
        isGeneratingBio = true;
        btnAiBio.disabled = true;
        btnAiBio.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Generating...';

        const tone = toneSelect ? toneSelect.value : 'Professional';
        const newBio = await aiService.generateBio(user.name, user.role, user.tags, tone);

        isGeneratingBio = false;
        if (bioDisplay) bioDisplay.textContent = newBio;
        if (bioInput) bioInput.value = newBio;

        store.updateCurrentUserProfile({ bio: newBio });
        onShowToast('Bio optimized with Gemini AI! ✨');
        btnAiBio.disabled = false;
        btnAiBio.innerHTML = '<i class="ph-fill ph-magic-wand"></i> Optimize';
      };
    }

    // Save Profile Form
    const profileForm = container.querySelector('#editProfileForm');
    if (profileForm) {
      profileForm.onsubmit = (e) => {
        e.preventDefault();
        const name = container.querySelector('#profNameInput').value.trim();
        const company = container.querySelector('#profCompanyInput').value.trim();
        const location = container.querySelector('#profLocationInput').value.trim();
        const tags = container.querySelector('#profTagsInput').value.split(',').map(t => t.trim()).filter(Boolean);
        const bio = container.querySelector('#profBioInput').value.trim();

        store.updateCurrentUserProfile({ name, company, location, tags, bio });
        onShowToast('Profile saved successfully! 💾');
        render();
      };
    }

    // Media Kit Modal
    const btnMediaKit = container.querySelector('#btnPreviewMediaKit');
    const mediaKitModal = container.querySelector('#mediaKitModal');
    const closeMediaKit = container.querySelector('#closeMediaKitModal');
    const btnCopyLink = container.querySelector('#btnCopyMediaKitLink');

    if (btnMediaKit && mediaKitModal) {
      btnMediaKit.onclick = () => mediaKitModal.classList.add('active');
    }
    if (closeMediaKit && mediaKitModal) {
      closeMediaKit.onclick = () => mediaKitModal.classList.remove('active');
    }
    if (btnCopyLink) {
      btnCopyLink.onclick = () => {
        navigator.clipboard?.writeText(window.location.href);
        onShowToast('Verified Media Kit URL copied to clipboard! 📋');
      };
    }
    const btnPrint = container.querySelector('#btnPrintMediaKit');
    if (btnPrint) {
      btnPrint.onclick = () => window.print();
    }
  }

  render();
}
