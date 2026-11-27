// Turns Part B's big houses.geojson into two small files the map can load fast:
//   houses_nowshera.geojson (Kabul + Swat) and houses_dadu.geojson (Indus + Johi).
// Rounds corners to about 1 m and keeps only what the map needs:
//   id, p = river point, h = height above river (m), f = 1 if flooded in 2022, e = exposure 0..1
// Run from web/:  node scripts/slim-houses.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('public/data/houses.geojson', 'utf8'));
const AREAS = { nowshera: ['kabul_nowshera', 'swat_charsadda'], dadu: ['indus_dadu', 'johi_dadu'] };
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const ring = (r) => r.map(([x, y]) => [r5(x), r5(y)]);
const geom = (g) => g.type === 'Polygon'
  ? { type: 'Polygon', coordinates: g.coordinates.map(ring) }
  : { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.map(ring)) };

for (const [area, pts] of Object.entries(AREAS)) {
  const features = src.features
    .filter((f) => pts.includes(f.properties.river_point))
    .map((f) => {
      const p = f.properties;
      return { type: 'Feature', geometry: geom(f.geometry), properties: {
        id: p.id, p: p.river_point,
        h: Math.round((p.height_above_river_m ?? 10) * 10) / 10,
        f: p.flooded_2022 ? 1 : 0,
        e: Math.round((p.exposure ?? 0) * 100) / 100,
      } };
    });
  const out = JSON.stringify({ type: 'FeatureCollection', features });
  writeFileSync(`public/data/houses_${area}.geojson`, out);
  console.log(area, features.length, (out.length / 1e6).toFixed(1) + ' MB');
}

// Proof for the demo: score every house WITHOUT telling it whether it flooded in 2022
// (height 5/8 + distance 3/8, same scales as the risk API), with the river at its 2022 peak.
// Then compare with what really happened (the UNOSAT 2022 flood map).
const c01 = (x) => Math.max(0, Math.min(1, x));
const proof = {};
for (const [area, pts] of Object.entries(AREAS)) {
  const s = { flagged: 0, flaggedWet: 0, rest: 0, restWet: 0, wet: 0, wetFlagged: 0 };
  for (const f of src.features) {
    const p = f.properties;
    if (!pts.includes(p.river_point)) continue;
    const h = c01(1 - (p.height_above_river_m ?? 10) / 10);
    const d = c01(1 - (p.dist_to_river_m ?? 2000) / 2000);
    const flagged = ((0.5 * h + 0.3 * d) / 0.8) * 100 >= 50; // warning or danger
    const wet = !!p.flooded_2022;
    if (flagged) { s.flagged++; if (wet) s.flaggedWet++; } else { s.rest++; if (wet) s.restWet++; }
    if (wet) { s.wet++; if (flagged) s.wetFlagged++; }
  }
  proof[area] = { ...s, houses: s.flagged + s.rest,
    flaggedHit: Math.round((100 * s.flaggedWet) / s.flagged), restHit: Math.round((100 * s.restWet) / s.rest) };
}
writeFileSync('public/data/proof_houses.json', JSON.stringify(proof, null, 1));
console.log(proof);
