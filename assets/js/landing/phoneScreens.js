// Phone mock-ups for the landing page's "How it works" section. Each screen
// mirrors a real step in the Ping app (spotlight deck, Ping, Deal Room chat,
// Smart Proposal) and has a GSAP timeline that plays when its step becomes
// active. Names and numbers are illustrative.

const img = (id, w = 500) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

export const PHOTOS = {
  simran: img('1534528741775-53994a69daeb'),
  zoya: img('1517841905240-472988babdf9'),
  kabir: img('1507003211169-0a1dd7228f2d'),
  brewLab: img('1509042239860-f550ce710b93', 200),
  cafe: img('1554118811-1e0d58224f24', 1400),
  creator: img('1517841905240-472988babdf9', 1400),
  boutique: img('1490481651871-ab68de25d43d', 600),
  salon: img('1522337360788-8b13dee7a37e', 200),
  gym: img('1534438327276-14e5300c3a48', 200),
  meera: img('1524504388940-b1c1722653e1', 200),
  arjun: img('1500648767791-00dcc994a43e', 200)
};

function card(pos, photo, info, { stamp = false } = {}) {
  return `
    <div class="ps-card ps-card-${pos}">
      <div class="ps-card-img" style="background-image:url('${photo}')"></div>
      ${stamp ? '<span class="ps-stamp">PING</span>' : ''}
      <div class="ps-card-info">
        <span class="ps-card-place"><i class="ph-fill ph-map-pin"></i> ${info.place}</span>
        <b>${info.name} <i class="ph-fill ph-seal-check"></i></b>
        <span class="ps-card-role">${info.role}</span>
        <span class="ps-card-tags">${info.tags.map((t) => `<em>#${t}</em>`).join('')}</span>
      </div>
    </div>`;
}

const SIMRAN = { name: 'Simran K.', role: 'Food & café creator', place: 'Sector 17', tags: ['coffee', 'brunch'] };
const ZOYA = { name: 'Zoya M.', role: 'Lifestyle creator', place: 'Sector 22', tags: ['cafés', 'weekends'] };
const KABIR = { name: 'Kabir S.', role: 'Food & travel creator', place: 'Mohali', tags: ['streetfood'] };

function bar() {
  return `
    <div class="ps-bar">
      <span class="ps-bar-title">Explore</span>
      <span class="ps-bar-bell"><i class="ph-fill ph-bell"></i><b></b></span>
    </div>
    <div class="ps-chips">
      <span class="ps-chip is-on">Food &amp; Café</span>
      <span class="ps-chip">Lifestyle</span>
      <span class="ps-chip"><i class="ph-fill ph-seal-check"></i> Verified</span>
    </div>`;
}

function actions(ripple = false) {
  return `
    <div class="ps-actions">
      <span class="ps-act ps-act-pass"><i class="ph-bold ph-x"></i></span>
      <span class="ps-act ps-act-super"><i class="ph-fill ph-lightning"></i></span>
      <span class="ps-act ps-act-ping">
        ${ripple ? '<span class="ps-ripple"></span><span class="ps-ripple"></span>' : ''}
        <i class="ph-fill ph-heart"></i>
      </span>
    </div>`;
}

const SCREENS = [
  // 0 - Discover
  () => `
    <div class="ps ps-discover">
      ${bar()}
      <div class="ps-deck">
        ${card('back2', PHOTOS.kabir, KABIR)}
        ${card('back1', PHOTOS.zoya, ZOYA)}
        ${card('top', PHOTOS.simran, SIMRAN)}
      </div>
      ${actions()}
    </div>`,

  // 1 - Ping
  () => `
    <div class="ps ps-ping">
      ${bar()}
      <div class="ps-toast"><i class="ph-fill ph-lightning"></i> Ping sent to Simran</div>
      <div class="ps-deck">
        ${card('back2', PHOTOS.kabir, KABIR)}
        ${card('back1', PHOTOS.zoya, ZOYA)}
        ${card('top', PHOTOS.simran, SIMRAN, { stamp: true })}
      </div>
      ${actions(true)}
    </div>`,

  // 2 - Match & chat
  () => `
    <div class="ps ps-match">
      <div class="ps-match-layer">
        <div class="ps-match-avatars">
          <span class="ps-av ps-av-l" style="background-image:url('${PHOTOS.brewLab}')"></span>
          <span class="ps-burst"></span>
          <span class="ps-av ps-av-r" style="background-image:url('${PHOTOS.simran}')"></span>
        </div>
        <p class="ps-match-title">It's a <em>match!</em></p>
        <p class="ps-match-sub">You and Simran pinged each other</p>
      </div>
      <div class="ps-chat-layer">
        <div class="ps-chat-head">
          <span class="ps-av-sm" style="background-image:url('${PHOTOS.simran}')"></span>
          <div><b>Simran K.</b><span>Deal Room</span></div>
          <i class="ph-bold ph-dots-three"></i>
        </div>
        <div class="ps-chat-body">
          <div class="ps-msg ps-msg-out">Hi Simran! Loved your latte reels ☕</div>
          <div class="ps-msg ps-msg-out">Would you shoot our cold brew launch?</div>
          <div class="ps-typing"><i></i><i></i><i></i></div>
          <div class="ps-msg ps-msg-in">I'd love to! Free this weekend 🙌</div>
          <div class="ps-ai"><i class="ph-fill ph-sparkle"></i><span>Ping AI suggests <b>Send a Smart Proposal</b></span></div>
        </div>
        <div class="ps-input"><span>Message…</span><i class="ph-fill ph-paper-plane-tilt"></i></div>
      </div>
    </div>`,

  // 3 - Smart Proposal (creator's side)
  () => `
    <div class="ps ps-proposal">
      <div class="ps-chat-head">
        <span class="ps-av-sm" style="background-image:url('${PHOTOS.brewLab}')"></span>
        <div><b>Brew Lab</b><span>Deal Room</span></div>
        <i class="ph-bold ph-dots-three"></i>
      </div>
      <div class="ps-prop-wrap">
        <div class="ps-prop">
          <span class="ps-prop-tag"><i class="ph-fill ph-file-text"></i> Smart Proposal</span>
          <h4>Cold brew launch</h4>
          <div class="ps-prop-row"><span>Deliverables</span><b>1 Reel + 3 Stories</b></div>
          <div class="ps-prop-row"><span>Shoot</span><b>This Saturday</b></div>
          <div class="ps-prop-row"><span>Goes live</span><b>Monday</b></div>
          <div class="ps-prop-total"><span>Budget</span><b>₹6,500</b></div>
          <div class="ps-prop-btns">
            <span class="ps-prop-decline">Decline</span>
            <span class="ps-prop-accept">
              <span class="ps-accept-a">Accept</span>
              <span class="ps-accept-b"><i class="ph-bold ph-check"></i> Accepted</span>
              <span class="ps-confetti">${'<i></i>'.repeat(10)}</span>
              <span class="ps-tap"></span>
            </span>
          </div>
        </div>
        <div class="ps-deal-note"><i class="ph-fill ph-check-circle"></i> Deal agreed, in writing</div>
      </div>
    </div>`
];

export function screenMarkup(index) {
  return SCREENS[index]();
}

// Paused timeline for one screen element. Restart it to replay.
export function buildScreenTimeline(gsap, el, index) {
  const q = (s) => el.querySelector(s);
  const qa = (s) => el.querySelectorAll(s);
  const tl = gsap.timeline({ paused: true });

  if (index === 0) {
    tl.from(qa('.ps-chip'), { y: 12, opacity: 0, stagger: 0.06, duration: 0.5, ease: 'power3.out' })
      .from(qa('.ps-card'), { y: 70, opacity: 0, stagger: 0.1, duration: 0.9, ease: 'expo.out' }, 0.1)
      .from(q('.ps-card-top .ps-card-info').children, { y: 14, opacity: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out' }, 0.45)
      .from(qa('.ps-act'), { scale: 0.5, opacity: 0, stagger: 0.07, duration: 0.55, ease: 'back.out(2.2)' }, 0.5)
      .to(q('.ps-card-top'), { rotation: -4, x: -12, duration: 0.35, ease: 'power2.inOut', yoyo: true, repeat: 1 }, 1.4)
      .to(q('.ps-card-top'), { rotation: 4, x: 12, duration: 0.35, ease: 'power2.inOut', yoyo: true, repeat: 1 }, 2.1);
  }

  if (index === 1) {
    const top = q('.ps-card-top');
    const next = q('.ps-card-back1');
    const last = q('.ps-card-back2');
    tl.fromTo(q('.ps-act-ping'), { scale: 1 }, { scale: 1.22, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.35)
      .fromTo(qa('.ps-ripple'), { scale: 0.6, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 1.1, stagger: 0.18, ease: 'power2.out' }, 0.35)
      .fromTo(q('.ps-stamp'), { scale: 1.9, opacity: 0, rotation: -24 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.4, ease: 'back.out(2.4)' }, 0.5)
      .to(top, { x: 300, y: -20, rotation: 20, opacity: 0, duration: 0.75, ease: 'power3.in' }, 1.1)
      .to(next, { y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'expo.out' }, 1.6)
      .to(next.querySelector('.ps-card-info'), { opacity: 1, duration: 0.4 }, 1.8)
      .to(last, { y: -9, scale: 0.95, opacity: 0.8, duration: 0.7, ease: 'expo.out' }, 1.65)
      .fromTo(q('.ps-toast'), { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }, 1.5)
      .to(q('.ps-toast'), { y: -60, opacity: 0, duration: 0.5, ease: 'power2.in' }, 3.6);
  }

  if (index === 2) {
    tl.set(q('.ps-match-layer'), { yPercent: 0, opacity: 1 })
      .fromTo(q('.ps-av-l'), { x: -140, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'expo.out' }, 0.1)
      .fromTo(q('.ps-av-r'), { x: 140, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'expo.out' }, 0.1)
      .fromTo(q('.ps-burst'), { scale: 0.3, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 1, ease: 'power2.out' }, 0.55)
      .from(q('.ps-match-title'), { y: 24, opacity: 0, duration: 0.7, ease: 'expo.out' }, 0.6)
      .from(q('.ps-match-sub'), { y: 16, opacity: 0, duration: 0.7, ease: 'expo.out' }, 0.72)
      .to(q('.ps-match-layer'), { yPercent: -100, opacity: 0, duration: 0.8, ease: 'expo.inOut' }, 2.1)
      .fromTo(q('.ps-chat-layer'), { yPercent: 12, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out' }, 2.3);

    const msgs = qa('.ps-msg');
    const typing = q('.ps-typing');
    tl.from(msgs[0], { y: 14, scale: 0.9, opacity: 0, transformOrigin: '100% 100%', duration: 0.45, ease: 'back.out(1.8)' }, 2.8)
      .from(msgs[1], { y: 14, scale: 0.9, opacity: 0, transformOrigin: '100% 100%', duration: 0.45, ease: 'back.out(1.8)' }, 3.25)
      .fromTo(typing, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3 }, 3.7)
      .to(typing, { opacity: 0, height: 0, marginTop: -8, duration: 0.25 }, 4.6)
      .from(msgs[2], { y: 14, scale: 0.9, opacity: 0, transformOrigin: '0% 100%', duration: 0.45, ease: 'back.out(1.8)' }, 4.65)
      .from(q('.ps-ai'), { y: 14, opacity: 0, duration: 0.6, ease: 'expo.out' }, 5.2);
  }

  if (index === 3) {
    const accept = q('.ps-prop-accept');
    const tap = q('.ps-tap');
    tl.from(q('.ps-prop'), { y: 60, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0.1)
      .from(qa('.ps-prop > *'), { y: 12, opacity: 0, stagger: 0.07, duration: 0.5, ease: 'power3.out' }, 0.35)
      .set(accept, { className: 'ps-prop-accept' }, 0)
      .fromTo(tap, { opacity: 0, scale: 1.6, x: 60, y: 120 }, { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.8, ease: 'power3.out' }, 1.3)
      .to(tap, { scale: 0.7, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 2.15)
      .to(accept, { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 2.15)
      .set(accept, { className: 'ps-prop-accept is-accepted' }, 2.27)
      .fromTo(qa('.ps-confetti i'), { x: 0, y: 0, opacity: 1, scale: 1 }, {
        x: (i) => Math.cos((i / 10) * Math.PI * 2) * (46 + (i % 3) * 14),
        y: (i) => Math.sin((i / 10) * Math.PI * 2) * (30 + (i % 3) * 10) - 10,
        opacity: 0, scale: 0.4, duration: 0.9, ease: 'power3.out'
      }, 2.28)
      .to(tap, { opacity: 0, duration: 0.3 }, 2.5)
      .from(q('.ps-deal-note'), { y: 14, opacity: 0, duration: 0.6, ease: 'expo.out' }, 2.6);
  }

  return tl;
}
