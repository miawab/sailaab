// GET /api/forecast?point=kabul_nowshera[&demo=1]
// 7-day river forecast for one point, each day rated safe/watch/warning/danger.
const { send, isDemo, findPoint, sevenDayForecast, updatedStamp, handler } = require('./_lib/common');

module.exports = handler(async (req, res, q) => {
  const point = findPoint(res, q.point || 'kabul_nowshera');
  if (!point) return;
  const demo = isDemo(q);

  const { days, worst, stale } = await sevenDayForecast(point, demo);

  const body = {
    point: point.id,
    updated: updatedStamp(demo),
    days: days.map(({ date, discharge, level }) => ({ date, discharge, level })),
    worst: { date: worst.date, level: worst.level },
  };
  if (stale) body.stale = true;
  if (demo) body.demo = true;
  send(res, 200, body, 3600);
});
