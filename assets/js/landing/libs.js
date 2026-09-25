// Motion libraries for the public landing page, loaded on demand so logged-in
// app users never download them. Versions are pinned and SRI-checked: the
// browser refuses a CDN file whose hash doesn't match.
const LIBS = {
  gsap: {
    src: 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js',
    integrity: 'sha384-XmJ9SoHtVOHoQUcKvFAzVXwdkKo1Ie3bhmSoIAkcdsHGaIrVJIkmozyq0FJeb/Ly'
  },
  scrollTrigger: {
    src: 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js',
    integrity: 'sha384-wl5TeDVvOWt30Pbf8aSo2ZrzsOjddu3avOBvHe+p+OhJt9gP6w9YXmDkN5DK2/dF'
  },
  lenis: {
    src: 'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js',
    integrity: 'sha384-jqpi9VmOdhyLoLURgjCn7EpnG9BbnHW57ibIZoeaIU+erWDH3k8fQQg0xH2ySjnw'
  }
};

function loadScript({ src, integrity }) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded) { resolve(); return; }
    if (existing) existing.remove(); // a previous attempt failed or is stale - start clean

    const script = document.createElement('script');
    script.src = src;
    script.integrity = integrity;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => { script.dataset.loaded = '1'; resolve(); };
    script.onerror = () => { script.remove(); reject(new Error(`Failed to load ${src}`)); };
    document.head.appendChild(script);
  });
}

let pending = null;

// Resolves to { gsap, ScrollTrigger, Lenis } - Lenis may be null (smooth
// scrolling is a nice-to-have; GSAP is required for the animations).
export function loadMotionLibs() {
  if (!pending) {
    pending = Promise.all([
      loadScript(LIBS.gsap).then(() => loadScript(LIBS.scrollTrigger)),
      loadScript(LIBS.lenis).catch(() => null)
    ])
      .then(() => ({ gsap: window.gsap, ScrollTrigger: window.ScrollTrigger, Lenis: window.Lenis || null }))
      .catch((err) => { pending = null; throw err; });
  }
  return pending;
}
