// Smog / air quality: PM2.5 forecast from the free Open-Meteo Air Quality API (Copernicus CAMS), no key.
// Levels use the daily average PM2.5 (µg/m³), roughly following the US EPA bands:
//   up to 35 clean, 35 to 55 moderate, 55 to 150 unhealthy, over 150 hazardous.

export const AIR = {
  safe:    { label: 'Clean' },
  watch:   { label: 'Moderate' },
  warning: { label: 'Unhealthy' },
  danger:  { label: 'Hazardous' },
};
export const airLevel = (pm) => (pm > 150 ? 'danger' : pm > 55 ? 'warning' : pm > 35 ? 'watch' : 'safe');

const BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// Daily averages from hourly values.
function daily(times, vals) {
  const by = {};
  times.forEach((t, i) => { if (vals[i] == null) return; const d = t.slice(0, 10); (by[d] ??= []).push(vals[i]); });
  return Object.entries(by).map(([date, v]) => ({ date, pm: v.reduce((a, b) => a + b, 0) / v.length }));
}

// A grid of points over Pakistan, for the map. `inside` filters to points within the border.
export async function airGrid(inside) {
  const pts = [];
  for (let lat = 24; lat <= 37; lat += 0.75) for (let lng = 61; lng <= 77.5; lng += 0.75) if (inside([lng, lat])) pts.push([lng, lat]);
  const out = [];
  for (let i = 0; i < pts.length; i += 100) {
    const chunk = pts.slice(i, i + 100);
    const url = `${BASE}?latitude=${chunk.map((p) => p[1]).join(',')}&longitude=${chunk.map((p) => p[0]).join(',')}&hourly=pm2_5&forecast_days=1&timezone=Asia%2FKarachi`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('air grid');
    let j = await r.json();
    if (!Array.isArray(j)) j = [j];
    j.forEach((x, k) => {
      const v = x.hourly.pm2_5.filter((a) => a != null);
      const pm = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      if (pm != null) out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: chunk[k] }, properties: { pm: Math.round(pm), level: airLevel(pm) } });
    });
  }
  return { type: 'FeatureCollection', features: out };
}

// Next 5 days for one spot.
export async function airSpot(lng, lat) {
  const r = await fetch(`${BASE}?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&hourly=pm2_5&forecast_days=5&timezone=Asia%2FKarachi`);
  if (!r.ok) throw new Error('air spot');
  const j = await r.json();
  const days = daily(j.hourly.time, j.hourly.pm2_5).map((d) => ({ ...d, pm: Math.round(d.pm), level: airLevel(d.pm) }));
  const today = days[0];
  const worstDay = days.reduce((a, b) => (b.pm > a.pm ? b : a), days[0]);
  return { today, worstDay, days };
}
