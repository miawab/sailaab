// Shared bits every endpoint uses: reading the query, sending JSON,
// demo mode, and building a 7-day forecast with a level per day.
const { getPoints } = require('./data');
const { getDischarge } = require('./openmeteo');
const { riverLevel, riverSeverity, LEVELS } = require('./risk');

// Demo mode (?demo=1) pretends today is 25 Aug 2022, just before the
// Kabul River peaked, so the "7-day forecast" is the real 25-31 Aug 2022.
const DEMO_TODAY = '2022-08-25';

function query(req) {
  if (req.query) return req.query;
  return Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}

function isDemo(q) {
  return q.demo === '1' || q.demo === 'true';
}

function send(res, status, body, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (status === 200 && cacheSeconds && !body.stale) {
    // Vercel's CDN keeps the answer for cacheSeconds; serves the old one while refreshing.
    res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`);
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.end(JSON.stringify(body));
}

// Finds a forecast point or sends a 404. Returns null if it sent an error.
function findPoint(res, id) {
  const points = getPoints();
  if (!id) {
    send(res, 400, { error: 'Give a point, e.g. ?point=kabul_nowshera' });
    return null;
  }
  const point = points[id];
  if (!point) {
    send(res, 404, { error: `Unknown point "${id}"`, known_points: Object.keys(points).slice(0, 20) });
    return null;
  }
  return point;
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Which dates "the next 7 days" means: real forecast, or 25-31 Aug 2022 in demo mode.
function forecastWindow(demo) {
  return demo ? { start: DEMO_TODAY, end: addDays(DEMO_TODAY, 6) } : { forecastDays: 7 };
}

// Gives each day a level and severity, and picks the worst day
// (the one with the highest discharge).
function rateDays(days, point) {
  if (!days.length) throw new Error('No river data for these dates');
  const rated = days.map((d) => ({
    date: d.date,
    discharge: Math.round(d.discharge * 10) / 10,
    level: riverLevel(d.discharge, point),
    severity: riverSeverity(d.discharge, point),
  }));
  const worst = rated.reduce((a, b) => (b.discharge > a.discharge ? b : a));
  return { days: rated, worst };
}

// 7 rated days for one point.
async function sevenDayForecast(point, demo) {
  const { days, stale } = await getDischarge(point, forecastWindow(demo));
  return { ...rateDays(days, point), stale };
}

function updatedStamp(demo) {
  if (demo) return `${DEMO_TODAY}T06:00Z`;
  return new Date().toISOString().slice(0, 16) + 'Z';
}

// Wraps a handler so any crash becomes a clean JSON error, not a blank 500.
function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res, query(req));
    } catch (err) {
      console.error(err);
      send(res, 502, { error: 'Could not get river data right now', detail: String(err.message || err) });
    }
  };
}

module.exports = { send, isDemo, findPoint, sevenDayForecast, forecastWindow, rateDays, updatedStamp, handler, DEMO_TODAY, LEVELS };
