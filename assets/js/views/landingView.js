// Ping Web Platform - Public Landing Page
// First thing a logged-out visitor sees. Sections: interactive radar hero,
// niche marquee, manifesto, scroll-driven "how it works" phone, creators /
// brands bento, agency comparison, FAQ, and the Creator / Brand choice that
// hands off to sign-up. Content is fully visible without JS animation; GSAP +
// Lenis (loaded on demand) layer the motion on top.
//
// Copy rules: no invented member counts or activity, nothing about escrow or
// in-app payments (not built). Names in mock-ups are fictional.
import { PingMap } from '../landing/pingMap.js';
import { screenMarkup, buildScreenTimeline, PHOTOS } from '../landing/phoneScreens.js';
import { loadMotionLibs } from '../landing/libs.js';
import { splitWords, initCursor, initMagnetic, revealLines, initClickPings, initTilt } from '../landing/motionUtils.js';
import { RouteLine } from '../landing/routeLine.js';

const CONTACT_EMAIL = 'letstalk@reachupmedia.in';
const INTRO_SEEN_KEY = 'ping_intro_seen';

const MARK = '<svg class="lp-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#E6FF1A"/><path d="M37 7 15 36h15l-4 21 23-31H34l3-19Z" fill="#0A0A0A"/></svg>';
const ARROW = '<svg class="lp-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_UR = '<svg class="lp-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STAR = '<svg class="lp-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z" fill="currentColor"/></svg>';

const bg = (url) => `style="background-image:url('${url}')"`;

function btn(label, { variant = 'primary', size = '', attrs = '', icon = ARROW } = {}) {
  return `
    <a class="lp-btn lp-btn-${variant}${size ? ` lp-btn-${size}` : ''}" data-magnetic ${attrs}>
      <span class="lp-btn-label"><span data-text="${label}">${label}</span></span>
      <span class="lp-btn-icon">${icon}</span>
    </a>`;
}

