// Rain flooding + flash floods for any spot, and "how sure" numbers for all three hazards.
// All free Open-Meteo APIs, called straight from the browser (no keys).
//
// River risk comes from Part C's API (GloFAS + house exposure). Here we add:
//  - chance: how many of GloFAS's ~50 forecast versions agree (live only; 2022 has no stored versions)
//  - rain flooding: heavy rain forecast x low ground x wet soil
//  - flash flood: heavy rain forecast x steep hills around the spot
// These two are rules of thumb, not a water simulation. Thresholds follow Pakistan Met Dept's
// heavy rain bands (50 / 100 / 150 mm in a day).

const RANK = { safe: 0, watch: 1, warning: 2, danger: 3 };
const LEVEL_OF = ['safe', 'watch', 'warning', 'danger'];
export const worst = (...ls) => LEVEL_OF[Math.max(...ls.filter(Boolean).map((l) => RANK[l]))];

const get = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(url); return r.json(); };
const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

// ---------- ground shape around the spot ----------
// Heights of the spot and 16 points on rings 1.5 km and 3 km out.
async function terrain(lng, lat) {
  const pts = [[lng, lat]];
  for (const r of [1.5, 3]) {
    for (let a = 0; a < 8; a++) {
      const t = (a * Math.PI) / 4;
      pts.push([lng + (r / (111 * Math.cos((lat * Math.PI) / 180))) * Math.cos(t), lat + (r / 111) * Math.sin(t)]);
    }
  }
  const j = await get(`https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p[1].toFixed(4)).join(',')}&longitude=${pts.map((p) => p[0].toFixed(4)).join(',')}`);
  const [h, ...ring] = j.elevation;
  const mean = ring.reduce((a, b) => a + b, 0) / ring.length;
  const range = Math.max(...ring, h) - Math.min(...ring, h);
  return {
    low: Math.max(0, Math.min(1, (mean - h) / 8)),      // 0 = not lower than around, 1 = 8 m+ lower (water collects)
    steep: Math.max(0, Math.min(1, (range - 60) / 400)), // 0 = flat, 1 = 460 m+ of relief within 3 km (hills)
  };
}

// ---------- rain ----------
// How bad is a rain series? Uses the wettest day and the wettest 3 days.
function rainFactor(daily) {
  let day = 0, three = 0, when = null;
  daily.forEach((v, i) => {
    const s = (daily[i] ?? 0) + (daily[i + 1] ?? 0) + (daily[i + 2] ?? 0);
    if ((v ?? 0) > day) { day = v ?? 0; when = when ?? null; }
    three = Math.max(three, s);
  });
  if (day >= 150 || three >= 250) return 1;
  if (day >= 100 || three >= 150) return 0.75;
  if (day >= 50 || three >= 100) return 0.5;
  if (day >= 25) return 0.25;
  return 0;
}
const levelOf = (score) => (score >= 0.75 ? 'danger' : score >= 0.5 ? 'warning' : score >= 0.25 ? 'watch' : 'safe');
const firstHeavy = (daily, dates) => { const i = daily.findIndex((v) => (v ?? 0) >= 25); return i < 0 ? null : dates[i]; };

function rainLevels(daily, t, wet) {
  const f = rainFactor(daily);
  const pond = levelOf(f * (0.55 + 0.35 * t.low + 0.1 * wet));
  const flash = t.steep < 0.15 ? 'safe' : levelOf(f * (0.5 + 0.5 * t.steep));
  return { pond, flash };
}

// ---------- river chance from the GloFAS ensemble ----------
function riverChance(ens, th, level) {
  const keys = Object.keys(ens.daily).filter((k) => k.startsWith('river_discharge_member'));
  const members = keys.map((k) => ens.daily[k]).filter((v) => v.some((x) => x != null));
  if (members.length < 10) return null;
  const danger = Math.max(0.9 * th.peak_2022, 1.1 * th.p99);
  const line = { safe: th.p90, watch: th.p90, warning: th.p99, danger }[level];
  const crosses = members.filter((m) => Math.max(...m.map((x) => x ?? 0)) >= line).length;
  const pct = level === 'safe' ? 1 - crosses / members.length : crosses / members.length;
  return Math.round(pct * 100);
}

// ---------- everything for one spot ----------
// river: Part C's answer ({ level, first_date, point }); points: national points by id (with thresholds)
export async function hazards({ lng, lat, river, points, demoDate }) {
  const live = !demoDate;
  const start = demoDate ?? new Date().toISOString().slice(0, 10);
  const end = addDays(start, 6);
  const where = `latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}`;

  const rainUrl = live
    ? `https://api.open-meteo.com/v1/forecast?${where}&daily=precipitation_sum&hourly=soil_moisture_0_to_7cm&forecast_days=7`
    : `https://historical-forecast-api.open-meteo.com/v1/forecast?${where}&daily=precipitation_sum&hourly=soil_moisture_0_to_7cm&start_date=${start}&end_date=${end}`;
  const th = river?.point ? points?.[river.point] : null;

  const [t, rain, rainEns, flowEns] = await Promise.all([
    terrain(lng, lat).catch(() => ({ low: 0, steep: 0 })),
    get(rainUrl),
    live ? get(`https://ensemble-api.open-meteo.com/v1/ensemble?${where}&daily=precipitation_sum&models=ecmwf_ifs025&forecast_days=7`).catch(() => null) : null,
    live && th ? get(`https://flood-api.open-meteo.com/v1/flood?latitude=${th.lat}&longitude=${th.lon}&daily=river_discharge&ensemble=true&forecast_days=7`).catch(() => null) : null,
  ]);

  const daily = rain.daily.precipitation_sum;
  const soil = (rain.hourly?.soil_moisture_0_to_7cm ?? []).filter((x) => x != null);
  const wet = soil.length ? Math.max(0, Math.min(1, (soil[0] - 0.15) / 0.25)) : 0; // 0.15 dry .. 0.40 soaked
  const { pond, flash } = rainLevels(daily, t, wet);
  const total = Math.round(daily.reduce((a, b) => a + (b ?? 0), 0));
  const maxDay = Math.round(Math.max(...daily.map((x) => x ?? 0)));
  const rainDate = firstHeavy(daily, rain.daily.time);

  // chance for rain: share of ECMWF's forecast versions that give the same level
  let pondChance = null, flashChance = null;
  if (rainEns) {
    const keys = Object.keys(rainEns.daily).filter((k) => k.startsWith('precipitation_sum_member'));
    const runs = keys.map((k) => rainLevels(rainEns.daily[k], t, wet));
    if (runs.length >= 10) {
      const agree = (key, lvl) => Math.round((runs.filter((r) => (lvl === 'safe' ? r[key] === 'safe' : RANK[r[key]] >= RANK[lvl])).length / runs.length) * 100);
      pondChance = agree('pond', pond);
      flashChance = agree('flash', flash);
    }
  }

  return {
    live,
    river: river ? { level: river.level, date: river.first_date, chance: flowEns && th ? riverChance(flowEns, th, river.level) : null } : null,
    rain: { level: pond, date: pond === 'safe' ? null : rainDate, chance: pondChance, mm: total, maxDay },
    flash: { level: flash, date: flash === 'safe' ? null : rainDate, chance: flashChance, hilly: t.steep >= 0.15 },
  };
}
