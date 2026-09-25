// Ping Web Platform - Admin Concierge View (Platform Oversight, Verifications & Safety)
import { store } from '../state.js';

export function renderAdminView(container, onShowToast) {
  function render() {
    const stats = store.adminStats;
    const users = store.users;
    const pendingUsers = users.filter(u => u.verificationStatus === 'PENDING');
    const broadcasts = store.broadcasts || [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1><i class="ph-fill ph-shield-star" style="color:var(--gold-primary)"></i> ReachUp Admin Concierge</h1>
          <p>Executive governance, safety moderation, identity verification, and platform broadcast suite.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn-primary" id="btnOpenBroadcastModal" style="background:var(--gold-primary); color:#000; padding:10px 20px; border-radius:999px; font-weight:700; border:none; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <i class="ph-fill ph-megaphone"></i> Send Broadcast
          </button>
          <button class="btn-exit-app" id="btnResetAllDemoData" style="color:var(--accent-crimson); border-color:rgba(255,51,102,0.3);">
            <i class="ph-bold ph-arrow-counter-clockwise"></i> Reset Demo Data
          </button>
        </div>
      </div>

      <!-- High-Level Metrics -->
      <div class="admin-metrics-grid">
        <div class="admin-metric-card">
          <div style="font-size:12px; color:var(--text-tertiary); text-transform:uppercase; font-weight:700;">Total Active Members</div>
          <div class="admin-metric-value">${stats.totalUsers.toLocaleString()}</div>
          <div style="font-size:12px; color:var(--accent-green); margin-top:4px;">${stats.trends?.weeklyGrowth || '+24%'} this month</div>
        </div>

        <div class="admin-metric-card">
          <div style="font-size:12px; color:var(--text-tertiary); text-transform:uppercase; font-weight:700;">Member Split</div>
          <div class="admin-metric-value" style="font-size:24px;">${stats.split.influencer} Creators / ${stats.split.business} Brands</div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">1:3.2 Brand-to-Talent ratio</div>
        </div>

        <div class="admin-metric-card">
          <div style="font-size:12px; color:var(--text-tertiary); text-transform:uppercase; font-weight:700;">Platform Contract Volume</div>
          <div class="admin-metric-value" style="color:var(--gold-primary);">${stats.revenue}</div>
          <div style="font-size:12px; color:var(--accent-green); margin-top:4px;">${stats.trends?.contractCompletionRate || '98.4%'} completion rate</div>
        </div>

        <div class="admin-metric-card">
          <div style="font-size:12px; color:var(--text-tertiary); text-transform:uppercase; font-weight:700;">Pending Verifications</div>
          <div class="admin-metric-value" style="color:${pendingUsers.length > 0 ? 'var(--gold-primary)' : 'var(--text-secondary)'};">
            ${pendingUsers.length}
          </div>
          <div style="font-size:12px; color:var(--text-tertiary); margin-top:4px;">Identity & portfolio audit</div>
        </div>
      </div>

      <!-- Operational Tables Grid -->
      <div class="admin-tables-grid">
        <!-- Pending Verification Queue -->
        <div class="glass-panel" style="padding:22px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <h3 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
              <i class="ph-fill ph-seal-warning" style="color:var(--gold-primary)"></i> Identity Verification Queue
            </h3>
            <span class="brand-badge-pill">${pendingUsers.length} PENDING</span>
          </div>

          ${pendingUsers.length === 0 ? `
            <div style="padding:30px 10px; text-align:center; color:var(--text-secondary); font-size:13.5px;">
              <i class="ph-fill ph-check-circle" style="color:var(--accent-green); font-size:32px; margin-bottom:8px; display:block;"></i>
              All verification requests have been audited and cleared!
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${pendingUsers.map(u => `
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:12px; padding:14px; display:flex; align-items:center; justify-content:space-between;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:42px; height:42px; border-radius:999px; overflow:hidden; border:1px solid var(--border-subtle);">
                      <img src="${u.avatar}" alt="${u.name}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div>
                      <div style="font-weight:700; color:#fff; font-size:14px;">${u.name}</div>
                      <div style="font-size:12px; color:var(--gold-primary);">${u.company || u.jobTitle || u.role}</div>
                      <div style="font-size:11px; color:var(--text-tertiary);">${u.location} • Reach: ${u.stats?.followers || 'N/A'}</div>
                    </div>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <button class="btn-primary btn-approve-user" data-id="${u.id}" style="background:var(--accent-green); color:#000; padding:6px 12px; border-radius:999px; font-size:12px; font-weight:700; border:none; cursor:pointer;">
                      Approve
                    </button>
                    <button class="btn-exit-app btn-reject-user" data-id="${u.id}" style="padding:6px 10px; font-size:12px;">
                      Decline
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Recent Broadcasts & Platform Announcements -->
        <div class="glass-panel" style="padding:22px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <h3 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
              <i class="ph-fill ph-broadcast" style="color:var(--gold-primary)"></i> Platform Broadcasts
            </h3>
            <span style="font-size:12px; color:var(--text-tertiary);">${broadcasts.length} Sent</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:12px;">
            ${broadcasts.slice(0, 4).map(b => `
              <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:12px; padding:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <div style="font-weight:700; color:#fff; font-size:13.5px;">${b.title}</div>
                  <div style="font-size:11px; color:var(--text-tertiary);">${new Date(b.timestamp).toLocaleDateString()}</div>
                </div>
                <p style="font-size:12.5px; color:var(--text-secondary); line-height:1.4;">${b.body}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Member Registry Table -->
      <div class="glass-panel" style="padding:22px; margin-top:24px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
          <h3 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:700; color:#fff;">
            Platform Members Directory (${users.length})
          </h3>
          <span style="font-size:12px; color:var(--text-secondary);">Direct Status Controls</span>
        </div>

        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-subtle); color:var(--text-tertiary); text-transform:uppercase; font-size:11px;">
                <th style="padding:10px 12px;">Member</th>
                <th style="padding:10px 12px;">Role</th>
                <th style="padding:10px 12px;">PingScore</th>
                <th style="padding:10px 12px;">Verification</th>
                <th style="padding:10px 12px;">Account Status</th>
                <th style="padding:10px 12px; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                  <td style="padding:12px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <div style="width:34px; height:34px; border-radius:999px; overflow:hidden;">
                        <img src="${u.avatar}" alt="${u.name}" style="width:100%; height:100%; object-fit:cover;">
                      </div>
                      <div>
                        <div style="font-weight:600; color:#fff;">${u.name}</div>
                        <div style="font-size:11px; color:var(--text-tertiary);">${u.location}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding:12px; color:var(--gold-glow);">${u.role}</td>
                  <td style="padding:12px; font-weight:700; color:var(--gold-primary);">${u.pingScore || 95}</td>
                  <td style="padding:12px;">
                    <span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; background:${u.verified ? 'rgba(0,230,118,0.15)' : 'rgba(255,215,0,0.15)'}; color:${u.verified ? 'var(--accent-green)' : 'var(--gold-primary)'};">
                      ${u.verificationStatus}
                    </span>
                  </td>
                  <td style="padding:12px;">
                    <span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; background:${u.status === 'ACTIVE' ? 'rgba(0,230,118,0.15)' : 'rgba(255,51,102,0.15)'}; color:${u.status === 'ACTIVE' ? 'var(--accent-green)' : 'var(--accent-crimson)'};">
                      ${u.status}
                    </span>
                  </td>
                  <td style="padding:12px; text-align:right;">
                    <button class="btn-exit-app btn-toggle-ban" data-id="${u.id}" data-status="${u.status}" style="font-size:11px; padding:4px 8px; display:inline-flex;">
                      ${u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Broadcast Modal -->
      <div class="app-modal-overlay" id="broadcastModal">
        <div class="app-modal-box">
          <button class="app-modal-close" id="closeBroadcastModal">&times;</button>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
            <i class="ph-fill ph-megaphone" style="color:var(--gold-primary); font-size:26px;"></i>
            <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px;">Create Platform Broadcast</h2>
          </div>

          <form id="broadcastForm" style="display:flex; flex-direction:column; gap:14px;">
            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Announcement Title</label>
              <input type="text" id="bcastTitleInput" placeholder="e.g. System Maintenance or New Commission Rules" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Message Body</label>
              <textarea id="bcastBodyInput" rows="3" placeholder="Write announcement details for all creators and brands..." required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px; resize:vertical;"></textarea>
            </div>
            <button type="submit" class="btn-primary" style="margin-top:8px; background:var(--gold-primary); color:#000; padding:12px; border-radius:999px; font-weight:700; border:none; cursor:pointer;">
              Broadcast to Entire Network
            </button>
          </form>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Approve User
    container.querySelectorAll('.btn-approve-user').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        store.verifyUser(id, true);
        onShowToast('Member verified and granted the Gold Ping badge! 🎖️');
        render();
      };
    });

    // Decline User
    container.querySelectorAll('.btn-reject-user').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        store.verifyUser(id, false);
        onShowToast('Verification request declined.');
        render();
      };
    });

    // Toggle Account Status
    container.querySelectorAll('.btn-toggle-ban').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const current = btn.getAttribute('data-status');
        const next = current === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
        store.setUserStatus(id, next);
        onShowToast(`User status updated to ${next}`);
        render();
      };
    });

    // Broadcast Modal
    const btnOpenBcast = container.querySelector('#btnOpenBroadcastModal');
    const bcastModal = container.querySelector('#broadcastModal');
    const closeBcast = container.querySelector('#closeBroadcastModal');
    const bcastForm = container.querySelector('#broadcastForm');

    if (btnOpenBcast && bcastModal) {
      btnOpenBcast.onclick = () => bcastModal.classList.add('active');
    }
    if (closeBcast && bcastModal) {
      closeBcast.onclick = () => bcastModal.classList.remove('active');
    }
    if (bcastForm) {
      bcastForm.onsubmit = (e) => {
        e.preventDefault();
        const title = container.querySelector('#bcastTitleInput').value.trim();
        const body = container.querySelector('#bcastBodyInput').value.trim();
        store.postBroadcast(title, body);
        bcastModal.classList.remove('active');
        onShowToast('Broadcast dispatched across the platform! 📢');
        render();
      };
    }

    // Reset Demo Data
    const btnReset = container.querySelector('#btnResetAllDemoData');
    if (btnReset) {
      btnReset.onclick = () => {
        if (confirm('Reset all demo users, briefs, contracts, and state to default seeds?')) {
          store.resetAll();
          onShowToast('All demo data refreshed to pristine state!');
          render();
        }
      };
    }
  }

  render();
}
