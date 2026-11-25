// GET /api/national[?demo=1]
// Worst level over the next 7 days for every river point in Pakistan,
// so the map can colour every river. 50 points per Open-Meteo request.
// level is null when we have no river data for a point (show it grey).
const { send, isDemo, forecastWindow, rateDays, updatedStamp, handler } = require('./_lib/common');
const { getNationalPoints } = require('./_lib/data');
const { getDischargeMany } = require('./_lib/openmeteo');
const { hasRiverData } = require('./_lib/risk');

const THREE_HOURS = 3 * 60 * 60;

module.exports = handler(async (req, res, q) => {
  const demo = isDemo(q);
  const points = getNationalPoints();
  const { results, stale } = await getDischargeMany(points, {
    ...forecastWindow(demo),
    ttlMs: THREE_HOURS * 1000,
  });

  const out = points.map((point, i) => {
    const r = results[i];
    if (!r || !hasRiverData(point)) return { id: point.id, level: null, worst_date: null, no_data: true };
    const { worst } = rateDays(r.days, point);
    return {
      id: point.id,
      level: worst.level,
      worst_date: worst.level === 'safe' ? null : worst.date,
      discharge: worst.discharge,
    };
  });

  const body = { updated: updatedStamp(demo), points: out };
  if (stale) body.stale = true;
  if (demo) body.demo = true;
  send(res, 200, body, THREE_HOURS);
});
