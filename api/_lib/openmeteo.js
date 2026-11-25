// Talks to the free Open-Meteo APIs (no key needed).
// Flood API = GloFAS river discharge. Elevation API = ground height.
// - Caches good answers in memory (1 hour by default).
// - If Open-Meteo is down or sends junk, returns the last good answer with stale = true.
// - If there's no cached answer either, uses snapshot_2022.json (saved copy
//   of Aug-Sep 2022 for the showcase point) so the stage demo never breaks.
const FLOOD_URL = 'https://flood-api.open-meteo.com/v1/flood';
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';
const HOUR = 60 * 60 * 1000;
const TIMEOUT_MS = 5000;
const BATCH = 50;        // points per request, keeps the URL a sane length
const MAX_CACHE = 500;   // forget the oldest answers after this many

const cache = new Map();    // url -> { at, value }
const inFlight = new Map(); // url -> promise, so 5 identical requests make 1 call

let snapshot = {};
try { snapshot = require('./snapshot_2022.json'); } catch (_) { /* optional */ }

// Fetch JSON, check it with isValid, cache it. Falls back to the old cached
// answer (stale) if anything goes wrong.
async function cachedFetch(url, ttlMs, isValid) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return { value: hit.value, stale: false };

  if (!inFlight.has(url)) {
    const p = (async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
      const value = await res.json();
      if (!isValid(value)) throw new Error('Open-Meteo sent an unexpected reply');
      cache.delete(url);
      cache.set(url, { at: Date.now(), value });
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
      return value;
    })().finally(() => inFlight.delete(url));
    inFlight.set(url, p);
  }

  try {
    return { value: await inFlight.get(url), stale: false };
  } catch (err) {
    if (hit) return { value: hit.value, stale: true };
    throw err;
  }
}

const isFloodReply = (n) => (v) => {
  const list = Array.isArray(v) ? v : [v];
  return list.length === n && list.every((l) => l && l.daily && Array.isArray(l.daily.time));
};

// Daily river discharge (m³/s) for many points. Batches of 50 run in parallel.
// opts: { forecastDays: 7 }  or  { start: '2022-08-01', end: '2022-09-15' }
//       ttlMs (optional, default 1 hour)
// Returns { results: [{ days: [{ date, discharge }] } | null per point], stale }
// (null = Open-Meteo has no river at that spot)
async function getDischargeMany(points, opts) {
  const batches = [];
  for (let i = 0; i < points.length; i += BATCH) batches.push(points.slice(i, i + BATCH));

  const answers = await Promise.all(batches.map(async (batch) => {
    const params = new URLSearchParams({
      latitude: batch.map((p) => p.lat).join(','),
      longitude: batch.map((p) => p.lon).join(','),
      daily: 'river_discharge',
    });
    if (opts.start) {
      params.set('start_date', opts.start);
      params.set('end_date', opts.end);
    } else {
      params.set('forecast_days', String(opts.forecastDays || 7));
    }
    try {
      const r = await cachedFetch(`${FLOOD_URL}?${params}`, opts.ttlMs || HOUR, isFloodReply(batch.length));
      const list = Array.isArray(r.value) ? r.value : [r.value]; // 1 point = object, many = array
      // A point with no numbers in the reply still gets the saved 2022 copy if we have one.
      let stale = r.stale;
      const results = list.map((loc, i) => {
        const got = toDays(loc);
        if (got) return got;
        const saved = fromSnapshot(batch[i], opts);
        if (saved) stale = true;
        return saved ? { days: saved } : null;
      });
      return { results, stale };
    } catch (err) {
      // Nothing cached: fall back to the saved 2022 copy where we have one.
      // Points we have nothing for come back as null (no data), so one failed
      // batch doesn't blank the whole national map.
      const saved = batch.map((p) => fromSnapshot(p, opts));
      return {
        results: saved.map((s) => (s ? { days: s } : null)),
        stale: true,
        error: saved.every((s) => !s) ? err : null,
      };
    }
  }));

  // Only give up if every batch failed with nothing to fall back on.
  if (answers.every((a) => a.error)) throw answers[0].error;
  return {
    results: answers.flatMap((a) => a.results),
    stale: answers.some((a) => a.stale),
  };
}

// Same thing for one point. Returns { days, stale }.
async function getDischarge(point, opts) {
  const { results, stale } = await getDischargeMany([point], opts);
  if (!results[0]) throw new Error('Open-Meteo has no river data for this point');
  return { days: results[0].days, stale };
}

function toDays(loc) {
  const days = loc.daily.time
    .map((date, i) => ({ date, discharge: (loc.daily.river_discharge || [])[i] }))
    .filter((d) => typeof d.discharge === 'number' && Number.isFinite(d.discharge));
  return days.length ? { days } : null;
}

function fromSnapshot(point, opts) {
  if (!opts.start) return null;
  const days = snapshot[`${point.lat},${point.lon}`];
  if (!days) return null;
  const out = days.filter((d) => d.date >= opts.start && d.date <= opts.end);
  return out.length ? out : null;
}

// Ground height (m above sea level) for a list of [lat, lon] (max 100).
// Rounded to ~100 m, which is the terrain data's resolution anyway, so taps
// close together share a cache entry. Ground doesn't change: cache for a day.
async function getElevations(coords) {
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const params = new URLSearchParams({
    latitude: coords.map((c) => r3(c[0])).join(','),
    longitude: coords.map((c) => r3(c[1])).join(','),
  });
  const { value } = await cachedFetch(`${ELEVATION_URL}?${params}`, 24 * HOUR, (v) =>
    v && Array.isArray(v.elevation) && v.elevation.length === coords.length &&
    v.elevation.every((e) => typeof e === 'number' && Number.isFinite(e)));
  return value.elevation;
}

module.exports = { getDischarge, getDischargeMany, getElevations };
