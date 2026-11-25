// The risk engine. Pure maths, no network. Explained in api/README.md.

const LEVELS = ['safe', 'watch', 'warning', 'danger'];

// A point whose biggest days are under 10 m³/s isn't on a real river
// (GloFAS cell off the channel, or a dry desert wash), so we have no data for it.
const MIN_RIVER_FLOW = 10;

// More than 10 km from a major river = not exposed to river flooding
// (we don't cover rain or flash floods).
const MAX_RIVER_DIST_M = 10000;

const num = (x) => (x === null || x === undefined || x === '' ? NaN : Number(x));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// The four discharge lines (m³/s) for a point, cleaned up so they always go
// up in order even if a value is missing or odd.
//   watch   = p90  (top 10% of days since 1984)
//   warning = p99  (top 1% of days)
//   danger  = 90% of the 2022 peak, "almost as high as the 2022 disaster".
//             Not 100%: peak_2022 is the single highest day, so with 100% even
//             the 2022 replay could never reach danger. Always at least 10%
//             above p99 so there's a real warning band.
function thresholds(point) {
  const p90 = num(point.p90) || 0;
  const p99 = Math.max(num(point.p99) || 0, p90);
  const peak = num(point.peak_2022) || 0;
  const danger = Math.max(0.9 * peak, 1.1 * p99);
  return { p90, p99, danger, top: Math.max(peak, danger), noData: p99 < MIN_RIVER_FLOW };
}

function hasRiverData(point) {
  return !thresholds(point).noData;
}

// River level for one day's discharge at a point.
function riverLevel(discharge, point) {
  const t = thresholds(point);
  const q = num(discharge);
  if (t.noData || !Number.isFinite(q)) return 'safe';
  if (q >= t.danger) return 'danger';
  if (q >= t.p99) return 'warning';
  if (q >= t.p90) return 'watch';
  return 'safe';
}

// River severity 0..1, a smooth version of the level so houses get a score.
// Straight lines between: 0 m³/s -> 0, p90 -> 0.3, p99 -> 0.6, danger -> 0.9, 2022 peak -> 1
function riverSeverity(discharge, point) {
  const t = thresholds(point);
  const q = num(discharge);
  if (t.noData || !Number.isFinite(q) || q <= 0) return 0;
  const anchors = [[0, 0], [t.p90, 0.3], [t.p99, 0.6], [t.danger, 0.9], [t.top, 1]];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (q < x1) return x1 === x0 ? y1 : y0 + ((q - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1;
}

// House exposure 0..1. Part B's value if there is one, otherwise:
// 50% height above river (0 m = 1, 10 m+ = 0), 30% distance (0 m = 1,
// 2 km+ = 0), 20% flooded in 2022.
function exposureOf(house) {
  const given = num(house.exposure);
  if (Number.isFinite(given)) return clamp01(given);
  const hm = num(house.height_above_river_m);
  const dm = num(house.dist_to_river_m);
  const h = clamp01(1 - (Number.isFinite(hm) ? hm : 10) / 10);
  const d = clamp01(1 - (Number.isFinite(dm) ? dm : 2000) / 2000);
  return clamp01(0.5 * h + 0.3 * d + 0.2 * (house.flooded_2022 ? 1 : 0));
}

// Exposure for any spot in Pakistan (/api/risk). We don't know if it flooded
// in 2022, so we use only height (5/8) and distance (3/8), same scales as houses.
// If the ground height isn't available, distance alone.
function spotExposure(heightM, distM) {
  if (!(distM <= MAX_RIVER_DIST_M)) return 0;
  const d = clamp01(1 - distM / 2000);
  if (!Number.isFinite(heightM)) return d;
  const h = clamp01(1 - heightM / 10);
  return clamp01((0.5 * h + 0.3 * d) / 0.8);
}

// Score 0..100 -> level.
function scoreLevel(score) {
  if (score >= 75) return 'danger';
  if (score >= 50) return 'warning';
  if (score >= 25) return 'watch';
  return 'safe';
}

// Rates every forecast day for one house/spot: score = severity x exposure x 100.
// Returns the worst score and level, the day it peaks, and the FIRST day it
// reaches that level (for "DANGER in 2 days" on the card).
function scoreDays(ratedDays, exposure) {
  const days = ratedDays.map((d) => {
    const score = Math.round(d.severity * exposure * 100);
    return { date: d.date, discharge: d.discharge, river_level: d.level, score, level: scoreLevel(score) };
  });
  const peak = days.reduce((a, b) => (b.score > a.score ? b : a));
  const first = days.find((d) => d.level === peak.level);
  return {
    days,
    score: peak.score,
    level: peak.level,
    peak_date: peak.date,
    first_date: peak.level === 'safe' ? null : first.date,
  };
}

// ---- Plain-language reasons the judges and families will read ----
// Heights are rounded to whole metres: free terrain data isn't more accurate than that.
function heightReason(h) {
  const m = Math.round(h);
  if (m < 1) return 'At about the same level as the river';
  if (m < 3) return `Only about ${m} m above the river`;
  if (m < 8) return `About ${m} m above the river`;
  return `About ${m} m above the river, on higher ground`;
}

function distanceReason(d, riverName) {
  const m = Math.round(d / 10) * 10;
  const dist = m >= 1000 ? `${Math.round(d / 100) / 10} km` : `${m} m`;
  return `${dist} from the ${riverName}`;
}

function houseReasons(house, riverName) {
  const reasons = [];
  const h = num(house.height_above_river_m);
  const d = num(house.dist_to_river_m);
  if (Number.isFinite(h)) reasons.push(heightReason(h));
  if (Number.isFinite(d)) reasons.push(distanceReason(d, riverName));
  reasons.push(house.flooded_2022 ? 'Flooded in 2022' : 'Stayed dry in 2022');
  return reasons;
}

// "Kabul River expected to reach DANGER level on 27 Aug"
function forecastReason(level, date, riverName) {
  if (level === 'safe') return `${riverName} forecast to stay normal for the next 7 days`;
  const day = new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${riverName} expected to reach ${level.toUpperCase()} level on ${day}`;
}

// "Kabul River at Nowshera" -> "Kabul River"
function riverName(point) {
  return String(point.name || 'river').split(/ (at|near) /)[0];
}

module.exports = {
  LEVELS, MAX_RIVER_DIST_M, thresholds, hasRiverData, riverLevel, riverSeverity,
  exposureOf, spotExposure, scoreLevel, scoreDays,
  houseReasons, heightReason, distanceReason, forecastReason, riverName,
};
