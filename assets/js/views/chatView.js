// Ping Web Platform - Chat View (Real-time Messaging, AI Icebreakers, Smart Proposals & Milestones)
import { store } from '../state.js';
import { aiService } from '../aiService.js';

export function renderChatView(container, activeTargetMatchId = null, onShowToast) {
  let matches = store.getMatchesForCurrentUser();
  let activeMatch = (activeTargetMatchId ? matches.find(m => m.id === activeTargetMatchId || m.users.includes(activeTargetMatchId)) : null) || matches[0];
  let icebreakers = [];
  let isLoadingIcebreakers = false;

  async function loadIcebreakersForActive() {
    if (!activeMatch || !activeMatch.otherUser) return;
    isLoadingIcebreakers = true;
    renderIcebreakersBar();
    try {
      icebreakers = await aiService.generateIcebreakers(
        activeMatch.otherUser.name,
        activeMatch.otherUser.role,
        activeMatch.otherUser.tags || []
      );
    } catch (e) {
      icebreakers = ["Hey! Love your work, let's collaborate.", "What's your upcoming availability?", "Would love to discuss partnership rates."];
    } finally {
      isLoadingIcebreakers = false;
      renderIcebreakersBar();
    }
  }

  function render() {
    matches = store.getMatchesForCurrentUser();
    if (activeTargetMatchId && !activeMatch) {
      activeMatch = matches.find(m => m.id === activeTargetMatchId || m.users.includes(activeTargetMatchId)) || matches[0];
    }

    if (!matches || matches.length === 0) {
      container.innerHTML = `
        <div class="view-header">
          <div class="view-title-group">
            <h1><i class="ph-fill ph-chats-teardrop" style="color:var(--gold-primary)"></i> Messages & Deals</h1>
            <p>Negotiate scopes, generate Smart Proposals, and manage active contracts.</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:60px 20px; text-align:center; max-width:520px; margin:40px auto;">
          <i class="ph-fill ph-chat-circle-dots" style="font-size:52px; color:var(--gold-primary); margin-bottom:16px;"></i>
          <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px;">No Active Conversations Yet</h2>
          <p style="color:var(--text-secondary); font-size:14px; margin-top:8px;">
            Head over to Discovery to swipe or pitch on Live Briefs to initiate high-intent matches!
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1><i class="ph-fill ph-chats-teardrop" style="color:var(--gold-primary)"></i> Messages & Contracts</h1>
          <p>Secure end-to-end negotiation, Smart Proposals, and milestone escrow tracking.</p>
        </div>
      </div>

      <div class="chat-screen-layout">
        <!-- Sidebar Conversations List -->
        <div class="chat-sidebar">
          <div class="chat-sidebar-header">
            <span>Conversations (${matches.length})</span>
            <i class="ph-bold ph-faders" style="color:var(--text-secondary); cursor:pointer;"></i>
          </div>
          <div class="chat-matches-list">
            ${matches.map(m => {
              const other = m.otherUser || {};
              const isActive = activeMatch && activeMatch.id === m.id;
              return `
                <div class="chat-match-item ${isActive ? 'active' : ''}" data-match-id="${m.id}">
                  <div class="chat-match-avatar">
                    <img src="${other.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}" alt="${other.name}">
                    <div class="online-dot"></div>
                  </div>
                  <div class="chat-match-info">
                    <div class="chat-match-name">
                      <span>${other.name || 'User'}</span>
                      <span style="font-size:11px; font-weight:400; color:var(--text-tertiary)">${formatTime(m.lastActive)}</span>
                    </div>
                    <div class="chat-match-preview">${m.lastMessage || 'Connected on Ping'}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Main Chat Pane -->
        <div class="chat-pane" id="chatMainPane">
          ${activeMatch ? renderActiveChat(activeMatch) : ''}
        </div>
      </div>

      <!-- Create Proposal Modal -->
      <div class="app-modal-overlay" id="createProposalModal">
        <div class="app-modal-box">
          <button class="app-modal-close" id="closeProposalModal">&times;</button>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px;">
            <i class="ph-fill ph-file-text" style="color:var(--gold-primary); font-size:26px;"></i>
            <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px;">Create Smart Proposal</h2>
          </div>

          <form id="createProposalForm" style="display:flex; flex-direction:column; gap:14px;">
            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Campaign Deliverable Title</label>
              <input type="text" id="propTitleInput" placeholder="e.g. 1 4K Dedicated Review + 2 Instagram Reels" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Total Deal Price (₹)</label>
                <input type="text" id="propPriceInput" placeholder="e.g. ₹85,000" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Delivery Deadline</label>
                <input type="text" id="propDeadlineInput" placeholder="e.g. Nov 15, 2026" required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px;">
              </div>
            </div>

            <div>
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Scope of Work & Licensing</label>
              <textarea id="propDescInput" rows="3" placeholder="Specify deliverables, draft turnaround time, licensing rights..." required style="width:100%; margin-top:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 14px; color:#fff; font-size:14px; resize:vertical;"></textarea>
            </div>

            <div style="background:rgba(255,215,0,0.05); border:1px solid rgba(255,215,0,0.2); border-radius:12px; padding:12px; font-size:12px; color:var(--text-secondary);">
              <i class="ph-fill ph-shield-check" style="color:var(--gold-primary)"></i> Smart Proposals lock milestone escrow and include automated digital counter-signing.
            </div>

            <button type="submit" class="btn-primary" style="margin-top:6px; background:var(--gold-primary); color:#000; padding:12px; border-radius:999px; font-weight:700; border:none; cursor:pointer;">
              Send Binding Proposal in Chat
            </button>
          </form>
        </div>
      </div>
    `;

    bindEvents();
    loadIcebreakersForActive();
  }

  function renderActiveChat(match) {
    const other = match.otherUser || {};
    const messages = match.messages || [];

    return `
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="chat-header-user">
          <div class="chat-match-avatar" style="width:40px; height:40px;">
            <img src="${other.avatar}" alt="${other.name}">
          </div>
          <div>
            <div style="font-size:15px; font-weight:700; color:#fff; display:flex; align-items:center; gap:6px;">
              ${other.name}
              ${other.verified ? '<i class="ph-fill ph-seal-check" style="color:var(--gold-primary); font-size:16px;"></i>' : ''}
            </div>
            <div style="font-size:11.5px; color:var(--gold-glow);">${other.company || other.jobTitle || other.role} • PingScore: ${other.pingScore || 95}</div>
          </div>
        </div>

        <div class="chat-header-actions">
          <button class="btn-primary" id="btnOpenProposalModal" style="background:rgba(255,215,0,0.12); color:var(--gold-primary); border:1px solid rgba(255,215,0,0.3); padding:7px 14px; border-radius:999px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <i class="ph-fill ph-file-text"></i> Smart Proposal
          </button>
          <button class="btn-exit-app" id="btnMockCall" title="Start Audio / Video Room" style="padding:7px 10px;">
            <i class="ph-fill ph-video-camera" style="font-size:16px;"></i>
          </button>
        </div>
      </div>

      <!-- Messages Stream -->
      <div class="chat-messages-container" id="chatMessagesContainer">
        ${messages.map(msg => renderMessage(msg, match)).join('')}
      </div>

      <!-- AI Icebreaker Suggestions Bar -->
      <div class="ai-icebreaker-bar" id="aiIcebreakerBar">
        <div class="ai-spark-label"><i class="ph-fill ph-sparkle"></i> AI Icebreakers:</div>
        <div style="color:var(--text-tertiary); font-size:12px;">Generating contextual suggestions...</div>
      </div>

      <!-- Input Bar -->
      <form class="chat-input-bar" id="chatInputForm">
        <button type="button" class="btn-exit-app" id="btnQuickEmoji" style="padding:8px 10px; border-radius:999px;">
          <i class="ph-bold ph-paperclip" style="font-size:16px;"></i>
        </button>
        <input type="text" class="chat-input-field" id="chatMessageInput" placeholder="Write a message or proposal counter..." autocomplete="off">
        <button type="submit" class="btn-primary" style="width:40px; height:40px; border-radius:999px; background:var(--gold-primary); color:#000; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:18px;">
          <i class="ph-fill ph-paper-plane-right"></i>
        </button>
      </form>
    `;
  }

  function renderMessage(msg, match) {
    const isMine = msg.senderId === store.currentUser.id;

    if (msg.type === 'proposal' && msg.proposalData) {
      const prop = msg.proposalData;
      const isAccepted = prop.status === 'ACCEPTED';
      const isCreator = store.currentUser.role === 'INFLUENCER';

      return `
        <div class="proposal-message-card">
          <div class="proposal-card-top">
            <div class="proposal-tag">
              <i class="ph-fill ph-file-text"></i> Smart Proposal & Contract
            </div>
            <div class="proposal-status-pill ${isAccepted ? 'status-accepted' : 'status-pending'}">
              ${isAccepted ? '✓ CONTRACT ACTIVE' : 'PENDING COUNTERSIGN'}
            </div>
          </div>

          <div class="proposal-title">${prop.title}</div>
          <div class="proposal-price-box">
            <div class="proposal-price-amount">${prop.price}</div>
            <div class="proposal-deadline">• Deadline: ${prop.deadline}</div>
          </div>

          <p style="font-size:13px; color:var(--text-secondary); line-height:1.45; margin-bottom:12px;">
            ${prop.description}
          </p>

          <!-- Milestones Progression -->
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:6px;">Milestone Escrow Schedule</div>
          <div class="proposal-milestones-list">
            ${(prop.milestones || []).map(m => `
              <div class="milestone-item">
                <div>
                  <span style="font-weight:600; color:#fff;">${m.title}</span>
                  <span style="color:var(--gold-primary); margin-left:6px;">(${m.amount})</span>
                  ${m.contentUrl ? `<a href="${m.contentUrl}" target="_blank" style="color:var(--accent-cyan); font-size:11px; margin-left:8px;"><i class="ph-bold ph-link"></i> View Submitted Cut</a>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="milestone-status-chip milestone-status-${m.status}">${m.status}</span>
                  ${renderMilestoneActionBtn(match.id, msg.id, m)}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Signatures -->
          <div class="proposal-signatures">
            <div><strong>Brand Signed:</strong> ${prop.senderSignature || 'Verified Brand Official'}</div>
            <div><strong>Creator Signed:</strong> ${prop.creatorSignature || (isAccepted ? store.currentUser.name : 'Pending Signature')}</div>
          </div>

          ${!isAccepted && isCreator ? `
            <div style="margin-top:16px;">
              <button class="btn-primary btn-sign-proposal" data-match-id="${match.id}" data-msg-id="${msg.id}" style="width:100%; background:var(--gold-primary); color:#000; padding:11px; border-radius:999px; font-weight:700; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                <i class="ph-fill ph-signature"></i> Sign & Accept Contract (${prop.price})
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
        ${msg.text}
        <span class="chat-time">${formatTime(msg.timestamp)}</span>
      </div>
    `;
  }

  function renderMilestoneActionBtn(matchId, msgId, milestone) {
    const isCreator = store.currentUser.role === 'INFLUENCER';
    const isBrand = store.currentUser.role === 'BUSINESS' || store.currentUser.role === 'ADMIN';

    if (milestone.status === 'PAID') {
      return '<i class="ph-fill ph-check-circle" style="color:var(--accent-green)"></i>';
    }

    if (milestone.status === 'UNDER_REVIEW' && isBrand) {
      return `
        <button class="btn-primary btn-approve-milestone" data-match-id="${matchId}" data-msg-id="${msgId}" data-m-id="${milestone.id}" style="background:var(--accent-green); color:#000; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:700; border:none; cursor:pointer;">
          Release Escrow
        </button>
      `;
    }

    if (milestone.status === 'LOCKED' && isCreator) {
      return `
        <button class="btn-primary btn-submit-deliverable" data-match-id="${matchId}" data-msg-id="${msgId}" data-m-id="${milestone.id}" style="background:rgba(255,255,255,0.1); color:#fff; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600; border:1px solid var(--border-subtle); cursor:pointer;">
          Submit Link
        </button>
      `;
    }

    return '';
  }

  function renderIcebreakersBar() {
    const bar = container.querySelector('#aiIcebreakerBar');
    if (!bar) return;

    if (isLoadingIcebreakers) {
      bar.innerHTML = `
        <div class="ai-spark-label"><i class="ph-fill ph-sparkle"></i> AI Icebreakers:</div>
        <div style="color:var(--text-tertiary); font-size:12px; display:flex; align-items:center; gap:6px;">
          <i class="ph-bold ph-spinner ph-spin"></i> Generating smart prompts...
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
      <div class="ai-spark-label"><i class="ph-fill ph-sparkle"></i> AI Icebreakers:</div>
      ${icebreakers.map(text => `
        <button type="button" class="icebreaker-pill" data-text="${text}">${text}</button>
      `).join('')}
    `;

    bar.querySelectorAll('.icebreaker-pill').forEach(pill => {
      pill.onclick = () => {
        const input = container.querySelector('#chatMessageInput');
        if (input) {
          input.value = pill.getAttribute('data-text');
          input.focus();
        }
      };
    });
  }

  function bindEvents() {
    // Conversation switching
    container.querySelectorAll('.chat-match-item').forEach(item => {
      item.onclick = () => {
        const id = item.getAttribute('data-match-id');
        activeMatch = matches.find(m => m.id === id);
        render();
      };
    });

    // Send text message
    const chatForm = container.querySelector('#chatInputForm');
    const input = container.querySelector('#chatMessageInput');
    if (chatForm && input) {
      chatForm.onsubmit = (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || !activeMatch) return;

        store.sendMessage(activeMatch.id, text, 'text');
        input.value = '';
        render();
        scrollToBottom();
      };
    }

    // Open Proposal Modal
    const btnOpenProp = container.querySelector('#btnOpenProposalModal');
    const propModal = container.querySelector('#createProposalModal');
    const closeProp = container.querySelector('#closeProposalModal');
    const propForm = container.querySelector('#createProposalForm');

    if (btnOpenProp && propModal) {
      btnOpenProp.onclick = () => propModal.classList.add('active');
    }
    if (closeProp && propModal) {
      closeProp.onclick = () => propModal.classList.remove('active');
    }
    if (propForm) {
      propForm.onsubmit = (e) => {
        e.preventDefault();
        const title = container.querySelector('#propTitleInput').value.trim();
        const price = container.querySelector('#propPriceInput').value.trim();
        const deadline = container.querySelector('#propDeadlineInput').value.trim();
        const description = container.querySelector('#propDescInput').value.trim();

        const proposalData = {
          id: `prop_${Date.now()}`,
          title,
          price: price.startsWith('₹') ? price : `₹${price}`,
          deadline,
          description,
          status: 'PENDING',
          senderSignature: store.currentUser.company || store.currentUser.name,
          milestones: [
            { id: 'm1', title: 'Concept & Creative Direction', amount: '30%', status: 'PAID' },
            { id: 'm2', title: 'First Rough Cut Review', amount: '40%', status: 'UNDER_REVIEW' },
            { id: 'm3', title: 'Final Publish & Asset Handover', amount: '30%', status: 'LOCKED' }
          ]
        };

        store.sendMessage(activeMatch.id, `Smart Proposal created: ${title}`, 'proposal', proposalData);
        propModal.classList.remove('active');
        onShowToast('Smart Proposal sent in chat! 📜');
        render();
        scrollToBottom();
      };
    }

    // Sign & Accept Proposal
    container.querySelectorAll('.btn-sign-proposal').forEach(btn => {
      btn.onclick = () => {
        const matchId = btn.getAttribute('data-match-id');
        const msgId = btn.getAttribute('data-msg-id');

        store.signAndAcceptProposal(matchId, msgId, store.currentUser.name);
        if (window.confetti) {
          window.confetti({ particleCount: 70, spread: 60, colors: ['#00E676', '#FFD700', '#FFFFFF'] });
        }
        onShowToast('Proposal signed! Contract is now ACTIVE in escrow! 🎉');
        render();
      };
    });

    // Milestone Actions
    container.querySelectorAll('.btn-approve-milestone').forEach(btn => {
      btn.onclick = () => {
        const matchId = btn.getAttribute('data-match-id');
        const msgId = btn.getAttribute('data-msg-id');
        const mId = btn.getAttribute('data-m-id');

        store.updateMilestoneStatus(matchId, msgId, mId, 'PAID');
        onShowToast('Milestone approved! Escrow payment released! 💸');
        render();
      };
    });

    container.querySelectorAll('.btn-submit-deliverable').forEach(btn => {
      btn.onclick = () => {
        const url = prompt('Enter the link to your draft deliverable (Google Drive, Frame.io, or Loom):', 'https://drive.google.com/sample-cut');
        if (url) {
          const matchId = btn.getAttribute('data-match-id');
          const msgId = btn.getAttribute('data-msg-id');
          const mId = btn.getAttribute('data-m-id');

          store.updateMilestoneStatus(matchId, msgId, mId, 'UNDER_REVIEW', url);
          onShowToast('Deliverable submitted to brand for review! 🎥');
          render();
        }
      };
    });

    // Mock Video/Audio Call
    const btnCall = container.querySelector('#btnMockCall');
    if (btnCall) {
      btnCall.onclick = () => {
        alert('Live Encrypted Call Room initialized! In this demo, audio/video channels are simulated for testing.');
      };
    }

    scrollToBottom();
  }

  function scrollToBottom() {
    const el = container.querySelector('#chatMessagesContainer');
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  render();
}
