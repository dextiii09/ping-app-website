// Small DOM helpers for the landing page's motion: word splitting, a
// custom cursor, magnetic buttons, and the "ping" page transition.

// Wraps every word of `el` in spans (recursing into <em>/<span> so their
// styling survives). mask:true gives each word an overflow-clipped wrapper
// for slide-up reveals; returns the elements to animate.
export function splitWords(el, { mask = true } = {}) {
  if (el.dataset.splitDone) return el.querySelectorAll(mask ? '.lp-w > span' : '.lp-sw');
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const word = document.createElement('span');
          if (mask) {
            word.className = 'lp-w';
            const inner = document.createElement('span');
            inner.textContent = part;
            word.appendChild(inner);
          } else {
            word.className = 'lp-sw';
            word.textContent = part;
          }
          frag.appendChild(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    });
  };
  walk(el);
  el.dataset.splitDone = '1';
  return el.querySelectorAll(mask ? '.lp-w > span' : '.lp-sw');
}

const finePointer = () => window.matchMedia('(pointer: fine)').matches;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Dot + trailing ring cursor. Elements with data-cursor="Label" show a label.
export function initCursor(scope) {
  if (!finePointer() || reducedMotion()) return () => {};
  const dot = document.createElement('div');
  dot.className = 'lp-cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'lp-cursor-ring';
  ring.innerHTML = '<span class="lp-cursor-ring-inner"></span><span class="lp-cursor-label"></span>';
  document.body.append(dot, ring);
  scope.classList.add('has-cursor');
  const label = ring.querySelector('.lp-cursor-label');

  let x = -100, y = -100, rx = -100, ry = -100, shown = false, raf = 0;
  const onMove = (e) => {
    x = e.clientX;
    y = e.clientY;
    if (!shown) {
      shown = true;
      rx = x; ry = y;
      dot.classList.add('is-on');
      ring.classList.add('is-on');
    }
  };
  const onOver = (e) => {
    const target = e.target.closest('a, button, [data-cursor], .lp-hero');
    const text = target && target.getAttribute('data-cursor');
    const interactive = !!target && !target.classList.contains('lp-hero');
    ring.classList.toggle('is-hover', interactive && !text);
    ring.classList.toggle('has-label', !!text);
    ring.classList.toggle('is-map', !!target && target.classList.contains('lp-hero') && !interactive);
    if (text) label.textContent = text;
  };
  const onLeaveWindow = () => {
    shown = false;
    dot.classList.remove('is-on');
    ring.classList.remove('is-on');
  };
  const onDown = () => ring.classList.add('is-down');
  const onUp = () => ring.classList.remove('is-down');
  const loop = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = requestAnimationFrame(loop);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver);
  document.documentElement.addEventListener('pointerleave', onLeaveWindow);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    dot.remove();
    ring.remove();
    scope.classList.remove('has-cursor');
  };
}

// Buttons marked data-magnetic lean towards the pointer.
export function initMagnetic(scope) {
  if (!finePointer() || reducedMotion()) return () => {};
  const offs = [];
  scope.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.getAttribute('data-magnetic')) || 0.28;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
    };
    const onLeave = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    offs.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.style.transform = '';
    });
  });
  return () => offs.forEach((off) => off());
}

// Page transition: a lime wave then a dark fill expand from the click point.
// Resolves once the screen is covered; call revealScreen() after swapping views.
export function coverScreen(point) {
  const x = point && point.x ? point.x : window.innerWidth / 2;
  const y = point && point.y ? point.y : window.innerHeight / 2;
  const el = document.createElement('div');
  el.className = 'lp-transition';
  el.style.setProperty('--tx', `${x}px`);
  el.style.setProperty('--ty', `${y}px`);
  el.innerHTML = '<span class="lp-t-wave"></span><span class="lp-t-fill"></span>';
  document.body.appendChild(el);
  el.getBoundingClientRect(); // commit the start state so the transition runs
  el.classList.add('is-in');
  return new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : 880));
}

export function revealScreen() {
  document.querySelectorAll('.lp-transition').forEach((el) => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 650);
  });
}

// Fades a paragraph up line by line, then restores its original markup so
// later resizes re-wrap naturally. Lines are found by measuring where each
// word lands, so it works with inline links and <em> inside the text.
export function revealLines(gsap, el, { delay = 0 } = {}) {
  if (!el) return;
  if (el._lpReveal) {
    el._lpReveal.kill();
    el.innerHTML = el._lpOriginal;
  }
  const original = el.innerHTML;
  el._lpOriginal = original;
  delete el.dataset.splitDone;
  const words = [...splitWords(el, { mask: false })];
  words.forEach((w) => { w.style.display = 'inline-block'; });
  let lastTop = null;
  let line = -1;
  const lineOf = words.map((w) => {
    const top = w.offsetTop;
    if (lastTop === null || Math.abs(top - lastTop) > 4) { line += 1; lastTop = top; }
    return line;
  });
  gsap.set(el, { opacity: 1 });
  el._lpReveal = gsap.from(words, {
    yPercent: 70,
    opacity: 0,
    duration: 0.95,
    ease: 'expo.out',
    delay,
    stagger: (i) => lineOf[i] * 0.09,
    onComplete: () => {
      el.innerHTML = original;
      delete el.dataset.splitDone;
      el._lpReveal = null;
    }
  });
}

// A small lime "ping" ring wherever you click (outside the hero map, which
// has its own, and outside buttons/links).
export function initClickPings(scope) {
  if (reducedMotion()) return () => {};
  const onClick = (e) => {
    if (e.target.closest('a, button, input, textarea, select, label, .lp-hero, [data-no-ping]')) return;
    const ping = document.createElement('span');
    ping.className = 'lp-clickping';
    ping.style.left = `${e.clientX}px`;
    ping.style.top = `${e.clientY}px`;
    ping.innerHTML = '<i></i><i></i><b></b>';
    document.body.appendChild(ping);
    setTimeout(() => ping.remove(), 1200);
  };
  scope.addEventListener('click', onClick);
  return () => scope.removeEventListener('click', onClick);
}

// Elements marked data-tilt="<max degrees>" lean toward the pointer in 3D,
// with a soft light reflection that follows it.
export function initTilt(gsap, elements) {
  if (!finePointer() || reducedMotion()) return () => {};
  const offs = [];
  elements.forEach((el) => {
    const max = parseFloat(el.getAttribute('data-tilt')) || 5;
    gsap.set(el, { transformPerspective: 1000 });
    const rotX = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
    const rotY = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });
    const glare = document.createElement('span');
    glare.className = 'lp-glare';
    glare.setAttribute('aria-hidden', 'true');
    el.appendChild(glare);
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      rotY((px - 0.5) * 2 * max);
      rotX(-(py - 0.5) * 2 * max);
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
    };
    const onLeave = () => { rotX(0); rotY(0); };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    offs.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      glare.remove();
    });
  });
  return () => offs.forEach((off) => off());
}
