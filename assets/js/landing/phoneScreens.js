// Phone mock-ups for the landing page's "How it works" section. Each screen
// mirrors a real step of the campaign flow in the Ping app (a brand posts a
// campaign, talent applies, the brand swipes through applicants, a chat
// opens) and has a GSAP timeline that plays when its step becomes active.
// Names and numbers are illustrative.

const img = (id, w = 500) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

export const PHOTOS = {
  simran: img('1534528741775-53994a69daeb'),
  zoya: img('1517841905240-472988babdf9'),
  kabir: img('1507003211169-0a1dd7228f2d'),
  dj: img('1695277715416-e225cf09d70c'),
  brewLab: img('1509042239860-f550ce710b93', 200),
  cafe: img('1554118811-1e0d58224f24', 1400),
  creator: img('1517841905240-472988babdf9', 1400),
  boutique: img('1490481651871-ab68de25d43d', 600),
  salon: img('1522337360788-8b13dee7a37e', 200),
  gym: img('1534438327276-14e5300c3a48', 200),
  meera: img('1524504388940-b1c1722653e1', 200),
  arjun: img('1500648767791-00dcc994a43e', 200)
};

// An applicant card in the brand's review deck.
function card(pos, photo, info, { stamp = false } = {}) {
  return `
    <div class="ps-card ps-card-${pos}">
      <div class="ps-card-img" style="background-image:url('${photo}')"></div>
      ${stamp ? '<span class="ps-stamp">SELECT</span>' : ''}
      <div class="ps-card-info">
        <span class="ps-card-place"><i class="ph-fill ${info.icon}"></i> ${info.type} · ${info.place}</span>
        <b>${info.name} <i class="ph-fill ph-seal-check"></i></b>
        <span class="ps-card-role">${info.stats}</span>
        <span class="ps-card-quote">“${info.pitch}”</span>
      </div>
    </div>`;
}

const SIMRAN = { name: 'Simran K.', type: 'Influencer', icon: 'ph-camera', place: 'Sector 17', stats: '28K Instagram · 6.8% engagement', pitch: 'Brunch is my favourite thing to shoot!' };
const DJ = { name: 'DJ Kabir', type: 'DJ', icon: 'ph-vinyl-record', place: 'Sector 7', stats: 'Bollywood, House · 140+ gigs', pitch: 'Happy to do a chilled daytime set.' };
const ZOYA = { name: 'Zoya M.', type: 'Influencer', icon: 'ph-camera', place: 'Sector 22', stats: '12K Instagram · 7.1% engagement', pitch: 'I post a café every weekend.' };

