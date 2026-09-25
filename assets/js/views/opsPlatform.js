// Ping Platform - Operations (admin): verification queue and member safety.
import { store } from '../state.js';
import { escapeHtml } from '../domUtils.js';
import { displayPingScore } from '../pingScoreService.js';

export function renderOpsPlatform(container, onShowToast) {
  function render() {
    // Demo seed profiles aren't accounts, so they have nothing to review or suspend.
    const users = store.users.filter(u => !u.isDemo);
    const realUsers = users.filter(u => u.role !== 'ADMIN');
    const creatorCount = realUsers.filter(u => u.role === 'INFLUENCER').length;
    const brandCount = realUsers.filter(u => u.role === 'BUSINESS').length;
    const realBriefs = (store.briefs || []).filter(b => !b.isDemo);
    const pending = users.filter(u => u.verificationStatus === 'PENDING');

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h1 class="section-title">Ping <em>operations</em></h1>
          <p class="section-subtitle">Verification reviews and member safety.</p>
        </div>
      </div>

      <!-- Metric tiles: computed from the loaded member and brief lists -->
      <div class="ops-metrics-row">
        <div class="ops-card">
          <div class="ops-label">Members</div>
          <div class="ops-num">${realUsers.length.toLocaleString()}</div>
          <div class="ops-note">Real accounts loaded (excludes demo profiles)</div>
        </div>
        <div class="ops-card">
          <div class="ops-label">Creators · Brands</div>
          <div class="ops-num">${creatorCount} · ${brandCount}</div>
          <div class="ops-note">${brandCount ? `${(creatorCount / brandCount).toFixed(1)} creators per brand` : 'No brands yet'}</div>
        </div>
        <div class="ops-card">
          <div class="ops-label">Campaign briefs</div>
          <div class="ops-num">${realBriefs.length}</div>
          <div class="ops-note">Live on the marketplace</div>
        </div>
        <div class="ops-card">
          <div class="ops-label">Pending verifications</div>
          <div class="ops-num" style="color:${pending.length > 0 ? 'var(--gold)' : 'var(--text-muted)'};">${pending.length}</div>
          <div class="ops-note">Awaiting review below</div>
        </div>
      </div>

      <!-- Verification queue -->
      <div style="margin-bottom:28px;">
        <!-- Verification Audit Queue -->
        <div class="glass-box" style="padding:26px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <h3 style="font-family:var(--font-heading); font-size:18px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
              <i class="ph-fill ph-seal-warning" style="color:var(--gold)"></i> Identity Verification Queue
            </h3>
            <span class="platform-brand-badge">${pending.length} PENDING</span>
          </div>

          ${pending.length === 0 ? `
            <div style="padding:40px 10px; text-align:center; color:var(--text-muted); font-size:14px;">
              <i class="ph-fill ph-check-circle" style="color:var(--accent-green); font-size:36px; margin-bottom:10px; display:block;"></i>
              No verification requests waiting.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:14px;">
              ${pending.map(u => `
                <div style="background:rgba(255,255,255,0.025); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:14px 18px; display:flex; align-items:center; justify-content:space-between;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:44px; height:44px; border-radius:999px; overflow:hidden; border:1px solid var(--border-subtle);">
                      <img src="${escapeHtml(u.avatar)}" alt="${escapeHtml(u.name)}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div>
                      <div style="font-weight:700; color:#fff; font-size:14.5px;">${escapeHtml(u.name)}</div>
                      <div style="font-size:12.5px; color:var(--gold);">${escapeHtml(u.company || u.jobTitle || u.role)}</div>
                      <div style="font-size:11px; color:var(--text-dim);">${escapeHtml(u.location)} • Reach: ${escapeHtml(u.socialStats?.instagramFollowers && u.socialStats.instagramFollowers !== '0' ? u.socialStats.instagramFollowers : '—')}</div>
                    </div>
                  </div>

                  <div style="display:flex; gap:8px;">
                    <button class="btn-gold btn-ops-approve" data-id="${u.id}" style="padding:6px 14px; font-size:12px;">
                      Approve
                    </button>
                    <button class="btn-glass btn-ops-reject" data-id="${u.id}" style="padding:6px 12px; font-size:12px;">
                      Decline
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>

      <!-- Member Registry Directory -->
      <div class="glass-box" style="padding:26px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 style="font-family:var(--font-heading); font-size:20px; font-weight:700; color:#fff;">
            Member Directory & Safety Controls (${users.length})
          </h3>
          <span style="font-size:12px; color:var(--text-dim);">Live Account Status Management</span>
        </div>

        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:13.5px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-subtle); color:var(--text-dim); text-transform:uppercase; font-size:11px; letter-spacing:0.6px;">
                <th style="padding:12px;">Member</th>
                <th style="padding:12px;">Role</th>
                <th style="padding:12px;">PingScore</th>
                <th style="padding:12px;">Verification</th>
                <th style="padding:12px;">Status</th>
                <th style="padding:12px; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                  <td style="padding:14px 12px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div style="width:36px; height:36px; border-radius:999px; overflow:hidden;">
                        <img src="${escapeHtml(u.avatar)}" alt="${escapeHtml(u.name)}" style="width:100%; height:100%; object-fit:cover;">
                      </div>
                      <div>
                        <div style="font-weight:700; color:#fff;">${escapeHtml(u.name)}</div>
                        <div style="font-size:11.5px; color:var(--text-dim);">${escapeHtml(u.location)}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding:14px 12px; color:var(--gold-glow);">${escapeHtml(u.role)}</td>
                  <td style="padding:14px 12px; font-weight:700; color:var(--gold);">${displayPingScore(u)}</td>
                  <td style="padding:14px 12px;">
                    <span style="font-size:11px; font-weight:800; padding:3px 10px; border-radius:999px; background:${u.verified ? 'rgba(0,230,118,0.15)' : 'rgba(230,255,26,0.15)'}; color:${u.verified ? 'var(--accent-green)' : 'var(--gold)'};">
                      ${u.verificationStatus}
                    </span>
                  </td>
                  <td style="padding:14px 12px;">
                    <span style="font-size:11px; font-weight:800; padding:3px 10px; border-radius:999px; background:${u.status === 'ACTIVE' ? 'rgba(0,230,118,0.15)' : 'rgba(255,51,102,0.15)'}; color:${u.status === 'ACTIVE' ? 'var(--accent-green)' : 'var(--accent-crimson)'};">
                      ${u.status}
                    </span>
                  </td>
                  <td style="padding:14px 12px; text-align:right;">
                    ${u.id === store.currentUser.id ? '<span style="font-size:11.5px; color:var(--text-dim);">You</span>' : `
                      <button class="btn-glass btn-toggle-member-ban" data-id="${u.id}" data-status="${u.status}" style="font-size:11.5px; padding:5px 12px;">
                        ${u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    `;

    bindEvents();
  }

  // Every action is saved to the member's real profile first; the button
  // stays disabled until the save finishes, and a failure is reported
  // instead of a success toast for a change that didn't happen.
  async function runAction(btn, action, successMessage) {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      await action();
      onShowToast(successMessage);
      render();
    } catch (err) {
      console.error('Operations action failed:', err);
      btn.disabled = false;
      onShowToast("That didn't save. Check your connection and that you're signed in as the admin.");
    }
  }

  function bindEvents() {
    container.querySelectorAll('.btn-ops-approve').forEach(btn => {
      btn.onclick = () => runAction(btn, () => store.verifyUser(btn.getAttribute('data-id'), true), 'Member verified. Their profile now shows the verified badge.');
    });

    container.querySelectorAll('.btn-ops-reject').forEach(btn => {
      btn.onclick = () => runAction(btn, () => store.verifyUser(btn.getAttribute('data-id'), false), 'Verification request declined.');
    });

    container.querySelectorAll('.btn-toggle-member-ban').forEach(btn => {
      btn.onclick = () => {
        const next = btn.getAttribute('data-status') === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
        if (next === 'BANNED' && !confirm("Suspend this member? They'll be locked out of Ping (and hidden from everyone) until you reactivate them.")) return;
        runAction(btn, () => store.setUserStatus(btn.getAttribute('data-id'), next), next === 'BANNED' ? 'Member suspended.' : 'Member reactivated.');
      };
    });
  }

  render();

  // Verification queue and member directory both read store.users directly,
  // which subscribeToDiscoverableProfiles (state.js) keeps live - re-render
  // whenever that (or anything else) changes so new signups/edits show up
  // without a manual refresh.
  const unsubscribeStore = store.subscribe(() => { render(); });
  return unsubscribeStore;
}
