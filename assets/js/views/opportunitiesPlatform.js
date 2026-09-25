// Ping Platform - Discover (talent). Open campaign briefs made for the
// member's talent type (or open to all), nearest first. The fee is fixed
// and shown upfront; applying takes one tap plus an optional pitch note.
// Talent can apply to as many briefs as they like.
import { store } from '../state.js';
import { escapeHtml } from '../domUtils.js';
import { talentMeta, talentTypeOf, talentBadge } from '../talentTypes.js';
import { formatWindow, dueLabel, slotsLeft, sameCity, greeting, greetName } from '../campaignUtils.js';

export function renderOpportunitiesPlatform(container, { onShowToast, onOpenChat, onNavigate, focusBriefId = null } = {}) {
  let niche = 'ALL';
  let applyingTo = null;

  container.innerHTML = '<div class="cm-main"></div><div class="cm-layer"></div>';
  const main = container.querySelector('.cm-main');
  const layer = container.querySelector('.cm-layer');
  const toast = (msg) => onShowToast && onShowToast(msg);

  function clashesFor(b) {
    return store.getScheduleConflicts(store.currentUser.id, b);
  }

  function render() {
    const me = store.currentUser;
    const type = talentMeta(talentTypeOf(me) || 'INFLUENCER');
    const all = store.getOpenBriefsForTalent();
    const niches = [...new Set(all.flatMap(b => b.tags || []))];
    if (niche !== 'ALL' && !niches.includes(niche)) niche = 'ALL';
    const briefs = niche === 'ALL' ? all : all.filter(b => (b.tags || []).includes(niche));
    const mine = store.getMyApplications();

    main.innerHTML = `
      <div class="app-greet">
        <div class="app-greet-left">
          <img src="${escapeHtml(me.avatar)}" alt="" class="app-greet-av">
          <div>
            <p class="app-greet-hi">${greeting()}, ${escapeHtml(greetName(me))}</p>
            <h1 class="section-title">Open <em>briefs</em></h1>
          </div>
        </div>
        <div class="app-stats">
          <div class="app-stat" title="Open briefs you can apply to"><b>${all.length}</b><span>For you</span></div>
          <div class="app-stat" title="Applications waiting for a decision"><b>${mine.filter(a => a.status === 'PENDING').length}</b><span>Waiting</span></div>
          <div class="app-stat" title="Campaigns you've been selected for"><b class="is-lime">${mine.filter(a => a.status === 'SELECTED').length}</b><span>Selected</span></div>
          <div class="app-stat" title="Open chats with brands"><b>${store.getMatchesForCurrentUser().length}</b><span>Chats</span></div>
        </div>
      </div>

      <div class="app-toolbar cm-feed-bar">
        <div class="cm-for">
          ${talentBadge(type.id)}
          <span>Showing briefs for ${escapeHtml(type.plural)}</span>
          <button class="cm-link" data-go="mediakit">Change</button>
        </div>
        ${niches.length > 1 ? `
          <div class="tag-filter-list app-chip-row">
            <button class="tag-filter-chip ${niche === 'ALL' ? 'active' : ''}" data-niche="ALL">All</button>
            ${niches.map(t => `<button class="tag-filter-chip ${niche === t ? 'active' : ''}" data-niche="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
          </div>` : ''}
      </div>

      ${briefs.length === 0 ? `
        <div class="app-empty">
          <div class="app-empty-icon"><i class="ph-fill ${type.icon}"></i></div>
          <h2>No open briefs for ${escapeHtml(type.plural)} <em>yet</em></h2>
          <p>When a local brand posts a campaign for ${escapeHtml(type.plural)}, it shows up here. Meanwhile, make sure your media kit shows your best work, because it's what brands see when you apply.</p>
          <div class="app-empty-actions">
            <button class="btn-gold" data-go="mediakit"><i class="ph-bold ph-user-circle"></i> Update media kit</button>
            ${mine.length ? '<button class="btn-glass" data-go="applications">My applications</button>' : ''}
          </div>
        </div>
      ` : `<div class="cm-brief-grid">${briefs.map(briefCard).join('')}</div>`}
    `;

    if (focusBriefId) {
      const card = main.querySelector(`[data-brief="${CSS.escape(focusBriefId)}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('is-focus');
      }
      focusBriefId = null;
    }
  }

  function briefCard(b) {
    const me = store.currentUser;
    const app = store.getApplication(b.id);
    const clashes = clashesFor(b);
    const left = slotsLeft(b);
    let action;
    if (!app) action = `<button class="btn-gold" data-apply="${escapeHtml(b.id)}">Apply</button>`;
    else if (app.status === 'PENDING') action = '<span class="cm-pill is-wait"><i class="ph-bold ph-hourglass"></i> Applied</span>';
    else if (app.status === 'SELECTED') action = `<button class="btn-gold" data-chat="${escapeHtml(b.brandId)}"><i class="ph-bold ph-chat-circle-text"></i> Selected · Chat</button>`;
    else action = '<span class="cm-pill is-no">Not selected</span>';

    return `
      <article class="cm-brief" data-brief="${escapeHtml(b.id)}">
        <header class="cm-brief-brand">
          <img src="${escapeHtml(b.brandAvatar)}" alt="">
          <div>
            <b>${escapeHtml(b.brandName)}</b>
            <span><i class="ph-fill ph-map-pin"></i>${escapeHtml(b.location || '')}${sameCity(b.location, me.location) ? '<em>Near you</em>' : ''}</span>
          </div>
          ${b.isDemo ? '<span class="cm-demo">Demo</span>' : ''}
        </header>
        <h3>${escapeHtml(b.title)}</h3>
        <p class="cm-brief-desc">${escapeHtml(b.description)}</p>
        <ul class="cm-brief-facts">
          ${b.deliverables ? `<li><i class="ph-bold ph-list-checks"></i><span>Deliverables</span><b>${escapeHtml(b.deliverables)}</b></li>` : ''}
          <li><i class="ph-bold ph-calendar-blank"></i><span>${b.startsOn ? 'Dates' : 'Due / event'}</span><b>${escapeHtml(formatWindow(b))} <small>${escapeHtml(dueLabel(b))}</small></b></li>
          <li><i class="ph-bold ph-users"></i><span>Slots</span><b>${left} of ${b.slots || 1} open</b></li>
        </ul>
        <div class="cm-brief-tags">
          ${talentBadge(b.talentType)}
          ${(b.tags || []).map(t => `<span class="cm-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        ${clashes.length ? `<p class="cm-clash-hint"><i class="ph-fill ph-warning"></i>You're booked for “${escapeHtml(clashes[0].title)}” around these dates.</p>` : ''}
        <footer class="cm-brief-foot">
          <div class="cm-fee"><b>${escapeHtml(b.budget)}</b><span>Fixed fee</span></div>
          ${action}
        </footer>
      </article>`;
  }

  // ─── Apply ───────────────────────────────────────────────────────────────

  function openApply(briefId) {
    const b = store.getBrief(briefId);
    if (!b) return;
    applyingTo = briefId;
    const clashes = clashesFor(b);
    layer.innerHTML = `
      <div class="platform-modal-backdrop active cm-overlay">
        <div class="platform-modal-window cm-apply">
          <button class="platform-modal-close" data-close aria-label="Close">&times;</button>
          <div class="cm-apply-head">
            <img src="${escapeHtml(b.brandAvatar)}" alt="">
            <div>
              <span>${escapeHtml(b.brandName)}</span>
              <h2 class="app-modal-title">${escapeHtml(b.title)}</h2>
            </div>
          </div>

          <div class="cm-apply-terms">
            <div><span>Fixed fee</span><b class="is-lime">${escapeHtml(b.budget)}</b></div>
            <div><span>${b.startsOn ? 'Dates' : 'Due / event'}</span><b>${escapeHtml(formatWindow(b))}</b></div>
            ${b.deliverables ? `<div class="is-wide"><span>Deliverables</span><b>${escapeHtml(b.deliverables)}</b></div>` : ''}
            <div><span>Slots open</span><b>${slotsLeft(b)} of ${b.slots || 1}</b></div>
            <div><span>Location</span><b>${escapeHtml(b.location || '—')}</b></div>
          </div>

          <p class="cm-apply-fixed"><i class="ph-fill ph-lock-simple"></i>The fee is set by the brand and isn't negotiable. Apply only if it works for you.</p>
          ${clashes.length ? `<p class="cm-clash-hint"><i class="ph-fill ph-warning"></i>You're already booked for “${escapeHtml(clashes[0].title)}” (${escapeHtml(formatWindow(clashes[0]))}). You can still apply.</p>` : ''}

          <form id="cmApplyForm" novalidate>
            <div class="cm-field">
              <label for="cmPitch">Pitch note <span class="cm-opt">(optional)</span></label>
              <textarea id="cmPitch" rows="4" maxlength="500" placeholder="A line or two on why you're a great fit…"></textarea>
              <div class="cm-help"><span id="cmPitchCount">0</span>/500</div>
            </div>
            <button type="submit" class="btn-gold cm-submit">Send application</button>
            <p class="cm-apply-note">The brand sees your media kit and this note. If they pick you, a chat opens straight away.</p>
          </form>
        </div>
      </div>`;
  }

  async function submitApply(form) {
    const pitch = (layer.querySelector('#cmPitch')?.value || '').trim();
    const btn = form.querySelector('.cm-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const { alreadyApplied } = await store.applyToBrief(applyingTo, pitch);
      layer.innerHTML = '';
      applyingTo = null;
      toast(alreadyApplied ? "You've already applied to this one." : "Applied! You'll hear back when the brand decides.");
      render();
    } catch (err) {
      console.error('applyToBrief failed:', err);
      btn.disabled = false;
      btn.textContent = 'Send application';
      toast("Couldn't send your application. Please try again.");
    }
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  function onClick(e) {
    const t = e.target;
    const apply = t.closest('[data-apply]');
    if (apply) { openApply(apply.getAttribute('data-apply')); return; }
    const chat = t.closest('[data-chat]');
    if (chat) { onOpenChat && onOpenChat(chat.getAttribute('data-chat')); return; }
    const go = t.closest('[data-go]');
    if (go) { onNavigate && onNavigate(go.getAttribute('data-go')); return; }
    const chip = t.closest('[data-niche]');
    if (chip) { niche = chip.getAttribute('data-niche'); render(); return; }
    if (t.closest('[data-close]') || t.classList.contains('cm-overlay')) { layer.innerHTML = ''; applyingTo = null; }
  }

  function onInput(e) {
    if (e.target.id === 'cmPitch') {
      const count = layer.querySelector('#cmPitchCount');
      if (count) count.textContent = e.target.value.length;
    }
  }

  function onSubmit(e) {
    if (e.target.id !== 'cmApplyForm') return;
    e.preventDefault();
    submitApply(e.target);
  }

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('submit', onSubmit);

  render();
  const unsubscribe = store.subscribe(() => render());

  return () => {
    unsubscribe();
    container.removeEventListener('click', onClick);
    container.removeEventListener('input', onInput);
    container.removeEventListener('submit', onSubmit);
  };
}
