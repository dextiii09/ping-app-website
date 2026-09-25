// "Travelling ping": a lime route that draws itself down the landing page as
// you scroll. It leaves the hero's scroll cue, runs down the side margins,
// crosses sides in the gaps between sections (lighting a waypoint each time),
// and splits into two paths that land on the Creator / Brand panels.
// Desktop only (>= 1024px), off for reduced motion. The path is measured from
// the live layout and rebuilt whenever the page's size changes.

const SVGNS = 'http://www.w3.org/2000/svg';
const STEP = 8; // px between path samples

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function samplePath(path) {
  const total = path.getTotalLength();
  const ys = [];
  const xs = [];
  for (let l = 0; l <= total; l += STEP) {
    const p = path.getPointAtLength(l);
    xs.push(p.x);
    ys.push(p.y);
  }
  const end = path.getPointAtLength(total);
  xs.push(end.x);
  ys.push(end.y);
  return { total, xs, ys };
}

// Length along a (y-monotonic) sampled path whose point sits at height y.
function lengthAtY(s, y) {
  const { ys, total } = s;
  if (!ys.length || y <= ys[0]) return 0;
  const last = ys.length - 1;
  if (y >= ys[last]) return total;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ys[mid] <= y) lo = mid; else hi = mid;
  }
  const span = ys[hi] - ys[lo];
  const f = span > 0.001 ? (y - ys[lo]) / span : 0;
  return Math.min(total, (lo + f) * STEP);
}

function pointAt(s, len) {
  const i = clamp(Math.round(len / STEP), 0, s.xs.length - 1);
  return { x: s.xs[i], y: s.ys[i] };
}

