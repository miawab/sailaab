// GET /api/house?id=h_000123[&demo=1]
// Risk for one house: each forecast day's river severity x how exposed the house is.
const { send, isDemo, sevenDayForecast, handler } = require('./_lib/common');
const { getHouses, getPoints } = require('./_lib/data');
const { exposureOf, scoreDays, houseReasons, riverName } = require('./_lib/risk');

module.exports = handler(async (req, res, q) => {
  if (!q.id) return send(res, 400, { error: 'Give a house id, e.g. ?id=h_000001' });
  const house = getHouses()[q.id];
  if (!house) return send(res, 404, { error: `Unknown house "${q.id}"` });

  const point = getPoints()[house.river_point];
  if (!point) return send(res, 500, { error: `House ${house.id} points to unknown river point "${house.river_point}"` });
  const demo = isDemo(q);

  const { days, stale } = await sevenDayForecast(point, demo);

  // score = river severity (0..1) x house exposure (0..1) x 100, for each day
  const exposure = exposureOf(house);
  const rated = scoreDays(days, exposure);

  const body = {
    id: house.id,
    level: rated.level,
    score: rated.score,
    peak_date: rated.peak_date,   // the worst day
    first_date: rated.first_date, // first day it reaches that level (null if safe)
    reasons: houseReasons(house, riverName(point)),
    alert_key: rated.level,
    river: riverName(point),
    point: point.id,
    exposure: Math.round(exposure * 100) / 100,
    days: rated.days,             // per-day house level, for the 7-day chart
  };
  if (stale) body.stale = true;
  if (demo) body.demo = true;
  send(res, 200, body, 3600);
});
