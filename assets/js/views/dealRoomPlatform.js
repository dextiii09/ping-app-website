// Ping Platform - Deal Room: chat with matches and exchange Smart Proposals.
// Proposals are a written record of what was agreed: the person a proposal is
// sent to can accept or decline it. There is no in-app signing, escrow or
// payment; payment is arranged between the two sides.
import { store } from '../state.js';
import { aiService } from '../aiService.js';
import { escapeHtml } from '../domUtils.js';
import { displayPingScore } from '../pingScoreService.js';

export function renderDealRoomPlatform(container, initialMatchId = null, onShowToast) {
  let matches = store.getMatchesForCurrentUser();
  let activeMatch = (initialMatchId ? matches.find(m => m.id === initialMatchId || m.users.includes(initialMatchId)) : null) || matches[0];
  // Phones show either the conversation list or one open conversation (with
  // a back button), never both. Opening a chat from elsewhere lands in it.
  let mobileThread = !!initialMatchId;
  const mountId = container.dataset.mount;
  const setThreadOpen = (open) => document.body.classList.toggle('deal-thread-open', open);
  let icebreakers = [];
  let loadingIcebreakers = false;
  // Guards against refetching on every unrelated store.notify() (a decision
  // elsewhere, a brief loading in, etc.) - only actually regenerate when
  // the conversation shown here has changed.
  let lastIcebreakerKey = null;

  function buildTranscript(match) {
    const messages = (match?.messages || []).filter(m => m.type === 'text' || m.type === 'proposal' || m.type === 'system');
    if (messages.length === 0) return '';
    const otherName = match.otherUser?.name || 'them';
    return messages.slice(-8).map(m => {
      // The campaign note ("Connected for ...") gives the suggestions context.
      if (m.type === 'system') return `[${m.text}]`;
      const speaker = m.senderId === store.currentUser.id ? 'Me' : otherName;
      if (m.type === 'proposal' && m.proposalData) {
        return `${speaker}: [Sent a Smart Proposal: "${m.proposalData.title}" for ${m.proposalData.price}]`;
      }
      return `${speaker}: ${m.text}`;
    }).join('\n');
  }

  // Real messages come from Supabase with a live subscription - subscribing is
  // fire-and-forget (state.js dedups by matchId); the store.subscribe() call
  // below re-renders this view whenever the live snapshot delivers an update.
  function ensureMessagesLoaded(match) {
    if (!match || !store.isRealAccount) return;
    store.loadMessagesForMatch(match.id);
  }

  async function fetchIcebreakers() {
    if (!activeMatch || !activeMatch.otherUser) return;

    const messageCount = (activeMatch.messages || []).length;
    const key = `${activeMatch.id}:${messageCount}`;
    if (key === lastIcebreakerKey) return;
    lastIcebreakerKey = key;

    loadingIcebreakers = true;
    updateIcebreakerBar();
    try {
      icebreakers = await aiService.generateIcebreakers(
        activeMatch.otherUser.name,
        activeMatch.otherUser.role,
        activeMatch.otherUser.tags || [],
        buildTranscript(activeMatch),
        (activeMatch.messages || []).some(m => m.type === 'proposal')
      );
    } catch {
      icebreakers = ["Love your recent work!", "What is your upcoming campaign availability?", "What are your rates for a reel?"];
    } finally {
      loadingIcebreakers = false;
      updateIcebreakerBar();
    }
  }

  async function render() {
    matches = store.getMatchesForCurrentUser();
    if (initialMatchId && !activeMatch) {
      activeMatch = matches.find(m => m.id === initialMatchId || m.users.includes(initialMatchId)) || matches[0];
    }

    await ensureMessagesLoaded(activeMatch);
    if (container.dataset.mount !== mountId) return; // the member has left the Deal Room
    // loadMessagesForMatch mutates the store's underlying match object -
    // refresh our local references so the loaded messages are visible here.
    matches = store.getMatchesForCurrentUser();
    if (activeMatch) activeMatch = matches.find(m => m.id === activeMatch.id) || activeMatch;

    if (!matches || matches.length === 0) {
      setThreadOpen(false);
      container.innerHTML = `
        <div class="section-header">
          <div>
            <h1 class="section-title">Deal <em>Room</em></h1>
            <p class="section-subtitle">Chat with your matches and put what you agree in a Smart Proposal.</p>
          </div>
        </div>
        <div class="app-empty">
          <div class="app-empty-icon"><i class="ph-fill ph-chats-circle"></i></div>
          <h2>No conversations <em>yet</em></h2>
          ${store.currentUser.role === 'BUSINESS' ? `
            <p>When you pick someone for a campaign, your chat with them opens here straight away.</p>
            <div class="app-empty-actions">
              <button class="btn-gold" data-goto="campaigns"><i class="ph-bold ph-megaphone-simple"></i> Go to campaigns</button>
            </div>
          ` : `
            <p>When a brand picks you for a campaign, your chat with them opens here straight away.</p>
            <div class="app-empty-actions">
              <button class="btn-gold" data-goto="discover"><i class="ph-bold ph-compass"></i> Browse briefs</button>
              <button class="btn-glass" data-goto="applications">My applications</button>
            </div>
          `}
        </div>
      `;
      container.querySelectorAll('[data-goto]').forEach((b) => {
        b.onclick = () => window.pingPlatform && window.pingPlatform.switchView(b.getAttribute('data-goto'));
      });
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h1 class="section-title">Deal <em>Room</em></h1>
          <p class="section-subtitle">Chat with your matches and put what you agree in a Smart Proposal.</p>
        </div>
      </div>

      <div class="deal-room-shell${mobileThread && activeMatch ? ' is-thread' : ''}">
        <!-- Left Conversations Stream -->
        <div class="deal-conversations-pane">
          <div class="deal-conversations-head">
            <span>Conversations</span>
            <span class="deal-count">${matches.length}</span>
          </div>

          <div style="flex:1; overflow-y:auto;">
            ${matches.map(m => {
              const other = m.otherUser || {};
              const isActive = activeMatch && activeMatch.id === m.id;
              return `
                <div class="deal-item-row ${isActive ? 'active' : ''}" data-match-id="${m.id}" style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.03); display:flex; align-items:center; gap:14px; cursor:pointer; background:${isActive ? 'rgba(255,255,255,0.05)' : 'transparent'};">
                  <div style="position:relative; width:46px; height:46px; border-radius:999px; overflow:hidden; border:1px solid var(--border-subtle); flex-shrink:0;">
                    <img src="${escapeHtml(other.avatar)}" alt="${escapeHtml(other.name)}" style="width:100%; height:100%; object-fit:cover;">
                  </div>
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <div style="font-weight:700; color:#fff; font-size:14.5px;">${escapeHtml(other.name)}</div>
                      <div style="font-size:11px; color:var(--text-dim);">${formatTime(m.lastActive)}</div>
                    </div>
                    <div style="font-size:12.5px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:3px;">
                      ${escapeHtml(m.lastMessage || 'Deal room opened')}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Right Active Deal Room -->
        <div class="deal-room-active-pane">
          ${activeMatch ? renderActiveDeal(activeMatch) : ''}
        </div>
      </div>

      <!-- Create Smart Proposal Modal -->
      <div class="platform-modal-backdrop" id="modalCreateProposal">
        <div class="platform-modal-window">
          <button class="platform-modal-close" id="closeProposalModal">&times;</button>
          
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <div class="app-modal-icon"><i class="ph-fill ph-file-text"></i></div>
            <div>
              <h2 class="app-modal-title">Send a Smart <em>Proposal</em></h2>
              <div class="app-modal-sub">Lay out the deliverables, budget and deadline. It appears in this chat for them to read.</div>
            </div>
          </div>

          <form id="formCreateProposal" style="display:flex; flex-direction:column; gap:16px;">
            <div>
              <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">What you're proposing</label>
              <input type="text" id="inputPropTitle" placeholder="e.g. Cold brew launch: 1 Reel + 3 Stories" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
            </div>

            <div class="app-cols" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Budget (₹)</label>
                <input type="text" id="inputPropPrice" placeholder="e.g. 6,500" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
              </div>
              <div>
                <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Deadline</label>
                <input type="text" id="inputPropDeadline" placeholder="e.g. Nov 15, 2026" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px;">
              </div>
            </div>

            <div>
              <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Deliverables & details</label>
              <textarea id="inputPropDesc" rows="3" placeholder="What will be delivered, when drafts are due, how many revisions, where it gets posted…" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:11px 14px; color:#fff; font-size:14px; resize:vertical;"></textarea>
            </div>

            <button type="submit" class="btn-gold" style="margin-top:8px; padding:14px;">
              <i class="ph-fill ph-paper-plane-tilt"></i> Send proposal
            </button>
          </form>
        </div>
      </div>
    `;

    setThreadOpen(mobileThread && !!activeMatch);
    bindEvents();
    fetchIcebreakers();
  }

  function renderActiveDeal(match) {
    const other = match.otherUser || {};
    const messages = match.messages || [];

    return `
      <!-- Top Bar -->
      <div class="deal-room-top-bar">
        <div class="deal-top-who" style="display:flex; align-items:center; gap:14px;">
          <button type="button" class="deal-back" id="btnDealBack" aria-label="Back to conversations"><i class="ph-bold ph-arrow-left"></i></button>
          <div class="deal-top-avatar" style="width:44px; height:44px; border-radius:999px; overflow:hidden; border:2px solid var(--gold);">
            <img src="${escapeHtml(other.avatar)}" alt="${escapeHtml(other.name)}" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div class="deal-top-names">
            <div style="font-size:16px; font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
              ${escapeHtml(other.name)}
              ${other.verified ? '<i class="ph-fill ph-seal-check verified-gold-tick" style="font-size:17px;"></i>' : ''}
            </div>
            <div style="font-size:12px; color:var(--gold-glow);">${escapeHtml(other.company || other.jobTitle || other.role)} • PingScore: ${displayPingScore(other)}</div>
          </div>
        </div>

        <div class="deal-top-actions" style="display:flex; align-items:center; gap:10px;">
          <button class="btn-gold" id="btnOpenProposalDrawer" aria-label="Smart Proposal" title="Smart Proposal" style="padding:8px 16px; font-size:12.5px;">
            <i class="ph-fill ph-file-text"></i><span class="deal-prop-label"> Smart Proposal</span>
          </button>
          <button class="header-icon-btn" id="btnBlockUser" data-user-id="${other.id || ''}" data-match-id="${match.id || ''}" title="Block & Report" style="color:var(--accent-crimson);">
            <i class="ph-fill ph-prohibit"></i>
          </button>
        </div>
      </div>

      <!-- Messages Stream -->
      <div class="deal-messages-scroller" id="dealMessagesArea">
        ${messages.map(msg => renderMessageItem(msg, match)).join('')}
      </div>

      <!-- AI Icebreakers Toolbar -->
      <div id="dealIcebreakersBar" style="background:rgba(12,12,16,0.95); border-top:1px solid var(--border-subtle); padding:10px 24px; display:flex; align-items:center; gap:10px; overflow-x:auto;">
        <div style="font-size:11.5px; font-weight:800; color:var(--gold); display:flex; align-items:center; gap:6px; white-space:nowrap;">
          <i class="ph-fill ph-sparkle"></i> Ping AI suggests
        </div>
        <div style="font-size:12px; color:var(--text-dim);">Thinking of something to say…</div>
      </div>

      <!-- Input Form -->
      <form id="dealChatForm" style="padding:16px 24px; background:rgba(8,8,12,0.98); border-top:1px solid var(--border-subtle); display:flex; align-items:center; gap:12px;">
        <input type="text" id="dealMessageInput" placeholder="Write a message…" autocomplete="off" style="flex:1; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:999px; padding:12px 20px; color:#fff; font-size:14px; outline:none; font-family:inherit;">
        <button type="submit" class="btn-gold" style="width:44px; height:44px; padding:0; border-radius:999px;">
          <i class="ph-fill ph-paper-plane-right" style="font-size:18px;"></i>
        </button>
      </form>
    `;
  }

  function renderMessageItem(msg, match) {
    const isMine = msg.senderId === store.currentUser.id;

    // The note that opens a campaign chat ("Connected for ...").
    if (msg.type === 'system') {
      return `
        <div class="deal-system">
          <i class="ph-fill ph-megaphone-simple"></i>
          <span>${escapeHtml(msg.text)}</span>
          ${msg.timestamp ? `<time>${formatTime(msg.timestamp)}</time>` : ''}
        </div>
      `;
    }

    if (msg.type === 'proposal' && msg.proposalData) {
      const prop = msg.proposalData;
      const status = prop.status || 'PENDING';
      const statusLabel = { PENDING: 'Awaiting reply', ACCEPTED: 'Accepted', DECLINED: 'Declined' }[status] || status;
      const from = isMine ? 'You sent this proposal' : `From ${escapeHtml(prop.senderSignature || match.otherUser?.name || 'your match')}`;
      return `
        <div class="deal-proposal ${isMine ? 'is-mine' : ''}">
          <div class="deal-proposal-head">
            <span class="deal-proposal-tag"><i class="ph-fill ph-file-text"></i> Smart Proposal</span>
            <span class="deal-proposal-status is-${status.toLowerCase()}">${statusLabel}</span>
          </div>
          <h4>${escapeHtml(prop.title)}</h4>
          <div class="deal-proposal-meta">
            <div><span>Budget</span><b>${escapeHtml(prop.price)}</b></div>
            <div><span>Deadline</span><b>${escapeHtml(prop.deadline)}</b></div>
          </div>
          ${prop.description ? `<p>${escapeHtml(prop.description)}</p>` : ''}
          ${!isMine && status === 'PENDING' ? `
            <div class="deal-proposal-actions">
              <button class="btn-glass" data-prop-reply="DECLINED" data-msg="${escapeHtml(msg.id)}">Decline</button>
              <button class="btn-gold" data-prop-reply="ACCEPTED" data-msg="${escapeHtml(msg.id)}"><i class="ph-bold ph-check"></i> Accept</button>
            </div>
            <p class="deal-proposal-hint">Accepting records that you both agree to these terms. Payment is arranged between you, outside Ping.</p>
          ` : ''}
          <div class="deal-proposal-foot">${from}${msg.timestamp ? ` · ${formatTime(msg.timestamp)}` : ''}</div>
        </div>
      `;
    }

    return `
      <div class="deal-bubble ${isMine ? 'is-mine' : ''}">
        ${escapeHtml(msg.text)}
        <span class="deal-bubble-time">${formatTime(msg.timestamp)}</span>
      </div>
    `;
  }

  function updateIcebreakerBar() {
    const bar = container.querySelector('#dealIcebreakersBar');
    if (!bar) return;

    if (loadingIcebreakers) {
      bar.innerHTML = `
        <div style="font-size:11.5px; font-weight:800; color:var(--gold); display:flex; align-items:center; gap:6px; white-space:nowrap;">
          <i class="ph-fill ph-sparkle"></i> Ping AI suggests
        </div>
        <div style="font-size:12px; color:var(--text-dim); display:flex; align-items:center; gap:6px;">
          <i class="ph-bold ph-spinner ph-spin"></i> Thinking of something to say…
        </div>
      `;
      return;
    }

    if (!icebreakers || icebreakers.length === 0) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = `
      <div style="font-size:11.5px; font-weight:800; color:var(--gold); display:flex; align-items:center; gap:6px; white-space:nowrap;">
        <i class="ph-fill ph-sparkle"></i> Ping AI suggests
      </div>
      ${icebreakers.map(text => `
        <button type="button" class="btn-glass btn-icebreaker-chip" data-prompt="${escapeHtml(text)}" style="padding:5px 14px; font-size:12px; white-space:nowrap;">
          ${escapeHtml(text)}
        </button>
      `).join('')}
    `;

    bar.querySelectorAll('.btn-icebreaker-chip').forEach(btn => {
      btn.onclick = () => {
        const input = container.querySelector('#dealMessageInput');
        if (input) {
          input.value = btn.getAttribute('data-prompt');
          input.focus();
        }
      };
    });
  }

  function bindEvents() {
    // Switch conversation
    container.querySelectorAll('.deal-item-row').forEach(row => {
      row.onclick = async () => {
        const id = row.getAttribute('data-match-id');
        activeMatch = matches.find(m => m.id === id);
        mobileThread = true;
        await render();
        if (window.matchMedia('(max-width: 1024px)').matches) window.scrollTo({ top: 0 });
      };
    });

    // Phones: back from a conversation to the list
    const btnBack = container.querySelector('#btnDealBack');
    if (btnBack) {
      btnBack.onclick = async () => {
        mobileThread = false;
        await render();
        window.scrollTo({ top: 0 });
      };
    }

    // Chat form submit
    const form = container.querySelector('#dealChatForm');
    const input = container.querySelector('#dealMessageInput');
    if (form && input) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || !activeMatch) return;

        input.value = '';
        try {
          await store.sendMessage(activeMatch.id, text, 'text');
        } catch (err) {
          // Give the text back so nothing typed is lost.
          const box = container.querySelector('#dealMessageInput');
          if (box && !box.value) box.value = text;
          onShowToast("Message didn't send. Check your connection and try again.");
          return;
        }
        await render();
        scrollToBottom();
      };
    }

    // Accept / decline a proposal sent to you
    container.querySelectorAll('[data-prop-reply]').forEach(btn => {
      btn.onclick = async () => {
        const response = btn.getAttribute('data-prop-reply');
        const accept = response === 'ACCEPTED';
        if (!confirm(accept
          ? 'Accept this proposal? It records that you both agree to these terms.'
          : 'Decline this proposal? You can still keep chatting.')) return;
        const buttons = btn.closest('.deal-proposal-actions').querySelectorAll('button');
        buttons.forEach(b => { b.disabled = true; });
        try {
          const status = await store.respondToProposal(activeMatch.id, btn.getAttribute('data-msg'), response);
          onShowToast(status === 'ACCEPTED' ? 'Proposal accepted. It\'s in writing now.' : status === 'DECLINED' ? 'Proposal declined.' : 'This proposal was already answered.');
          await render();
          scrollToBottom();
        } catch (err) {
          console.error('Proposal reply failed:', err);
          buttons.forEach(b => { b.disabled = false; });
          onShowToast("That didn't save. Check your connection and try again.");
        }
      };
    });

    // Smart Proposal Modal
    const btnOpenProp = container.querySelector('#btnOpenProposalDrawer');
    const modalProp = container.querySelector('#modalCreateProposal');
    const closeProp = container.querySelector('#closeProposalModal');
    const formProp = container.querySelector('#formCreateProposal');

    if (btnOpenProp && modalProp) btnOpenProp.onclick = () => modalProp.classList.add('active');
    if (closeProp && modalProp) closeProp.onclick = () => modalProp.classList.remove('active');

    if (formProp) {
      formProp.onsubmit = async (e) => {
        e.preventDefault();
        const title = container.querySelector('#inputPropTitle').value.trim();
        const price = container.querySelector('#inputPropPrice').value.trim();
        const deadline = container.querySelector('#inputPropDeadline').value.trim();
        const description = container.querySelector('#inputPropDesc').value.trim();

        modalProp.classList.remove('active');
        try {
          await store.createProposal(activeMatch.id, activeMatch.otherUser.id, {
            title,
            price: price.startsWith('₹') ? price : `₹${price}`,
            deadline,
            description,
            senderSignature: store.currentUser.company || store.currentUser.name
          });
          onShowToast('Smart Proposal sent.');
        } catch (err) {
          onShowToast('Could not send proposal — please try again.');
          console.error('createProposal failed:', err);
        }
        await render();
        scrollToBottom();
      };
    }

    // Block & Report
    const btnBlock = container.querySelector('#btnBlockUser');
    if (btnBlock) {
      btnBlock.onclick = async () => {
        const userId = btnBlock.getAttribute('data-user-id');
        const matchId = btnBlock.getAttribute('data-match-id');
        if (!userId) return;
        const name = activeMatch?.otherUser?.name || 'this user';
        if (!confirm(`Block ${name}? They will no longer appear in your Explore & Match feed. This won't delete your existing conversation history.`)) return;

        if (store.isRealAccount) {
          try {
            await store.blockUserAndLeaveMatch(userId, matchId);
            onShowToast(`${name} has been blocked.`);
            // renderModals() (Settings' Blocked Members list) isn't wired to
            // store.subscribe() the way the header is - refresh it manually
            // so the list is accurate if Settings is opened next.
            window.pingPlatform?.renderModals();
          } catch (err) {
            console.error('Failed to block user:', err);
            onShowToast('Could not block user — please try again.');
          }
        } else {
          onShowToast('Blocking is available on real accounts.');
        }
      };
    }

    scrollToBottom();
  }

  function scrollToBottom() {
    const scroller = container.querySelector('#dealMessagesArea');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  function formatTime(t) {
    if (!t) return '';
    return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  render();

  // Live matches/messages arrive via a Supabase subscription in state.js,
  // which calls store.notify() - re-render this view whenever that happens
  // so a new match or an incoming message shows up without a manual refresh.
  const unsubscribeStore = store.subscribe(() => { render(); });

  return () => {
    unsubscribeStore();
    store.stopMessageSubscription();
    setThreadOpen(false);
  };
}
