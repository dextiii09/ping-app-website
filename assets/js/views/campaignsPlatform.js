// Ping Platform - Campaigns (brands). Post a campaign brief with a fixed fee,
// a number of slots, the talent type and the date; then review the people
// who applied one card at a time. A right swipe fills a slot and opens a chat
// straight away; once every slot is filled, everyone still waiting is told
// the campaign is filled (see decide_application() in
// supabase/campaign_matching.sql).
import { store } from '../state.js';
import { escapeHtml } from '../domUtils.js';
import { NICHE_TAGS } from '../mockData.js';
import { detectLocation } from '../geoService.js';
import { TALENT_TYPES, talentMeta, talentTypeOf, talentHighlights, talentLinks, portfolioOf, talentBadge } from '../talentTypes.js';
import {
  campaignStatus, STATUS_LABEL, formatWindow, feeAmount, formatINR, slotsLeft,
  timeAgo, toDateInput, greeting, greetName
} from '../campaignUtils.js';

const SWIPE_THRESHOLD = 110;

export function renderCampaignsPlatform(container, { onShowToast, onOpenChat, focusBriefId = null } = {}) {
  let mode = focusBriefId ? 'review' : 'list';
  let reviewId = focusBriefId;
  let busy = false;      // a decision is being saved / animated
  let dragging = false;

  container.innerHTML = '<div class="cm-main"></div><div class="cm-layer"></div>';
  const main = container.querySelector('.cm-main');
  const layer = container.querySelector('.cm-layer');

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const toast = (msg) => onShowToast && onShowToast(msg);

  function counts(briefId) {
    const apps = store.applications.filter(a => a.briefId === briefId);
    return {
      total: apps.length,
      pending: apps.filter(a => a.status === 'PENDING').length,
      selected: apps.filter(a => a.status === 'SELECTED').length,
      autoRejected: apps.filter(a => a.status === 'AUTO_REJECTED').length
    };
  }

  function slotDots(b, big = false) {
    const slots = b.slots || 1;
    const filled = Math.min(b.slotsFilled || 0, slots);
    if (slots > 12) {
      return `<div class="cm-slot-bar${big ? ' is-big' : ''}"><span style="width:${Math.round((filled / slots) * 100)}%"></span></div>`;
    }
    return `<div class="cm-slot-dots${big ? ' is-big' : ''}">${Array.from({ length: slots }, (_, i) => `<i class="${i < filled ? 'is-on' : ''}"></i>`).join('')}</div>`;
  }

  const statusPill = (b) => {
    const st = campaignStatus(b);
    return `<span class="cm-status is-${st.toLowerCase()}">${STATUS_LABEL[st]}</span>`;
  };

  const pendingApplicants = () => store.getApplicantsForBrief(reviewId).filter(a => a.status === 'PENDING');

  // ─── List of campaigns ───────────────────────────────────────────────────

  function renderList() {
    const me = store.currentUser;
    const campaigns = store.getMyCampaigns();
    const live = campaigns.filter(b => campaignStatus(b) === 'OPEN');
    const totalSlots = campaigns.reduce((n, b) => n + (b.slots || 1), 0);
    const filledSlots = campaigns.reduce((n, b) => n + Math.min(b.slotsFilled || 0, b.slots || 1), 0);
    const toReview = store.pendingApplicantsCount();

    main.innerHTML = `
      <div class="app-greet">
        <div class="app-greet-left">
          <img src="${escapeHtml(me.avatar)}" alt="" class="app-greet-av">
          <div>
            <p class="app-greet-hi">${greeting()}, ${escapeHtml(greetName(me))}</p>
            <h1 class="section-title">Your <em>campaigns</em></h1>
          </div>
        </div>
        <div class="app-stats">
          <div class="app-stat" title="Campaigns taking applications"><b>${live.length}</b><span>Live</span></div>
          <div class="app-stat" title="Applicants waiting for your decision"><b class="is-lime">${toReview}</b><span>To review</span></div>
          <div class="app-stat" title="Slots filled across all campaigns"><b>${filledSlots}/${totalSlots}</b><span>Slots filled</span></div>
          <div class="app-stat" title="Chats with talent you've picked"><b>${store.getMatchesForCurrentUser().length}</b><span>Chats</span></div>
        </div>
      </div>

      ${campaigns.length === 0 ? `
        <div class="app-empty cm-empty">
          <div class="app-empty-icon"><i class="ph-fill ph-megaphone-simple"></i></div>
          <h2>Post your first <em>campaign</em></h2>
          <p>Set a fixed fee, how many people you need and the date. Local talent applies, you swipe through them, and every pick opens a chat.</p>
          ${flowSteps()}
          <div class="app-empty-actions">
            <button class="btn-gold" data-cm="new"><i class="ph-bold ph-plus"></i> New campaign</button>
          </div>
        </div>
      ` : `
        <div class="cm-bar">
          ${flowSteps()}
          <button class="btn-gold" data-cm="new"><i class="ph-bold ph-plus"></i> New campaign</button>
        </div>
        <div class="cm-grid">
          ${campaigns.map(campaignCard).join('')}
        </div>
      `}
    `;
  }

  function flowSteps() {
    const steps = [['ph-megaphone-simple', 'Post a campaign'], ['ph-hand-waving', 'Talent applies'], ['ph-cards', 'Swipe to pick'], ['ph-chats-circle', 'Chat & deliver']];
    return `<ol class="cm-flow">${steps.map(([icon, label], i) => `<li><span>${i + 1}</span><i class="ph-bold ${icon}"></i>${label}</li>`).join('')}</ol>`;
  }

  function campaignCard(b) {
    const st = campaignStatus(b);
    const c = counts(b.id);
    const fee = feeAmount(b);
    const who = talentMeta(b.talentType);
    let primary;
    if (st === 'OPEN' && c.pending > 0) {
      primary = `<button class="btn-gold" data-cm="review" data-id="${escapeHtml(b.id)}"><i class="ph-bold ph-cards"></i> Review ${c.pending} applicant${c.pending === 1 ? '' : 's'}</button>`;
    } else if (st === 'OPEN') {
      primary = `<button class="btn-glass" disabled><i class="ph-bold ph-hourglass"></i> Waiting for applicants</button>`;
    } else {
      primary = `<button class="btn-glass" data-cm="review" data-id="${escapeHtml(b.id)}">View campaign</button>`;
    }
    return `
      <article class="cm-card is-${st.toLowerCase()}">
        <div class="cm-card-top">
          ${statusPill(b)}
          ${talentBadge(b.talentType)}
          <span class="cm-card-when"><i class="ph-bold ph-calendar-blank"></i>${escapeHtml(formatWindow(b))}</span>
        </div>
        <h3 class="cm-card-title">${escapeHtml(b.title)}</h3>
        ${b.deliverables ? `<p class="cm-card-deliv"><i class="ph-bold ph-list-checks"></i>${escapeHtml(b.deliverables)}</p>` : ''}
        <div class="cm-card-money">
          <b>${escapeHtml(b.budget)}</b><span>fixed per ${escapeHtml(who.id === 'ANY' ? 'person' : who.label.toLowerCase())}</span>
          ${(b.slots || 1) > 1 && fee ? `<em>${formatINR(fee * b.slots)} total</em>` : ''}
        </div>
        <div class="cm-card-slots">
          ${slotDots(b)}
          <span><b>${Math.min(b.slotsFilled || 0, b.slots || 1)} of ${b.slots || 1}</b> slot${(b.slots || 1) === 1 ? '' : 's'} filled · ${c.total} applied</span>
        </div>
        <div class="cm-card-foot">
          ${primary}
          ${c.selected ? `<button class="btn-glass" data-cm="picked" data-id="${escapeHtml(b.id)}"><i class="ph-bold ph-user-check"></i> Selected (${c.selected})</button>` : ''}
        </div>
      </article>`;
  }

  // ─── Reviewing one campaign's applicants ────────────────────────────────

  function renderReview() {
    const b = store.getBrief(reviewId);
    if (!b) { mode = 'list'; renderList(); return; }
    const st = campaignStatus(b);
    const pending = pendingApplicants();
    const selected = store.getApplicantsForBrief(reviewId).filter(a => a.status === 'SELECTED');
    const c = counts(b.id);

    main.innerHTML = `
      <div class="cm-review">
        <div class="cm-review-head">
          <button class="cm-back" data-cm="back"><i class="ph-bold ph-arrow-left"></i> Campaigns</button>
          <div class="cm-review-meta">
            <div class="cm-review-tags">${statusPill(b)}${talentBadge(b.talentType)}</div>
            <h1 class="cm-review-title">${escapeHtml(b.title)}</h1>
            <p class="cm-review-sub">${escapeHtml(b.budget)} fixed · ${escapeHtml(formatWindow(b))} · ${escapeHtml(b.location || '')}</p>
          </div>
          <div class="cm-slotmeter">
            <span>Slots</span>
            ${slotDots(b, true)}
            <b>${Math.min(b.slotsFilled || 0, b.slots || 1)}/${b.slots || 1}</b>
          </div>
        </div>

        <div class="cm-review-body">
          <div class="cm-deck-col">
            ${pending.length && st === 'OPEN' ? `
              <div class="cm-deck">${pending.slice(0, 3).map((a, i) => applicantCard(a, i)).reverse().join('')}</div>
              <div class="cm-deck-actions">
                <button class="cm-act is-pass" data-cm="pass" title="Pass (Left arrow)" aria-label="Pass"><i class="ph-bold ph-x"></i></button>
                <span class="cm-deck-count"><b>${pending.length}</b> to review</span>
                <button class="cm-act is-pick" data-cm="pick" title="Select (Right arrow)" aria-label="Select"><i class="ph-bold ph-check"></i></button>
              </div>
              <p class="cm-deck-hint">Swipe right to select, left to pass.<span class="cm-keys"> The arrow keys work too.</span></p>
            ` : deckDone(b, st, c)}
          </div>

          <aside class="cm-side">
            <div class="cm-side-box">
              <h4>Selected <span>${selected.length}/${b.slots || 1}</span></h4>
              ${selected.length ? `<ul class="cm-picked">${selected.map(pickedRow).join('')}</ul>`
                : '<p class="cm-side-empty">No one yet. Swipe right on someone to fill a slot.</p>'}
            </div>
            <div class="cm-side-box is-muted">
              <h4>How it works</h4>
              <ul class="cm-rules">
                <li><i class="ph-bold ph-check"></i>A right swipe fills a slot and opens a chat with that person.</li>
                <li><i class="ph-bold ph-users"></i>When all ${b.slots || 1} slot${(b.slots || 1) === 1 ? ' is' : 's are'} filled, everyone still waiting is told the campaign is filled.</li>
                <li><i class="ph-bold ph-calendar-x"></i>If someone is already booked on these dates, you'll be asked before they're selected.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    `;
    bindDrag();
  }

  function deckDone(b, st, c) {
    if (st === 'FILLED') {
      return `
        <div class="cm-deck-done">
          <div class="app-empty-icon"><i class="ph-fill ph-confetti"></i></div>
          <h2>All slots <em>filled</em></h2>
          <p>${c.autoRejected ? `The ${c.autoRejected} other applicant${c.autoRejected === 1 ? ' was' : 's were'} told the campaign is filled.` : 'Your picks are in the Deal Room.'}</p>
          <div class="app-empty-actions">
            <button class="btn-gold" data-cm="chats"><i class="ph-bold ph-chats-circle"></i> Open chats</button>
            <button class="btn-glass" data-cm="back">All campaigns</button>
          </div>
        </div>`;
    }
    if (st !== 'OPEN') {
      return `
        <div class="cm-deck-done">
          <div class="app-empty-icon"><i class="ph-fill ph-flag-checkered"></i></div>
          <h2>Campaign <em>${st === 'ENDED' ? 'ended' : 'closed'}</em></h2>
          <p>It's no longer taking applications.</p>
          <div class="app-empty-actions"><button class="btn-glass" data-cm="back">All campaigns</button></div>
        </div>`;
    }
    const left = slotsLeft(b);
    return `
      <div class="cm-deck-done">
        <div class="app-empty-icon"><i class="ph-fill ph-check-circle"></i></div>
        <h2>You're all <em>caught up</em></h2>
        <p>${c.total ? `${left} slot${left === 1 ? ' is' : 's are'} still open. New applicants will show up here.` : 'No one has applied yet. Talent sees your campaign in their feed, so check back soon.'}</p>
        <div class="app-empty-actions"><button class="btn-glass" data-cm="back">All campaigns</button></div>
      </div>`;
  }

  function applicantCard(a, depth) {
    const p = a.profile;
    if (depth > 0) {
      return `<article class="cm-app-card is-behind is-d${depth}" aria-hidden="true"><div class="cm-app-media"><img src="${escapeHtml(p.avatar)}" alt=""></div></article>`;
    }
    const type = talentTypeOf(p) || 'INFLUENCER';
    const stats = talentHighlights(p);
    const work = portfolioOf(p).filter(w => w.image).slice(0, 3);
    const links = talentLinks(p).slice(0, 4);
    return `
      <article class="cm-app-card is-top" data-creator="${escapeHtml(p.id)}">
        <div class="cm-app-media">
          <img src="${escapeHtml(p.avatar)}" alt="${escapeHtml(p.name)}" draggable="false">
          <div class="cm-app-shade"></div>
          <div class="cm-app-badges">${talentBadge(type)}${p.isDemo ? '<span class="cm-demo">Demo</span>' : ''}</div>
          <span class="cm-app-when">Applied ${escapeHtml(timeAgo(a.createdAt))}</span>
          <div class="cm-app-id">
            <h2>${escapeHtml(p.name)}${p.verified ? ' <i class="ph-fill ph-seal-check" title="Verified by Ping"></i>' : ''}</h2>
            <p><i class="ph-fill ph-map-pin"></i>${escapeHtml(p.location || 'Location not set')}</p>
          </div>
        </div>
        <div class="cm-app-body">
          ${stats.length ? `<div class="cm-app-stats">${stats.map(s => `<div><b>${escapeHtml(s.value)}</b><span>${escapeHtml(s.label)}</span></div>`).join('')}</div>` : ''}
          <div class="cm-app-pitch${a.pitch ? '' : ' is-empty'}">
            <span>Pitch note</span>
            <p>${a.pitch ? escapeHtml(a.pitch) : 'No note. They applied with their profile.'}</p>
          </div>
          ${work.length ? `<div class="cm-app-work">${work.map(w => `<a href="${escapeHtml(w.url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(w.url)}" alt="Past work" draggable="false"></a>`).join('')}</div>` : ''}
          ${links.length ? `<div class="cm-app-links">${links.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer"><i class="ph-bold ph-arrow-up-right"></i>${escapeHtml(l.label)}</a>`).join('')}</div>` : ''}
          ${!work.length && !links.length && p.bio ? `<p class="cm-app-bio">${escapeHtml(p.bio)}</p>` : ''}
        </div>
        <span class="cm-stamp is-pick">Select</span>
        <span class="cm-stamp is-pass">Pass</span>
      </article>`;
  }

  function pickedRow(a) {
    const p = a.profile;
    return `
      <li>
        <img src="${escapeHtml(p.avatar)}" alt="">
        <div><b>${escapeHtml(p.name)}</b><span>${escapeHtml(talentMeta(talentTypeOf(p)).label)}</span></div>
        <button class="btn-glass" data-cm="chat" data-id="${escapeHtml(p.id)}" title="Open chat"><i class="ph-bold ph-chat-circle-text"></i></button>
      </li>`;
  }

  // ─── Swiping ─────────────────────────────────────────────────────────────

  function topCard() {
    return main.querySelector('.cm-app-card.is-top');
  }

  function setStamp(card, dx) {
    if (!card) return;
    const k = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
    card.querySelector('.cm-stamp.is-pick').style.opacity = dx > 0 ? k : 0;
    card.querySelector('.cm-stamp.is-pass').style.opacity = dx < 0 ? k : 0;
  }

  function springBack(card) {
    if (!card) return;
    card.style.transition = '';
    card.style.transform = '';
    card.style.opacity = '';
    setStamp(card, 0);
  }

  function flyOut(card, decision) {
    return new Promise((resolve) => {
      if (!card) { resolve(); return; }
      const right = decision === 'SELECT';
      setStamp(card, right ? SWIPE_THRESHOLD : -SWIPE_THRESHOLD);
      card.style.transition = 'transform 0.42s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.42s';
      card.style.transform = `translate(${right ? 130 : -130}%, -4%) rotate(${right ? 16 : -16}deg)`;
      card.style.opacity = '0';
      setTimeout(resolve, 400);
    });
  }

  function bindDrag() {
    const card = topCard();
    if (!card) return;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    card.addEventListener('pointerdown', (e) => {
      if (busy || e.button > 0 || e.target.closest('a, button')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      const dy = (e.clientY - startY) * 0.25;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`;
      setStamp(card, dx);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (dx > SWIPE_THRESHOLD) decide('SELECT');
      else if (dx < -SWIPE_THRESHOLD) decide('REJECT');
      else springBack(card);
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  async function decide(decision, confirmConflict = false) {
    if (busy) return;
    const app = pendingApplicants()[0];
    if (!app) return;
    busy = true;
    const card = topCard();
    const animation = flyOut(card, decision);
    let res;
    try {
      res = await store.decideApplicant(reviewId, app.creatorId, decision, { confirmConflict });
    } catch (err) {
      console.error('Applicant decision failed:', err);
      busy = false;
      springBack(card);
      toast("That didn't save. Check your connection and try again.");
      return;
    }

    if (res.status === 'CONFLICT') {
      busy = false;
      springBack(card);
      openConflict(app, res.conflicts || []);
      return;
    }
    if (res.status !== 'SELECTED' && res.status !== 'REJECTED') {
      busy = false;
      toast(res.status === 'FULL' ? 'Every slot on this campaign is already filled.' : 'This applicant has already been decided.');
      render();
      return;
    }

    await animation;
    busy = false;
    render();
    if (res.status === 'SELECTED') openMatch(app, res);
  }

  // ─── Overlays ────────────────────────────────────────────────────────────

  function closeLayer() {
    layer.innerHTML = '';
  }

  function openConflict(app, conflicts) {
    const p = app.profile;
    layer.innerHTML = `
      <div class="platform-modal-backdrop active cm-overlay">
        <div class="platform-modal-window cm-dialog">
          <div class="cm-dialog-icon is-warn"><i class="ph-fill ph-calendar-x"></i></div>
          <h2 class="app-modal-title">Scheduling <em>clash</em></h2>
          <p class="cm-dialog-text">${escapeHtml(p.name)} is already booked for:</p>
          <ul class="cm-clash-list">${conflicts.map(cf => `<li><b>${escapeHtml(cf.title)}</b><span>${escapeHtml(cf.window || '')}</span></li>`).join('')}</ul>
          <p class="cm-dialog-note">You can still select them. Just check in the chat that they can do both.</p>
          <div class="cm-dialog-actions">
            <button class="btn-gold" data-cm="confirm-pick">Select anyway</button>
            <button class="btn-glass" data-cm="close-layer">Go back</button>
          </div>
        </div>
      </div>`;
  }

  function openMatch(app, res) {
    const p = app.profile;
    const me = store.currentUser;
    const b = store.getBrief(reviewId);
    const filledNow = campaignStatus(b) === 'FILLED';
    if (window.confetti) window.confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: ['#E6FF1A', '#FFFFFF', '#0A0A0A'] });
    layer.innerHTML = `
      <div class="platform-modal-backdrop active cm-overlay">
        <div class="platform-modal-window cm-dialog cm-match">
          <div class="cm-match-avs">
            <img src="${escapeHtml(me.avatar)}" alt="">
            <span><i class="ph-fill ph-lightning"></i></span>
            <img src="${escapeHtml(p.avatar)}" alt="">
          </div>
          <h2 class="app-modal-title">It's a <em>match</em></h2>
          <p class="cm-dialog-text">${escapeHtml(p.name)} is in for “${escapeHtml(b.title)}”. Your chat is open, so sort out the details there.</p>
          <div class="cm-match-slots">${slotDots(b, true)}<span>${Math.min(b.slotsFilled || 0, b.slots || 1)} of ${b.slots || 1} slots filled</span></div>
          ${res.conflict_overridden ? '<p class="cm-dialog-note">Heads-up: they have another booking on these dates.</p>' : ''}
          ${filledNow ? `<p class="cm-dialog-note">That was the last slot${res.auto_rejected ? `: ${res.auto_rejected} other applicant${res.auto_rejected === 1 ? ' was' : 's were'} told the campaign is filled` : ''}.</p>` : ''}
          <div class="cm-dialog-actions">
            <button class="btn-gold" data-cm="chat" data-id="${escapeHtml(p.id)}"><i class="ph-bold ph-chat-circle-text"></i> Open chat</button>
            <button class="btn-glass" data-cm="close-layer">${filledNow ? 'Done' : 'Keep reviewing'}</button>
          </div>
        </div>
      </div>`;
  }

  function openPicked(briefId) {
    const b = store.getBrief(briefId);
    const picked = store.getApplicantsForBrief(briefId).filter(a => a.status === 'SELECTED');
    layer.innerHTML = `
      <div class="platform-modal-backdrop active cm-overlay">
        <div class="platform-modal-window cm-dialog">
          <button class="platform-modal-close" data-cm="close-layer">&times;</button>
          <h2 class="app-modal-title">Selected for <em>this campaign</em></h2>
          <p class="cm-dialog-text">${escapeHtml(b.title)}</p>
          <ul class="cm-picked is-wide">${picked.map(pickedRow).join('')}</ul>
        </div>
      </div>`;
  }

  // ─── New campaign ────────────────────────────────────────────────────────

  function openCreate() {
    const me = store.currentUser;
    const today = toDateInput(Date.now());
    const types = [...TALENT_TYPES, talentMeta('ANY')];
    layer.innerHTML = `
      <div class="platform-modal-backdrop active cm-overlay">
        <div class="platform-modal-window cm-create">
          <button class="platform-modal-close" data-cm="close-layer" aria-label="Close">&times;</button>
          <div class="cm-create-head">
            <div class="app-modal-icon"><i class="ph-fill ph-megaphone-simple"></i></div>
            <div>
              <h2 class="app-modal-title">New <em>campaign</em></h2>
              <div class="app-modal-sub">Talent near you applies with one tap. You swipe through them and each pick opens a chat.</div>
            </div>
          </div>

          <form id="cmCreateForm" novalidate>
            <div class="cm-field">
              <label for="cmTitle">Campaign title</label>
              <input id="cmTitle" maxlength="140" placeholder="e.g. Monsoon menu launch reels" autocomplete="off">
              <div class="cm-err" data-err="title"></div>
            </div>

            <div class="cm-field">
              <label for="cmDesc">What it's about</label>
              <textarea id="cmDesc" rows="3" maxlength="1000" placeholder="The product or event, the vibe you want, anything talent should know…"></textarea>
              <div class="cm-err" data-err="description"></div>
            </div>

            <div class="cm-field">
              <label>Who you're looking for</label>
              <div class="cm-choice-row" role="radiogroup" aria-label="Talent type">
                ${types.map(t => `<button type="button" class="cm-choice${t.id === 'INFLUENCER' ? ' is-on' : ''}" role="radio" aria-checked="${t.id === 'INFLUENCER'}" data-talent="${t.id}"><i class="ph-fill ${t.icon}"></i>${escapeHtml(t.label)}</button>`).join('')}
              </div>
            </div>

            <div class="cm-field">
              <label for="cmDeliv">Deliverables</label>
              <input id="cmDeliv" maxlength="300" placeholder="e.g. 1 Reel + 2 Stories" autocomplete="off">
              <div class="cm-err" data-err="deliverables"></div>
            </div>

            <div class="cm-grid-2">
              <div class="cm-field">
                <label for="cmFee">Fixed fee per person</label>
                <div class="cm-inline"><span class="cm-affix">₹</span><input id="cmFee" type="number" min="1" step="1" inputmode="numeric" placeholder="5000"></div>
                <div class="cm-help">Shown upfront. Talent can't negotiate it.</div>
                <div class="cm-err" data-err="fee"></div>
              </div>
              <div class="cm-field">
                <label for="cmSlots">Slots</label>
                <div class="cm-stepper">
                  <button type="button" data-step="-1" aria-label="Fewer slots"><i class="ph-bold ph-minus"></i></button>
                  <input id="cmSlots" type="number" min="1" max="50" value="1" inputmode="numeric">
                  <button type="button" data-step="1" aria-label="More slots"><i class="ph-bold ph-plus"></i></button>
                </div>
                <div class="cm-help">How many people you'll hire.</div>
              </div>
            </div>
            <div class="cm-total" id="cmTotal"></div>

            <div class="cm-grid-2">
              <div class="cm-field">
                <label for="cmEnd">Deadline / event date</label>
                <input id="cmEnd" type="date" min="${today}">
                <div class="cm-err" data-err="endsOn"></div>
              </div>
              <div class="cm-field">
                <label for="cmStart">Starts <span class="cm-opt">(optional)</span></label>
                <input id="cmStart" type="date" min="${today}">
                <div class="cm-help">Only for multi-day campaigns.</div>
                <div class="cm-err" data-err="startsOn"></div>
              </div>
            </div>

            <div class="cm-field">
              <label for="cmLoc">Location</label>
              <div class="cm-inline">
                <input id="cmLoc" value="${escapeHtml(me.location || '')}" placeholder="City or neighbourhood" autocomplete="off">
                <button type="button" class="btn-glass cm-detect" data-cm="detect" title="Use my current location"><i class="ph-bold ph-crosshair"></i></button>
              </div>
              <div class="cm-err" data-err="location"></div>
            </div>

            <div class="cm-field">
              <label>Category <span class="cm-opt">(up to 3)</span></label>
              <div class="cm-choice-row is-small">
                ${NICHE_TAGS.map(t => `<button type="button" class="cm-choice" data-niche="${escapeHtml(t)}" aria-pressed="false">${escapeHtml(t)}</button>`).join('')}
              </div>
            </div>

            <button type="submit" class="btn-gold cm-submit">Publish campaign</button>
          </form>
        </div>
      </div>`;
    updateTotal();
    const title = layer.querySelector('#cmTitle');
    if (title && window.matchMedia('(hover: hover)').matches) title.focus();
  }

  function updateTotal() {
    const fee = Number(layer.querySelector('#cmFee')?.value) || 0;
    const slots = Math.max(1, Number(layer.querySelector('#cmSlots')?.value) || 1);
    const total = layer.querySelector('#cmTotal');
    if (!total) return;
    total.innerHTML = fee > 0
      ? `<i class="ph-bold ph-wallet"></i> ${formatINR(fee)} × ${slots} = <b>${formatINR(fee * slots)}</b> if every slot is filled`
      : '<i class="ph-bold ph-wallet"></i> Set a fee to see the total.';
  }

  function setErr(key, text) {
    const el = layer.querySelector(`[data-err="${key}"]`);
    if (el) el.textContent = text || '';
  }

  async function submitCreate(form) {
    const v = (id) => (layer.querySelector(`#${id}`)?.value || '').trim();
    const data = {
      title: v('cmTitle'),
      description: v('cmDesc'),
      deliverables: v('cmDeliv'),
      fee: Number(v('cmFee')),
      slots: Math.max(1, Math.min(50, parseInt(v('cmSlots'), 10) || 1)),
      endsOn: v('cmEnd'),
      startsOn: v('cmStart'),
      location: v('cmLoc'),
      talentType: layer.querySelector('[data-talent].is-on')?.getAttribute('data-talent') || 'ANY',
      tags: [...layer.querySelectorAll('[data-niche].is-on')].map(el => el.getAttribute('data-niche'))
    };
    const today = toDateInput(Date.now());
    const errors = {
      title: data.title ? '' : 'Give the campaign a title.',
      description: data.description ? '' : 'Tell talent what it\'s about.',
      deliverables: data.deliverables ? '' : 'What should they deliver? e.g. 1 Reel + 2 Stories',
      fee: data.fee >= 1 ? '' : 'Set the fixed fee per person.',
      endsOn: !data.endsOn ? 'Pick the deadline or event date.' : data.endsOn < today ? 'That date has passed.' : '',
      startsOn: data.startsOn && data.endsOn && data.startsOn > data.endsOn ? 'The start must be on or before the deadline.' : '',
      location: data.location ? '' : 'Where is it? This decides who sees it first.'
    };
    Object.entries(errors).forEach(([k, t]) => setErr(k, t));
    const firstBad = Object.keys(errors).find(k => errors[k]);
    if (firstBad) {
      const field = layer.querySelector(`[data-err="${firstBad}"]`)?.closest('.cm-field');
      field?.querySelector('input, textarea')?.focus();
      return;
    }

    const btn = form.querySelector('.cm-submit');
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    try {
      await store.createBrief(data);
      closeLayer();
      toast('Campaign published. Talent can apply now.');
      render();
    } catch (err) {
      console.error('createBrief failed:', err);
      btn.disabled = false;
      btn.textContent = 'Publish campaign';
      toast("Couldn't publish the campaign. Please try again.");
    }
  }

  async function detect(btn) {
    const input = layer.querySelector('#cmLoc');
    btn.disabled = true;
    try {
      const { label } = await detectLocation();
      input.value = label;
      setErr('location', '');
    } catch (err) {
      setErr('location', err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  function onClick(e) {
    const el = e.target.closest('[data-cm], [data-talent], [data-niche], [data-step]');
    if (!el) return;
    if (el.hasAttribute('data-talent')) {
      layer.querySelectorAll('[data-talent]').forEach(b => { b.classList.toggle('is-on', b === el); b.setAttribute('aria-checked', String(b === el)); });
      return;
    }
    if (el.hasAttribute('data-niche')) {
      const on = !el.classList.contains('is-on');
      if (on && layer.querySelectorAll('[data-niche].is-on').length >= 3) { toast('Pick up to 3 categories.'); return; }
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', String(on));
      return;
    }
    if (el.hasAttribute('data-step')) {
      const input = layer.querySelector('#cmSlots');
      input.value = Math.max(1, Math.min(50, (parseInt(input.value, 10) || 1) + Number(el.getAttribute('data-step'))));
      updateTotal();
      return;
    }
    const action = el.getAttribute('data-cm');
    const id = el.getAttribute('data-id');
    if (action === 'new') openCreate();
    else if (action === 'review') { mode = 'review'; reviewId = id; closeLayer(); render(); window.scrollTo({ top: 0 }); }
    else if (action === 'back') { mode = 'list'; reviewId = null; closeLayer(); render(); }
    else if (action === 'picked') openPicked(id);
    else if (action === 'pick') decide('SELECT');
    else if (action === 'pass') decide('REJECT');
    else if (action === 'confirm-pick') { closeLayer(); decide('SELECT', true); }
    else if (action === 'close-layer') closeLayer();
    else if (action === 'chat') { closeLayer(); onOpenChat && onOpenChat(id); }
    else if (action === 'chats') onOpenChat && onOpenChat(null);
    else if (action === 'detect') detect(el);
  }

  function onInput(e) {
    if (e.target.id === 'cmFee' || e.target.id === 'cmSlots') updateTotal();
    if (e.target.closest('.cm-field')) {
      const err = e.target.closest('.cm-field').querySelector('.cm-err');
      if (err) err.textContent = '';
    }
  }

  function onSubmit(e) {
    if (e.target.id !== 'cmCreateForm') return;
    e.preventDefault();
    submitCreate(e.target);
  }

  function onKey(e) {
    if (mode !== 'review' || layer.innerHTML || busy) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); decide('SELECT'); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); decide('REJECT'); }
  }

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKey);

  function render() {
    if (mode === 'review') renderReview();
    else renderList();
  }

  render();

  // New applicants and decisions arrive live. Don't redraw mid-swipe; the
  // decision flow redraws itself when it's done.
  const unsubscribe = store.subscribe(() => {
    if (!busy && !dragging) render();
  });

  return () => {
    unsubscribe();
    container.removeEventListener('click', onClick);
    container.removeEventListener('input', onInput);
    container.removeEventListener('submit', onSubmit);
    document.removeEventListener('keydown', onKey);
  };
}
