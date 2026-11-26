import { useEffect, useRef, useState, useCallback } from 'react';
import { createMap, PK_BOUNDS, NOWSHERA, HOUSE_COLOR, LAYER_GROUPS } from './mapSetup.js';
import { LEVELS } from './levels.js';
import { hazards, worst } from './hazards.js';
import Icon from './components/Icon.jsx';
import Panel from './components/Panel.jsx';
import Sidebar from './components/Sidebar.jsx';

const getJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
};
const isDesktop = () => window.matchMedia('(min-width: 821px)').matches;
const SIDEBAR_W = 320;
const PANEL_W = 400;

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

// 2022 replay: how far the flood has spread on a given day, 0 (in its banks) to 1 (the 2022 peak).
// Only houses that REALLY flooded in 2022 (inside the UNOSAT flood map, `flooded_2022`) ever turn blue.
// They go lowest-first as the river climbs, so by the peak the map matches what really happened.
function floodShare(discharge, t) {
  const f = (discharge - t.p99) / (t.peak_2022 - t.p99);
  return Math.max(0, Math.min(1, f));
}

const pt = (c, props = {}) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: props });
const EMPTY = { type: 'FeatureCollection', features: [] };

export default function App() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const selectedRef = useRef(null);
  const housesRef = useRef(null);
  const pointsRef = useRef(null);
  const nationalLevels = useRef({});

  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [inPk, setInPk] = useState(true);
  const [pinLevel, setPinLevel] = useState(null);
  const [result, setResult] = useState(null);
  const [hz, setHz] = useState(null); // rain + hills + chances for the checked spot
  const [toast, setToast] = useState(null);

  const [sideOpen, setSideOpen] = useState(isDesktop);
  const [mode, setMode] = useState('now');
  const [lang, setLangState] = useState(() => store.get('sailaab.lang') ?? 'ur');
  const [demo, setDemo] = useState(() => new URLSearchParams(location.search).get('demo') !== '0');
  const [layers, setLayers] = useState({ rivers: true, points: true, flood2022: false, houses: true, provinces: true });
  const [home, setHomeState] = useState(() => store.get('sailaab.home'));
  const [homeRisk, setHomeRisk] = useState(null);

  const [replay, setReplay] = useState(null);
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [underwater, setUnderwater] = useState(0);

  const q = demo || mode === 'past' ? '&demo=1' : '';
  const today = q ? '2022-08-25' : new Date().toISOString().slice(0, 10);
  const setLang = (l) => { setLangState(l); store.set('sailaab.lang', l); };
  const say = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  // ---------- map ----------
  useEffect(() => {
    setReady(false); // a fresh map is not ready yet (matters on hot reload)
    const map = createMap(mapEl.current);
    mapRef.current = map;
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
      const [points, rivers, houses, flood] = await Promise.all([
        getJson('/data/national_points.geojson'),
        getJson('/data/rivers.geojson'),
        getJson('/data/houses.geojson'),
        getJson('/data/flood2022.geojson'),
      ]);
      if (off) return;
      map.getSource('rivers')?.setData(rivers);
      map.getSource('flood2022')?.setData(flood);
      housesRef.current = houses;
      pointsRef.current = points;
      map.getSource('houses')?.setData(houses);

      try {
        const nat = await getJson(`/api/national?x=1${q}`);
        nationalLevels.current = Object.fromEntries(nat.points.map((p) => [p.id, p.level]));
      } catch { say('Risk server is offline'); }
      if (off) return;
      for (const f of points.features) f.properties.level = nationalLevels.current[f.properties.id] ?? null;
      map.getSource('national')?.setData(points);

      // TODO(Part C): one call per house is fine for the mock; real data needs a batch endpoint.
      if (houses.features.length <= 400) {
        const res = await Promise.allSettled(houses.features.map((f) => getJson(`/api/house?id=${f.properties.id}${q}`)));
        if (off) return;
        res.forEach((r, i) => { if (r.status === 'fulfilled') houses.features[i].properties.level = r.value.level; });
        map.getSource('houses')?.setData(houses);
      }
    })().catch((e) => console.warn('data', e));
    return () => { off = true; };
  }, [ready, q]);

  // ---------- layers on/off ----------
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    for (const [key, ids] of Object.entries(LAYER_GROUPS)) {
      for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', layers[key] ? 'visible' : 'none');
    }
    if (mode !== 'past') map.setPaintProperty('flood2022', 'fill-opacity', layers.flood2022 ? 0.28 : 0);
  }, [ready, layers, mode]);

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
    if (mode !== 'past' || replay) return;
    getJson('/api/replay').then((r) => {
      setReplay(r);
      // start a few days before the river leaves its banks
      const first = r.days.findIndex((d) => d.level === 'warning');
      setDay(Math.max(0, first - 4));
    }).catch(() => say('Could not load the 2022 data'));
  }, [mode, replay]);

  useEffect(() => {
    if (!playing || !replay) return;
    const t = setInterval(() => setDay((d) => {
      if (d >= replay.days.length - 1) { setPlaying(false); return d; }
      return d + 1;
    }), 260);
    return () => clearInterval(t);
  }, [playing, replay]);

  // Paint the map for the replay day (or put it back to normal).
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const houses = housesRef.current;
    if (mode !== 'past' || !replay || !houses) {
      map.setPaintProperty('houses', 'fill-color', HOUSE_COLOR.risk);
      for (const f of houses?.features ?? []) map.setFeatureState({ source: 'houses', id: f.properties.id }, { flooded: false });
      if (pointsRef.current) {
        for (const f of pointsRef.current.features) f.properties.level = nationalLevels.current[f.properties.id] ?? null;
        map.getSource('national')?.setData(pointsRef.current);
      }
      return;
    }
    const d = replay.days[day];
    const share = floodShare(d.discharge, replay.thresholds);
    const wetHouses = houses.features.filter((f) => f.properties.flooded_2022);
    const maxH = Math.max(0.5, ...wetHouses.map((f) => f.properties.height_above_river_m ?? 0));
    let n = 0;
    map.setPaintProperty('houses', 'fill-color', HOUSE_COLOR.replay);
    for (const f of houses.features) {
      const wet = share > 0 && !!f.properties.flooded_2022 && (f.properties.height_above_river_m ?? 0) <= share * maxH;
      if (wet) n++;
      map.setFeatureState({ source: 'houses', id: f.properties.id }, { flooded: wet });
    }
    setUnderwater(n);
    // the 2022 flood area fades in once the river passes the danger line
    const dangerLine = replay.thresholds.peak_2022 * 0.9;
    map.setPaintProperty('flood2022', 'fill-opacity', layers.flood2022 || d.discharge >= dangerLine ? 0.32 : 0);
    if (pointsRef.current) {
      for (const f of pointsRef.current.features) f.properties.level = f.properties.id === replay.point ? d.level : null;
      map.getSource('national')?.setData(pointsRef.current);
    }
  }, [ready, mode, replay, day, layers.flood2022]);

  // ---------- keep the map centre clear of the sidebar + panel ----------
  const sbW = sideOpen && isDesktop() ? SIDEBAR_W + 16 : 0;
  const pnW = result && isDesktop() ? PANEL_W + 16 : 0;
  useEffect(() => {
    mapRef.current?.easeTo({ padding: { left: sbW, right: pnW, top: 0, bottom: 0 }, duration: 400 });
  }, [sbW, pnW]);

  // ---------- the one main action: is the spot under the pin safe? ----------
  const check = useCallback(async () => {
    const map = mapRef.current;
    const c = map.getCenter();
    const house = map.getZoom() >= 13 ? map.queryRenderedFeatures(map.project(c), { layers: ['houses'] })[0] : null;

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
  }, [q]);

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
  const allPakistan = () => { setPinLevel(null); mapRef.current.fitBounds(PK_BOUNDS, { padding: 40, duration: 1500 }); };
  const goNowshera = () => { setPinLevel(null); mapRef.current.flyTo({ ...NOWSHERA, duration: 3500 }); };

  const closePanel = () => {
    setResult(null);
    setPinLevel(null);
    mapRef.current.getSource('checked')?.setData(EMPTY);
    if (selectedRef.current) mapRef.current.setFeatureState({ source: 'houses', id: selectedRef.current }, { selected: false });
    selectedRef.current = null;
  };

  const changeMode = (m) => {
    setMode(m);
    setPlaying(false);
    closePanel();
    if (m === 'past') goNowshera();
  };

  const pinColor = !inPk ? '#A3ADBF' : pinLevel ? LEVELS[pinLevel].color : 'var(--cobalt)';
  const checkLabel = 'Safe here?';
  const checkUr = 'کیا یہاں محفوظ ہے؟';

  return (
    <div className="app" style={{ '--sb': `${sbW}px`, '--pn': `${pnW}px` }}>
      <div ref={mapEl} className="map" />

      <Sidebar
        open={sideOpen} setOpen={setSideOpen}
        mode={mode} setMode={changeMode}
        layers={layers} toggleLayer={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))}
        home={home} homeLevel={homeRisk?.level} setHome={saveHome} clearHome={clearHome} goHome={goHome}
        lang={lang} setLang={setLang} demo={demo} setDemo={setDemo}
        replayProps={{ replay, day, setDay, playing, setPlaying, underwater, totalHouses: housesRef.current?.features.length ?? 0 }}
      />

      {!sideOpen && (
        <button className="menu-btn" onClick={() => setSideOpen(true)} aria-label="Open menu">
          <Icon name="menu" size={18} />
          <span className="brand-mark">سیلاب</span>
          <span className="brand-name">Sailaab</span>
        </button>
      )}

      {/* the pin that points where you're looking */}
      {mode !== "past" && <div className={`pin ${moving ? "lifted" : ""}`} style={{ "--pin": pinColor }}>
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
      {mode !== 'past' && (
        <button className={`check ${inPk ? '' : 'off'}`} onClick={check} disabled={!ready || !inPk || moving}>
          <span className="check-icon"><Icon name={!inPk ? 'x' : 'drop'} size={22} /></span>
          <span className="check-text">
            <b>{inPk ? checkLabel : 'Outside Pakistan'}</b>
            <small className="font-nastaliq">{inPk ? checkUr : 'پاکستان سے باہر'}</small>
          </span>
        </button>
      )}

      {toast && <div className="toast">{toast}</div>}

      {result && <Panel result={result} hz={hz} lang={lang} setLang={setLang} today={today} onClose={closePanel} />}
    </div>
  );
}
