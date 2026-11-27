// Makes a light copy of the Pakistan outline (about 1 km accuracy) for quick "is this inside Pakistan" tests.
// The map still draws the detailed outline. Run from web/:  node scripts/simplify-pk.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const pk = JSON.parse(readFileSync('public/geo/pakistan.geojson', 'utf8'));
const TOL = 0.01;
function dp(pts) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(dx, dy) || 1);
    if (d > max) { max = d; idx = i; }
  }
  return max > TOL ? [...dp(pts.slice(0, idx + 1)).slice(0, -1), ...dp(pts.slice(idx))] : [a, b];
}
let before = 0, after = 0;
const g = pk.features[0].geometry;
const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((p) => p.map((r) => { before += r.length; const m = r.length >> 1; const s = [...dp(r.slice(0, m + 1)).slice(0, -1), ...dp(r.slice(m))]; after += s.length; return s; })).filter((p) => p[0].length >= 4);
writeFileSync('public/geo/pakistan_simple.geojson', JSON.stringify({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polys } }));
console.log(before, '->', after, 'points');
