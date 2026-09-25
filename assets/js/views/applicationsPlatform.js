// Ping Platform - My applications (talent). Every campaign the member has
// applied to and where it stands: waiting, selected (with the chat),
// not selected, or filled by others.
import { store } from '../state.js';
import { escapeHtml } from '../domUtils.js';
import { formatWindow, timeAgo, windowsOverlap, briefWindow } from '../campaignUtils.js';

const STATUS = {
  PENDING: { label: 'Waiting', icon: 'ph-hourglass', cls: 'is-wait' },
  SELECTED: { label: 'Selected', icon: 'ph-check-circle', cls: 'is-yes' },
  REJECTED: { label: 'Not selected', icon: 'ph-x-circle', cls: 'is-no' },
  AUTO_REJECTED: { label: 'Campaign filled', icon: 'ph-users-three', cls: 'is-no' }
};

const TABS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'waiting', label: 'Waiting', test: (a) => a.status === 'PENDING' },
  { id: 'selected', label: 'Selected', test: (a) => a.status === 'SELECTED' },
  { id: 'closed', label: 'Not selected', test: (a) => a.status === 'REJECTED' || a.status === 'AUTO_REJECTED' }
];

export function renderApplicationsPlatform(container, { onOpenChat, onNavigate } = {}) {
  let tab = 'all';

  function render() {
    const apps = store.getMyApplications();
    const current = TABS.find(t => t.id === tab) || TABS[0];
    const shown = apps.filter(current.test);
    const selected = apps.filter(a => a.status === 'SELECTED');

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h1 class="section-title">My <em>applications</em></h1>
          <p class="section-subtitle">Every campaign you've applied to, and where it stands.</p>
        </div>
        <button class="btn-glass" data-go="discover"><i class="ph-bold ph-compass"></i> Browse briefs</button>
      </div>

      ${apps.length === 0 ? `
        <div class="app-empty">
          <div class="app-empty-icon"><i class="ph-fill ph-paper-plane-tilt"></i></div>
          <h2>No applications <em>yet</em></h2>
          <p>Apply to open briefs from local brands. You can apply to as many as you like, and if a brand picks you, a chat opens straight away.</p>
          <div class="app-empty-actions"><button class="btn-gold" data-go="discover"><i class="ph-bold ph-compass"></i> Browse briefs</button></div>
        </div>
      ` : `
        <div class="cm-tabs" role="tablist">
          ${TABS.map(t => `<button class="cm-tab ${t.id === tab ? 'is-on' : ''}" role="tab" aria-selected="${t.id === tab}" data-tab="${t.id}">${t.label}<b>${apps.filter(t.test).length}</b></button>`).join('')}
        </div>
        ${shown.length ? `<div class="cm-rows">${shown.map(a => row(a, selected)).join('')}</div>`
          : `<p class="cm-rows-empty">Nothing here right now.</p>`}
      `}
    `;
  }

  function row(a, selected) {
    const b = a.brief;
    const st = STATUS[a.status] || STATUS.PENDING;
    const clash = a.status === 'SELECTED'
      ? selected.find(o => o.briefId !== a.briefId && windowsOverlap(briefWindow(o.brief), briefWindow(b)))
      : null;
    return `
      <article class="cm-row ${st.cls}">
        <img src="${escapeHtml(b.brandAvatar)}" alt="">
        <div class="cm-row-main">
          <span class="cm-row-brand">${escapeHtml(b.brandName)}</span>
          <h3>${escapeHtml(b.title)}</h3>
          <p class="cm-row-meta">${escapeHtml(b.budget)} fixed · ${escapeHtml(formatWindow(b))} · applied ${escapeHtml(timeAgo(a.createdAt))}</p>
          ${a.pitch ? `<p class="cm-row-pitch">“${escapeHtml(a.pitch)}”</p>` : ''}
          ${clash ? `<p class="cm-clash-hint"><i class="ph-fill ph-warning"></i>Overlaps with “${escapeHtml(clash.brief.title)}”.</p>` : ''}
        </div>
        <div class="cm-row-side">
          <span class="cm-pill ${st.cls}"><i class="ph-bold ${st.icon}"></i> ${st.label}</span>
          ${a.status === 'SELECTED' ? `<button class="btn-gold" data-chat="${escapeHtml(b.brandId)}"><i class="ph-bold ph-chat-circle-text"></i> Open chat</button>` : ''}
        </div>
      </article>`;
  }

  function onClick(e) {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.getAttribute('data-tab'); render(); return; }
    const chat = e.target.closest('[data-chat]');
    if (chat) { onOpenChat && onOpenChat(chat.getAttribute('data-chat')); return; }
    const go = e.target.closest('[data-go]');
    if (go) onNavigate && onNavigate(go.getAttribute('data-go'));
  }

  container.addEventListener('click', onClick);
  render();
  const unsubscribe = store.subscribe(() => render());

  return () => {
    unsubscribe();
    container.removeEventListener('click', onClick);
  };
}
