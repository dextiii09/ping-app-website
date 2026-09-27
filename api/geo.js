// Ping - roughly where a visitor is, from their IP address as Vercel sees it
// (city level; on mobile data it can be a nearby city). The home page uses it
// to draw the visitor's own streets on its map (assets/js/landing/realMap.js).
// Nothing is stored or logged here.
export const config = { runtime: 'edge' };

export default function handler(request) {
  const h = request.headers;
  const lat = Number.parseFloat(h.get('x-vercel-ip-latitude') || '');
  const lon = Number.parseFloat(h.get('x-vercel-ip-longitude') || '');
  let city = '';
  try { city = decodeURIComponent(h.get('x-vercel-ip-city') || ''); } catch (err) { /* malformed header */ }
  const known = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0);
  return new Response(JSON.stringify(known ? { lat, lon, city: city.slice(0, 60) } : {}), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' }
  });
}
