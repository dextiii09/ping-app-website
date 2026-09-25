// Ping "neighbourhood radar": the animated map behind the landing hero (and
// a smaller version on the sign-up screen). A generated street grid with a
// river, local businesses (lime squares) and creators (white dots). A radar
// sweep lights them up, and every couple of seconds a creator and a nearby
// business ping each other and match. Clicking sends your own ping.
// With buildIn, the city starts empty and playBuild() "builds" it: streets
// reveal outward from the home point and places pop in as the edge passes.
// Purely illustrative - the names are fictional and nothing here is live data.

const BUSINESSES = [
  'Brew Lab', 'Glow Salon', 'Iron Den Gym', 'Thread & Co.', 'Crumb & Crust', 'Petal House',
  'Fold Studio', 'Spice Route', 'Kiln Café', 'Loop Cycles', 'Mint Nails', 'Paper Plane Books',
  'Salt & Sugar', 'Hue Boutique', 'Pulse Yoga', 'Common Room'
];
const CREATORS = [
  '@simran.eats', '@arjun.lifts', '@meera.styles', '@kabir.films', '@zoya.glow', '@dev.walks',
  '@ria.bakes', '@neel.shoots', '@tara.reads', '@ishaan.rides', '@naina.nails', '@vir.cooks',
  '@anya.fits', '@rohan.frames', '@pia.plates', '@sam.sketches'
];
const NICHES = ['Food & Café', 'Beauty', 'Fitness', 'Fashion', 'Lifestyle', 'Home & Décor', 'Events'];

