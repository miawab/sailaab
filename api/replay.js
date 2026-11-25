// GET /api/replay?point=kabul_nowshera
// The real river during the 2022 flood (1 Aug - 15 Sep 2022), one entry per
// day with its level. The web app colours houses from this day by day.
const { send, findPoint, handler } = require('./_lib/common');
const { getDischarge } = require('./_lib/openmeteo');
const { riverLevel } = require('./_lib/risk');

module.exports = handler(async (req, res, q) => {
  const point = findPoint(res, q.point || 'kabul_nowshera');
  if (!point) return;

  const { days, stale } = await getDischarge(point, { start: '2022-08-01', end: '2022-09-15' });

  const body = {
    point: point.id,
    thresholds: { p90: point.p90, p99: point.p99, peak_2022: point.peak_2022 },
    days: days.map((d) => ({
      date: d.date,
      discharge: Math.round(d.discharge * 10) / 10,
      level: riverLevel(d.discharge, point),
    })),
  };
  if (stale) body.stale = true;
  // History never changes, so the CDN can keep this for a day.
  send(res, 200, body, 86400);
});
