// Ping - real streets for the landing maps. The visitor's rough area comes
// from /api/geo (Vercel's IP lookup, see api/geo.js); their exact spot from
// the browser, which asks them first. The streets, water, parks and place
// names come from OpenStreetMap, as vector tiles served free by OpenFreeMap
// (the credit is shown on the map). Everything is best-effort: any failure
// resolves null and the invented city simply stays.
import { readTile } from './vectorTile.js';

const TILEJSON = 'https://tiles.openfreemap.org/planet';
const Z = 14;               // OpenFreeMap's most detailed zoom
const EARTH = 40075016.686; // metres around the equator
const PLACE_KEY = 'ping_map_place';
const ASKED_KEY = 'ping_map_asked';

// Roads by OpenMapTiles class. Tunnels and railways are left out.
const ROADS = {
  motorway: 'major', trunk: 'major', primary: 'major',
  secondary: 'mid', tertiary: 'mid',
  minor: 'minor', service: 'service',
  track: 'path', path: 'path'
};
const WATERWAYS = { river: 7, canal: 4.5, stream: 1.8, drain: 1, ditch: 1 }; // widths in screen px
const GREEN_COVER = new Set(['grass', 'wood']);
const GREEN_USE = new Set(['pitch', 'playground', 'stadium', 'cemetery']);
// Place names for "Near …", finest first (a city name only when nothing closer).
const PLACE_RANK = { neighbourhood: 0, quarter: 0, suburb: 0, hamlet: 1, village: 1, town: 2, city: 3 };
const WANTED = new Set(['transportation', 'water', 'waterway', 'park', 'landcover', 'landuse', 'building', 'place']);
const nameOf = (p) => String(p.name_en || p['name:latin'] || p.name || '').trim();

function keep(layer, p, type) {
  switch (layer) {
    case 'transportation': return type === 2 && !!ROADS[p.class] && p.brunnel !== 'tunnel';
    case 'waterway': return type === 2 && p.brunnel !== 'tunnel';
    case 'landcover': return type === 3 && GREEN_COVER.has(p.class);
    case 'landuse': return type === 3 && GREEN_USE.has(p.class);
    case 'place': return type === 1 && p.class in PLACE_RANK && !!nameOf(p);
    default: return type === 3; // water, park, building
  }
}

async function fetchWithin(url, ms, as) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
    if (!res.ok) return null;
    return as === 'json' ? await res.json() : await res.arrayBuffer();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Only where it's cheap and supported: not on data saver or 2G.
export function realMapAllowed() {
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return false;
  return typeof Path2D === 'function' && typeof TextDecoder === 'function' && typeof AbortController === 'function';
}

// A place the visitor picked this session ("Use my exact location").
export function savedPlace() {
  try {
    const p = JSON.parse(sessionStorage.getItem(PLACE_KEY) || 'null');
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? p : null;
  } catch (err) {
    return null;
  }
}

// Remember it for this browser tab (once its map has loaded).
export function savePlace(p) {
  try { sessionStorage.setItem(PLACE_KEY, JSON.stringify(p)); } catch (err) { /* storage blocked */ }
}

// Roughly where the visitor is: { lat, lon, city, exact: false } or null.
let approx;
export async function approxPlace() {
  if (approx === undefined) {
    const d = await fetchWithin('/api/geo', 4000, 'json');
    approx = d && Number.isFinite(d.lat) && Number.isFinite(d.lon)
      ? { lat: d.lat, lon: d.lon, city: String(d.city || '').slice(0, 60), exact: false }
      : null;
  }
  return approx;
}

// The exact spot is asked for once per browser tab; a "no" (or no answer)
// isn't asked again until the next visit.
export function askedExact() {
  try { return sessionStorage.getItem(ASKED_KEY) === '1'; } catch (err) { return true; }
}
function markAsked() {
  try { sessionStorage.setItem(ASKED_KEY, '1'); } catch (err) { /* storage blocked */ }
}

// The visitor's exact position: the browser asks them first. Resolves
// { lat, lon, exact: true } or null (no answer, "no", or no support).
export function exactPlace() {
  markAsked();
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const round = (v) => Math.round(v * 1e4) / 1e4; // about 10 m is plenty for a map
      resolve({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude), city: '', exact: true });
    }, () => resolve(null), { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  });
}

