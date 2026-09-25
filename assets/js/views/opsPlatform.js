// Ping Platform - Operations (admin): verification queue, announcements and
// member safety. Every action is saved to the real database first.
import { store } from '../state.js';
import { escapeHtml } from '../domUtils.js';
import { displayPingScore } from '../pingScoreService.js';
import { safeUrl, talentLinks, talentMeta, talentTypeOf } from '../talentTypes.js';
import { campaignStatus, timeAgo } from '../campaignUtils.js';

// Links the Ping team can open to check who someone is before verifying.
function reviewLinks(u) {
  const out = [];
  const ig = String(u.socials?.instagram || '').trim();
  if (ig) out.push({ label: 'Instagram', url: safeUrl(/[./]/.test(ig) ? ig : `instagram.com/${ig.replace(/^@/, '')}`) });
  const yt = String(u.socials?.youtube || '').trim();
  if (yt) out.push({ label: 'YouTube', url: safeUrl(/[./]/.test(yt) ? yt : `youtube.com/@${yt.replace(/^@/, '')}`) });
  if (u.website) out.push({ label: 'Website', url: safeUrl(u.website) });
  if (u.role === 'INFLUENCER') talentLinks(u).forEach((l) => out.push(l));
  return out.filter((l) => l.url).slice(0, 6);
}