const SCREENS = [
  // 0 - A brand posts a campaign
  () => `
    <div class="ps ps-post">
      <div class="ps-bar">
        <span class="ps-bar-title">New campaign</span>
        <span class="ps-bar-bell"><i class="ph-fill ph-megaphone-simple"></i></span>
      </div>
      <div class="ps-form">
        <div class="ps-field"><span>Title</span><b>Weekend brunch reels</b></div>
        <div class="ps-field">
          <span>Looking for</span>
          <div class="ps-chips ps-chips-tight">
            <span class="ps-chip is-on"><i class="ph-fill ph-camera"></i> Influencer</span>
            <span class="ps-chip"><i class="ph-fill ph-vinyl-record"></i> DJ</span>
            <span class="ps-chip"><i class="ph-fill ph-microphone-stage"></i> Comedian</span>
          </div>
        </div>
        <div class="ps-row2">
          <div class="ps-field"><span>Fixed fee</span><b class="ps-lime">₹5,000</b></div>
          <div class="ps-field"><span>Slots</span><div class="ps-stepper"><i>−</i><b class="ps-slots-num">3</b><i>+</i></div></div>
        </div>
        <div class="ps-field"><span>Deliverables · date</span><b>1 Reel + 2 Stories · Sat 12 Oct</b></div>
      </div>
      <div class="ps-publish"><span>Publish campaign</span><span class="ps-tap"></span></div>
      <div class="ps-toast"><i class="ph-fill ph-check-circle"></i> Live · local talent can apply</div>
    </div>`,

  // 1 - Talent applies (creator's side)
  () => `
    <div class="ps ps-apply">
      <div class="ps-bar">
        <span class="ps-bar-title">Open briefs</span>
        <span class="ps-bar-bell"><i class="ph-fill ph-bell"></i><b></b></span>
      </div>
      <div class="ps-brief">
        <div class="ps-brief-brand">
          <span class="ps-av-sm" style="background-image:url('${PHOTOS.brewLab}')"></span>
          <div><b>Brew Lab</b><span>Sector 17 · Near you</span></div>
        </div>
        <h4>Weekend brunch reels</h4>
        <div class="ps-prop-row"><span>Deliverables</span><b>1 Reel + 2 Stories</b></div>
        <div class="ps-prop-row"><span>Date</span><b>Sat 12 Oct</b></div>
        <div class="ps-prop-row"><span>Slots</span><b>3 open</b></div>
        <div class="ps-prop-total"><span>Fixed fee</span><b>₹5,000</b></div>
        <div class="ps-pitch"><span>Pitch note</span>Brunch is my favourite thing to shoot!</div>
        <div class="ps-apply-btn">
          <span class="ps-apply-a">Apply</span>
          <span class="ps-apply-b"><i class="ph-bold ph-check"></i> Applied</span>
          <span class="ps-tap"></span>
        </div>
      </div>
      <p class="ps-apply-note">No haggling: the fee is set upfront.</p>
    </div>`,

  // 2 - The brand swipes through applicants
  () => `
    <div class="ps ps-pick">
      <div class="ps-bar">
        <span class="ps-bar-title">Applicants</span>
        <span class="ps-slots" aria-label="Slots filled"><i class="is-on"></i><i></i><i></i></span>
      </div>
      <div class="ps-deck">
        ${card('back2', PHOTOS.zoya, ZOYA)}
        ${card('back1', PHOTOS.dj, DJ)}
        ${card('top', PHOTOS.simran, SIMRAN, { stamp: true })}
      </div>
      <div class="ps-actions">
        <span class="ps-act ps-act-pass"><i class="ph-bold ph-x"></i></span>
        <span class="ps-act ps-act-ping">
          <span class="ps-ripple"></span><span class="ps-ripple"></span>
          <i class="ph-bold ph-check"></i>
        </span>
      </div>
      <div class="ps-toast"><i class="ph-fill ph-chats-circle"></i> Simran's in · chat open</div>
    </div>`,

  // 3 - The chat opens straight away (creator's side)
  () => `
    <div class="ps ps-chat">
      <div class="ps-chat-head">
        <span class="ps-av-sm" style="background-image:url('${PHOTOS.brewLab}')"></span>
        <div><b>Brew Lab</b><span>Deal Room</span></div>
        <i class="ph-bold ph-dots-three"></i>
      </div>
      <div class="ps-chat-body">
        <div class="ps-note"><i class="ph-fill ph-megaphone-simple"></i> Selected for “Weekend brunch reels” · ₹5,000 fixed</div>
        <div class="ps-msg ps-msg-in">Welcome aboard! Can you shoot Saturday at 11?</div>
        <div class="ps-typing"><i></i><i></i><i></i></div>
        <div class="ps-msg ps-msg-out">Perfect, see you there ☕</div>
        <div class="ps-ai"><i class="ph-fill ph-sparkle"></i><span>Ping AI suggests <b>Confirm the shot list</b></span></div>
      </div>
      <div class="ps-input"><span>Message…</span><i class="ph-fill ph-paper-plane-tilt"></i></div>
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
    const tap = q('.ps-tap');
    const slots = q('.ps-slots-num');
    const counter = { n: 1 };
    tl.call(() => { slots.textContent = '1'; }, null, 0)
      .from(qa('.ps-field'), { y: 18, opacity: 0, stagger: 0.09, duration: 0.6, ease: 'expo.out' }, 0.1)
      .from(qa('.ps-chip'), { scale: 0.6, opacity: 0, stagger: 0.06, duration: 0.45, ease: 'back.out(2.2)' }, 0.45)
      .fromTo(counter, { n: 1 }, {
        n: 3, duration: 0.8, ease: 'steps(2)',
        onUpdate: () => { slots.textContent = String(Math.round(counter.n)); }
      }, 0.9)
      .from(q('.ps-publish'), { y: 20, opacity: 0, duration: 0.6, ease: 'expo.out' }, 0.8)
      .fromTo(tap, { opacity: 0, scale: 1.6, x: 60, y: 90 }, { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.7, ease: 'power3.out' }, 1.6)
      .to(tap, { scale: 0.7, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 2.35)
      .to(q('.ps-publish'), { scale: 0.95, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 2.35)
      .to(tap, { opacity: 0, duration: 0.3 }, 2.6)
      .fromTo(q('.ps-toast'), { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }, 2.55)
      .to(q('.ps-toast'), { y: -60, opacity: 0, duration: 0.5, ease: 'power2.in' }, 4.6);
  }

  if (index === 1) {
    const btn = q('.ps-apply-btn');
    const tap = q('.ps-tap');
    tl.from(q('.ps-brief'), { y: 60, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0.1)
      .from(qa('.ps-brief > *:not(.ps-pitch)'), { y: 12, opacity: 0, stagger: 0.07, duration: 0.5, ease: 'power3.out' }, 0.35)
      .set(btn, { className: 'ps-apply-btn' }, 0)
      .fromTo(q('.ps-pitch'), { height: 0, opacity: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }, { height: 'auto', opacity: 1, marginTop: 4, paddingTop: 9, paddingBottom: 9, duration: 0.6, ease: 'expo.out' }, 1.3)
      .fromTo(tap, { opacity: 0, scale: 1.6, x: 60, y: 90 }, { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.7, ease: 'power3.out' }, 1.8)
      .to(tap, { scale: 0.7, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 2.55)
      .to(btn, { scale: 0.95, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 2.55)
      .set(btn, { className: 'ps-apply-btn is-done' }, 2.67)
      .to(tap, { opacity: 0, duration: 0.3 }, 2.8)
      .from(q('.ps-apply-note'), { y: 10, opacity: 0, duration: 0.6, ease: 'expo.out' }, 2.9);
  }

  if (index === 2) {
    const top = q('.ps-card-top');
    const next = q('.ps-card-back1');
    const last = q('.ps-card-back2');
    const dots = qa('.ps-slots i');
    tl.set(dots[1], { className: '' }, 0)
      .from(top.querySelector('.ps-card-info').children, { y: 12, opacity: 0, stagger: 0.06, duration: 0.5, ease: 'power3.out' }, 0.15)
      .fromTo(q('.ps-act-ping'), { scale: 1 }, { scale: 1.22, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 1.1)
      .fromTo(qa('.ps-ripple'), { scale: 0.6, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 1.1, stagger: 0.18, ease: 'power2.out' }, 1.1)
      .fromTo(q('.ps-stamp'), { scale: 1.9, opacity: 0, rotation: -24 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.4, ease: 'back.out(2.4)' }, 1.25)
      .to(top, { x: 300, y: -20, rotation: 20, opacity: 0, duration: 0.75, ease: 'power3.in' }, 1.85)
      .set(dots[1], { className: 'is-on' }, 2.3)
      .fromTo(dots[1], { scale: 0.4 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' }, 2.3)
      .to(next, { y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'expo.out' }, 2.35)
      .to(next.querySelector('.ps-card-info'), { opacity: 1, duration: 0.4 }, 2.55)
      .to(last, { y: -9, scale: 0.95, opacity: 0.8, duration: 0.7, ease: 'expo.out' }, 2.4)
      .fromTo(q('.ps-toast'), { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }, 2.3)
      .to(q('.ps-toast'), { y: -60, opacity: 0, duration: 0.5, ease: 'power2.in' }, 4.4);
  }

  if (index === 3) {
    const msgs = qa('.ps-msg');
    const typing = q('.ps-typing');
    tl.from(q('.ps-chat-head'), { y: -16, opacity: 0, duration: 0.6, ease: 'expo.out' }, 0.1)
      .from(q('.ps-note'), { scale: 0.85, opacity: 0, duration: 0.6, ease: 'back.out(1.8)' }, 0.4)
      .from(msgs[0], { y: 14, scale: 0.9, opacity: 0, transformOrigin: '0% 100%', duration: 0.45, ease: 'back.out(1.8)' }, 1.1)
      .fromTo(typing, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3 }, 1.6)
      .to(typing, { opacity: 0, height: 0, marginTop: -8, duration: 0.25 }, 2.5)
      .from(msgs[1], { y: 14, scale: 0.9, opacity: 0, transformOrigin: '100% 100%', duration: 0.45, ease: 'back.out(1.8)' }, 2.55)
      .from(q('.ps-ai'), { y: 14, opacity: 0, duration: 0.6, ease: 'expo.out' }, 3.1);
  }

  return tl;
}
