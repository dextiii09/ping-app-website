// Ping Platform — Master Application Controller
import { store } from './state.js';
import { renderCampaignsPlatform } from './views/campaignsPlatform.js';
import { renderOpportunitiesPlatform } from './views/opportunitiesPlatform.js';
import { renderApplicationsPlatform } from './views/applicationsPlatform.js';
import { renderDealRoomPlatform } from './views/dealRoomPlatform.js';
import { renderMediaKitPlatform } from './views/mediaKitPlatform.js';
import { renderOpsPlatform } from './views/opsPlatform.js';
import { escapeHtml } from './domUtils.js';
import { initCustomSelects } from './customSelect.js';

class PingPlatform {
  constructor() {
    // Brands: 'campaigns' | 'dealroom' | 'mediakit'
    // Talent: 'discover' | 'applications' | 'dealroom' | 'mediakit'
    // Admin:  'ops'
    this.currentView = null;
    this.activeDealId = null;
    this.activeBriefId = null;
    this.viewportEl = document.getElementById('platformViewport');
    this.headerEl = document.getElementById('platformHeader');
    this.toastEl = document.getElementById('platformToast');
    this.toastTimeout = null;
    this.isNotifsOpen = false;
    this.isSettingsOpen = false;
    // A render*Platform function may return a cleanup callback (e.g. to
    // unsubscribe a live Supabase listener); switchView calls it before
    // mounting the next view so listeners don't pile up across navigation.
    this.currentViewCleanup = null;
  }

  // Where each role lands: brands on their campaigns, talent on open briefs,
  // the admin on Operations (oversight, not dealmaking).
  homeView(role = store.currentUser.role) {
    if (role === 'ADMIN') return 'ops';
    return role === 'BUSINESS' ? 'campaigns' : 'discover';
  }

  init() {
    this.currentView = this.homeView();

    this.renderHeader();
    this.renderModals();
    this.switchView(this.currentView);

    // Reactive store updates
    store.subscribe(() => {
      this.renderHeader();
    });

    // A click anywhere outside the notifications panel closes it. Added once
    // here, since the header is redrawn on every store update.
    document.addEventListener('click', (e) => {
      const flyout = this.headerEl && this.headerEl.querySelector('#platformNotifsFlyout');
      if (!flyout || flyout.contains(e.target) || e.target.closest('#btnOpenNotifsDrawer')) return;
      this.isNotifsOpen = false;
      flyout.classList.remove('active');
    });

    this.checkBroadcasts();
  }

