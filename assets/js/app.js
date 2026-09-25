// Ping Web Platform - Main Controller & Application Shell
import { store } from './state.js';
import { aiService } from './aiService.js';
import { renderDiscoveryView } from './views/discoveryView.js';
import { renderBriefsView } from './views/briefsView.js';
import { renderChatView } from './views/chatView.js';
import { renderProfileView } from './views/profileView.js';
import { renderAdminView } from './views/adminView.js';

class PingAppController {
  constructor() {
    this.currentTab = 'discovery'; // 'discovery' | 'briefs' | 'chat' | 'profile' | 'admin'
    this.activeMatchId = null;
    this.rootEl = document.getElementById('pingAppRoot');
    this.viewportEl = document.getElementById('appMainViewport');
    this.toastEl = document.getElementById('appToast');
    this.toastTimer = null;
    this.isNotifsOpen = false;
  }

  init() {
    if (!this.rootEl) return;

    this.renderHeader();
    this.renderModals();
    this.navigateTo(this.currentTab);

    // Subscribe to state updates
    store.subscribe(() => {
      this.renderHeader();
    });

    // Check for broadcasts
    this.checkBroadcasts();
  }

  showToast(message) {
    if (!this.toastEl) return;
    this.toastEl.querySelector('.toast-text').textContent = message;
    this.toastEl.classList.add('visible');

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('visible');
    }, 3200);
  }

  getNotifications() {
    const matches = store.getMatchesForCurrentUser();
    const list = [];

    // Recent proposals
    matches.forEach(m => {
      const propMsg = (m.messages || []).find(msg => msg.type === 'proposal');
      if (propMsg && propMsg.proposalData) {
        list.push({
          id: `notif_${propMsg.id}`,
          type: 'proposal',
          iconClass: 'notif-icon-proposal',
          icon: 'ph-file-text',
          title: 'Smart Proposal Active',
          text: `${m.otherUser?.name || 'Partner'}: ${propMsg.proposalData.title} (${propMsg.proposalData.price})`,
          time: new Date(propMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          matchId: m.id
        });
      }
    });

    // Matches
    matches.forEach(m => {
      list.push({
        id: `notif_match_${m.id}`,
        type: 'match',
        iconClass: 'notif-icon-match',
        icon: 'ph-lightning',
        title: 'High-Intent Match',
        text: `Connected with ${m.otherUser?.name || 'Partner'}. Tap to chat.`,
        time: new Date(m.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        matchId: m.id
      });
    });

    return list.slice(0, 6);
  }

  renderHeader() {
    const user = store.currentUser;
    const matches = store.getMatchesForCurrentUser();
    const pendingVerifications = store.adminStats.pendingVerifications;
    const notifs = this.getNotifications();

    const header = document.getElementById('appHeaderNav');
    if (!header) return;

    header.innerHTML = `
      <div class="app-brand" id="appBrandLogo">
        <i class="ph-fill ph-lightning"></i>
        <span>Ping</span>
        <span class="brand-badge-pill">${user.role}</span>
      </div>

      <!-- Main Navigation Tabs -->
      <nav class="app-nav-tabs">
        <button class="nav-tab-btn ${this.currentTab === 'discovery' ? 'active' : ''}" data-tab="discovery">
          <i class="ph-fill ph-compass"></i>
          <span>Discovery</span>
        </button>

        <button class="nav-tab-btn ${this.currentTab === 'briefs' ? 'active' : ''}" data-tab="briefs">
          <i class="ph-fill ph-megaphone-simple"></i>
          <span>Briefs</span>
        </button>

        <button class="nav-tab-btn ${this.currentTab === 'chat' ? 'active' : ''}" data-tab="chat">
          <i class="ph-fill ph-chats-teardrop"></i>
          <span>Chat</span>
          ${matches.length > 0 ? `<span class="nav-badge-count">${matches.length}</span>` : ''}
        </button>

        <button class="nav-tab-btn ${this.currentTab === 'profile' ? 'active' : ''}" data-tab="profile">
          <i class="ph-fill ph-user-circle"></i>
          <span>Profile</span>
        </button>

        <button class="nav-tab-btn ${this.currentTab === 'admin' ? 'active' : ''}" data-tab="admin">
          <i class="ph-fill ph-shield-star"></i>
          <span>Concierge</span>
          ${pendingVerifications > 0 ? `<span class="nav-badge-count">${pendingVerifications}</span>` : ''}
        </button>
      </nav>

      <!-- Right Actions: Role Switcher & User Profile -->
      <div class="app-header-right" style="position:relative;">
        <div class="role-switcher-wrap" title="Quickly switch personas to test creator, brand, and admin experiences">
          <span class="role-label">Persona:</span>
          <select class="role-select" id="headerRoleSelect">
            ${store.users.map(u => `
              <option value="${u.id}" ${user.id === u.id ? 'selected' : ''}>
                ${u.name} (${u.role === 'INFLUENCER' ? 'Creator' : u.role === 'BUSINESS' ? 'Brand' : 'Admin'})
              </option>
            `).join('')}
            <option value="__create__">+ Register New Account...</option>
          </select>
        </div>

        <!-- Notification Bell Button -->
        <button class="btn-exit-app" id="btnHeaderNotifs" style="position:relative; padding:7px 10px;" title="Activity Notifications">
          <i class="ph-fill ph-bell" style="font-size:16px;"></i>
          ${notifs.length > 0 ? `<span class="nav-badge-count" style="position:absolute; top:-4px; right:-4px;">${notifs.length}</span>` : ''}
        </button>

        <!-- Settings Gear Button -->
        <button class="btn-exit-app" id="btnHeaderSettings" style="padding:7px 10px;" title="Platform Settings & AI Config">
          <i class="ph-fill ph-gear" style="font-size:16px;"></i>
        </button>

        <div class="user-avatar-btn" id="btnHeaderAvatar" title="View Profile">
          <img src="${user.avatar}" alt="${user.name}">
        </div>

        <button class="btn-exit-app" id="btnExitToLanding" title="Return to Marketing Landing Page">
          <i class="ph-bold ph-arrow-square-out"></i>
          <span>Landing</span>
        </button>

        <!-- Notifications Dropdown Box -->
        <div class="notifications-dropdown ${this.isNotifsOpen ? 'active' : ''}" id="notifsDropdown">
          <div class="notif-header">
            <span>Notifications</span>
            <span style="font-size:11px; color:var(--text-tertiary);">${notifs.length} recent</span>
          </div>
          <div class="notif-list">
            ${notifs.length === 0 ? `
              <div style="padding:20px; text-align:center; color:var(--text-secondary); font-size:12px;">No new alerts</div>
            ` : notifs.map(n => `
              <div class="notif-item" data-match-id="${n.matchId}">
                <div class="notif-icon ${n.iconClass}"><i class="ph-fill ${n.icon}"></i></div>
                <div class="notif-body">
                  <div style="font-weight:700; color:#fff;">${n.title}</div>
                  <div>${n.text}</div>
                  <div class="notif-time">${n.time}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindHeaderEvents();
  }

  bindHeaderEvents() {
    const header = document.getElementById('appHeaderNav');
    if (!header) return;

    // Navigation tab buttons
    header.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        this.navigateTo(tab);
      };
    });

    // Logo -> discovery
    const brandLogo = header.querySelector('#appBrandLogo');
    if (brandLogo) {
      brandLogo.onclick = () => this.navigateTo('discovery');
    }

    // Role switcher dropdown
    const roleSelect = header.querySelector('#headerRoleSelect');
    if (roleSelect) {
      roleSelect.onchange = (e) => {
        const val = e.target.value;
        if (val === '__create__') {
          document.getElementById('registerAccountModal').classList.add('active');
          roleSelect.value = store.currentUser.id; // reset select
        } else {
          store.setCurrentUser(val);
          this.showToast(`Switched persona to ${store.currentUser.name} (${store.currentUser.role})`);
          this.navigateTo(this.currentTab);
        }
      };
    }

    // Notifications toggle
    const btnNotifs = header.querySelector('#btnHeaderNotifs');
    const dropdown = header.querySelector('#notifsDropdown');
    if (btnNotifs && dropdown) {
      btnNotifs.onclick = (e) => {
        e.stopPropagation();
        this.isNotifsOpen = !this.isNotifsOpen;
        dropdown.classList.toggle('active', this.isNotifsOpen);
      };
    }

    // Close notifications when clicked outside
    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== btnNotifs) {
        this.isNotifsOpen = false;
        dropdown.classList.remove('active');
      }
    });

    // Click on a notification -> open chat
    header.querySelectorAll('.notif-item').forEach(item => {
      item.onclick = () => {
        const mId = item.getAttribute('data-match-id');
        this.isNotifsOpen = false;
        dropdown.classList.remove('active');
        if (mId) this.navigateTo('chat', mId);
      };
    });

    // Settings Modal
    const btnSettings = header.querySelector('#btnHeaderSettings');
    const settingsModal = document.getElementById('settingsModal');
    if (btnSettings && settingsModal) {
      btnSettings.onclick = () => settingsModal.classList.add('active');
    }

    // Avatar -> profile
    const avatarBtn = header.querySelector('#btnHeaderAvatar');
    if (avatarBtn) {
      avatarBtn.onclick = () => this.navigateTo('profile');
    }

    // Exit to landing
    const btnExit = header.querySelector('#btnExitToLanding');
    if (btnExit) {
      btnExit.onclick = () => {
        window.location.hash = '';
        document.getElementById('pingLandingRoot').style.display = 'block';
        this.rootEl.classList.remove('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }
  }

  renderModals() {
    let modalRoot = document.getElementById('appGlobalModals');
    if (!modalRoot) {
      modalRoot = document.createElement('div');
      modalRoot.id = 'appGlobalModals';
      document.body.appendChild(modalRoot);
    }

    modalRoot.innerHTML = `
      <!-- Register New Persona Modal -->
      <div class="app-modal-overlay" id="registerAccountModal">
        <div class="app-modal-box">
          <button class="app-modal-close" id="closeRegisterModal">&times;</button>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
            <i class="ph-fill ph-user-plus" style="color:var(--gold-primary); font-size:26px;"></i>
            <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px;">Register New Member Profile</h2>
          </div>

          <form id="registerAccountForm" style="display:flex; flex-direction:column; gap:14px;">
            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Account Role</label>
              <select id="regRoleInput" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px; outline:none;">
                <option value="INFLUENCER">Creator / Influencer</option>
                <option value="BUSINESS">Brand / Business</option>
              </select>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Full Name</label>
                <input type="text" id="regNameInput" placeholder="e.g. Maya Patel" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Brand / Handle</label>
                <input type="text" id="regCompanyInput" placeholder="e.g. MayaVisuals" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
              </div>
            </div>

            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Location</label>
              <input type="text" id="regLocationInput" placeholder="e.g. Mumbai, MH" value="Mumbai, MH" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
            </div>

            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Niche Tags (Comma separated)</label>
              <input type="text" id="regTagsInput" placeholder="e.g. Tech, Lifestyle, Minimalist" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
            </div>

            <button type="submit" class="btn-primary" style="margin-top:10px; background:var(--gold-primary); color:#000; padding:12px; border-radius:999px; font-weight:700; border:none; cursor:pointer;">
              Create Member Profile
            </button>
          </form>
        </div>
      </div>

      <!-- Platform Settings & Configuration Modal -->
      <div class="app-modal-overlay" id="settingsModal">
        <div class="app-modal-box">
          <button class="app-modal-close" id="closeSettingsModal">&times;</button>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
            <i class="ph-fill ph-gear" style="color:var(--gold-primary); font-size:26px;"></i>
            <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px;">Platform Settings</h2>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">AI Engine Configuration</div>
            <div style="margin-bottom:12px;">
              <label style="font-size:12px; color:var(--text-secondary);">Google Gemini API Key</label>
              <input type="password" id="settingGeminiKey" placeholder="AIzaSy..." value="${aiService.getApiKey()}" style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:13px;">
              <span style="font-size:11px; color:var(--text-tertiary); margin-top:4px; display:block;">Powers live AI Bio generation, matchmaker rationale, and smart icebreakers.</span>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">Notification Alerts</div>
            <div class="settings-row">
              <div>
                <div class="settings-row-label">Match Alerts</div>
                <div class="settings-row-sub">Instant sound and push notification when matched</div>
              </div>
              <label class="switch">
                <input type="checkbox" checked id="toggleMatchAlerts">
                <span class="slider"></span>
              </label>
            </div>

            <div class="settings-row">
              <div>
                <div class="settings-row-label">Smart Proposal Escrow Alerts</div>
                <div class="settings-row-sub">Notify when milestone review or payout is released</div>
              </div>
              <label class="switch">
                <input type="checkbox" checked id="toggleProposalAlerts">
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">Data Storage & Cache</div>
            <div style="display:flex; gap:10px; margin-top:10px;">
              <button class="btn-primary" id="btnSaveSettings" style="background:var(--gold-primary); color:#000; padding:10px 20px; border-radius:999px; font-weight:700; border:none; cursor:pointer;">
                Save Preferences
              </button>
              <button class="btn-exit-app" id="btnClearCacheBtn" style="color:var(--accent-crimson); border-color:rgba(255,51,102,0.3);">
                Clear Local Data
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindModalEvents();
  }

  bindModalEvents() {
    // Register Account Modal
    const regModal = document.getElementById('registerAccountModal');
    const closeReg = document.getElementById('closeRegisterModal');
    const regForm = document.getElementById('registerAccountForm');

    if (closeReg && regModal) {
      closeReg.onclick = () => regModal.classList.remove('active');
    }

    if (regForm) {
      regForm.onsubmit = (e) => {
        e.preventDefault();
        const role = document.getElementById('regRoleInput').value;
        const name = document.getElementById('regNameInput').value.trim();
        const company = document.getElementById('regCompanyInput').value.trim();
        const location = document.getElementById('regLocationInput').value.trim();
        const tags = document.getElementById('regTagsInput').value.split(',').map(t => t.trim()).filter(Boolean);

        const newUser = {
          id: `custom_${Date.now()}`,
          name,
          role,
          avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`,
          bio: `${name} on Ping — specialized in ${tags.join(', ')}.`,
          location,
          company,
          jobTitle: role === 'INFLUENCER' ? 'Content Creator' : 'Founder',
          tags,
          verified: false,
          verificationStatus: 'PENDING',
          status: 'ACTIVE',
          pingScore: 90,
          completionRate: 100,
          responseTime: '< 1h',
          totalEarnings: 0,
          rating: 5.0,
          reviewCount: 0,
          stats: {
            followers: '50K',
            engagement: '6.0%',
            budget: '₹50,000'
          },
          socialStats: {
            instagramFollowers: '40K',
            youtubeSubscribers: '10K',
            avgEngagement: '6.0%'
          },
          joinedAt: Date.now()
        };

        store.users.unshift(newUser);
        store.setCurrentUser(newUser.id);
        regModal.classList.remove('active');
        this.showToast(`Welcome ${name}! Your profile is now active.`);
        this.navigateTo('profile');
      };
    }

    // Settings Modal
    const setModal = document.getElementById('settingsModal');
    const closeSet = document.getElementById('closeSettingsModal');
    const btnSaveSet = document.getElementById('btnSaveSettings');
    const btnClearCache = document.getElementById('btnClearCacheBtn');

    if (closeSet && setModal) {
      closeSet.onclick = () => setModal.classList.remove('active');
    }

    if (btnSaveSet) {
      btnSaveSet.onclick = () => {
        const key = document.getElementById('settingGeminiKey').value.trim();
        aiService.setApiKey(key);
        setModal.classList.remove('active');
        this.showToast('Platform preferences updated! ✨');
      };
    }

    if (btnClearCache) {
      btnClearCache.onclick = () => {
        if (confirm('Clear local app storage and reset to seed profiles?')) {
          store.resetAll();
          setModal.classList.remove('active');
          this.showToast('Application reset to default state.');
          this.navigateTo('discovery');
        }
      };
    }
  }

  navigateTo(tab, payload = null) {
    this.currentTab = tab;
    if (tab === 'chat' && payload) {
      this.activeMatchId = payload;
    }

    this.renderHeader();

    if (!this.viewportEl) return;
    this.viewportEl.innerHTML = '';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    switch (tab) {
      case 'discovery':
        renderDiscoveryView(this.viewportEl, (matchId) => {
          this.navigateTo('chat', matchId);
        }, (msg) => this.showToast(msg));
        break;

      case 'briefs':
        renderBriefsView(this.viewportEl, (msg) => this.showToast(msg));
        break;

      case 'chat':
        renderChatView(this.viewportEl, this.activeMatchId, (msg) => this.showToast(msg));
        this.activeMatchId = null;
        break;

      case 'profile':
        renderProfileView(this.viewportEl, (msg) => this.showToast(msg));
        break;

      case 'admin':
        renderAdminView(this.viewportEl, (msg) => this.showToast(msg));
        break;

      default:
        this.navigateTo('discovery');
        break;
    }
  }

  checkBroadcasts() {
    const broadcasts = store.broadcasts || [];
    if (broadcasts.length > 0) {
      const latest = broadcasts[0];
      const seenKey = `seen_bcast_${latest.id}`;
      if (!sessionStorage.getItem(seenKey)) {
        setTimeout(() => {
          this.showToast(`📢 ${latest.title}`);
          sessionStorage.setItem(seenKey, 'true');
        }, 1500);
      }
    }
  }
}

export const appController = new PingAppController();
