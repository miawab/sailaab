import { useEffect, useRef, useState, useCallback } from 'react';
import { createMap, PK_BOUNDS, LAYER_GROUPS } from './mapSetup.js';
import { AREAS, RIVER_POINTS, severity, riskColor, replayColor, floodShare, thresholds } from './houseRisk.js';
import { LEVELS } from './levels.js';
import { hazards, worst } from './hazards.js';
import { airGrid, airSpot, AIR } from './air.js';
import AirPanel from './components/AirPanel.jsx';
import Icon from './components/Icon.jsx';
import Panel from './components/Panel.jsx';
import Sidebar from './components/Sidebar.jsx';
import DemoTour, { STEPS } from './components/DemoTour.jsx';
import Intro from './components/Intro.jsx';
import { LogoMark } from './components/Logo.jsx';

const getJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
};
const isDesktop = () => window.matchMedia('(min-width: 821px)').matches;
const SIDEBAR_W = 320;
const PANEL_W = 400;
const TOUR_W = 380;

// Small, safe wrappers around localStorage (it can be blocked in private windows).
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// Is [lng, lat] inside a Polygon / MultiPolygon? (ray casting)
function inside([x, y], geom) {
  if (!geom) return true;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polys.some(([outer, ...holes]) => {
    const hit = (ring) => {
      let c = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    return hit(outer) && !holes.some(hit);
  });
}

// 2022 replay: only houses that REALLY flooded in 2022 (inside the UNOSAT flood map) ever turn blue.
// They go lowest-first as the river climbs, so by the peak the map matches what really happened.
// For each point: the heights of its flooded houses, sorted, so we can count how many are under water.
function wetHeights(features) {
  const by = {};
  for (const f of features) if (f.properties.f) (by[f.properties.p] ??= []).push(f.properties.h);
  for (const k in by) by[k].sort((a, b) => a - b);
  return by;
}
const countUpTo = (sorted, x) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= x) lo = m + 1; else hi = m; } return lo; };
const inBox = ([x, y], [w, s, e, n], pad = 0.3) => x > w - pad && x < e + pad && y > s - pad && y < n + pad;

const pt = (c, props = {}) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: props });
const EMPTY = { type: 'FeatureCollection', features: [] };

