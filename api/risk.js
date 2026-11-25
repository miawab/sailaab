// GET /api/risk?lat=34.02&lon=71.97[&demo=1]
// Risk for ANY spot in Pakistan (not just the showcase houses):
//  1. find the nearest river (line between two national river points)
//  2. that river's 7-day forecast -> severity per day
//  3. ground height at the spot minus the river's height there -> exposure
//  4. score = severity x exposure x 100, same as houses
const { send, isDemo, sevenDayForecast, handler } = require('./_lib/common');
const { nearestRiver } = require('./_lib/geo');
const { getElevations } = require('./_lib/openmeteo');
const {
  MAX_RIVER_DIST_M, spotExposure, scoreDays, heightReason, distanceReason, forecastReason, riverName,
} = require('./_lib/risk');

const PAKISTAN = { west: 60.8, south: 23.6, east: 77.9, north: 37.1 };

module.exports = handler(async (req, res, q) => {
  if (q.lat == null || q.lat === '' || q.lon == null || q.lon === '') {
    return send(res, 400, { error: 'Give lat and lon, e.g. /api/risk?lat=34.02&lon=71.97' });
  }
  const lat = Number(q.lat), lon = Number(q.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return send(res, 400, { error: 'lat and lon must be numbers' });
  }
  if (lon < PAKISTAN.west || lon > PAKISTAN.east || lat < PAKISTAN.south || lat > PAKISTAN.north) {
    return send(res, 400, { error: 'That spot is outside Pakistan' });
  }
  const demo = isDemo(q);

  // 1. Nearest river. Use the forecast of whichever end of the line is closer.
  const near = nearestRiver(lat, lon);
  if (!near) return send(res, 503, { error: 'River points not loaded yet' });
  const { a, b, t, distM } = near;
  const point = t <= 0.5 ? a : b;
  const river = riverName(point);
  const far = distM > MAX_RIVER_DIST_M;

  // Too far from any major river: safe, no need to ask Open-Meteo anything.
  if (far) {
    const body = {
      level: 'safe',
      score: 0,
      river,
      dist_to_river_m: Math.round(distM),
      reasons: [
        distanceReason(distM, river),
        'Too far from a major river for river flooding to reach',
        'Sailaab covers river floods, not rain or flash floods',
      ],
      alert_key: 'safe',
      peak_date: null,
      first_date: null,
      height_above_river_m: null,
      point: point.id,
      days: [],
    };
    if (demo) body.demo = true;
    return send(res, 200, body, 3600);
  }

  // 2 + 3 at the same time: river forecast, and ground heights (spot + both
  // ends of the river line). If the Elevation API fails we carry on with
  // distance only.
  const [forecast, height] = await Promise.all([
    sevenDayForecast(point, demo),
    getElevations([[lat, lon], [a.lat, a.lon], [b.lat, b.lon]])
      .then(([spotE, aE, bE]) => {
        // River height at the closest spot = blend of the two ends' heights.
        // Below 0 is terrain-data noise or downstream land: call it river level.
        return Math.max(0, Math.round(spotE - (aE + t * (bE - aE))));
      })
      .catch((err) => { console.error('elevation failed:', err.message); return null; }),
  ]);

  // 4. Score each day.
  const rated = scoreDays(forecast.days, spotExposure(height, distM));

  const reasons = [
    height !== null ? heightReason(height) : 'Ground height not available right now',
    distanceReason(distM, river),
    forecastReason(forecast.worst.level, forecast.worst.date, river),
  ];

  const body = {
    level: rated.level,
    score: rated.score,
    river,
    dist_to_river_m: Math.round(distM),
    reasons,
    alert_key: rated.level,
    peak_date: rated.peak_date,
    first_date: rated.first_date,
    height_above_river_m: height,
    point: point.id,
    days: rated.days,
  };
  if (forecast.stale) body.stale = true;
  if (demo) body.demo = true;
  send(res, 200, body, 3600);
});