const LIME = '230, 255, 26';
const INK = '245, 245, 240';
const MONO = '500 10.5px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const TAU = Math.PI * 2;
const NODE_DEPTH = 1.35; // nodes drift a little more than streets = depth

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const backOut = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapAngle = (a) => ((a % TAU) + TAU) % TAU;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function bezierPoint(p, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
    y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class PingMap {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.o = {
      focus: [0.7, 0.5],         // radar centre (fraction of width/height) on wide canvases
      narrowFocus: [0.5, 0.28],  // ... and on narrow ones (text sits low on phones)
      avoidLeft: 0.38,           // wide canvases keep most nodes right of this (headline side)
      density: 1,
      interactive: false,
      eventTarget: null,         // element receiving pointer events (the canvas sits under text)
      homeLabel: "You're here",
      nameLabels: true,          // false = only the "Match · niche" badge, no node names
      avoid: null,               // () => [{x, y, w, h}] areas (canvas px) to keep nodes out of, e.g. text
      buildIn: false,            // start empty and wait for playBuild() / skipBuild()
      ...options
    };
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.nodes = [];
    this.links = [];
    this.rings = [];
    this.spokes = [];
    this.toasts = [];
    this.pointer = { x: 0, y: 0, inside: false };
    this.par = { x: 0, y: 0 };
    this.sweep = -Math.PI / 2;
    this.visible = true;
    this.pageVisible = !document.hidden;
    this.raf = 0;
    this.last = 0;
    this.nextMatch = 0;
    this.destroyed = false;
    // Build-in state: pending = empty city waiting for playBuild().
    this.buildState = { pending: !!this.o.buildIn && !this.reduced, active: false, start: 0, dur: 2600, doneAt: 0 };

    this.loop = this.loop.bind(this);
    let resizeTimer = 0;
    this.handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (!this.destroyed) this.build(); }, 160);
    };
    this.handleVisibility = () => { this.pageVisible = !document.hidden; this.toggleLoop(); };

    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibility);
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.toggleLoop(); });
      this.io.observe(canvas);
    }
    if (this.o.interactive) this.bindPointer();

    this.build();
    // Labels use the web font; repaint the static version once it's ready.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (!this.destroyed && this.reduced) this.draw(performance.now()); });
    }
    this.toggleLoop();
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  build() {
    const rect = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, Math.round(rect.width));
    this.H = Math.max(1, Math.round(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.narrow = this.W < 900;

    const f = this.narrow ? this.o.narrowFocus : this.o.focus;
    this.hx = this.W * f[0];
    this.hy = this.H * f[1];
    this.R = Math.max(this.W, this.H) * (this.narrow ? 0.6 : 0.46);
    // Far enough to uncover every corner during the build-in.
    this.maxReveal = Math.max(
      Math.hypot(this.hx, this.hy), Math.hypot(this.W - this.hx, this.hy),
      Math.hypot(this.hx, this.H - this.hy), Math.hypot(this.W - this.hx, this.H - this.hy)
    ) + 80;

    this.buildStreets();
    this.buildNodes();
    this.links = [];
    this.rings = [];
    this.spokes = [];
    this.toasts = [];
    this.nextMatch = performance.now() + 600;
    if (this.reduced) this.seedStatic();
    this.draw(performance.now());
  }

  buildStreets() {
    const pad = (this.pad = 48);
    const w = this.W + pad * 2;
    const h = this.H + pad * 2;
    const off = this.streets || (this.streets = document.createElement('canvas'));
    off.width = Math.round(w * this.dpr);
    off.height = Math.round(h * this.dpr);
    const g = off.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const angle = (this.angle = -0.42);
    const cx = w / 2;
    const cy = h / 2;
    const D = Math.hypot(w, h) / 2 + 40;
    const xs = [];
    const ys = [];
    for (let x = -D; x < D; x += rand(58, 112)) xs.push(x);
    for (let y = -D; y < D; y += rand(58, 112)) ys.push(y);
    this.grid = { xs, ys, cx, cy };

    // River control points (unrotated offscreen space).
    this.river = this.narrow
      ? [{ x: -40, y: h * 0.62 }, { x: w * 0.3, y: h * 0.78 }, { x: w * 0.7, y: h * 0.3 }, { x: w + 40, y: h * 0.5 }]
      : [{ x: -40, y: h * 0.84 }, { x: w * 0.36, y: h * 0.56 }, { x: w * 0.6, y: h * 1.06 }, { x: w + 40, y: h * 0.72 }];
    this.riverPts = [];
    for (let i = 0; i <= 64; i++) this.riverPts.push(bezierPoint(this.river, i / 64));

    const street = (x1, y1, x2, y2, width, alpha) => {
      g.strokeStyle = `rgba(255,255,255,${alpha})`;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    };
    const majors = () => {
      xs.forEach((x, i) => { if (i % 4 === 0) street(x, -D, x, D, 1.6, 0.1); });
      ys.forEach((y, i) => { if (i % 4 === 0) street(-D, y, D, y, 1.6, 0.1); });
    };

    // Blocks: building footprints, the odd park and empty lot.
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i] + 7;
        const y0 = ys[j] + 7;
        const bw = xs[i + 1] - xs[i] - 14;
        const bh = ys[j + 1] - ys[j] - 14;
        if (bw < 14 || bh < 14) continue;
        const r = Math.random();
        if (r < 0.07) {
          g.fillStyle = 'rgba(230,255,26,0.032)';
          roundRectPath(g, x0, y0, bw, bh, 6);
          g.fill();
          continue;
        }
        if (r < 0.14) continue;
        g.fillStyle = `rgba(255,255,255,${rand(0.018, 0.042).toFixed(3)})`;
        const n = 1 + Math.floor(Math.random() * 3);
        const horizontal = bw > bh;
        const total = horizontal ? bw : bh;
        const gap = 4;
        let cursor = 0;
        for (let k = 0; k < n; k++) {
          const remaining = total - cursor - gap * (n - k - 1);
          const size = k === n - 1 ? remaining : rand(0.3, 0.6) * remaining;
          if (size < 4) break;
          if (horizontal) roundRectPath(g, x0 + cursor, y0, size, bh, 3);
          else roundRectPath(g, x0, y0 + cursor, bw, size, 3);
          g.fill();
          cursor += size + gap;
        }
      }
    }
    xs.forEach((x, i) => { if (i % 4) street(x, -D, x, D, 0.8, 0.05); });
    ys.forEach((y, i) => { if (i % 4) street(-D, y, D, y, 0.8, 0.05); });
    majors();
    g.restore();

    // River cuts through everything...
    const riverPath = () => {
      const p = this.river;
      g.beginPath();
      g.moveTo(p[0].x, p[0].y);
      g.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
    };
    g.lineCap = 'round';
    riverPath(); g.strokeStyle = 'rgba(255,255,255,0.09)'; g.lineWidth = 58; g.stroke();
    riverPath(); g.strokeStyle = '#0b0c0c'; g.lineWidth = 55; g.stroke();
    riverPath(); g.strokeStyle = 'rgba(255,255,255,0.016)'; g.lineWidth = 55; g.stroke();
    g.lineCap = 'butt';

    // ...and the major streets bridge it (clipped to the water band).
    g.save();
    const left = [];
    const right = [];
    const pts = this.riverPts;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      left.push({ x: pts[i].x + nx * 28, y: pts[i].y + ny * 28 });
      right.push({ x: pts[i].x - nx * 28, y: pts[i].y - ny * 28 });
    }
    g.beginPath();
    left.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    right.reverse().forEach((p) => g.lineTo(p.x, p.y));
    g.closePath();
    g.clip();
    g.translate(cx, cy);
    g.rotate(angle);
    majors();
    g.restore();

    // Two avenues at a different angle.
    g.save();
    g.translate(cx, cy);
    g.rotate(angle + 1.05);
    street(-D, -D * 0.22, D, -D * 0.22, 2.4, 0.08);
    street(-D, D * 0.3, D, D * 0.3, 2.4, 0.08);
    g.restore();
  }

  avoidRects() {
    try { return (this.o.avoid && this.o.avoid()) || []; } catch (e) { return []; }
  }

  inRects(rects, x, y, margin = 30) {
    return rects.some((r) => x > r.x - margin && x < r.x + r.w + margin && y > r.y - margin && y < r.y + r.h + margin);
  }

  // Drop nodes that now overlap the avoid areas (e.g. once web fonts load
  // and the headline's real width is known).
  refreshAvoid() {
    const rects = this.avoidRects();
    if (!rects.length) return;
    this.nodes = this.nodes.filter((n) => n.busy || !this.inRects(rects, n.x, n.y));
  }

  inRiver(x, y, margin = 34) {
    for (const p of this.riverPts) {
      if (Math.abs(p.x - x) < margin && Math.hypot(p.x - x, p.y - y) < margin) return true;
    }
    return false;
  }

  buildNodes() {
    const { W, H, pad } = this;
    const count = clamp(Math.round((W * H) / 21000 * this.o.density), 12, 64);
    const { xs, ys, cx, cy } = this.grid;
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    const bizNames = shuffle(BUSINESSES.slice());
    const creatorNames = shuffle(CREATORS.slice());
    let bi = 0;
    let ci = 0;
    const nodes = [];
    const avoid = this.avoidRects();
    let guard = 0;
    while (nodes.length < count && guard++ < count * 60) {
      const vertical = Math.random() < 0.5;
      const px = vertical ? pick(xs) : rand(xs[0], xs[xs.length - 1]);
      const py = vertical ? rand(ys[0], ys[ys.length - 1]) : pick(ys);
      const x = cx + px * c - py * s - pad;
      const y = cy + px * s + py * c - pad;
      if (x < 20 || x > W - 20 || y < 20 || y > H - 20) continue;
      if (!this.narrow && x < W * this.o.avoidLeft && Math.random() < 0.82) continue;
      if (this.inRiver(x + pad, y + pad)) continue;
      if (this.inRects(avoid, x, y)) continue;
      if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 28)) continue;
      if (Math.hypot(x - this.hx, y - this.hy) < 30) continue;
      const biz = Math.random() < 0.45;
      nodes.push({
        x, y, biz,
        label: biz ? bizNames[bi++ % bizNames.length] : creatorNames[ci++ % creatorNames.length],
        niche: pick(NICHES),
        lit: 0,
        hover: 0,
        busy: false,
        ang: Math.atan2(y - this.hy, x - this.hx),
        dist: Math.hypot(x - this.hx, y - this.hy)
      });
    }
    this.nodes = nodes;
  }

  // Reduced motion: a single still frame with a few settled matches.
  seedStatic() {
    const used = new Set();
    for (const a of this.nodes) {
      if (this.links.length >= 3) break;
      if (a.biz || used.has(a)) continue;
      const b = this.nodes.find((n) => n.biz && !used.has(n) && Math.hypot(n.x - a.x, n.y - a.y) < 220 && Math.hypot(n.x - a.x, n.y - a.y) > 40);
      if (!b) continue;
      used.add(a); used.add(b);
      a.lit = b.lit = 0.8;
      this.links.push({ a, b, t0: -Infinity, matched: true, niche: b.niche, still: true });
    }
  }

  bindPointer() {
    const target = this.o.eventTarget || this.canvas;
    this.onMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.pointer.inside = this.pointer.x >= 0 && this.pointer.y >= 0 && this.pointer.x <= this.W && this.pointer.y <= this.H;
    };
    this.onLeave = () => { this.pointer.inside = false; };
    this.onClick = (e) => {
      if (e.target.closest('a, button, input, textarea, select, [data-no-ping]')) return;
      const r = this.canvas.getBoundingClientRect();
      this.ping(e.clientX - r.left, e.clientY - r.top);
    };
    target.addEventListener('pointermove', this.onMove, { passive: true });
    target.addEventListener('pointerleave', this.onLeave);
    target.addEventListener('click', this.onClick);
  }

  // ─── Behaviour ────────────────────────────────────────────────────────────

  // A ping from the visitor at view coordinates (x, y).
  ping(x, y) {
    const now = performance.now();
    const mx = x - this.par.x * NODE_DEPTH;
    const my = y - this.par.y * NODE_DEPTH;
    this.rings.push({ x: mx, y: my, t0: now, dur: 1400, r: 170, w: 1.5 });
    this.rings.push({ x: mx, y: my, t0: now + 200, dur: 1400, r: 120, w: 1 });
    const hits = this.nodes.filter((n) => Math.hypot(n.x - mx, n.y - my) < 190);
    hits.forEach((n, i) => {
      n.lit = 1;
      this.spokes.push({ x: mx, y: my, n, t0: now + i * 45 });
    });
    const creators = hits.filter((n) => !n.biz).length;
    const biz = hits.length - creators;
    const text = hits.length
      ? `${creators} creator${creators === 1 ? '' : 's'} · ${biz} business${biz === 1 ? '' : 'es'} nearby`
      : 'Quiet corner. Try another spot';
    this.toasts.push({ x: mx, y: my - 18, text, t0: now, life: 2300, lime: true });
    if (this.reduced) this.draw(now);
  }

  // Build the city: streets reveal outward from home, places pop in.
  playBuild(duration = 2600) {
    if (this.reduced || this.destroyed) return;
    const now = performance.now();
    this.buildState = { pending: false, active: true, start: now, dur: duration, doneAt: now + duration };
    this.nodes.forEach((n) => { n.popped = false; });
    this.nextMatch = now + duration + 500;
    this.toggleLoop();
  }

  // Show the finished city straight away (e.g. when returning mid-page).
  skipBuild() {
    this.buildState = { pending: false, active: false, start: 0, dur: 0, doneAt: 0 };
    this.draw(performance.now());
  }

  // 0..Infinity radius of the revealed area (Infinity = fully built).
  revealRadius(now) {
    const b = this.buildState;
    if (b.pending) return 0;
    if (!b.active) return Infinity;
    const t = clamp((now - b.start) / b.dur, 0, 1);
    if (t >= 1) { b.active = false; return Infinity; }
    return easeOutQuart(t) * this.maxReveal;
  }

  get building() {
    return this.buildState.pending || this.buildState.active;
  }

  maybeMatch(now) {
    if (this.building) return;
    if (now < this.nextMatch || this.links.length >= 3) return;
    this.nextMatch = now + rand(1500, 2600);
    const creators = this.nodes.filter((n) => !n.biz && !n.busy);
    const reach = Math.min(this.W, this.H) * 0.36;
    for (let attempt = 0; attempt < 10; attempt++) {
      const a = pick(creators);
      if (!a) return;
      const near = this.nodes.filter((n) => {
        if (!n.biz || n.busy) return false;
        const d = Math.hypot(n.x - a.x, n.y - a.y);
        return d > 40 && d < reach;
      });
      if (!near.length) continue;
      const b = pick(near);
      a.busy = b.busy = true;
      a.lit = 1;
      this.links.push({ a, b, t0: now, matched: false, niche: b.niche });
      this.rings.push({ x: a.x, y: a.y, t0: now, dur: 1100, r: 34, w: 1.5 });
      return;
    }
  }

  update(now, dt) {
    // Parallax follows the pointer, eased.
    const tx = this.pointer.inside ? (this.pointer.x / this.W - 0.5) * -26 : 0;
    const ty = this.pointer.inside ? (this.pointer.y / this.H - 0.5) * -18 : 0;
    this.par.x += (tx - this.par.x) * Math.min(1, dt * 3.2);
    this.par.y += (ty - this.par.y) * Math.min(1, dt * 3.2);

    // Radar sweep lights nodes as it passes.
    const prev = this.sweep;
    this.sweep += dt * 0.78;
    const swept = this.sweep - prev;
    for (const n of this.nodes) {
      if (!this.building && n.dist < this.R) {
        const behind = wrapAngle(this.sweep - n.ang);
        if (behind <= swept + 0.01) n.lit = Math.max(n.lit, 0.9);
      }
      n.lit = Math.max(0, n.lit - dt * 0.55);
    }

    // Hover highlight around the pointer.
    const px = this.pointer.x - this.par.x * NODE_DEPTH;
    const py = this.pointer.y - this.par.y * NODE_DEPTH;
    for (const n of this.nodes) {
      const target = this.pointer.inside && Math.hypot(n.x - px, n.y - py) < 120 ? 1 : 0;
      n.hover += (target - n.hover) * Math.min(1, dt * 8);
    }

    this.maybeMatch(now);

    // Link lifecycle: draw the line, match, hold, fade.
    this.links = this.links.filter((l) => {
      const age = now - l.t0;
      if (!l.matched && age > 1000) {
        l.matched = true;
        l.a.lit = l.b.lit = 1;
        this.rings.push({ x: l.b.x, y: l.b.y, t0: now, dur: 1200, r: 42, w: 1.5 });
      }
      if (age > 4600) {
        l.a.busy = l.b.busy = false;
        return false;
      }
      return true;
    });
    this.rings = this.rings.filter((r) => now - r.t0 < r.dur);
    this.spokes = this.spokes.filter((s) => now - s.t0 < 1300);
    this.toasts = this.toasts.filter((t) => now - t.t0 < t.life);
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────

  curvePoint(l, t) {
    const { a, b } = l;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    let nx = -(b.y - a.y) / d;
    let ny = (b.x - a.x) / d;
    if (ny > 0) { nx = -nx; ny = -ny; } // always bow upwards
    const qx = mx + nx * d * 0.26;
    const qy = my + ny * d * 0.26;
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * qx + t * t * b.x, y: u * u * a.y + 2 * u * t * qy + t * t * b.y };
  }

  label(x, y, text, { lime = false, alpha = 1, center = false } = {}) {
    const ctx = this.ctx;
    ctx.font = MONO;
    const w = ctx.measureText(text).width + 16;
    const h = 21;
    const ox = this.par.x * NODE_DEPTH;
    const oy = this.par.y * NODE_DEPTH;
    let bx = center ? x - w / 2 : x + 10;
    let by = y - h - 8;
    bx = clamp(bx + ox, 8, this.W - w - 8) - ox; // keep the pill on screen
    by = clamp(by + oy, 8, this.H - h - 8) - oy;
    ctx.globalAlpha = alpha;
    roundRectPath(ctx, bx, by, w, h, 10.5);
    ctx.fillStyle = 'rgba(12,12,12,0.88)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = lime ? 'rgba(230,255,26,0.5)' : 'rgba(255,255,255,0.16)';
    ctx.stroke();
    ctx.fillStyle = lime ? '#E6FF1A' : `rgba(${INK},0.92)`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + 8, by + h / 2 + 0.5);
    ctx.globalAlpha = 1;
  }

  draw(now) {
    const ctx = this.ctx;
    const { W, H, hx, hy, R } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const reveal = this.revealRadius(now);
    const ox = this.par.x * NODE_DEPTH;
    const oy = this.par.y * NODE_DEPTH;
    if (reveal === Infinity) {
      ctx.drawImage(this.streets, -this.pad + this.par.x, -this.pad + this.par.y, W + this.pad * 2, H + this.pad * 2);
    } else if (reveal > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(hx + ox, hy + oy, reveal, 0, TAU);
      ctx.clip();
      ctx.drawImage(this.streets, -this.pad + this.par.x, -this.pad + this.par.y, W + this.pad * 2, H + this.pad * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(ox, oy);

    // Build-in edge: a glowing ring riding the reveal front.
    if (reveal !== Infinity && reveal > 0) {
      const fade = 1 - clamp(reveal / this.maxReveal, 0, 1);
      ctx.strokeStyle = `rgba(${LIME},${0.05 + 0.08 * fade})`;
      ctx.lineWidth = 28;
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(0, reveal - 14), 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${LIME},${0.25 + 0.5 * fade})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx, hy, reveal, 0, TAU);
      ctx.stroke();
    }

    // Radar: range rings (each appears once the build passes it), sweep, home.
    ctx.setLineDash([2, 6]);
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach((k) => {
      const rr = R * k;
      if (rr > reveal) return;
      const a = reveal === Infinity ? 1 : clamp((reveal - rr) / 120, 0, 1);
      ctx.strokeStyle = `rgba(${LIME},${0.10 * a})`;
      ctx.beginPath();
      ctx.arc(hx, hy, rr, 0, TAU);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // The sweep fades in once the city is built.
    const sweepAlpha = this.building ? 0 : clamp((now - this.buildState.doneAt) / 900, 0, 1);
    if (!this.reduced && sweepAlpha > 0) {
      ctx.globalAlpha = sweepAlpha;
      const wedge = 0.9;
      if (ctx.createConicGradient) {
        const grad = ctx.createConicGradient(this.sweep - wedge, hx, hy);
        const k = wedge / TAU;
        grad.addColorStop(0, `rgba(${LIME},0)`);
        grad.addColorStop(k * 0.999, `rgba(${LIME},0.085)`);
        grad.addColorStop(k, `rgba(${LIME},0)`);
        grad.addColorStop(1, `rgba(${LIME},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(hx, hy, R, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(${LIME},0.32)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(this.sweep) * R, hy + Math.sin(this.sweep) * R);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Home pulse.
    for (let i = 0; i < 2; i++) {
      const t = this.reduced ? 0.4 + i * 0.3 : ((now / 2400 + i * 0.5) % 1);
      ctx.strokeStyle = `rgba(${LIME},${(1 - t) * 0.55})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(hx, hy, 6 + t * 30, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#E6FF1A';
    ctx.beginPath();
    ctx.arc(hx, hy, 4.5, 0, TAU);
    ctx.fill();
    if (this.o.homeLabel) this.label(hx, hy + 4, this.o.homeLabel, { lime: true, alpha: 0.9, center: true });

    // Match curves.
    for (const l of this.links) {
      const age = now - l.t0;
      const p = l.still ? 1 : easeInOut(clamp((age - 150) / 850, 0, 1));
      const alpha = l.still ? 0.75 : clamp((4600 - age) / 900, 0, 1);
      if (p <= 0) continue;
      const steps = 28;
      const drawCurve = (width, a) => {
        ctx.strokeStyle = `rgba(${LIME},${a})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const pt = this.curvePoint(l, (i / steps) * p);
          if (i) ctx.lineTo(pt.x, pt.y); else ctx.moveTo(pt.x, pt.y);
        }
        ctx.stroke();
      };
      drawCurve(6, 0.07 * alpha);
      drawCurve(1.4, 0.85 * alpha);
      if (p < 1) {
        const head = this.curvePoint(l, p);
        ctx.fillStyle = `rgba(${LIME},${alpha})`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 2.6, 0, TAU);
        ctx.fill();
      }
    }

    // Spokes from a visitor ping.
    for (const s of this.spokes) {
      const t = clamp((now - s.t0) / 1300, 0, 1);
      if (t <= 0) continue;
      const grow = easeOut(clamp(t * 2.5, 0, 1));
      ctx.strokeStyle = `rgba(${LIME},${0.55 * (1 - t)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + (s.n.x - s.x) * grow, s.y + (s.n.y - s.y) * grow);
      ctx.stroke();
    }

    // Expanding rings.
    for (const r of this.rings) {
      const t = clamp((now - r.t0) / r.dur, 0, 1);
      if (t <= 0) continue;
      ctx.strokeStyle = `rgba(${LIME},${(1 - t) * 0.9})`;
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4 + easeOut(t) * r.r, 0, TAU);
      ctx.stroke();
    }

    // Nodes (pop in as the build-in front passes them).
    for (const n of this.nodes) {
      let scale = 1;
      if (reveal !== Infinity) {
        const appear = clamp((reveal - n.dist) / 80, 0, 1);
        if (appear <= 0) continue;
        if (!n.popped && this.buildState.active) {
          n.popped = true;
          n.lit = 1;
          this.rings.push({ x: n.x, y: n.y, t0: now, dur: 800, r: n.biz ? 22 : 16, w: 1 });
        }
        scale = backOut(appear);
      }
      const glow = Math.max(n.lit, n.hover * 0.8);
      if (glow > 0.02) {
        ctx.fillStyle = n.biz ? `rgba(${LIME},${0.12 * glow})` : `rgba(${INK},${0.1 * glow})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5 + glow * 9, 0, TAU);
        ctx.fill();
      }
      if (n.biz) {
        ctx.fillStyle = `rgba(${LIME},${0.55 + glow * 0.45})`;
        roundRectPath(ctx, n.x - 3.4 * scale, n.y - 3.4 * scale, 6.8 * scale, 6.8 * scale, 1.6 * scale);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(${INK},${0.5 + glow * 0.5})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.8 * scale, 0, TAU);
        ctx.fill();
      }
    }

    // Pointer: faint lock-on lines + labels for the closest few.
    if (this.pointer.inside) {
      const px = this.pointer.x - this.par.x * NODE_DEPTH;
      const py = this.pointer.y - this.par.y * NODE_DEPTH;
      const near = this.nodes.filter((n) => n.hover > 0.05 && (reveal === Infinity || n.dist < reveal)).sort((a, b) => b.hover - a.hover).slice(0, 4);
      ctx.setLineDash([3, 4]);
      for (const n of near) {
        ctx.strokeStyle = `rgba(${INK},${0.22 * n.hover})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const n of near) if (n.hover > 0.5) this.label(n.x, n.y, n.label, { lime: n.biz, alpha: n.hover });
    }

    // Labels for matching pairs + the match toast.
    for (const l of this.links) {
      const age = now - l.t0;
      const alpha = l.still ? 0.9 : clamp((4600 - age) / 900, 0, 1) * clamp(age / 300, 0, 1);
      if (this.o.nameLabels && l.a.hover < 0.5) this.label(l.a.x, l.a.y, l.a.label, { alpha });
      if (this.o.nameLabels && l.matched && l.b.hover < 0.5) this.label(l.b.x, l.b.y, l.b.label, { lime: true, alpha });
      if (l.matched) {
        const top = this.curvePoint(l, 0.5);
        const pop = l.still ? 1 : easeOut(clamp((age - 1000) / 350, 0, 1));
        this.label(top.x, top.y + 8 - pop * 6, `Match · ${l.niche}`, { lime: true, alpha: alpha * pop, center: true });
      }
    }
    for (const t of this.toasts) {
      const age = now - t.t0;
      const alpha = clamp(age / 200, 0, 1) * clamp((t.life - age) / 400, 0, 1);
      this.label(t.x, t.y - easeOut(clamp(age / 500, 0, 1)) * 8, t.text, { lime: t.lime, alpha, center: true });
    }

    ctx.restore();
  }

  // ─── Loop / lifecycle ────────────────────────────────────────────────────

  toggleLoop() {
    const run = !this.reduced && this.visible && this.pageVisible && !this.destroyed;
    if (run && !this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    } else if (!run && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.update(now, dt);
    this.draw(now);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    if (this.io) this.io.disconnect();
    if (this.o.interactive) {
      const target = this.o.eventTarget || this.canvas;
      target.removeEventListener('pointermove', this.onMove);
      target.removeEventListener('pointerleave', this.onLeave);
      target.removeEventListener('click', this.onClick);
    }
  }
}
