// Finds the nearest river to any spot, using only the national points.
// Points on the same river are numbered in order (indus_014, indus_015, ...),
// so we join neighbours with straight lines and measure to the nearest line.
const { getNationalPoints } = require('./data');

const M_PER_DEG = 111320;
const MAX_GAP_M = 60000; // don't join two points more than 60 km apart (a gap in the river)

let segmentsCache = null;
function getSegments() {
  if (segmentsCache) return segmentsCache;
  const rivers = {};
  const segments = [];
  for (const p of getNationalPoints()) {
    const m = /^(.*)_(\d+)$/.exec(p.id);
    if (!m) { segments.push([p, p]); continue; } // a lone point, no neighbours
    (rivers[m[1]] ||= []).push({ n: Number(m[2]), p });
  }
  for (const list of Object.values(rivers)) {
    list.sort((a, b) => a.n - b.n);
    if (list.length === 1) segments.push([list[0].p, list[0].p]);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1].p, b = list[i].p;
      if (distanceM(a.lat, a.lon, b.lat, b.lon) <= MAX_GAP_M) segments.push([a, b]);
      else segments.push([a, a], [b, b]);
    }
  }
  segmentsCache = segments;
  return segments;
}

// Flat-earth distance in metres. Fine at these distances (< 100 km).
function distanceM(lat1, lon1, lat2, lon2) {
  const k = Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const dx = (lon2 - lon1) * M_PER_DEG * k;
  const dy = (lat2 - lat1) * M_PER_DEG;
  return Math.hypot(dx, dy);
}

// Nearest river line to (lat, lon).
// Returns { a, b, t, distM }: the two river points, how far along from a to b
// the closest spot is (0..1), and the distance in metres.
function nearestRiver(lat, lon) {
  const k = Math.cos(lat * Math.PI / 180);
  let best = null;
  for (const [a, b] of getSegments()) {
    // Work in metres relative to the tapped spot.
    const ax = (a.lon - lon) * M_PER_DEG * k, ay = (a.lat - lat) * M_PER_DEG;
    const bx = (b.lon - lon) * M_PER_DEG * k, by = (b.lat - lat) * M_PER_DEG;
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * vx + ay * vy) / len2));
    const d = Math.hypot(ax + t * vx, ay + t * vy);
    if (!best || d < best.distM) best = { a, b, t, distM: d };
  }
  return best;
}

module.exports = { nearestRiver, distanceM };