// One tile as Path2D shapes in metres around the centre (x east, y south),
// plus its road segments for placing people on streets.
function buildTile(buf, tx, ty, cx, cy, tileM) {
  let layers;
  try { layers = readTile(buf, WANTED, keep); } catch (err) { return null; }
  const ox = (tx - cx) * tileM;
  const oy = (ty - cy) * tileM;
  const t = {
    rect: [ox, oy, tileM, tileM],
    green: new Path2D(),
    buildings: new Path2D(),
    water: new Path2D(),
    waterways: {},
    roads: { path: new Path2D(), service: new Path2D(), minor: new Path2D(), mid: new Path2D(), major: new Path2D() },
    segs: [],
    names: []
  };
  const trace = (path, layer, f, close) => {
    const k = tileM / layer.extent;
    for (const part of f.geom) {
      if (part.length < 4) continue;
      path.moveTo(ox + part[0] * k, oy + part[1] * k);
      for (let i = 2; i < part.length; i += 2) path.lineTo(ox + part[i] * k, oy + part[i + 1] * k);
      if (close) path.closePath();
    }
  };
  const each = (name, fn) => { const layer = layers[name]; if (layer) layer.features.forEach((f) => fn(layer, f)); };

  each('landcover', (l, f) => trace(t.green, l, f, true));
  each('landuse', (l, f) => trace(t.green, l, f, true));
  each('park', (l, f) => trace(t.green, l, f, true));
  each('building', (l, f) => trace(t.buildings, l, f, true));
  each('water', (l, f) => trace(t.water, l, f, true));
  each('waterway', (l, f) => {
    const w = WATERWAYS[f.props.class] || 1.4;
    trace(t.waterways[w] || (t.waterways[w] = new Path2D()), l, f, false);
  });
  each('place', (l, f) => {
    const k = tileM / l.extent;
    const pt = f.geom[0];
    if (pt) t.names.push({ x: ox + pt[0] * k, y: oy + pt[1] * k, name: nameOf(f.props).slice(0, 60), rank: PLACE_RANK[f.props.class] });
  });
  each('transportation', (l, f) => {
    const kind = ROADS[f.props.class];
    trace(t.roads[kind], l, f, false);
    if (kind === 'path') return;
    const k = l.extent ? tileM / l.extent : 1;
    for (const part of f.geom) {
      for (let i = 2; i < part.length; i += 2) {
        t.segs.push(ox + part[i - 2] * k, oy + part[i - 1] * k, ox + part[i] * k, oy + part[i + 1] * k);
      }
    }
  });
  return t;
}

// Streets around (lat, lon) covering `ext` = { left, right, up, down } metres.
// Resolves { lat, lon, tiles, segs } or null. Remembers the last area, so a
// second map (or coming back to the page) doesn't fetch it again.
let lastArea = null;
export async function loadArea(lat, lon, ext) {
  if (lastArea && lastArea.lat === lat && lastArea.lon === lon) return lastArea;
  const tj = await fetchWithin(TILEJSON, 5000, 'json');
  const template = tj && Array.isArray(tj.tiles) ? tj.tiles[0] : '';
  if (!/^https:\/\/tiles\.openfreemap\.org\/[^?#]*\{z\}\/\{x\}\/\{y\}\.pbf$/.test(template || '')) return null;

  const n = 2 ** Z;
  const lr = (lat * Math.PI) / 180;
  const tileM = (EARTH * Math.cos(lr)) / n;
  const cx = ((lon + 180) / 360) * n;
  const cy = ((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2) * n;
  const fx = Math.floor(cx);
  const fy = Math.floor(cy);
  // At most the tile under the centre and one ring around it.
  const x0 = Math.max(fx - 1, Math.floor(cx - ext.left / tileM));
  const x1 = Math.min(fx + 1, Math.floor(cx + ext.right / tileM));
  const y0 = Math.max(fy - 1, Math.floor(cy - ext.up / tileM));
  const y1 = Math.min(fy + 1, Math.floor(cy + ext.down / tileM));

  const jobs = [];
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = x0; tx <= x1; tx++) {
      const url = template.replace('{z}', Z).replace('{x}', ((tx % n) + n) % n).replace('{y}', ty);
      jobs.push(fetchWithin(url, 8000, 'buffer').then((buf) => (buf ? buildTile(buf, tx, ty, cx, cy, tileM) : null)));
    }
  }
  const tiles = (await Promise.all(jobs)).filter(Boolean);
  if (!tiles.length) return null;
  const count = tiles.reduce((sum, t) => sum + t.segs.length, 0);
  const segs = new Float32Array(count);
  let at = 0;
  tiles.forEach((t) => { segs.set(t.segs, at); at += t.segs.length; t.segs = null; });
  lastArea = { lat, lon, tiles, segs, name: nearestName(tiles.flatMap((t) => t.names)) };
  return lastArea;
}

// The closest place name to the centre ("Sector 17", "Bandra West"): a
// neighbourhood within about 2 km, else the nearest village, town or city.
function nearestName(names) {
  let best = null;
  let bestScore = Infinity;
  for (const n of names) {
    const d = Math.hypot(n.x, n.y);
    if (n.rank === 0 && d > 2000) continue;
    const score = d + n.rank * 1500;
    if (score < bestScore) { best = n; bestScore = score; }
  }
  return best && bestScore < 12000 ? best.name : '';
}