export class RouteLine {
  constructor(root, { onArrive } = {}) {
    this.root = root;
    this.main = root.querySelector('main');
    this.onArrive = onArrive || (() => {});
    this.arrived = false;
    this.enabled = false;
    this.destroyed = false;
    this.mq = window.matchMedia('(min-width: 1024px)');

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'lp-route');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <path class="lp-route-track" data-part="main"></path>
      <path class="lp-route-track" data-part="a"></path>
      <path class="lp-route-track" data-part="b"></path>
      <path class="lp-route-glow" data-part="main"></path>
      <path class="lp-route-glow" data-part="a"></path>
      <path class="lp-route-glow" data-part="b"></path>
      <path class="lp-route-line" data-part="main"></path>
      <path class="lp-route-line" data-part="a"></path>
      <path class="lp-route-line" data-part="b"></path>
      <g class="lp-route-nodes"></g>
      <g class="lp-route-head" data-head="main"><circle class="lp-route-head-ring" r="6"></circle><circle class="lp-route-head-dot" r="4"></circle></g>
      <g class="lp-route-head" data-head="a"><circle class="lp-route-head-ring" r="6"></circle><circle class="lp-route-head-dot" r="4"></circle></g>
      <g class="lp-route-head" data-head="b"><circle class="lp-route-head-ring" r="6"></circle><circle class="lp-route-head-dot" r="4"></circle></g>`;
    this.main.prepend(svg);
    this.svg = svg;
    this.parts = ['main', 'a', 'b'].reduce((acc, key) => {
      acc[key] = {
        track: svg.querySelector(`.lp-route-track[data-part="${key}"]`),
        glow: svg.querySelector(`.lp-route-glow[data-part="${key}"]`),
        line: svg.querySelector(`.lp-route-line[data-part="${key}"]`),
        head: svg.querySelector(`.lp-route-head[data-head="${key}"]`),
        s: null
      };
      return acc;
    }, {});
    this.nodesEl = svg.querySelector('.lp-route-nodes');
    this.nodes = [];

    let ticking = false;
    this.onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; this.update(); });
    };
    let timer = 0;
    this.rebuild = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!this.destroyed) this.build(); }, 160);
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.rebuild);
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(this.rebuild);
      this.ro.observe(this.main);
    }
    this.build();
  }

  build() {
    if (!this.mq.matches) {
      this.enabled = false;
      this.svg.style.display = 'none';
      return;
    }
    const $ = (sel) => this.root.querySelector(sel);
    const hero = $('.lp-hero');
    const cue = $('.lp-scroll-line');
    const panels = [...this.root.querySelectorAll('.lp-panel')];
    const ref = $('#idea .lp-container');
    if (!hero || !cue || panels.length < 2 || !ref) { this.svg.style.display = 'none'; return; }

    this.enabled = true;
    this.svg.style.display = '';
    const mainRect = this.main.getBoundingClientRect();
    const W = this.main.clientWidth;
    const H = this.main.scrollHeight;
    this.svg.setAttribute('width', W);
    this.svg.setAttribute('height', H);
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - mainRect.left, y: r.top - mainRect.top, w: r.width, h: r.height };
    };
    // Lanes sit in the middle of the empty side margins.
    const refR = rect(ref);
    const contentLeft = refR.x + (parseFloat(getComputedStyle(ref).paddingLeft) || 0);
    const laneL = clamp(contentLeft / 2, 14, 150);
    const laneR = W - laneL;

    const nodes = [];
    const c = rect(cue);
    const heroR = rect(hero);
    let x = c.x + c.w / 2;
    let y = c.y + c.h;
    let d = `M ${x} ${y}`;
    // Ease out of the scroll cue into the left lane.
    const laneStartY = heroR.y + heroR.h + 60;
    d += ` C ${x} ${y + 40} ${laneL} ${laneStartY - 50} ${laneL} ${laneStartY}`;
    x = laneL;
    y = laneStartY;

    // Cross sides in the gap above each of these sections.
    const crossings = [['#how', laneR], ['#audience', laneL], ['#compare', laneR], ['#faq', laneL]];
    for (const [sel, toX] of crossings) {
      const el = $(sel);
      if (!el) continue;
      const y0 = rect(el).y;
      if (y0 - 70 <= y) continue;
      d += ` L ${x} ${y0 - 70} C ${x} ${y0} ${toX} ${y0} ${toX} ${y0 + 70}`;
      nodes.push({ x: (x + toX) / 2, y: y0 });
      x = toX;
      y = y0 + 70;
    }

    // Final approach: meet in the gap above the two panels, then split.
    const pa = rect(panels[0]);
    const pb = rect(panels[1]);
    const splitY = Math.min(pa.y, pb.y) - 46;
    const splitX = (pa.x + pa.w + pb.x) / 2;
    d += ` L ${x} ${splitY - 90} C ${x} ${splitY} ${splitX} ${splitY} ${splitX} ${splitY}`;
    nodes.push({ x: splitX, y: splitY, split: true });

    const branch = (p) => {
      const ex = p.x + p.w / 2;
      const ey = p.y + 1;
      const my = (splitY + ey) / 2;
      return `M ${splitX} ${splitY} C ${splitX + (ex - splitX) * 0.5} ${my} ${ex} ${my} ${ex} ${ey}`;
    };
    const dA = branch(pa);
    const dB = branch(pb);

    const set = (key, pathD) => {
      const part = this.parts[key];
      [part.track, part.glow, part.line].forEach((el) => el.setAttribute('d', pathD));
      part.s = samplePath(part.line);
      [part.glow, part.line].forEach((el) => {
        el.style.strokeDasharray = `${part.s.total} ${part.s.total}`;
      });
    };
    set('main', d);
    set('a', dA);
    set('b', dB);

    // Waypoints + the two landing points.
    this.nodesEl.innerHTML = '';
    const ends = [
      { x: pa.x + pa.w / 2, y: pa.y + 1, end: 'a' },
      { x: pb.x + pb.w / 2, y: pb.y + 1, end: 'b' }
    ];
    this.nodes = [...nodes, ...ends].map((n) => {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', `lp-route-node${n.end ? ' is-end' : ''}${n.split ? ' is-split' : ''}`);
      g.setAttribute('transform', `translate(${n.x} ${n.y})`);
      g.innerHTML = `<circle class="lp-route-node-ring" r="${n.end ? 7 : 5}"></circle><circle class="lp-route-node-dot" r="${n.end ? 5 : 3.5}"></circle>`;
      this.nodesEl.appendChild(g);
      const s = n.end ? this.parts[n.end].s : this.parts.main.s;
      return { ...n, el: g, len: n.end ? s.total : lengthAtY(s, n.y) };
    });
    this.update();
  }

  update() {
    if (!this.enabled) return;
    const mainTop = this.main.getBoundingClientRect().top;
    const targetY = window.innerHeight * 0.62 - mainTop;
    const lens = {};
    for (const key of ['main', 'a', 'b']) {
      const part = this.parts[key];
      if (!part.s) continue;
      const len = key === 'main' || targetY > part.s.ys[0] ? lengthAtY(part.s, targetY) : 0;
      lens[key] = len;
      const offset = `${part.s.total - len}`;
      part.line.style.strokeDashoffset = offset;
      part.glow.style.strokeDashoffset = offset;
      const p = pointAt(part.s, len);
      part.head.setAttribute('transform', `translate(${p.x} ${p.y})`);
      const onBranch = key !== 'main';
      const show = onBranch ? len > 0 && len < part.s.total : len < part.s.total;
      part.head.classList.toggle('is-hidden', !show);
    }
    for (const n of this.nodes) {
      const len = n.end ? lens[n.end] : lens.main;
      n.el.classList.toggle('is-on', len >= n.len - 1);
    }
    const arrived = lens.a >= this.parts.a.s.total - 1 && lens.b >= this.parts.b.s.total - 1;
    if (arrived !== this.arrived) {
      this.arrived = arrived;
      this.onArrive(arrived);
    }
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.rebuild);
    if (this.ro) this.ro.disconnect();
    this.svg.remove();
  }
}