export function renderOpsPlatform(container, onShowToast) {
  // Announcements are fetched once per visit (not on every live update).
  let announcements = null;
  let announcementsError = null; // null, 'setup' (extras.sql not run yet) or 'load'

  container.innerHTML = '<div class="ops-main"></div><div class="cm-layer"></div>';
  const main = container.querySelector('.ops-main');
  const layer = container.querySelector('.cm-layer');

  function render() {
    // Demo seed profiles aren't accounts, so they have nothing to review or suspend.
    const users = store.users.filter(u => !u.isDemo);
    const realUsers = users.filter(u => u.role !== 'ADMIN');
    const creatorCount = realUsers.filter(u => u.role === 'INFLUENCER').length;
    const brandCount = realUsers.filter(u => u.role === 'BUSINESS').length;
    const realBriefs = (store.briefs || []).filter(b => !b.isDemo);
    const liveBriefs = realBriefs.filter(b => campaignStatus(b) === 'OPEN');
    const pending = users.filter(u => u.verificationStatus === 'PENDING');

    main.innerHTML = `
      <div class="section-header">
        <div>
          <h1 class="section-title">Ping <em>operations</em></h1>
          <p class="section-subtitle">Verification reviews, announcements and member safety.</p>
        </div>
        <button class="btn-gold" data-ops="announce"><i class="ph-fill ph-megaphone"></i> Send announcement</button>
      </div>

      <!-- Metric tiles: computed from the loaded member and brief lists -->
      <div class="ops-metrics-row">
        <div class="ops-card">
          <div class="ops-label">Members</div>
          <div class="ops-num">${realUsers.length.toLocaleString()}</div>
          <div class="ops-note">Real accounts (excludes demo profiles)</div>
        </div>
        <div class="ops-card">
          <div class="ops-label">Talent · Brands</div>
          <div class="ops-num">${creatorCount} · ${brandCount}</div>
          <div class="ops-note">${brandCount ? `${(creatorCount / brandCount).toFixed(1)} talent per brand` : 'No brands yet'}</div>
        </div>
        <div class="ops-card">
          <div class="ops-label">Live campaigns</div>
          <div class="ops-num">${liveBriefs.length}</div>
          <div class="ops-note">${realBriefs.length} posted in total</div>
        </div>
        <div class="ops-card">
          <div class="ops-label">Pending verifications</div>
          <div class="ops-num" style="color:${pending.length > 0 ? 'var(--gold)' : 'var(--text-muted)'};">${pending.length}</div>
          <div class="ops-note">Awaiting review below</div>
        </div>
      </div>

      <div class="ops-two">
        <!-- Verification queue -->
        <div class="glass-box ops-panel">
          <div class="ops-panel-head">
            <h3><i class="ph-fill ph-seal-warning"></i> Verification requests</h3>
            <span class="platform-brand-badge">${pending.length} pending</span>
          </div>
          ${pending.length === 0 ? `
            <p class="ops-empty"><i class="ph-fill ph-check-circle"></i>No verification requests waiting.</p>
          ` : `
            <div class="ops-queue">
              ${pending.map(u => {
                const links = reviewLinks(u);
                const kind = u.role === 'INFLUENCER' ? talentMeta(talentTypeOf(u)).label : 'Brand';
                return `
                  <div class="ops-req">
                    <img src="${escapeHtml(u.avatar)}" alt="">
                    <div class="ops-req-main">
                      <b>${escapeHtml(u.name)}</b>
                      <span>${escapeHtml(kind)}${u.company ? ` · ${escapeHtml(u.company)}` : ''} · ${escapeHtml(u.location || 'No location')}</span>
                      ${u.bio ? `<p>${escapeHtml(u.bio)}</p>` : ''}
                      ${links.length ? `<div class="cm-app-links">${links.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer"><i class="ph-bold ph-arrow-up-right"></i>${escapeHtml(l.label)}</a>`).join('')}</div>` : '<span class="ops-req-nolinks">No links added</span>'}
                    </div>
                    <div class="ops-req-actions">
                      <button class="btn-gold btn-ops-approve" data-id="${u.id}">Approve</button>
                      <button class="btn-glass btn-ops-reject" data-id="${u.id}">Decline</button>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Announcements -->
        <div class="glass-box ops-panel">
          <div class="ops-panel-head">
            <h3><i class="ph-fill ph-megaphone"></i> Announcements</h3>
            <button class="btn-glass" data-ops="announce">New</button>
          </div>
          ${announcementsBlock()}
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
                  <td style="padding:14px 12px; color:var(--gold-glow);">${escapeHtml(u.role === 'INFLUENCER' ? talentMeta(talentTypeOf(u)).label : u.role === 'BUSINESS' ? 'Brand' : 'Admin')}</td>
                  <td style="padding:14px 12px; font-weight:700; color:var(--gold);">${displayPingScore(u)}</td>
                  <td style="padding:14px 12px;">
                    <span style="font-size:11px; font-weight:800; padding:3px 10px; border-radius:999px; background:${u.verified ? 'rgba(0,230,118,0.15)' : 'rgba(230,255,26,0.15)'}; color:${u.verified ? 'var(--accent-green)' : 'var(--gold)'};">
                      ${escapeHtml(u.verificationStatus)}
                    </span>
                  </td>
                  <td style="padding:14px 12px;">
                    <span style="font-size:11px; font-weight:800; padding:3px 10px; border-radius:999px; background:${u.status === 'ACTIVE' ? 'rgba(0,230,118,0.15)' : 'rgba(255,51,102,0.15)'}; color:${u.status === 'ACTIVE' ? 'var(--accent-green)' : 'var(--accent-crimson)'};">
                      ${escapeHtml(u.status)}
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

  function announcementsBlock() {
    if (announcementsError === 'setup') {
      return '<p class="ops-empty">Announcements need the <b>extras.sql</b> update in Supabase before they can load.</p>';
    }
    if (announcementsError) {
      return '<p class="ops-empty">Couldn\'t load announcements. Refresh the page to try again.</p>';
    }
    if (!announcements) return '<p class="ops-empty">Loading…</p>';
    if (!announcements.length) {
      return '<p class="ops-empty">Nothing sent yet. Announcements go to every member\'s notifications.</p>';
    }
    return `<ul class="ops-ann">${announcements.slice(0, 6).map(a => `
      <li><b>${escapeHtml(a.title)}</b><p>${escapeHtml(a.body)}</p><time>${escapeHtml(timeAgo(a.timestamp))}</time></li>`).join('')}</ul>`;
  }

  async function loadAnnouncements() {
    try {
      announcements = await store.loadAnnouncements();
      announcementsError = null;
    } catch (err) {
      console.error('Loading announcements failed:', err);
      announcementsError = isMissingSetup(err) ? 'setup' : 'load';
    }
    render();
  }

  // The table or function isn't there yet: extras.sql hasn't been run.
  function isMissingSetup(err) {
    return ['PGRST202', 'PGRST205', '42P01', '42883'].includes(err?.code)
      || /schema cache|does not exist/i.test(err?.message || '');
  }

  // ─── Compose an announcement ───────────────────────────────────────────
  function openCompose() {
    const count = store.users.filter(u => !u.isDemo && u.role !== 'ADMIN' && u.status === 'ACTIVE').length;
    layer.innerHTML = `
      <div class="platform-modal-backdrop active cm-overlay">
        <div class="platform-modal-window cm-apply">
          <button class="platform-modal-close" data-ops="close" aria-label="Close">&times;</button>
          <div class="cm-create-head">
            <div class="app-modal-icon"><i class="ph-fill ph-megaphone"></i></div>
            <div>
              <h2 class="app-modal-title">Send an <em>announcement</em></h2>
              <div class="app-modal-sub">Goes to ${count === 1 ? 'the 1 active member' : `all ${count} active members`} as a notification (and by email, if email notifications are set up).</div>
            </div>
          </div>
          <form id="opsAnnounceForm" novalidate>
            <div class="cm-field">
              <label for="opsAnnTitle">Title</label>
              <input id="opsAnnTitle" maxlength="120" placeholder="e.g. New: campaigns for DJs and bands" autocomplete="off">
            </div>
            <div class="cm-field">
              <label for="opsAnnBody">Message</label>
              <textarea id="opsAnnBody" rows="4" maxlength="500" placeholder="Keep it short and useful."></textarea>
              <div class="cm-help"><span id="opsAnnCount">0</span>/500</div>
            </div>
            <div class="cm-err" id="opsAnnErr"></div>
            <button type="submit" class="btn-gold cm-submit">Send to everyone</button>
          </form>
        </div>
      </div>`;
    layer.querySelector('#opsAnnTitle').focus();
  }

  async function submitCompose(form) {
    const title = layer.querySelector('#opsAnnTitle').value.trim();
    const body = layer.querySelector('#opsAnnBody').value.trim();
    const err = layer.querySelector('#opsAnnErr');
    if (!title || !body) {
      err.textContent = 'Add a title and a message.';
      return;
    }
    if (!confirm('Send this announcement to every member? It can\'t be unsent.')) return;
    const btn = form.querySelector('.cm-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const { recipients } = await store.sendAnnouncement(title, body);
      layer.innerHTML = '';
      onShowToast(`Announcement sent to ${recipients} member${recipients === 1 ? '' : 's'}.`);
      loadAnnouncements();
    } catch (e) {
      console.error('Announcement failed:', e);
      btn.disabled = false;
      btn.textContent = 'Send to everyone';
      err.textContent = isMissingSetup(e)
        ? 'Run supabase/extras.sql in Supabase first, then try again.'
        : "That didn't send. Check your connection and that you're signed in as the admin.";
    }
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
    main.querySelectorAll('.btn-ops-approve').forEach(btn => {
      btn.onclick = () => runAction(btn, () => store.verifyUser(btn.getAttribute('data-id'), true), 'Member verified. Their profile now shows the verified badge.');
    });

    main.querySelectorAll('.btn-ops-reject').forEach(btn => {
      btn.onclick = () => runAction(btn, () => store.verifyUser(btn.getAttribute('data-id'), false), 'Verification request declined.');
    });

    main.querySelectorAll('.btn-toggle-member-ban').forEach(btn => {
      btn.onclick = () => {
        const next = btn.getAttribute('data-status') === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
        if (next === 'BANNED' && !confirm("Suspend this member? They'll be locked out of Ping (and hidden from everyone) until you reactivate them.")) return;
        runAction(btn, () => store.setUserStatus(btn.getAttribute('data-id'), next), next === 'BANNED' ? 'Member suspended.' : 'Member reactivated.');
      };
    });
  }

  function onClick(e) {
    const el = e.target.closest('[data-ops]');
    if (!el) return;
    const action = el.getAttribute('data-ops');
    if (action === 'announce') openCompose();
    if (action === 'close') layer.innerHTML = '';
  }

  function onInput(e) {
    if (e.target.id === 'opsAnnBody') layer.querySelector('#opsAnnCount').textContent = e.target.value.length;
    if (e.target.closest('#opsAnnounceForm')) layer.querySelector('#opsAnnErr').textContent = '';
  }

  function onSubmit(e) {
    if (e.target.id !== 'opsAnnounceForm') return;
    e.preventDefault();
    submitCompose(e.target);
  }

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('submit', onSubmit);

  render();
  loadAnnouncements();

  // Verification queue and member directory both read store.users directly,
  // which subscribeToDiscoverableProfiles (state.js) keeps live - re-render
  // whenever that (or anything else) changes so new signups/edits show up
  // without a manual refresh.
  const unsubscribeStore = store.subscribe(() => { render(); });
  return () => {
    unsubscribeStore();
    container.removeEventListener('click', onClick);
    container.removeEventListener('input', onInput);
    container.removeEventListener('submit', onSubmit);
  };
}