const U = (id, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

// Photo that "peeks" out when you hover a word in the moving bands.
const PEEK = {
  'Cafés': U('1718791985055-e1b06ef5961d', 480), 'Salons': U('1580618672591-eb180b1a973f', 480),
  'Gyms': U('1517836357463-d25dfeac3438', 480), 'Boutiques': U('1441984904996-e0b6ba687e04', 480),
  'Bakeries': U('1568254183919-78a4f43a2877', 480), 'Studios': U('1647427854253-b92bb40c9330', 480),
  'Restaurants': U('1622021142947-da7dedc7c39a', 480), 'Florists': U('1639696194673-67b86204b885', 480),
  'Bookshops': U('1699443817739-cf2f7cbcd18d', 480), 'Pop-ups': U('1777232260032-4a4ea6600c7b', 480),
  'Food': U('1623334044303-241021148842', 480), 'Fitness': U('1534438327276-14e5300c3a48', 480),
  'Fashion': U('1490481651871-ab68de25d43d', 480), 'Beauty': U('1583209814683-c023dd293cc6', 480),
  'Lifestyle': U('1759393852314-59dc00faeed3', 480), 'Home & décor': U('1583847268964-b28dc8f51f92', 480),
  'Events': U('1501386761578-eac5c94b800a', 480), 'Tech': U('1468495244123-6c6c332eeece', 480),
  'Comedy': U('1730875648513-b08f39b8924c', 480), 'DJ sets': U('1695277715416-e225cf09d70c', 480),
  'Live music': U('1526478806334-5fd488fcaabc', 480)
};

// "Made for" gallery: ideas for what brands and creators can make together.
const GALLERY = [
  { biz: 'Cafés', who: 'food creators', text: 'Menu launches, latte-art reels and weekend brunch stories.', img: U('1718791985055-e1b06ef5961d') },
  { biz: 'Salons', who: 'beauty creators', text: 'Before-and-afters, fresh looks and bridal-season shoots.', img: U('1634449571010-02389ed0f9b0') },
  { biz: 'Gyms', who: 'fitness creators', text: 'Workout reels, trial-class invites and transformation stories.', img: U('1517836357463-d25dfeac3438') },
  { biz: 'Boutiques', who: 'fashion creators', text: 'Try-on hauls, festive drops and styling reels.', img: U('1441984904996-e0b6ba687e04') },
  { biz: 'Bakeries', who: 'food creators', text: 'Fresh-out-of-the-oven reels and new flavour launches.', img: U('1568254183919-78a4f43a2877') },
  { biz: 'Restaurants', who: 'food creators', text: "Chef's specials, tasting menus and dine-in reviews.", img: U('1622021142947-da7dedc7c39a') },
  { biz: 'Bars & terraces', who: 'DJs & bands', text: 'Launch nights, weekend sets and live-music Fridays.', img: U('1526478806334-5fd488fcaabc') },
  { biz: 'Venues', who: 'comedians', text: 'Open mics, hosted evenings and a laugh at your launch.', img: U('1730875648513-b08f39b8924c') }
];
const pad2 = (n) => String(n).padStart(2, '0');

const BUSINESS_TYPES = ['Cafés', 'Salons', 'Gyms', 'Boutiques', 'Bakeries', 'Studios', 'Restaurants', 'Florists', 'Bookshops', 'Pop-ups'];
const NICHES = ['Food', 'Fitness', 'Comedy', 'Fashion', 'DJ sets', 'Beauty', 'Live music', 'Lifestyle', 'Home & décor', 'Events', 'Tech'];

function bandItems(list, altClass) {
  const half = [...list, ...list].map((item, i) => `<span class="lp-band-item${i % 2 ? ` ${altClass}` : ''}"${PEEK[item] ? ` data-peek="${PEEK[item]}"` : ''}>${item}</span><span class="lp-band-sep">${STAR}</span>`).join('');
  return `<span class="lp-band-half">${half}</span><span class="lp-band-half" aria-hidden="true">${half}</span>`;
}

const STEPS = [
  { title: 'Post a campaign', text: 'A brand sets a fixed fee, how many people it needs and the date. The campaign goes out to local talent straight away.' },
  { title: 'Talent applies', text: 'Creators, comedians, DJs and bands see the campaigns made for them. The fee is shown upfront, and applying takes one tap.' },
  { title: 'Swipe to pick', text: 'The brand goes through applicants one card at a time: right to pick, left to pass. When every slot is filled, everyone else is told.' },
  { title: 'Chat & deliver', text: 'Every pick opens a private chat straight away. Sort out the details, put them in a Smart Proposal, and get it done.' }
];

const COMPARE = [
  ['What it costs', '20–30% of your budget', 'Free during the pilot'],
  ['Who you find', 'Whoever is on their roster', 'Local creators, comedians, DJs and bands'],
  ['How you pick', 'A shortlist someone else chose', 'Swipe through everyone who applied'],
  ['The price', 'Negotiated, then marked up', 'A fixed fee, shown upfront'],
  ['How you talk', 'Through an account manager', 'Directly, the moment you pick']
];

const FAQ = [
  ['Is Ping really free?', 'Yes. During the pilot, Ping is completely free for both creators and brands. No commission, no subscription.'],
  ['Who is Ping for?', 'Local businesses such as cafés, salons, gyms, bars and boutiques, and the local talent they work with: influencers and content creators (roughly 1K to 300K followers), comedians, DJs, bands and other artists.'],
  ['How does it work?', 'A brand posts a campaign with a fixed fee, how many people it needs and the date. Talent of that kind nearby can apply with one tap. The brand swipes through the applicants, and every pick opens a private chat straight away. When all the slots are filled, everyone else is told the campaign is filled.'],
  ['Do I need to be in a particular city?', 'No. Ping works wherever you are. Set your location when you sign up and discovery is built around it.'],
  ['Can I negotiate the fee?', 'No. The brand sets one fixed fee per person and it is shown upfront, so everyone knows what a campaign pays before applying. Details like timing and deliverables are agreed in the chat.'],
  ['How many campaigns can I apply to?', 'As many as you like. Ping never double-books you: once you are picked for a campaign, your other applications on the same dates close, and brands can’t pick you for dates you are already booked.'],
  ['How do payments work?', 'During the pilot you agree the scope and price in a Smart Proposal and settle payment directly with each other. In-app payments are on our roadmap.'],
  ['What is PingScore?', 'A trust signal on every profile, based on verification, how complete the profile is, and activity on Ping.']
];

function phone(inner, extraClass = '') {
  return `
    <div class="lp-phone ${extraClass}">
      <div class="lp-phone-island"></div>
      <div class="lp-phone-status"><span>9:41</span><span><i class="ph-fill ph-cell-signal-full"></i><i class="ph-fill ph-wifi-high"></i><i class="ph-fill ph-battery-full"></i></span></div>
      <div class="lp-phone-screen">${inner}</div>
    </div>`;
}

function markup({ skipIntro, touch }) {
  const year = new Date().getFullYear();
  return `
  <div class="landing">
    ${skipIntro ? '' : `
      <div class="lp-intro" aria-hidden="true">
        <div class="lp-intro-mark">${MARK}<span class="lp-intro-ring"></span><span class="lp-intro-ring"></span></div>
      </div>`}

    <header class="lp-nav" id="lpNav">
      <div class="lp-nav-inner">
        <a href="#top" class="lp-logo" data-scroll="top" aria-label="Ping, back to top">${MARK}<span>Ping</span></a>
        <nav class="lp-nav-links" aria-label="Page sections">
          <a href="#how" data-scroll="how">How it works</a>
          <a href="#audience" data-scroll="audience">Creators &amp; brands</a>
          <a href="#compare" data-scroll="compare">Why Ping</a>
          <a href="#faq" data-scroll="faq">FAQ</a>
        </nav>
        <div class="lp-nav-actions">
          <button type="button" class="lp-nav-login" data-action="login">Log in</button>
          ${btn('Get started', { size: 'sm', attrs: 'href="#choose" data-scroll="choose"' })}
          <button type="button" class="lp-menu-btn" aria-expanded="false" aria-controls="lpMenu" aria-label="Open menu"><span></span><span></span></button>
        </div>
      </div>
      <div class="lp-nav-progress" aria-hidden="true"><span></span></div>
    </header>

    <div class="lp-menu" id="lpMenu" hidden>
      <nav class="lp-menu-links" aria-label="Menu">
        <a href="#how" data-scroll="how"><span>01</span>How it works</a>
        <a href="#audience" data-scroll="audience"><span>02</span>Creators &amp; brands</a>
        <a href="#compare" data-scroll="compare"><span>03</span>Why Ping</a>
        <a href="#faq" data-scroll="faq"><span>04</span>FAQ</a>
      </nav>
      <div class="lp-menu-actions">
        <button type="button" class="lp-menu-role" data-role-choice="creator">I'm a creator ${ARROW}</button>
        <button type="button" class="lp-menu-role" data-role-choice="brand">I'm a brand ${ARROW}</button>
        <button type="button" class="lp-menu-login" data-action="login">Already on Ping? Log in</button>
      </div>
    </div>

    <main>
      <!-- HERO -->
      <section class="lp-hero" id="top">
        <div class="lp-hero-media"><canvas class="lp-hero-map" aria-hidden="true"></canvas></div>
        <div class="lp-hero-shade" aria-hidden="true"></div>
        <div class="lp-container lp-hero-inner">
          <p class="lp-hero-kicker lp-kicker"><span class="lp-live"></span> Pilot now open · free for creators &amp; brands</p>
          <h1 class="lp-hero-title">
            <span class="lp-line">Local brands.</span>
            <span class="lp-line">Local creators.</span>
            <span class="lp-line lp-line-serif"><em>One ping apart.</em></span>
          </h1>
          <div class="lp-hero-row">
            <p class="lp-hero-sub">Ping connects neighbourhood businesses with the creators, comedians, DJs and bands their customers already follow. Post a campaign, pick who you want, no agency in between.</p>
            <div class="lp-hero-ctas">
              ${btn('Find your match', { attrs: 'href="#choose" data-scroll="choose"' })}
              <a href="#how" class="lp-textlink" data-scroll="how">See how it works</a>
            </div>
          </div>
        </div>
        <div class="lp-container lp-hero-foot">
          <span class="lp-scroll-cue"><span class="lp-scroll-line"></span>Scroll</span>
          <span class="lp-hero-hint"><span class="lp-hint-dot"></span>${touch ? 'Tap' : 'Click'} the map to send a ping</span>
        </div>
      </section>

      <!-- MARQUEE -->
      <section class="lp-marquee" aria-label="Made for local businesses and creators">
        <div class="lp-band lp-band-lime"><div class="lp-band-track" data-dir="-1">${bandItems(BUSINESS_TYPES, 'is-serif')}</div></div>
        <div class="lp-band lp-band-dark"><div class="lp-band-track" data-dir="1">${bandItems(NICHES, 'is-outline')}</div></div>
      </section>

      <!-- MANIFESTO -->
      <section class="lp-section lp-manifesto" id="idea">
        <div class="lp-container lp-grid">
          <p class="lp-kicker lp-col-side"><b>(01)</b> The idea</p>
          <div class="lp-col-main">
            <p class="lp-manifesto-text" data-scrub-words>Local businesses hand agencies <span class="lp-hl">20–30%</span> of their budget to find creators who have never walked past their door. The creators their customers actually follow live <em>a few streets away.</em> Ping connects the two, directly.</p>
            <div class="lp-facts" data-stagger>
              <div class="lp-fact"><span class="lp-fact-num">0%</span><span class="lp-fact-label">Commission for either side during the pilot</span></div>
              <div class="lp-fact"><span class="lp-fact-num">1K–<span data-count="300">300</span>K</span><span class="lp-fact-label">Followers. The micro &amp; nano creators Ping is built for</span></div>
              <div class="lp-fact"><span class="lp-fact-num"><span data-count="4">4</span> steps</span><span class="lp-fact-label">From posting a campaign to chatting with your pick</span></div>
            </div>
          </div>
        </div>
      </section>

      <!-- GALLERY -->
      <section class="lp-gallery" id="made" aria-label="Ideas for local collaborations">
        <div class="lp-gallery-pin">
          <div class="lp-container lp-gallery-head">
            <div>
              <p class="lp-kicker"><b>(02)</b> Made for</p>
              <h2 class="lp-h2" data-split>Every kind of <em>local business.</em></h2>
            </div>
            <p class="lp-gallery-intro" data-lines>From the café on the corner to the bar down the road: a few ideas for what brands and local talent can make together.</p>
          </div>
          <div class="lp-gallery-viewport">
            <div class="lp-gallery-track">
              ${GALLERY.map((g, i) => `
                <article class="lp-gcard" data-tilt="6">
                  <div class="lp-gcard-media"><img src="${g.img}" alt="" loading="lazy" decoding="async"></div>
                  <span class="lp-gcard-idx">${pad2(i + 1)}</span>
                  <div class="lp-gcard-body">
                    <h3>${g.biz} <em>× ${g.who}</em></h3>
                    <p>${g.text}</p>
                  </div>
                </article>`).join('')}
              <a href="#choose" class="lp-gcard lp-gcard-cta" data-scroll="choose" data-tilt="6">
                <span class="lp-gcard-idx">${pad2(GALLERY.length + 1)}</span>
                <span class="lp-gcard-cta-body">
                  <span class="lp-gcard-cta-title">Don't see <em>yours?</em></span>
                  <span class="lp-gcard-cta-text">Ping works for any local business, and any creator or artist nearby.</span>
                  <span class="lp-gcard-cta-btn">Find your match ${ARROW}</span>
                </span>
              </a>
            </div>
          </div>
          <div class="lp-container lp-gallery-foot" aria-hidden="true">
            <span class="lp-gallery-count"><b>01</b> / ${pad2(GALLERY.length + 1)}</span>
            <span class="lp-gallery-bar"><span></span></span>
            <span class="lp-gallery-hint">Keep scrolling</span>
          </div>
        </div>
      </section>

      <!-- HOW IT WORKS -->
      <section class="lp-section lp-how" id="how">
        <div class="lp-container lp-grid lp-section-head">
          <p class="lp-kicker lp-col-side"><b>(03)</b> How it works</p>
          <h2 class="lp-h2 lp-col-main" data-split>Post it. Pick them. <em>Get it done.</em></h2>
        </div>
        <div class="lp-container lp-how-grid">
          <div class="lp-how-list">
            <div class="lp-how-progress" aria-hidden="true"><span></span></div>
            <ol class="lp-how-steps">
              ${STEPS.map((s, i) => `
                <li class="lp-how-step${i === 0 ? ' is-active' : ''}">
                  <div class="lp-how-copy">
                    <span class="lp-how-num">0${i + 1}</span>
                    <h3>${s.title}</h3>
                    <p data-lines>${s.text}</p>
                  </div>
                  <div class="lp-how-mini" aria-hidden="true">${phone(screenMarkup(i).replace('class="ps ', 'class="ps is-active '), 'lp-phone-sm')}</div>
                </li>`).join('')}
            </ol>
          </div>
          <div class="lp-how-phone" aria-hidden="true">
            <div class="lp-how-phone-sticky">
              <div class="lp-phone-glow"></div>
              ${phone([0, 1, 2, 3].map((i) => screenMarkup(i).replace('class="ps ', `class="ps${i === 0 ? ' is-active' : ''} `)).join(''))}
            </div>
          </div>
        </div>
      </section>

      <!-- AUDIENCE -->
      <section class="lp-section lp-audience" id="audience">
        <div class="lp-container">
          <div class="lp-audience-head">
            <div>
              <p class="lp-kicker"><b>(04)</b> Who it's for</p>
              <h2 class="lp-h2" data-split>Built for <em>both sides</em> of the street.</h2>
            </div>
            <div class="lp-tabs" role="tablist" aria-label="Who is Ping for">
              <span class="lp-tabs-pill" aria-hidden="true"></span>
              <button type="button" role="tab" id="lpTabCreators" aria-controls="lpPanelCreators" aria-selected="true" data-aud-tab="creators" class="is-on">For creators</button>
              <button type="button" role="tab" id="lpTabBrands" aria-controls="lpPanelBrands" aria-selected="false" tabindex="-1" data-aud-tab="brands">For brands</button>
            </div>
          </div>

          <div class="lp-bento" id="lpPanelCreators" role="tabpanel" aria-labelledby="lpTabCreators" data-aud-panel="creators">
            <article class="lp-tile lp-tile-a">
              <div class="lp-tile-copy"><h3>Your media kit, always ready</h3><p>What you do, your numbers and your best work in one profile. It's what brands see when you apply.</p></div>
              <div class="lp-tile-visual">
                <div class="mk">
                  <div class="mk-head"><span class="mk-av" ${bg(PHOTOS.simran)}></span><div><b>Simran K. <i class="ph-fill ph-seal-check"></i></b><span>Food &amp; café creator · Sector 17</span></div></div>
                  <div class="mk-tags"><em>#coffee</em><em>#brunch</em><em>#desserts</em></div>
                  <div class="mk-stats"><div><b>32K</b><span>Instagram</span></div><div><b>6.8%</b><span>Engagement</span></div><div><b>93</b><span>PingScore</span></div></div>
                  <div class="mk-rates">
                    <span class="mk-rates-title">Rate card</span>
                    <div class="mk-rate"><span>Dedicated reel</span><b>₹8,000</b></div>
                    <div class="mk-rate"><span>Story sequence</span><b>₹2,500</b></div>
                    <div class="mk-rate"><span>Store visit</span><b>₹15,000</b></div>
                  </div>
                </div>
              </div>
            </article>
            <article class="lp-tile lp-tile-b">
              <div class="lp-tile-copy"><h3>Apply in one tap</h3><p>Local brands post campaigns with the fee upfront. Apply to as many as you like.</p></div>
              <div class="lp-tile-visual">
                <div class="brief">
                  <div class="brief-top"><span class="brief-av" ${bg(PHOTOS.brewLab)}></span><div><b>Cold brew launch</b><span>Brew Lab · Food &amp; Café</span></div><span class="brief-budget">₹6,000</span></div>
                  <p>Looking for two local creators to shoot our new cold brew menu this month. Fixed fee, 1 Reel + 2 Stories.</p>
                  <div class="brief-foot"><span><i class="ph-fill ph-users"></i> 2 slots open</span><span class="brief-pitch"><i class="ph-fill ph-paper-plane-tilt"></i> Apply</span></div>
                </div>
              </div>
            </article>
            <article class="lp-tile lp-tile-c">
              <div class="lp-tile-copy"><h3>Ping AI polishes your bio</h3><p>Pick a tone. Get a bio that lands deals.</p></div>
              <div class="lp-tile-visual">
                <div class="bio"><span class="bio-tone"><i class="ph-fill ph-sparkle"></i> Tone: warm</span><p><span class="bio-text" data-typer>Chandigarh's café whisperer. I turn your best brews into reels people actually save. ☕</span><span class="bio-caret"></span></p></div>
              </div>
            </article>
            <article class="lp-tile lp-tile-d lp-tile-lime">
              <span class="lp-zero">0%</span>
              <p>commission during the pilot. You keep every rupee you agree.</p>
            </article>
            <div class="lp-aud-cta">
              <p>Free while we're in pilot. Set up in about two minutes.</p>
              ${btn('Join as a creator', { attrs: 'href="#" data-role-choice="creator"' })}
            </div>
          </div>

          <div class="lp-bento" id="lpPanelBrands" role="tabpanel" aria-labelledby="lpTabBrands" data-aud-panel="brands" hidden>
            <article class="lp-tile lp-tile-a">
              <div class="lp-tile-copy"><h3>Reach talent around you</h3><p>Your campaign goes to the creators, comedians, DJs and bands nearby: the people your customers already follow.</p></div>
              <div class="lp-tile-visual lp-tile-map">
                <canvas class="lp-mini-map" aria-hidden="true"></canvas>
                <span class="map-chip" style="--x:8%;--y:14%"><span ${bg(PHOTOS.meera)}></span>@meera.styles</span>
                <span class="map-chip" style="--x:46%;--y:64%"><span ${bg(PHOTOS.simran)}></span>@simran.eats</span>
                <span class="map-chip" style="--x:18%;--y:80%"><span ${bg(PHOTOS.arjun)}></span>@arjun.lifts</span>
              </div>
            </article>
            <article class="lp-tile lp-tile-b">
              <div class="lp-tile-copy"><h3>Post it. Swipe who applied.</h3><p>Set a fixed fee and how many people you need. Right to pick, left to pass.</p></div>
              <div class="lp-tile-visual">
                <div class="brief">
                  <div class="brief-top"><span class="brief-av" ${bg(PHOTOS.boutique)}></span><div><b>Festive collection drop</b><span>Hue Boutique · Fashion</span></div><span class="brief-budget">₹8,000</span></div>
                  <div class="pitches">
                    <span class="pitches-label">Applicants</span>
                    <span class="pitch-stack"><span ${bg(PHOTOS.zoya)}></span><span ${bg(PHOTOS.meera)}></span><span ${bg(PHOTOS.kabir)}></span><span ${bg(PHOTOS.arjun)}></span></span>
                    <b class="pitch-new">4 new</b>
                  </div>
                </div>
              </div>
            </article>
            <article class="lp-tile lp-tile-c">
              <div class="lp-tile-copy"><h3>Every pick opens a chat</h3><p>No account managers. Just you and the people you picked.</p></div>
              <div class="lp-tile-visual">
                <div class="chat-snip">
                  <span class="chat-in">Can you do a reel + stories by Friday?</span>
                  <span class="chat-out">Done. See you Saturday ✨</span>
                </div>
              </div>
            </article>
            <article class="lp-tile lp-tile-d">
              <div class="lp-tile-copy"><h3>Agree it in writing</h3><p>Smart Proposals lock in deliverables, timeline and budget.</p></div>
              <div class="lp-tile-visual">
                <div class="prop-snip"><span><i class="ph-fill ph-file-text"></i> 1 Reel + 3 Stories · ₹6,500</span><b><i class="ph-bold ph-check"></i> Accepted</b></div>
              </div>
            </article>
            <div class="lp-aud-cta">
              <p>Free while we're in pilot. Post your first campaign today.</p>
              ${btn('Join as a brand', { attrs: 'href="#" data-role-choice="brand"' })}
            </div>
          </div>
        </div>
      </section>

      <!-- COMPARE -->
      <section class="lp-section lp-compare" id="compare">
        <div class="lp-container lp-grid">
          <p class="lp-kicker lp-col-side"><b>(05)</b> Why Ping</p>
          <div class="lp-col-main">
            <h2 class="lp-h2" data-split>The agency model wasn't built for <em>your street.</em></h2>
            <div class="lp-cmp" role="table" aria-label="A typical agency compared with Ping">
              <div class="lp-cmp-hl" aria-hidden="true"></div>
              <div class="lp-cmp-row lp-cmp-head" role="row">
                <span role="columnheader"><span class="lp-sr">Topic</span></span>
                <span role="columnheader">Typical agency</span>
                <span role="columnheader" class="is-ping">${MARK} Ping</span>
              </div>
              ${COMPARE.map(([topic, agency, ping]) => `
                <div class="lp-cmp-row" role="row">
                  <span role="rowheader">${topic}</span>
                  <span role="cell" class="is-agency">${agency}</span>
                  <span role="cell" class="is-ping"><i class="ph-bold ph-check"></i>${ping}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section class="lp-section lp-faq" id="faq">
        <div class="lp-container lp-grid">
          <p class="lp-kicker lp-col-side"><b>(06)</b> FAQ</p>
          <div class="lp-col-main">
            <h2 class="lp-h2" data-split>Questions, <em>answered.</em></h2>
            <div class="lp-faq-list" data-stagger>
              ${FAQ.map(([q, a], i) => `
                <div class="lp-faq-item">
                  <h3><button type="button" class="lp-faq-q" id="lpFaqQ${i}" aria-expanded="false" aria-controls="lpFaqA${i}">${q}<span class="lp-faq-icon" aria-hidden="true"></span></button></h3>
                  <div class="lp-faq-a" id="lpFaqA${i}" role="region" aria-labelledby="lpFaqQ${i}"><div><p>${a}</p></div></div>
                </div>`).join('')}
            </div>
            <p class="lp-faq-contact" data-lines>Something else? Write to us at <a class="lp-textlink" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
          </div>
        </div>
      </section>

      <!-- CHOOSE -->
      <section class="lp-section lp-choose" id="choose">
        <div class="lp-container lp-grid lp-section-head">
          <p class="lp-kicker lp-col-side"><b>(07)</b> Get started</p>
          <h2 class="lp-h2 lp-col-main" data-split>Which side of the street <em>are you on?</em></h2>
        </div>
        <div class="lp-choose-panels">
          <button type="button" class="lp-panel" data-role-choice="creator" data-cursor="Join" aria-label="I'm a creator. Create my free account">
            <span class="lp-panel-media"><img src="${PHOTOS.creator}" alt="" loading="lazy" decoding="async"></span>
            <span class="lp-panel-top"><span class="lp-kicker">For creators</span><span class="lp-panel-idx">A</span></span>
            <span class="lp-panel-bottom">
              <span class="lp-panel-title">I'm a <em>creator</em></span>
              <span class="lp-panel-text" data-lines>Get booked by the places you already love.</span>
              <span class="lp-panel-cta"><span class="lp-panel-arrow">${ARROW}</span>Create my free account</span>
            </span>
          </button>
          <button type="button" class="lp-panel" data-role-choice="brand" data-cursor="Join" aria-label="I'm a brand. Create my free account">
            <span class="lp-panel-media"><img src="${PHOTOS.cafe}" alt="" loading="lazy" decoding="async"></span>
            <span class="lp-panel-top"><span class="lp-kicker">For brands</span><span class="lp-panel-idx">B</span></span>
            <span class="lp-panel-bottom">
              <span class="lp-panel-title">I'm a <em>brand</em></span>
              <span class="lp-panel-text" data-lines>Find the talent your customers already follow.</span>
              <span class="lp-panel-cta"><span class="lp-panel-arrow">${ARROW}</span>Create my free account</span>
            </span>
          </button>
        </div>
        <p class="lp-choose-login" data-lines>Already on Ping? <button type="button" class="lp-textlink" data-action="login">Log in</button></p>
      </section>
    </main>

    <footer class="lp-footer">
      <div class="lp-container lp-footer-top">
        <div class="lp-footer-lead">
          <p class="lp-footer-title" data-split>Local marketing, <em>minus the middleman.</em></p>
          ${btn('Join Ping', { attrs: 'href="#choose" data-scroll="choose"' })}
        </div>
        <div class="lp-footer-cols">
          <div>
            <p class="lp-footer-h">Explore</p>
            <a href="#how" data-scroll="how">How it works</a>
            <a href="#audience" data-scroll="audience">Creators &amp; brands</a>
            <a href="#compare" data-scroll="compare">Why Ping</a>
            <a href="#faq" data-scroll="faq">FAQ</a>
          </div>
          <div>
            <p class="lp-footer-h">Contact</p>
            <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
            <a href="https://instagram.com/reachup__media" target="_blank" rel="noopener noreferrer">Instagram ${ARROW_UR}</a>
            <a href="https://www.linkedin.com/company/reachupmedia01/" target="_blank" rel="noopener noreferrer">LinkedIn ${ARROW_UR}</a>
          </div>
          <div>
            <p class="lp-footer-h">Account</p>
            <button type="button" data-role-choice="creator">Join as a creator</button>
            <button type="button" data-role-choice="brand">Join as a brand</button>
            <button type="button" data-action="login">Log in</button>
            <a href="/privacy.html">Privacy</a>
            <a href="/terms.html">Terms</a>
          </div>
        </div>
      </div>
      <div class="lp-footer-word" aria-hidden="true"><span class="lp-fw">${'Ping'.split('').map((c) => `<span class="lp-fw-l">${c}</span>`).join('')}</span></div>
      <div class="lp-container lp-footer-bottom">
        <span>© ${year} <a href="https://reachupmedia.in" target="_blank" rel="noopener noreferrer">ReachUp Media</a></span>
        <span>Made for local businesses &amp; creators</span>
        <a href="#top" data-scroll="top">Back to top ↑</a>
      </div>
    </footer>
    <div class="lp-peek" aria-hidden="true"><img alt=""></div>
  </div>`;
}

const BIOS = [
  "Chandigarh's café whisperer. I turn your best brews into reels people actually save. ☕",
  'Brunch hunter and latte-art nerd. Weekend café trails for 32K locals who love a good plate.',
  'Food stories from Sector 17 and beyond. Honest reviews, gorgeous flat-lays, zero fluff.'
];

export function renderLanding(container, { onChooseRole, onLogin, skipIntro = false, scrollTo = null } = {}) {
  let introSeen = false;
  try { introSeen = sessionStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch (e) { /* storage blocked */ }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noIntro = skipIntro || introSeen || reduced || !!scrollTo;
  const touch = window.matchMedia('(hover: none)').matches;

  container.innerHTML = markup({ skipIntro: noIntro, touch });
  const root = container.querySelector('.landing');
  const cleanups = [];
  let destroyed = false;
  let lenis = null;
  let gsap = null;
  let menuOpen = false;

  // ─── Navigation & actions ────────────────────────────────────────────────
  const pointFrom = (e, el) => {
    if (e && e.detail !== 0 && e.clientX) return { x: e.clientX, y: e.clientY };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  function scrollToSection(id, immediate = false) {
    const target = id === 'top' ? 0 : root.querySelector(`#${id}`);
    if (target === null) return;
    if (lenis) {
      lenis.scrollTo(target, { offset: 0, duration: 1.6, immediate, force: true });
    } else if (target === 0) {
      window.scrollTo({ top: 0, behavior: immediate || reduced ? 'auto' : 'smooth' });
    } else {
      target.scrollIntoView({ behavior: immediate || reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }

  const menuBtn = root.querySelector('.lp-menu-btn');
  const menu = root.querySelector('#lpMenu');
  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    root.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      menu.getBoundingClientRect(); // commit the closed state so the wipe animates
      menu.classList.add('is-open');
      if (lenis) lenis.stop(); else document.documentElement.style.overflow = 'hidden';
    } else {
      menu.classList.remove('is-open');
      if (lenis) lenis.start(); else document.documentElement.style.overflow = '';
      setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 500);
    }
  }

  const onClick = (e) => {
    const scrollEl = e.target.closest('[data-scroll]');
    if (scrollEl) {
      e.preventDefault();
      const wasOpen = menuOpen;
      setMenu(false);
      setTimeout(() => scrollToSection(scrollEl.getAttribute('data-scroll')), wasOpen ? 120 : 0);
      return;
    }
    const roleEl = e.target.closest('[data-role-choice]');
    if (roleEl) {
      e.preventDefault();
      setMenu(false);
      onChooseRole(roleEl.getAttribute('data-role-choice') === 'brand' ? 'BUSINESS' : 'INFLUENCER', pointFrom(e, roleEl));
      return;
    }
    const loginEl = e.target.closest('[data-action="login"]');
    if (loginEl) {
      e.preventDefault();
      setMenu(false);
      onLogin(pointFrom(e, loginEl));
      return;
    }
    if (e.target.closest('.lp-menu-btn')) {
      setMenu(!menuOpen);
      return;
    }
    const faqBtn = e.target.closest('.lp-faq-q');
    if (faqBtn) {
      const item = faqBtn.closest('.lp-faq-item');
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      faqBtn.setAttribute('aria-expanded', String(open));
      if (open && gsap && !reduced) revealLines(gsap, item.querySelector('.lp-faq-a p'), { delay: 0.08 });
      return;
    }
    const tab = e.target.closest('[data-aud-tab]');
    if (tab) selectTab(tab.getAttribute('data-aud-tab'));
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && menuOpen) setMenu(false);
    const tab = e.target.closest && e.target.closest('[data-aud-tab]');
    if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const next = tab.getAttribute('data-aud-tab') === 'creators' ? 'brands' : 'creators';
      selectTab(next);
      root.querySelector(`[data-aud-tab="${next}"]`).focus();
    }
  };
  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  cleanups.push(() => {
    root.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    document.documentElement.style.overflow = '';
  });

  // Nav: glass once scrolled, hides while scrolling down, progress bar.
  const nav = root.querySelector('#lpNav');
  const progress = nav.querySelector('.lp-nav-progress span');
  let lastY = window.scrollY;
  let navTicking = false;
  const onScroll = () => {
    if (navTicking) return;
    navTicking = true;
    requestAnimationFrame(() => {
      navTicking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      nav.classList.toggle('is-scrolled', y > 24);
      if (y > lastY + 4 && y > 320 && !menuOpen) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y <= 320) nav.classList.remove('is-hidden');
      lastY = y;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));
  onScroll();

  // ─── Hero map ────────────────────────────────────────────────────────────
  const hero = root.querySelector('.lp-hero');
  const heroCanvas = root.querySelector('.lp-hero-map');
  // Keep map points out from under the headline, copy and buttons.
  const textRects = () => {
    const base = heroCanvas.getBoundingClientRect();
    const rel = (r) => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
    const rects = [...root.querySelectorAll('.lp-hero-title .lp-line')].map((line) => {
      const range = document.createRange();
      range.selectNodeContents(line);
      return rel(range.getBoundingClientRect());
    });
    root.querySelectorAll('.lp-hero-kicker, .lp-hero-sub, .lp-hero-ctas').forEach((el) => rects.push(rel(el.getBoundingClientRect())));
    return rects;
  };
  const heroMap = new PingMap(heroCanvas, {
    interactive: true,
    eventTarget: hero,
    focus: [0.74, 0.54],
    avoidLeft: 0.5,
    avoid: textRects,
    buildIn: true
  });
  cleanups.push(() => heroMap.destroy());
  // City builds itself: straight away without the intro, after the intro
  // curtain otherwise (see setupMotion / setupStatic), or not at all when
  // we're jumping back to a section further down.
  if (scrollTo) heroMap.skipBuild();
  else if (noIntro) heroMap.playBuild();

  // Travelling ping line (desktop only).
  if (!reduced) {
    const choosePanels = root.querySelector('.lp-choose-panels');
    const route = new RouteLine(root, { onArrive: (on) => choosePanels.classList.toggle('is-pinged', on) });
    cleanups.push(() => route.destroy());
    root._route = route;
  }

  // Click anywhere for a ping.
  cleanups.push(initClickPings(root));

  // Photo peek on the moving bands (desktop pointer only).
  let marqueeSlowTarget = 1;
  if (!reduced && window.matchMedia('(pointer: fine)').matches) {
    const marqueeEl = root.querySelector('.lp-marquee');
    const peek = root.querySelector('.lp-peek');
    const peekImg = peek.querySelector('img');
    let tx = 0, ty = 0, px = 0, py = 0, scale = 0.6, targetScale = 0.6, rot = 0, raf = 0, on = false, current = '', preloaded = false;
    const loop = () => {
      px += (tx - px) * 0.16;
      py += (ty - py) * 0.16;
      rot += (Math.max(-14, Math.min(14, (tx - px) * 0.3)) - rot) * 0.12;
      scale += (targetScale - scale) * 0.16;
      peek.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      raf = (on || Math.abs(targetScale - scale) > 0.005) ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const onEnter = (e) => {
      if (!preloaded) {
        preloaded = true;
        Object.values(PEEK).forEach((src) => { const im = new Image(); im.src = src; });
      }
      px = tx = e.clientX;
      py = ty = e.clientY;
    };
    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      const item = e.target.closest('.lp-band-item[data-peek]');
      if (item) {
        const src = item.getAttribute('data-peek');
        if (src !== current) {
          current = src;
          peekImg.src = src;
          scale = Math.min(scale, 0.86);
        }
        on = true;
        targetScale = 1;
        peek.classList.add('is-on');
        marqueeSlowTarget = 0.12;
      } else {
        on = false;
        targetScale = 0.6;
        peek.classList.remove('is-on');
        marqueeSlowTarget = 1;
      }
      kick();
    };
    const onLeave = () => {
      on = false;
      targetScale = 0.6;
      peek.classList.remove('is-on');
      marqueeSlowTarget = 1;
      kick();
    };
    marqueeEl.addEventListener('pointerenter', onEnter);
    marqueeEl.addEventListener('pointermove', onMove);
    marqueeEl.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      cancelAnimationFrame(raf);
      marqueeEl.removeEventListener('pointerenter', onEnter);
      marqueeEl.removeEventListener('pointermove', onMove);
      marqueeEl.removeEventListener('pointerleave', onLeave);
    });
  }

  // Gallery progress when it scrolls natively (phones, static mode).
  const galleryViewport = root.querySelector('.lp-gallery-viewport');
  const galleryCount = root.querySelector('.lp-gallery-count b');
  const galleryBar = root.querySelector('.lp-gallery-bar span');
  const galleryCards = root.querySelectorAll('.lp-gcard').length;
  const setGalleryProgress = (p) => {
    galleryBar.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;
    galleryCount.textContent = pad2(Math.round(Math.max(0, Math.min(1, p)) * (galleryCards - 1)) + 1);
  };
  const onGalleryScroll = () => {
    const max = galleryViewport.scrollWidth - galleryViewport.clientWidth;
    setGalleryProgress(max > 0 ? galleryViewport.scrollLeft / max : 0);
  };
  galleryViewport.addEventListener('scroll', onGalleryScroll, { passive: true });
  cleanups.push(() => galleryViewport.removeEventListener('scroll', onGalleryScroll));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) heroMap.refreshAvoid(); });

  // ─── Audience tabs ───────────────────────────────────────────────────────
  const tabs = [...root.querySelectorAll('[data-aud-tab]')];
  const panels = [...root.querySelectorAll('[data-aud-panel]')];
  const pill = root.querySelector('.lp-tabs-pill');
  let miniMap = null;
  const placePill = () => {
    const active = tabs.find((t) => t.classList.contains('is-on'));
    if (!active || !pill) return;
    pill.style.width = `${active.offsetWidth}px`;
    pill.style.transform = `translateX(${active.offsetLeft}px)`;
  };
  function selectTab(name) {
    const current = tabs.find((t) => t.classList.contains('is-on'));
    if (current && current.getAttribute('data-aud-tab') === name) return;
    tabs.forEach((t) => {
      const on = t.getAttribute('data-aud-tab') === name;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    placePill();
    panels.forEach((p) => { p.hidden = p.getAttribute('data-aud-panel') !== name; });
    const panel = panels.find((p) => !p.hidden);
    if (name === 'brands' && !miniMap) {
      miniMap = new PingMap(panel.querySelector('.lp-mini-map'), {
        density: 1.6, focus: [0.62, 0.42], narrowFocus: [0.62, 0.42], avoidLeft: 0, homeLabel: 'Your store', nameLabels: false
      });
      cleanups.push(() => miniMap.destroy());
    }
    if (gsap && !reduced) {
      gsap.fromTo(panel.querySelectorAll('.lp-tile, .lp-aud-cta'), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.07, overwrite: 'auto' });
      revealTileText(panel, 0.2);
    }
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }
  // Tile paragraphs fade up line by line (after the tiles themselves).
  function revealTileText(panel, delay = 0) {
    panel.querySelectorAll('.lp-tile-copy p, .lp-tile-lime p, .lp-aud-cta p').forEach((el, i) => {
      revealLines(gsap, el, { delay: delay + i * 0.07 });
    });
  }
  placePill();
  const onResize = () => placePill();
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) placePill(); });

  // Bento spotlight follows the pointer.
  const onTileMove = (e) => {
    const tile = e.target.closest('.lp-tile');
    if (!tile) return;
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
    tile.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  root.addEventListener('pointermove', onTileMove, { passive: true });
  cleanups.push(() => root.removeEventListener('pointermove', onTileMove));

  // Ping AI bio typer - only runs while visible.
  const typerEl = root.querySelector('[data-typer]');
  if (typerEl && !reduced) {
    let bioIndex = 0;
    let chars = BIOS[0].length;
    let deleting = true;
    let timer = 0;
    let running = false;
    const step = () => {
      const text = BIOS[bioIndex];
      if (deleting) {
        chars = Math.max(0, chars - 3);
        typerEl.textContent = text.slice(0, chars);
        if (chars === 0) {
          deleting = false;
          bioIndex = (bioIndex + 1) % BIOS.length;
          timer = setTimeout(step, 450);
          return;
        }
        timer = setTimeout(step, 18);
      } else {
        const next = BIOS[bioIndex];
        chars += 1;
        typerEl.textContent = next.slice(0, chars);
        if (chars >= next.length) {
          deleting = true;
          timer = setTimeout(step, 3200);
          return;
        }
        timer = setTimeout(step, 26 + Math.random() * 45);
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) { running = true; timer = setTimeout(step, 1800); }
      else if (!entry.isIntersecting && running) { running = false; clearTimeout(timer); }
    });
    io.observe(typerEl);
    cleanups.push(() => { io.disconnect(); clearTimeout(timer); });
  }

  cleanups.push(initCursor(root), initMagnetic(root));

  // ─── Motion (GSAP + Lenis) ───────────────────────────────────────────────
  function setupStatic() {
    root.classList.add('lp-static');
    const intro = root.querySelector('.lp-intro');
    if (intro) intro.remove();
    if (heroMap.building && !scrollTo) heroMap.playBuild();
    if (scrollTo) setTimeout(() => scrollToSection(scrollTo, true), 0);
  }

  function setupMotion(libs) {
    gsap = libs.gsap;
    const { ScrollTrigger, Lenis } = libs;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    if (Lenis) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      const raf = (time) => { if (lenis) lenis.raf(time * 1000); };
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      cleanups.push(() => {
        gsap.ticker.remove(raf);
        gsap.ticker.lagSmoothing(500, 33);
        if (lenis) lenis.destroy();
        lenis = null;
      });
    }

    let mm = null;
    let marqueeTick = null;
    let onRefresh = null;
    let onFooterResize = null;
    const footerOffs = [];
    const ctx = gsap.context(() => {
      // Hero entrance (after the intro, if any).
      const intro = root.querySelector('.lp-intro');
      const titleWords = splitWords(root.querySelector('.lp-hero-title'));
      // .lp-hero-foot itself is scrubbed on scroll below, so animate its children here.
      const heroBits = root.querySelectorAll('.lp-hero-kicker, .lp-hero-ctas, .lp-hero-foot > *');
      const heroSub = root.querySelector('.lp-hero-sub');
      if (scrollTo) {
        if (intro) intro.remove();
      } else {
        gsap.set(titleWords, { yPercent: 118 });
        gsap.set(heroBits, { y: 26, opacity: 0 });
        gsap.set(heroSub, { opacity: 0 });
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
        let start = 0.1;
        if (intro) {
          const mark = intro.querySelector('.lp-mark');
          tl.fromTo(mark, { scale: 0.4, opacity: 0, rotation: -14 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.8 })
            .fromTo(intro.querySelectorAll('.lp-intro-ring'), { scale: 0.6, opacity: 0.9 }, { scale: 3.6, opacity: 0, duration: 1.2, stagger: 0.16, ease: 'power2.out' }, 0.35)
            .to(mark, { scale: 0.85, opacity: 0, duration: 0.35, ease: 'power2.in' }, 1.0)
            .to(intro, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.05, ease: 'expo.inOut' }, 1.05)
            .add(() => intro.remove())
            .add(() => heroMap.playBuild(), 1.0);
          start = 1.5;
          try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch (e) { /* storage blocked */ }
        }
        tl.to(titleWords, { yPercent: 0, duration: 1.4, stagger: 0.07 }, start)
          .to(heroBits, { y: 0, opacity: 1, duration: 1.2, stagger: 0.1 }, start + 0.5)
          .add(() => revealLines(gsap, heroSub), start + 0.55);
      }

      // Hero drifts away as you scroll past it.
      const heroST = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to(root.querySelector('.lp-hero-inner'), { yPercent: -24, opacity: 0.1, ease: 'none', scrollTrigger: heroST });
      gsap.to(root.querySelector('.lp-hero-foot'), { opacity: 0, ease: 'none', scrollTrigger: { ...heroST, end: '30% top' } });
      gsap.to(root.querySelector('.lp-hero-media'), { scale: 1.14, opacity: 0.2, ease: 'none', scrollTrigger: heroST });

      // Headline word reveals.
      root.querySelectorAll('[data-split]').forEach((el) => {
        gsap.from(splitWords(el), {
          yPercent: 118, duration: 1.3, ease: 'expo.out', stagger: 0.05,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
      });
      root.querySelectorAll('[data-stagger]').forEach((el) => {
        gsap.from(el.children, {
          y: 44, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
      });
      root.querySelectorAll('.lp-section .lp-kicker:not(.lp-panel-top .lp-kicker), .lp-gallery .lp-kicker').forEach((el) => {
        gsap.from(el, { opacity: 0, x: -16, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      });

      // Paragraphs fade up line by line as they come into view.
      root.querySelectorAll('[data-lines]').forEach((el) => {
        gsap.set(el, { opacity: 0 });
        ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => revealLines(gsap, el) });
      });

      // Manifesto: words light up as you read.
      const manifesto = root.querySelector('[data-scrub-words]');
      gsap.fromTo(splitWords(manifesto, { mask: false }), { opacity: 0.13 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: manifesto, start: 'top 80%', end: 'bottom 45%', scrub: true }
      });
      root.querySelectorAll('[data-count]').forEach((el) => {
        const end = parseFloat(el.getAttribute('data-count'));
        const counter = { v: 0 };
        el.textContent = '0';
        gsap.to(counter, {
          v: end, duration: 1.8, ease: 'power3.out',
          onUpdate: () => { el.textContent = String(Math.round(counter.v)); },
          scrollTrigger: { trigger: el, start: 'top 92%', once: true }
        });
      });

      // Marquee: always drifting, faster (and reversible) with scroll velocity.
      const bands = [...root.querySelectorAll('.lp-band')];
      const tracks = bands.map((band) => {
        const el = band.querySelector('.lp-band-track');
        return { band, el, x: 0, dir: parseFloat(el.getAttribute('data-dir')) || -1, half: el.scrollWidth / 2 };
      });
      let velocity = 0;
      let boost = 0;
      let scrollDir = 1;
      let marqueeOn = false;
      let slow = 1;
      ScrollTrigger.create({
        trigger: root.querySelector('.lp-marquee'), start: 'top bottom', end: 'bottom top',
        onToggle: (self) => { marqueeOn = self.isActive; }
      });
      ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: (self) => {
          velocity = self.getVelocity();
          if (Math.abs(velocity) > 20) scrollDir = velocity > 0 ? 1 : -1;
        }
      });
      onRefresh = () => tracks.forEach((t) => { t.half = t.el.scrollWidth / 2; });
      ScrollTrigger.addEventListener('refresh', onRefresh);
      marqueeTick = () => {
        velocity *= 0.9;
        boost += (Math.min(Math.abs(velocity) / 220, 10) - boost) * 0.1;
        if (!marqueeOn) return;
        const dr = gsap.ticker.deltaRatio(60);
        const skew = Math.max(-7, Math.min(7, velocity / -260));
        slow += (marqueeSlowTarget - slow) * 0.08;
        tracks.forEach((t) => {
          t.x += (0.7 + boost) * t.dir * scrollDir * dr * slow;
          if (t.half > 0) {
            if (t.x <= -t.half) t.x += t.half;
            else if (t.x > 0) t.x -= t.half;
          }
          t.el.style.transform = `translate3d(${t.x}px,0,0)`;
          t.band.style.setProperty('--skew', `${skew.toFixed(2)}deg`);
        });
      };
      gsap.ticker.add(marqueeTick);

      // How it works: sticky phone on desktop, per-step phones on mobile.
      mm = gsap.matchMedia();
      mm.add('(min-width: 961px)', () => {
        const steps = [...root.querySelectorAll('.lp-how-step')];
        const screens = [...root.querySelectorAll('.lp-how-phone .ps')];
        const tls = screens.map((el, i) => buildScreenTimeline(gsap, el, i));
        let active = -1;
        const activate = (i) => {
          if (i === active) return;
          active = i;
          steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
          screens.forEach((s, k) => s.classList.toggle('is-active', k === i));
          tls.forEach((tl, k) => (k === i ? tl.restart() : tl.pause()));
        };
        steps.forEach((step, i) => {
          ScrollTrigger.create({
            trigger: step, start: i === 0 ? 'top 92%' : 'top 55%', end: 'bottom 55%',
            onToggle: (self) => { if (self.isActive) activate(i); }
          });
        });
        gsap.fromTo(root.querySelector('.lp-how-progress span'), { scaleY: 0 }, {
          scaleY: 1, ease: 'none',
          scrollTrigger: { trigger: root.querySelector('.lp-how-steps'), start: 'top 55%', end: 'bottom 55%', scrub: true }
        });
        // The phone leans towards the pointer.
        const phoneEl = root.querySelector('.lp-how-phone .lp-phone');
        const rotX = gsap.quickTo(phoneEl, 'rotationX', { duration: 0.9, ease: 'power3' });
        const rotY = gsap.quickTo(phoneEl, 'rotationY', { duration: 0.9, ease: 'power3' });
        const how = root.querySelector('.lp-how');
        const onMove = (e) => {
          rotY(((e.clientX / window.innerWidth) - 0.5) * 12);
          rotX(-((e.clientY / window.innerHeight) - 0.5) * 8);
        };
        const onLeave = () => { rotX(0); rotY(0); };
        how.addEventListener('pointermove', onMove);
        how.addEventListener('pointerleave', onLeave);
        return () => {
          how.removeEventListener('pointermove', onMove);
          how.removeEventListener('pointerleave', onLeave);
        };
      });
      // Gallery: holds in place while the cards slide sideways (desktop).
      mm.add('(min-width: 901px)', () => {
        const gallery = root.querySelector('.lp-gallery');
        const track = gallery.querySelector('.lp-gallery-track');
        const cards = [...track.children];
        const imgs = cards.map((c) => c.querySelector('.lp-gcard-media img'));
        gallery.classList.add('is-pinned');
        galleryViewport.scrollLeft = 0;
        const distance = () => Math.max(0, track.offsetWidth + (parseFloat(getComputedStyle(galleryViewport).paddingLeft) || 0) - galleryViewport.clientWidth);
        const parallax = () => {
          const vw = window.innerWidth;
          cards.forEach((card, i) => {
            if (!imgs[i]) return;
            const r = card.getBoundingClientRect();
            const c = (r.left + r.width / 2) / vw - 0.5;
            imgs[i].style.transform = `translateX(${(-c * 9).toFixed(2)}%)`;
          });
        };
        gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          onUpdate: parallax,
          scrollTrigger: {
            trigger: gallery,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
            // Created after triggers further down the page (how-it-works
            // steps, reveals...), so refresh it first: everything below then
            // measures its position including this pin's extra scroll space.
            refreshPriority: 1,
            onUpdate: (self) => setGalleryProgress(self.progress)
          }
        });
        gsap.from(cards, {
          y: 90, opacity: 0, rotation: 2, duration: 1.2, ease: 'expo.out', stagger: 0.07,
          scrollTrigger: { trigger: gallery, start: 'top 72%', once: true }
        });
        parallax();
        return () => gallery.classList.remove('is-pinned');
      });
      mm.add('(max-width: 900px)', () => {
        gsap.from(root.querySelectorAll('.lp-gcard'), {
          x: 60, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.06,
          scrollTrigger: { trigger: root.querySelector('.lp-gallery'), start: 'top 75%', once: true }
        });
      });

      mm.add('(max-width: 960px)', () => {
        root.querySelectorAll('.lp-how-step').forEach((step, i) => {
          const tl = buildScreenTimeline(gsap, step.querySelector('.lp-how-mini .ps'), i);
          ScrollTrigger.create({
            trigger: step, start: 'top 75%', end: 'bottom 20%',
            onToggle: (self) => (self.isActive ? tl.restart() : tl.pause())
          });
        });
      });

      // Bento tiles.
      const creatorsPanel = root.querySelector('[data-aud-panel="creators"]');
      gsap.set(creatorsPanel.querySelectorAll('.lp-tile-copy p, .lp-tile-lime p, .lp-aud-cta p'), { opacity: 0 });
      gsap.from(creatorsPanel.querySelectorAll('.lp-tile, .lp-aud-cta'), {
        y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: root.querySelector('.lp-bento'), start: 'top 82%', once: true, onEnter: () => revealTileText(creatorsPanel, 0.35) }
      });

      // Comparison.
      const cmp = root.querySelector('.lp-cmp');
      gsap.from(cmp.querySelectorAll('.lp-cmp-row'), {
        y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: cmp, start: 'top 82%', once: true }
      });
      gsap.from(cmp.querySelector('.lp-cmp-hl'), {
        scaleY: 0, transformOrigin: '50% 0%', duration: 1.4, ease: 'expo.inOut',
        scrollTrigger: { trigger: cmp, start: 'top 82%', once: true }
      });

      // Choice panels: wipe in, photos drift.
      const panelsWrap = root.querySelector('.lp-choose-panels');
      root.querySelectorAll('.lp-panel').forEach((panel, i) => {
        gsap.fromTo(panel, { clipPath: 'inset(22% 8% 0% 8% round 32px)', opacity: 0 }, {
          clipPath: 'inset(0% 0% 0% 0% round 32px)', opacity: 1, duration: 1.5, ease: 'expo.out', delay: i * 0.12,
          scrollTrigger: { trigger: panelsWrap, start: 'top 85%', once: true }
        });
        gsap.fromTo(panel.querySelector('.lp-panel-media'), { yPercent: -7 }, {
          yPercent: 7, ease: 'none',
          scrollTrigger: { trigger: panel, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });

      // Footer wordmark rises as you reach the bottom.
      gsap.fromTo(root.querySelector('.lp-fw'), { yPercent: 65 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: root.querySelector('.lp-footer'), start: 'top bottom', end: 'bottom bottom', scrub: true }
      });
      // Footer "Ping": a shine sweeps through the letters...
      const fw = root.querySelector('.lp-fw');
      const letters = [...fw.querySelectorAll('.lp-fw-l')];
      let sweep = null;
      const measureSweep = () => {
        const w = fw.offsetWidth;
        fw.style.setProperty('--fw-w', `${w * 3}px`);
        letters.forEach((l) => l.style.setProperty('--ox', `${l.offsetLeft}px`));
        if (sweep) sweep.kill();
        sweep = gsap.fromTo(fw, { '--fw-bx': `${-0.5 * w - 1.5 * w}px` }, {
          '--fw-bx': `${1.5 * w - 1.5 * w}px`, duration: 2.8, ease: 'power2.inOut', repeat: -1, repeatDelay: 1.8
        });
      };
      measureSweep();
      onFooterResize = measureSweep;
      window.addEventListener('resize', onFooterResize);
      // ...and the letters lift and stretch toward the cursor, then spring back.
      if (window.matchMedia('(pointer: fine)').matches) {
        const word = root.querySelector('.lp-footer-word');
        const onWordMove = (e) => {
          letters.forEach((l) => {
            const r = l.getBoundingClientRect();
            const d = Math.abs(e.clientX - (r.left + r.width / 2)) / (r.width * 0.95);
            const t = Math.max(0, 1 - d);
            const k = t * t * (3 - 2 * t);
            gsap.to(l, { yPercent: -10 * k, scaleY: 1 + 0.08 * k, scaleX: 1 - 0.03 * k, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
          });
        };
        const onWordLeave = () => {
          gsap.to(letters, { yPercent: 0, scaleX: 1, scaleY: 1, duration: 1.4, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' });
        };
        const onWordClick = () => {
          gsap.fromTo(letters, { scaleY: 0.8, scaleX: 1.1 }, { scaleY: 1, scaleX: 1, duration: 1.3, ease: 'elastic.out(1.1, 0.3)', stagger: 0.05, overwrite: 'auto' });
        };
        word.addEventListener('pointermove', onWordMove);
        word.addEventListener('pointerleave', onWordLeave);
        word.addEventListener('click', onWordClick);
        footerOffs.push(() => {
          word.removeEventListener('pointermove', onWordMove);
          word.removeEventListener('pointerleave', onWordLeave);
          word.removeEventListener('click', onWordClick);
        });
      }
    }, root);

    // 3D tilt on cards and panels.
    root.querySelectorAll('.lp-tile').forEach((t) => { if (!t.hasAttribute('data-tilt')) t.setAttribute('data-tilt', '5'); });
    root.querySelectorAll('.lp-panel').forEach((t) => t.setAttribute('data-tilt', '3'));
    cleanups.push(initTilt(gsap, root.querySelectorAll('[data-tilt]')));

    // Keep the travelling line in sync with pins and late layout changes.
    const onRouteRefresh = () => { if (root._route) root._route.rebuild(); };
    ScrollTrigger.addEventListener('refresh', onRouteRefresh);

    cleanups.push(() => {
      ScrollTrigger.removeEventListener('refresh', onRouteRefresh);
      if (onFooterResize) window.removeEventListener('resize', onFooterResize);
      footerOffs.forEach((off) => off());
      if (marqueeTick) gsap.ticker.remove(marqueeTick);
      if (onRefresh) ScrollTrigger.removeEventListener('refresh', onRefresh);
      if (mm) mm.revert();
      ctx.revert();
    });

    ScrollTrigger.refresh();
    if (scrollTo) setTimeout(() => scrollToSection(scrollTo, true), 0);
  }

  const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
  if (reduced) {
    setupStatic();
  } else {
    Promise.race([loadMotionLibs(), timeout(4000)])
      .then(async (libs) => {
        if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
        if (destroyed) return;
        if (!libs || !libs.gsap || !libs.ScrollTrigger) throw new Error('GSAP missing');
        setupMotion(libs);
      })
      .catch((err) => {
        if (destroyed) return;
        console.warn('Landing animations unavailable, showing static page:', err && err.message);
        setupStatic();
      });
  }

  return function destroy() {
    destroyed = true;
    setMenu(false);
    for (let i = cleanups.length - 1; i >= 0; i--) {
      try { cleanups[i](); } catch (e) { /* keep tearing down */ }
    }
  };
}