export default function App() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const selectedRef = useRef(null);
  const housesRef = useRef({ type: 'FeatureCollection', features: [] }); // grows as areas load
  const loadedAreas = useRef({}); // area -> 'loading' | 'done'
  const wetRef = useRef({});
  const autoPlay = useRef(false); // the demo starts replays by itself
  const pointsRef = useRef(null);
  const nationalLevels = useRef({});

  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [inPk, setInPk] = useState(true);
  const [pinLevel, setPinLevel] = useState(null);
  const [result, setResult] = useState(null);
  const [hz, setHz] = useState(null);
  const airLoaded = useRef(false); // rain + hills + chances for the checked spot
  const [toast, setToast] = useState(null);

  const [sideOpen, setSideOpen] = useState(isDesktop);
  const [mode, setMode] = useState('now');
  const [lang, setLangState] = useState(() => store.get('sailaab.lang') ?? 'ur');
  // The guided demo (null = normal live app). ?demo=1 in the link opens it straight away.
  const [tour, setTour] = useState(() => (new URLSearchParams(location.search).get('demo') === '1' ? 0 : null));
  const [proofRiver, setProofRiver] = useState(null);
  // The welcome screen, once per visit (not when the link opens the demo directly)
  const [intro, setIntro] = useState(() => { try { return tour == null && !sessionStorage.getItem('sailaab.seen'); } catch { return true; } });
  const closeIntro = () => { setIntro(false); try { sessionStorage.setItem('sailaab.seen', '1'); } catch { /* ignore */ } };
  const [natCounts, setNatCounts] = useState(null);
  const [airCounts, setAirCounts] = useState(null);
  const [proofHouses, setProofHouses] = useState(null);
  const [layers, setLayers] = useState({ rivers: true, points: true, flood2022: false, houses: true, provinces: true });
  const [home, setHomeState] = useState(() => store.get('sailaab.home'));
  const [homeRisk, setHomeRisk] = useState(null);

  const [sev, setSev] = useState({}); // river point -> worst severity in the next 7 days
  const [housesTick, setHousesTick] = useState(0);
  const [area, setArea] = useState('nowshera');
  const [replay, setReplay] = useState(null); // { area, main, points: { id: replay data }, days, thresholds }
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [underwater, setUnderwater] = useState(0);

  const q = tour != null ? '&demo=1' : '';
  const today = q ? '2022-08-25' : new Date().toISOString().slice(0, 10);
  const setLang = (l) => { setLangState(l); store.set('sailaab.lang', l); };
  const say = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  // ---------- map ----------
  useEffect(() => {
    setReady(false); // a fresh map is not ready yet (matters on hot reload)
    const map = createMap(mapEl.current);
    mapRef.current = map;
    if (import.meta.env.DEV) window.sailaabMap = map; // for poking at it in the console
    const where = () => { const c = map.getCenter(); setInPk(inside([c.lng, c.lat], map.pakistan)); };
    map.on('sailaab:ready', () => { setReady(true); where(); });
    // Only a move by the person clears the last answer; panel/sidebar nudges don't.
    map.on('movestart', (e) => { if (e.originalEvent) { setMoving(true); setPinLevel(null); setTouched(true); } });
    map.on('moveend', () => { setMoving(false); where(); });
    return () => map.remove();
  }, []);

  // ---------- data ----------
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    let off = false;
    (async () => {
      const [points, rivers, flood] = await Promise.all([
        getJson('/data/national_points.geojson'),
        getJson('/data/rivers.geojson'),
        getJson('/data/flood2022.geojson'),
      ]);
      if (off) return;
      map.getSource('rivers')?.setData(rivers);
      map.getSource('flood2022')?.setData(flood);
      pointsRef.current = points;

      try {
        const nat = await getJson(`/api/national?x=1${q}`);
        nationalLevels.current = Object.fromEntries(nat.points.map((p) => [p.id, p.level]));
      } catch { say('Risk server is offline'); }
      if (off) return;
      for (const f of points.features) f.properties.level = nationalLevels.current[f.properties.id] ?? null;
      map.getSource('national')?.setData(points);
      const c = {};
      for (const l of Object.values(nationalLevels.current)) if (l) c[l] = (c[l] ?? 0) + 1;
      setNatCounts(c);

      // Houses: one forecast per river point, then the map colours every house itself.
      const ids = Object.keys(RIVER_POINTS);
      const res = await Promise.allSettled(ids.map((id) => getJson(`/api/forecast?point=${id}${q}`)));
      if (off) return;
      const s = {};
      res.forEach((r, i) => {
        if (r.status === 'fulfilled') s[ids[i]] = Math.max(...r.value.days.map((d) => severity(d.discharge, RIVER_POINTS[ids[i]])));
      });
      setSev(s);
    })().catch((e) => console.warn('data', e));
    return () => { off = true; };
  }, [ready, q]);

  // Houses load only near a showcase area (they're big), when you zoom in there or open its replay.
  const loadArea = useCallback(async (key) => {
    if (loadedAreas.current[key]) return;
    loadedAreas.current[key] = 'loading';
    try {
      const fc = await getJson(AREAS[key].file);
      housesRef.current.features.push(...fc.features);
      wetRef.current = wetHeights(housesRef.current.features);
      mapRef.current.getSource('houses')?.setData(housesRef.current);
      loadedAreas.current[key] = 'done';
      setHousesTick((t) => t + 1);
    } catch { loadedAreas.current[key] = null; }
  }, []);
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const near = () => {
      if (map.getZoom() < 9.5) return;
      const c = map.getCenter();
      for (const k in AREAS) if (inBox([c.lng, c.lat], AREAS[k].bbox)) loadArea(k);
    };
    near();
    map.on('moveend', near);
    return () => map.off('moveend', near);
  }, [ready, loadArea]);

  // ---------- layers on/off ----------
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    for (const [key, ids] of Object.entries(LAYER_GROUPS)) {
      for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', layers[key] ? 'visible' : 'none');
    }
    if (mode !== 'past') map.setPaintProperty('flood2022', 'fill-opacity', layers.flood2022 ? 0.28 : 0);
  }, [ready, layers, mode]);

  // ---------- air mode ----------
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const on = mode === 'air';
    map.setLayoutProperty('air', 'visibility', on ? 'visible' : 'none');
    for (const id of ['national', 'national-halo', 'houses', 'houses-edge', 'houses-line']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'none' : (id.startsWith('house') ? (layers.houses ? 'visible' : 'none') : (layers.points ? 'visible' : 'none')));
    }
    if (on && !airLoaded.current) {
      airLoaded.current = true;
      airGrid((p) => inside(p, map.pakistan)).then((g) => {
        map.getSource('air')?.setData(g);
        const c = {};
        for (const f of g.features) c[f.properties.level] = (c[f.properties.level] ?? 0) + 1;
        setAirCounts(c);
      }).catch(() => { airLoaded.current = false; say('Could not load air data'); });
    }
  }, [ready, mode, layers]);

  // ---------- home ----------
  useEffect(() => {
    if (!ready) return;
    mapRef.current.getSource('home')?.setData(home ? pt(home.c) : EMPTY);
    setHomeRisk(null);
    if (!home) return;
    getJson(`/api/risk?lat=${home.c[1].toFixed(5)}&lon=${home.c[0].toFixed(5)}${q}`).then(setHomeRisk).catch(() => {});
  }, [ready, home, q]);

  const saveHome = () => {
    const c = mapRef.current.getCenter();
    if (!inside([c.lng, c.lat], mapRef.current.pakistan)) return say('Move the pin inside Pakistan first');
    const h = { c: [c.lng, c.lat] };
    setHomeState(h); store.set('sailaab.home', h); say('Home saved');
  };
  const clearHome = () => { setHomeState(null); store.set('sailaab.home', null); };
  const goHome = () => { setPinLevel(null); mapRef.current.flyTo({ center: home.c, zoom: 14, duration: 2200 }); };

  // ---------- 2022 replay ----------
  useEffect(() => {
    if (mode !== 'past' || replay?.area === area) return;
    const A = AREAS[area];
    loadArea(area);
    Promise.all(A.points.map((id) => getJson(`/api/replay?point=${id}`))).then((rs) => {
      const points = Object.fromEntries(rs.map((r) => [r.point, r]));
      const main = points[A.main];
      // the peak, and the start of the rise that led to it (the unbroken run above Safe)
      const peak = main.days.reduce((b, x, i) => (x.discharge > main.days[b].discharge ? i : b), 0);
      let rise = peak;
      while (rise > 0 && main.days[rise - 1].level !== 'safe') rise--;
      setReplay({ area, main: A.main, points, days: main.days, thresholds: main.thresholds, peak });
      setDay(Math.max(0, rise - 3));
      if (autoPlay.current) setPlaying(true);
    }).catch(() => say('Could not load the 2022 data'));
  }, [mode, replay, area, loadArea]);

  useEffect(() => {
    if (!playing || !replay || replay.area !== area) return;
    // In the demo it stops on the peak day, so the flooded houses stay on screen. Play again to go on.
    const stopAt = autoPlay.current ? replay.peak : replay.days.length - 1;
    const t = setInterval(() => setDay((d) => {
      if (d >= replay.days.length - 1 || (d === stopAt && autoPlay.current)) {
        setPlaying(false);
        autoPlay.current = false;
        return d;
      }
      return d + 1;
    }), 380);
    return () => clearInterval(t);
  }, [playing, replay, area]);

  // Paint the map for the replay day (or put it back to normal).
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (mode !== 'past' || !replay) {
      map.setPaintProperty('houses', 'fill-color', riskColor(sev));
      map.setPaintProperty('houses-edge', 'line-color', riskColor(sev));
      if (pointsRef.current) {
        for (const f of pointsRef.current.features) f.properties.level = nationalLevels.current[f.properties.id] ?? null;
        map.getSource('national')?.setData(pointsRef.current);
      }
      return;
    }
    // how high the water stands today at each point, in "height above river" metres
    const cut = {};
    let n = 0;
    for (const [id, r] of Object.entries(replay.points)) {
      // that share of the really-flooded houses goes under, lowest first
      const wet = wetRef.current[id] ?? [];
      const share = floodShare(r.days[day]?.discharge ?? 0, RIVER_POINTS[id]);
      const k = Math.floor(share * wet.length);
      cut[id] = k > 0 ? wet[k - 1] : -1;
      n += countUpTo(wet, cut[id]);
    }
    map.setPaintProperty('houses', 'fill-color', replayColor(cut));
    map.setPaintProperty('houses-edge', 'line-color', replayColor(cut));
    setUnderwater(n);
    // the 2022 flood area fades in once the main river passes the danger line
    const d = replay.days[day];
    map.setPaintProperty('flood2022', 'fill-opacity', layers.flood2022 || d.discharge >= thresholds(RIVER_POINTS[replay.main]).danger ? 0.32 : 0);
    if (pointsRef.current) {
      for (const f of pointsRef.current.features) f.properties.level = f.properties.id === replay.main ? d.level : null;
      map.getSource('national')?.setData(pointsRef.current);
    }
  }, [ready, mode, replay, day, layers.flood2022, sev, housesTick]);

  // ---------- keep the map centre clear of the sidebar + panel ----------
  const desk = isDesktop();
  const sbW = desk ? (tour != null ? TOUR_W + 16 : sideOpen ? SIDEBAR_W + 16 : 0) : 0;
  const pnW = result && desk ? PANEL_W + 16 : 0;
  const pb = tour != null && !desk ? Math.round(window.innerHeight * 0.46) : 0;
  useEffect(() => {
    mapRef.current?.easeTo({ padding: { left: sbW, right: pnW, top: 0, bottom: pb }, duration: 400 });
  }, [sbW, pnW, pb]);

  // ---------- the demo tour: each step points the map somewhere ----------
  useEffect(() => {
    if (tour == null) return;
    const S = STEPS[tour];
    setMode(S.mode);
    if (S.area) setArea(S.area);
    autoPlay.current = S.key === 'dadu' || S.key === 'nowshera';
    setPlaying(autoPlay.current && replay?.area === (S.area ?? area));
    setLayers((l) => ({ ...l, flood2022: !!S.flood, houses: true, points: true }));
    const map = mapRef.current;
    if (!map) return;
    setPinLevel(null);
    if (S.view === 'pakistan') map.fitBounds(PK_BOUNDS, { padding: isDesktop() ? 40 : 16, duration: 1800 });
    else { loadArea(S.view); map.flyTo({ ...AREAS[S.view].view, duration: 2600 }); }
  }, [tour, ready, loadArea]);
  useEffect(() => {
    if (tour == null || proofRiver) return;
    getJson('/data/proof_kabul_nowshera.json').then(setProofRiver).catch(() => {});
    getJson('/data/proof_houses.json').then(setProofHouses).catch(() => {});
  }, [tour, proofRiver]);

  // ---------- the one main action: is the spot under the pin safe? ----------
  const check = useCallback(async () => {
    const map = mapRef.current;
    const c = map.getCenter();
    if (mode === 'air') {
      setResult({ kind: 'air', status: 'loading', coords: [c.lng, c.lat] });
      try {
        const air = await airSpot(c.lng, c.lat);
        setResult({ kind: 'air', status: 'ok', air, coords: [c.lng, c.lat] });
        setPinLevel(air.today.level);
      } catch { setResult({ kind: 'air', status: 'error', coords: [c.lng, c.lat] }); }
      return;
    }
    // the house under the pin, or the nearest one within a finger's width
    let house = null;
    if (map.getZoom() >= 13) {
      const p = map.project(c);
      const near = map.queryRenderedFeatures([[p.x - 16, p.y - 16], [p.x + 16, p.y + 16]], { layers: ['houses'] });
      const d = (f) => { const [x, y] = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0][0][0]; const q = map.project([x, y]); return (q.x - p.x) ** 2 + (q.y - p.y) ** 2; };
      house = near.sort((a, b) => d(a) - d(b))[0] ?? null;
    }

    if (selectedRef.current) map.setFeatureState({ source: 'houses', id: selectedRef.current }, { selected: false });
    selectedRef.current = house ? house.properties.id : null;
    if (house) map.setFeatureState({ source: 'houses', id: house.properties.id }, { selected: true });

    const kind = house ? 'house' : 'spot';
    const coords = [c.lng, c.lat];
    setHz(null);
    setResult({ kind, status: 'loading', coords });
    try {
      const data = house
        ? await getJson(`/api/house?id=${encodeURIComponent(house.properties.id)}${q}`)
        : await getJson(`/api/risk?lat=${c.lat.toFixed(5)}&lon=${c.lng.toFixed(5)}${q}`);
      setResult({ kind, status: 'ok', data, coords });
      setPinLevel(data.level);
      // rain, hills and "% sure" (slower, from Open-Meteo): fill in when ready
      const points = Object.fromEntries((pointsRef.current?.features ?? []).map((f) => [f.properties.id,
        { ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }]));
      hazards({ lng: c.lng, lat: c.lat, river: data, points, demoDate: q ? '2022-08-25' : null })
        .then((h) => {
          setHz(h);
          const all = worst(data.level, h.rain.level, h.flash.level);
          setPinLevel(all);
          map.getSource('checked')?.setData(pt(coords, { level: all }));
        })
        .catch((e) => console.warn('hazards', e));
      map.getSource('checked')?.setData(pt(coords, { level: data.level }));
    } catch (e) {
      setResult({ kind, status: 'error', error: e.message, coords });
    }
  }, [q, mode]);

  const locate = () => {
    if (!navigator.geolocation) return say('Location is not available on this device');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const p = [coords.longitude, coords.latitude];
        mapRef.current.getSource('me')?.setData(pt(p));
        setPinLevel(null);
        mapRef.current.flyTo({ center: p, zoom: 14, duration: 2200 });
      },
      () => say('Allow location to find your house'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const zoom = (d) => mapRef.current.easeTo({ zoom: mapRef.current.getZoom() + d, duration: 300 });
  const allPakistan = () => { setPinLevel(null); mapRef.current.fitBounds(PK_BOUNDS, { padding: isDesktop() ? 40 : 16, duration: 1500 }); };

  const closePanel = () => {
    setResult(null);
    setPinLevel(null);
    mapRef.current.getSource('checked')?.setData(EMPTY);
    if (selectedRef.current) mapRef.current.setFeatureState({ source: 'houses', id: selectedRef.current }, { selected: false });
    selectedRef.current = null;
  };

  const startTour = () => { closePanel(); setSideOpen(false); setTour(0); };
  const exitTour = () => {
    closePanel(); setTour(null); setPlaying(false); setMode('now');
    setLayers((l) => ({ ...l, flood2022: false }));
    if (isDesktop()) setSideOpen(true);
    allPakistan();
  };
  const goStep = (i) => { if (i < 0 || i >= STEPS.length) return; closePanel(); setTour(i); };

  const changeMode = (m) => {
    setMode(m);
    setPlaying(false);
    closePanel();
    if (m === 'air') allPakistan();
  };

  const pinColor = !inPk ? '#A3ADBF' : pinLevel ? LEVELS[pinLevel].color : 'var(--cobalt)';
  const checkLabel = mode === 'air' ? 'Air here?' : 'Safe here?';
  const checkUr = mode === 'air' ? 'یہاں ہوا کیسی ہے؟' : 'کیا یہاں محفوظ ہے؟';

  return (
    <div className={`app ${tour != null ? "touring" : ""}`} style={{ '--sb': `${sbW}px`, '--pn': `${pnW}px` }}>
      <div ref={mapEl} className="map" />

      <Sidebar
        open={sideOpen && tour == null} setOpen={setSideOpen}
        mode={mode} setMode={changeMode}
        layers={layers} toggleLayer={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))}
        home={home} homeLevel={homeRisk?.level} setHome={saveHome} clearHome={clearHome} goHome={goHome}
        lang={lang} setLang={setLang} startTour={startTour}
        summary={mode === 'air'
          ? airCounts && { title: 'Air today', when: 'PM2.5', unit: 'places checked', counts: airCounts, labels: Object.fromEntries(Object.entries(AIR).map(([k, v]) => [k, v.label])) }
          : natCounts && { title: 'Rivers, next 7 days', when: q ? '25 Aug 2022' : 'Live', unit: 'river points', counts: natCounts, labels: Object.fromEntries(Object.entries(LEVELS).map(([k, v]) => [k, v.label])) }}
      />

      {intro && tour == null && <Intro onOpen={closeIntro} onDemo={() => { closeIntro(); startTour(); }} />}

      {tour != null && (
        <DemoTour
          step={tour} go={goStep} onExit={exitTour} onCheck={check}
          proofRiver={proofRiver} proofHouses={proofHouses} lang={lang} setLang={setLang}
          replayProps={{ replay: replay?.area === area ? replay : null, day, setDay, playing, setPlaying, underwater,
            totalHouses: housesRef.current.features.filter((f) => AREAS[area].points.includes(f.properties.p)).length }}
        />
      )}

      {!sideOpen && tour == null && (
        <button className="menu-btn" onClick={() => setSideOpen(true)} aria-label="Open menu">
          <LogoMark size={30} />
          <span className="brand-name">Khabardar</span>
          <Icon name="menu" size={18} />
        </button>
      )}

      {/* the pin that points where you're looking */}
      {mode !== "past" && (tour == null || ["what", "house"].includes(STEPS[tour].key)) && <div className={`pin ${moving ? "lifted" : ""}`} style={{ "--pin": pinColor }}>
        <div className="pin-head">
          {!inPk ? <Icon name="x" size={18} stroke={2.6} />
            : pinLevel ? <Icon name={LEVELS[pinLevel].icon} size={18} stroke={2.4} />
            : <span className="pin-dot" />}
        </div>
        <div className="pin-stem" />
        <div className="pin-shadow" />
        {!touched && !result && <div className="pin-hint">Move the map to any place</div>}
      </div>}

      {/* map controls */}
      <div className="controls">
        <button className="ctl" onClick={locate} title="My location" aria-label="My location"><Icon name="locate" /></button>
        <div className="ctl-group">
          <button className="ctl" onClick={() => zoom(1)} aria-label="Zoom in"><Icon name="plus" /></button>
          <button className="ctl" onClick={() => zoom(-1)} aria-label="Zoom out"><Icon name="minus" /></button>
        </div>
        <button className="ctl" onClick={allPakistan} title="All of Pakistan" aria-label="All of Pakistan"><Icon name="fit" /></button>
      </div>

      {/* the main button */}
      {mode !== 'past' && (tour == null || (desk && ['what', 'house'].includes(STEPS[tour].key))) && (
        <button className={`check ${inPk ? '' : 'off'}`} onClick={check} disabled={!ready || !inPk || moving}>
          <span className="check-icon"><Icon name={!inPk ? 'x' : mode === 'air' ? 'wind' : 'drop'} size={22} /></span>
          <span className="check-text">
            <b>{inPk ? checkLabel : 'Outside Pakistan'}</b>
            <small className="font-ur">{inPk ? checkUr : 'پاکستان سے باہر'}</small>
          </span>
        </button>
      )}

      {toast && <div className="toast">{toast}</div>}

      {result && (result.kind === 'air'
        ? <AirPanel result={result} onClose={closePanel} />
        : <Panel result={result} hz={hz} lang={lang} setLang={setLang} today={today} onClose={closePanel} />)}
    </div>
  );
}