  showToast(message) {
    if (!this.toastEl) return;
    this.toastEl.querySelector('.toast-content').textContent = message;
    this.toastEl.classList.add('visible');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.remove('visible');
    }, 3200);
  }

  // Maps a real notification's `type` to a bell icon.
  notificationIcon(type) {
    if (type === 'match') return 'ph-lightning';
    if (type === 'message') return 'ph-chat-circle-text';
    if (type === 'tip') return 'ph-sparkle';
    if (type === 'announcement') return 'ph-megaphone';
    if (type === 'system') return 'ph-briefcase'; // campaign updates
    return 'ph-bell';
  }

  formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const diffMs = Date.now() - timestamp;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  renderHeader() {
    if (!this.headerEl) return;
    const user = store.currentUser;
    const matches = store.getMatchesForCurrentUser();
    const pendingVerifications = store.users.filter(u => !u.isDemo && u.verificationStatus === 'PENDING').length;
    const toReview = user.role === 'BUSINESS' ? store.pendingApplicantsCount() : 0;
    const notifications = store.notifications || [];
    const unreadCount = notifications.filter(n => !n.read).length;
    const blockedUsers = store.getBlockedUsers ? store.getBlockedUsers() : [];

    this.headerEl.innerHTML = `
      <div class="platform-brand" id="btnBrandLogoHome">
        <svg class="platform-brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#E6FF1A"/><path d="M37 7 15 36h15l-4 21 23-31H34l3-19Z" fill="#0A0A0A"/></svg>
        <span class="platform-brand-text">Ping</span>
        <span class="platform-brand-badge">${user.role === 'INFLUENCER' ? 'Creator' : user.role === 'BUSINESS' ? 'Brand' : 'Operations'}</span>
      </div>

      <!-- Segmented Navigation Pills - deliberately different per role:
           Admin only gets Operations (oversight, not dealmaking); Business
           and Creator get the marketplace tabs, never Operations. -->
      <nav class="platform-nav">
        ${user.role === 'ADMIN' ? `
          <button class="nav-pill-btn ${this.currentView === 'ops' ? 'active' : ''}" data-view="ops" title="Operations">
            <i class="ph-fill ph-shield-star"></i>
            <span>Operations</span>
            ${pendingVerifications > 0 ? `<span class="nav-badge">${pendingVerifications}</span>` : ''}
          </button>
        ` : user.role === 'BUSINESS' ? `
          <button class="nav-pill-btn ${this.currentView === 'campaigns' ? 'active' : ''}" data-view="campaigns" title="Campaigns">
            <i class="ph-fill ph-megaphone-simple"></i>
            <span>Campaigns</span>
            ${toReview > 0 ? `<span class="nav-badge">${toReview}</span>` : ''}
          </button>

          <button class="nav-pill-btn ${this.currentView === 'dealroom' ? 'active' : ''}" data-view="dealroom" title="Deal Room">
            <i class="ph-fill ph-handshake"></i>
            <span>Deal Room</span>
            ${matches.length > 0 ? `<span class="nav-badge">${matches.length}</span>` : ''}
          </button>

          <button class="nav-pill-btn ${this.currentView === 'mediakit' ? 'active' : ''}" data-view="mediakit" title="Profile">
            <i class="ph-fill ph-storefront"></i>
            <span>Profile</span>
          </button>
        ` : `
          <button class="nav-pill-btn ${this.currentView === 'discover' ? 'active' : ''}" data-view="discover" title="Discover briefs">
            <i class="ph-fill ph-compass"></i>
            <span>Discover</span>
          </button>

          <button class="nav-pill-btn ${this.currentView === 'applications' ? 'active' : ''}" data-view="applications" title="My applications">
            <i class="ph-fill ph-paper-plane-tilt"></i>
            <span>Applications</span>
          </button>

          <button class="nav-pill-btn ${this.currentView === 'dealroom' ? 'active' : ''}" data-view="dealroom" title="Deal Room">
            <i class="ph-fill ph-handshake"></i>
            <span>Deal Room</span>
            ${matches.length > 0 ? `<span class="nav-badge">${matches.length}</span>` : ''}
          </button>

          <button class="nav-pill-btn ${this.currentView === 'mediakit' ? 'active' : ''}" data-view="mediakit" title="Media Kit">
            <i class="ph-fill ph-user-circle"></i>
            <span>Media Kit</span>
          </button>
        `}
      </nav>

      <!-- Right Controls: Notifications & Settings -->
      <div class="platform-header-right">
        <!-- Activity Bell -->
        <button class="header-icon-btn" id="btnOpenNotifsDrawer" title="Notifications">
          <i class="ph-fill ph-bell"></i>
          ${unreadCount > 0 ? `<span class="nav-badge" style="position:absolute; top:-4px; right:-4px;">${unreadCount}</span>` : ''}
        </button>

        <!-- Settings Gear -->
        <button class="header-icon-btn" id="btnOpenPlatformSettings" title="Platform & AI Settings">
          <i class="ph-fill ph-gear"></i>
        </button>

        <!-- Avatar -->
        <div class="header-avatar-btn" id="btnHeaderAvatarClick" title="View Media Kit">
          <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}">
        </div>

        ${store.isRealAccount ? `
          <button class="header-icon-btn" id="btnLogoutAccount" title="Log Out">
            <i class="ph-fill ph-sign-out"></i>
          </button>
        ` : ''}

        <!-- Notifications Flyout -->
        <div class="notifications-dropdown ${this.isNotifsOpen ? 'active' : ''}" id="platformNotifsFlyout">
          <div class="notif-header">
            <span>Notifications</span>
            <span style="font-size:11px; color:var(--text-dim);">${notifications.length ? `${notifications.length} recent` : ''}</span>
          </div>
          <div class="notif-list">
            ${notifications.length === 0 ? `
              <div style="padding:24px; text-align:center; color:var(--text-muted); font-size:12.5px;">No notifications yet</div>
            ` : notifications.map(n => `
              <div class="notif-item ${n.read ? '' : 'notif-unread'}" data-notif-type="${escapeHtml(n.type)}">
                <div class="notif-icon notif-icon-match"><i class="ph-fill ${this.notificationIcon(n.type)}"></i></div>
                <div class="notif-body">
                  <div style="font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
                    ${!n.read ? '<span class="notif-unread-dot"></span>' : ''}${escapeHtml(n.title)}
                  </div>
                  <div>${escapeHtml(n.text)}</div>
                  <div style="font-size:10.5px; color:var(--text-dim); margin-top:3px;">${this.formatRelativeTime(n.timestamp)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    initCustomSelects(this.headerEl);
    this.bindHeaderEvents();
  }

  bindHeaderEvents() {
    // Nav pill clicks
    this.headerEl.querySelectorAll('.nav-pill-btn').forEach(btn => {
      btn.onclick = () => {
        const view = btn.getAttribute('data-view');
        this.switchView(view);
      };
    });

    // Logo click -> explore
    const logo = this.headerEl.querySelector('#btnBrandLogoHome');
    if (logo) logo.onclick = () => this.switchView(this.homeView());

    // Notifications flyout
    const btnNotifs = this.headerEl.querySelector('#btnOpenNotifsDrawer');
    const flyout = this.headerEl.querySelector('#platformNotifsFlyout');
    if (btnNotifs && flyout) {
      btnNotifs.onclick = (e) => {
        e.stopPropagation();
        this.isNotifsOpen = !this.isNotifsOpen;
        flyout.classList.toggle('active', this.isNotifsOpen);
        // Clears the unread badge the moment the panel is opened, same as
        // most real notification centers - it's a real database write for
        // real accounts (see notificationService.js), not just a local reset.
        if (this.isNotifsOpen) store.markNotificationsRead();
      };
    }

    this.headerEl.querySelectorAll('.notif-item').forEach(item => {
      item.onclick = () => {
        this.isNotifsOpen = false;
        flyout.classList.remove('active');
        // Notifications don't carry an id to deep-link to. Matches and
        // messages are Deal Room activity; campaign updates (new applicant,
        // not selected, campaign filled) belong to the campaign screens.
        const type = item.getAttribute('data-notif-type');
        if (type === 'announcement') return; // read in place, nothing to open
        const role = store.currentUser.role;
        const campaignHome = role === 'BUSINESS' ? 'campaigns' : 'applications';
        this.switchView(type === 'system' ? campaignHome : 'dealroom');
      };
    });

    // Settings Modal
    const btnSettings = this.headerEl.querySelector('#btnOpenPlatformSettings');
    const modalSettings = document.getElementById('modalPlatformSettings');
    if (btnSettings && modalSettings) {
      btnSettings.onclick = () => {
        this.isSettingsOpen = true;
        modalSettings.classList.add('active');
      };
    }

    // Avatar -> Media Kit
    const avatar = this.headerEl.querySelector('#btnHeaderAvatarClick');
    if (avatar) {
      // Admin has no Media Kit tab (see renderHeader) - keep them on Operations.
      avatar.onclick = () => this.switchView(store.currentUser.role === 'ADMIN' ? 'ops' : 'mediakit');
    }

    // Log Out (real accounts only)
    const btnLogout = this.headerEl.querySelector('#btnLogoutAccount');
    if (btnLogout) {
      btnLogout.onclick = async () => {
        const { logOut } = await import('./authService.js');
        await logOut();
        localStorage.removeItem('ping_platform_state_v1');
        window.location.reload();
      };
    }
  }

  renderModals() {
    let container = document.getElementById('platformGlobalModals');
    if (!container) {
      container = document.createElement('div');
      container.id = 'platformGlobalModals';
      document.body.appendChild(container);
    }

    const user = store.currentUser;
    const blockedUsers = store.getBlockedUsers ? store.getBlockedUsers() : [];

    container.innerHTML = `
      <!-- Platform Settings Modal -->
      <div class="platform-modal-backdrop ${this.isSettingsOpen ? 'active' : ''}" id="modalPlatformSettings">
        <div class="platform-modal-window">
          <button class="platform-modal-close" id="closeSettingsModal">&times;</button>

          <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
            <div class="platform-brand-icon"><i class="ph-fill ph-gear"></i></div>
            <h2 style="font-family:var(--font-heading); font-size:22px; color:#fff;">Settings</h2>
          </div>

          <!-- Account -->
          <div style="border-bottom:1px solid var(--border-subtle); padding-bottom:20px; margin-bottom:20px;">
            <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin-bottom:12px;">Account</div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:${store.isRealAccount ? '14px' : '0'};">
              <div>
                <div style="font-size:13.5px; color:#fff; font-weight:600;">${escapeHtml(user.email || 'Demo Account')}</div>
                <div style="font-size:11.5px; color:var(--text-dim); margin-top:2px;">Signed in as ${escapeHtml(user.role === 'INFLUENCER' ? 'Creator' : user.role === 'BUSINESS' ? 'Brand' : 'Admin')}</div>
              </div>
            </div>
            ${store.isRealAccount ? `
              <button class="btn-glass" id="btnSendPasswordReset" style="width:100%; padding:10px; font-size:12.5px;">
                <i class="ph-fill ph-lock-key"></i> Send Password Reset Email
              </button>
              <label style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:14px; cursor:pointer;">
                <span style="font-size:12.5px; color:var(--text-muted); line-height:1.4;">Email me about new matches, messages and pitches</span>
                <input type="checkbox" id="toggleEmailNotifs" ${user.settings?.emailNotifications === false ? '' : 'checked'} style="width:18px; height:18px; accent-color:var(--gold); flex-shrink:0;">
              </label>
            ` : ''}
          </div>

          <!-- Privacy & Safety -->
          <div style="border-bottom:1px solid var(--border-subtle); padding-bottom:20px; margin-bottom:20px;">
            <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin-bottom:12px;">Blocked Members</div>
            ${blockedUsers.length === 0 ? `
              <div style="font-size:12.5px; color:var(--text-dim);">You haven't blocked anyone. Block a member from any Deal Room conversation to stop seeing them in Explore & Match.</div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${blockedUsers.map(u => `
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:8px 12px;">
                    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                      <img src="${escapeHtml(u.avatar)}" alt="${escapeHtml(u.name)}" style="width:32px; height:32px; border-radius:999px; object-fit:cover; flex-shrink:0;">
                      <div style="font-size:13px; color:#fff; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(u.name)}</div>
                    </div>
                    <button class="btn-glass btn-unblock-user" data-id="${u.id}" style="padding:5px 12px; font-size:11.5px; flex-shrink:0;">Unblock</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- AI Features -->
          <div style="border-bottom:1px solid var(--border-subtle); padding-bottom:20px; margin-bottom:20px;">
            <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:0.6px; margin-bottom:10px;">AI Bio & Icebreaker Generation</div>
            <div style="font-size:12.5px; color:var(--text-dim); line-height:1.5;">Powered by Ping's built-in AI service — no setup or API key needed. Generation runs securely on Ping's servers.</div>
          </div>

          <!-- Advanced -->
          <div>
            <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:var(--text-dim); letter-spacing:0.6px; margin-bottom:12px;">Advanced</div>
            <button class="btn-glass" id="btnPurgePlatformCache" style="width:100%; padding:10px; font-size:12.5px; color:var(--accent-crimson); border-color:rgba(255,51,102,0.3);">
              Clear Local Cache
            </button>
          </div>
        </div>
      </div>
    `;

    initCustomSelects(container);
    this.bindModalEvents();
  }

  bindModalEvents() {
    // Settings
    const modalSet = document.getElementById('modalPlatformSettings');
    const closeSet = document.getElementById('closeSettingsModal');
    const btnPurge = document.getElementById('btnPurgePlatformCache');

    if (closeSet && modalSet) {
      closeSet.onclick = () => {
        this.isSettingsOpen = false;
        modalSet.classList.remove('active');
      };
    }
    if (btnPurge) {
      btnPurge.onclick = () => {
        if (store.isRealAccount) {
          // Signed in: store.resetAll() would swap this account for the demo
          // seed user. Drop the cached data and reload instead - the session
          // survives and everything real is fetched fresh.
          if (confirm("Clear Ping's cached data in this browser? You'll stay signed in.")) {
            localStorage.removeItem('ping_platform_state_v1');
            window.location.reload();
          }
          return;
        }
        if (confirm('Clear local cache and restore pristine seed data?')) {
          store.resetAll();
          this.isSettingsOpen = false;
          modalSet.classList.remove('active');
          this.showToast('Cache cleared! ⚡');
          this.switchView(this.homeView());
        }
      };
    }

    const toggleEmailNotifs = document.getElementById('toggleEmailNotifs');
    if (toggleEmailNotifs) {
      toggleEmailNotifs.onchange = async () => {
        const on = toggleEmailNotifs.checked;
        toggleEmailNotifs.disabled = true;
        try {
          await store.updateCurrentUserProfile({
            settings: { ...(store.currentUser.settings || {}), emailNotifications: on }
          });
          this.showToast(on ? 'Email notifications on' : 'Email notifications off');
        } catch (err) {
          console.error('Email notification setting failed:', err);
          toggleEmailNotifs.checked = !on;
          this.showToast("Couldn't update that setting. Please try again.");
        } finally {
          toggleEmailNotifs.disabled = false;
        }
      };
    }

    const btnPasswordReset = document.getElementById('btnSendPasswordReset');
    if (btnPasswordReset) {
      btnPasswordReset.onclick = async () => {
        if (!store.currentUser.email) return;
        btnPasswordReset.disabled = true;
        try {
          const { resetPassword } = await import('./authService.js');
          await resetPassword(store.currentUser.email);
          this.showToast(`Password reset email sent to ${store.currentUser.email}`);
        } catch (err) {
          console.error('Password reset failed:', err);
          this.showToast('Could not send reset email — please try again.');
        } finally {
          btnPasswordReset.disabled = false;
        }
      };
    }

    document.querySelectorAll('.btn-unblock-user').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        try {
          await store.unblockUser(id);
          this.showToast('Member unblocked.');
          this.renderModals();
        } catch (err) {
          console.error('Unblock failed:', err);
          this.showToast('Could not unblock — please try again.');
        }
      };
    });
  }

  switchView(view, payload = null) {
    if (this.currentViewCleanup) {
      this.currentViewCleanup();
      this.currentViewCleanup = null;
    }

    // Hard guard, not just hidden nav buttons: Admin only ever sees
    // Operations; Business/Creator never see it, regardless of how
    // switchView was reached (stale state, direct call, etc.).
    const role = store.currentUser.role;
    // Old names from before the campaign flow replaced Explore & Match.
    if (view === 'explore' || view === 'briefs') view = this.homeView(role);
    const allowed = role === 'ADMIN' ? ['ops']
      : role === 'BUSINESS' ? ['campaigns', 'dealroom', 'mediakit']
        : ['discover', 'applications', 'dealroom', 'mediakit'];
    if (!allowed.includes(view)) view = this.homeView(role);

    this.currentView = view;
    if (view === 'dealroom' && payload) {
      this.activeDealId = payload;
    }
    if ((view === 'campaigns' || view === 'discover') && payload) {
      this.activeBriefId = payload;
    }

    this.renderHeader();

    if (!this.viewportEl) return;
    this.viewportEl.innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    switch (view) {
      case 'campaigns':
        this.currentViewCleanup = renderCampaignsPlatform(this.viewportEl, {
          onShowToast: (msg) => this.showToast(msg),
          onOpenChat: (id) => this.switchView('dealroom', id),
          focusBriefId: this.activeBriefId
        });
        this.activeBriefId = null;
        break;

      case 'discover':
        this.currentViewCleanup = renderOpportunitiesPlatform(this.viewportEl, {
          onShowToast: (msg) => this.showToast(msg),
          onOpenChat: (id) => this.switchView('dealroom', id),
          onNavigate: (v) => this.switchView(v),
          focusBriefId: this.activeBriefId
        });
        this.activeBriefId = null;
        break;

      case 'applications':
        this.currentViewCleanup = renderApplicationsPlatform(this.viewportEl, {
          onOpenChat: (id) => this.switchView('dealroom', id),
          onNavigate: (v) => this.switchView(v)
        });
        break;

      case 'dealroom':
        this.currentViewCleanup = renderDealRoomPlatform(this.viewportEl, this.activeDealId, (msg) => this.showToast(msg));
        this.activeDealId = null;
        break;

      case 'mediakit':
        renderMediaKitPlatform(this.viewportEl, (msg) => this.showToast(msg));
        break;

      case 'ops':
        this.currentViewCleanup = renderOpsPlatform(this.viewportEl, (msg) => this.showToast(msg));
        break;

      default:
        this.switchView(this.homeView(role));
        break;
    }
  }

  // Demo sessions only: real announcements arrive in the notifications bell.
  checkBroadcasts() {
    if (store.isRealAccount) return;
    const bcasts = store.broadcasts || [];
    if (bcasts.length > 0) {
      const top = bcasts[0];
      const key = `seen_platform_bcast_${top.id}`;
      if (!sessionStorage.getItem(key)) {
        setTimeout(() => {
          this.showToast(`📢 ${top.title}`);
          sessionStorage.setItem(key, 'true');
        }, 1200);
      }
    }
  }
}

export const platform = new PingPlatform();
