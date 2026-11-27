// The map: our own flat, top-down "Sailaab" style drawn from OpenStreetMap vector data.
// Pakistan is white, everything else fades out, water is sky blue. Detail appears as you zoom:
// big roads, then main roads, then streets, then buildings.
import maplibregl from 'maplibre-gl';
import { levelColorExpr } from './levels.js';

export const PK_BOUNDS = [[60.8, 23.6], [77.9, 37.1]];
export const NOWSHERA = { center: [71.982, 34.015], zoom: 15.5 };

// OpenFreeMap: free OpenStreetMap vector tiles + fonts, no key. We only borrow its data source and fonts.
const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

export const C = {
  outside: '#EEF2F8',
  land: '#FFFFFF',
  water: '#CFE7FF',
  river: '#4DB2FF',
  riverGlow: '#A9D8FF',
  road: '#E3E8F1',
  roadMain: '#D3DBE8',
  building: '#EDF1F7',
  green: '#F1F7F2',
  cobalt: '#2540F0',
  label: '#5A6478',
};

const z = (...stops) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops];
const EN = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']];

function sailaabStyle(base) {
  const src = Object.keys(base.sources).find((k) => base.sources[k].type === 'vector');
  const L = (id, type, layer, extra) => ({ id, type, source: src, 'source-layer': layer, ...extra });
  const cls = (list) => ['match', ['get', 'class'], list, true, false];
  return {
    version: 8,
    glyphs: base.glyphs,
    sprite: base.sprite,
    sources: { [src]: base.sources[src] },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': C.land } },
      L('green', 'fill', 'landcover', { minzoom: 9, filter: cls(['farmland', 'grass', 'wood', 'scrub']),
        paint: { 'fill-color': C.green, 'fill-opacity': z(9, 0, 11, 1) } }),
      L('water', 'fill', 'water', { paint: { 'fill-color': C.water } }),
      L('waterway', 'line', 'waterway', { minzoom: 8, layout: { 'line-cap': 'round' },
        paint: { 'line-color': C.river, 'line-width': z(8, 0.5, 13, 2, 18, 8), 'line-opacity': z(8, 0, 10, 0.8) } }),
      L('road-minor', 'line', 'transportation', { minzoom: 13, filter: cls(['minor', 'service', 'track']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.road, 'line-width': z(13, 0.6, 16, 5, 18, 14) } }),
      L('road-mid', 'line', 'transportation', { minzoom: 9, filter: cls(['secondary', 'tertiary']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.road, 'line-width': z(9, 0.5, 14, 3.5, 18, 18) } }),
      L('road-main', 'line', 'transportation', { minzoom: 6, filter: cls(['motorway', 'trunk', 'primary']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.roadMain, 'line-width': z(6, 0.5, 12, 2.5, 18, 22) } }),
      // province lines: faint dashes
      L('provinces', 'line', 'boundary', { minzoom: 4.5,
        filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': '#B9C3D6', 'line-width': z(5, 0.6, 10, 1.4), 'line-dasharray': [3, 3] } }),
      L('building', 'fill', 'building', { minzoom: 14,
        paint: { 'fill-color': C.building, 'fill-outline-color': '#E2E7EF', 'fill-opacity': z(14, 0, 15, 1) } }),
      // --- labels: few, small, quiet ---
      L('label-street', 'symbol', 'transportation_name', { minzoom: 15,
        layout: { 'symbol-placement': 'line', 'text-field': EN, 'text-font': FONT, 'text-size': 11 },
        paint: { 'text-color': '#8A93A6', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 } }),
      L('label-village', 'symbol', 'place', { minzoom: 11, filter: cls(['village', 'suburb', 'neighbourhood']),
        layout: { 'text-field': EN, 'text-font': FONT, 'text-size': 11.5 },
        paint: { 'text-color': '#7A8498', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 } }),
      L('label-town', 'symbol', 'place', { minzoom: 8, filter: cls(['town']),
        layout: { 'text-field': EN, 'text-font': FONT, 'text-size': z(8, 11, 13, 14) },
        paint: { 'text-color': C.label, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 } }),
      L('label-city', 'symbol', 'place', { minzoom: 5, filter: cls(['city']),
        layout: { 'text-field': EN, 'text-font': FONT_BOLD, 'text-size': z(5, 11, 10, 15),
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] },
        paint: { 'text-color': '#3B4458', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.8 } }),
    ],
  };
}

export function createMap(container) {
  const map = new maplibregl.Map({
    container,
    style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': C.outside } }] },
    bounds: PK_BOUNDS,
    fitBoundsOptions: { padding: window.innerWidth < 600 ? 16 : 40 },
    minZoom: 3, // low enough for all of Pakistan to fit on a phone
    maxZoom: 18,
    // Keep people near Pakistan, with plenty of room to pan sideways at every zoom.
    maxBounds: [[35, 5], [105, 50]],
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: { compact: true },
    // Speed: sharp but not 3x pixels on phones, and no label fade-in on every move.
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    fadeDuration: 0,
  });
  map.touchZoomRotate.disableRotation();
  map.setStyle(BASE_STYLE, { transformStyle: (_prev, next) => sailaabStyle(next) });
  map.on('style.load', () => { if (map.getLayer('land') && !map.getSource('houses')) addLayers(map); });
  return map;
}

// Everything outside Pakistan gets a pale veil.
function maskOutside(pk) {
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  const holes = [];
  for (const f of pk.features) {
    const g = f.geometry;
    for (const p of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) holes.push(p[0]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] } };
}


// Which map layers each switch in the sidebar controls.
export const LAYER_GROUPS = {
  rivers: ['pk-rivers-glow', 'pk-rivers', 'pk-river-names', 'rivers-glow', 'rivers', 'waterway'],
  points: ['national-halo', 'national'],
  flood2022: ['flood2022'],
  houses: ['houses', 'houses-line'],
  provinces: ['provinces'],
};

async function addLayers(map) {
  const empty = { type: 'FeatureCollection', features: [] };
  const firstLabel = 'label-street';

  // 2022 flood area (real, from UNOSAT via Part B). Hidden until the 2022 mode or the layer switch shows it.
  map.addSource('flood2022', { type: 'geojson', data: empty });
  map.addLayer({ id: 'flood2022', type: 'fill', source: 'flood2022',
    paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0, 'fill-opacity-transition': { duration: 600 } } }, firstLabel);

  // Showcase district houses: flat footprints coloured by risk (or by water in the 2022 replay).
  map.addSource('houses', { type: 'geojson', data: empty, promoteId: 'id' });
  map.addLayer({ id: 'houses', type: 'fill', source: 'houses', minzoom: 12,
    paint: { 'fill-color': '#94A3B8', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.82] } }, firstLabel);
  map.addLayer({ id: 'houses-line', type: 'line', source: 'houses', minzoom: 14,
    paint: { 'line-color': '#FFFFFF', 'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1] } }, firstLabel);

  // Smog: soft blobs of colour from the air-quality grid (Air mode only). The Pakistan fade sits on top.
  map.addSource('air', { type: 'geojson', data: empty });
  map.addLayer({ id: 'air', type: 'circle', source: 'air', layout: { visibility: 'none' },
    paint: { 'circle-color': levelColorExpr(), 'circle-radius': z(4, 30, 7, 110, 9, 260), 'circle-blur': 1, 'circle-opacity': 0.32 }, maxzoom: 10 }, firstLabel);

  // Showcase rivers (detailed lines from Part B).
  map.addSource('rivers', { type: 'geojson', data: empty });
  map.addLayer({ id: 'rivers-glow', type: 'line', source: 'rivers', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': C.riverGlow, 'line-width': z(8, 6, 16, 40), 'line-opacity': 0.5 } }, 'houses');
  map.addLayer({ id: 'rivers', type: 'line', source: 'rivers', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': C.river, 'line-width': z(8, 1.5, 16, 6) } }, 'houses');

  try {
    const [pk, pkLight, rivers] = await Promise.all([
      fetch('/geo/pakistan.geojson').then((r) => r.json()),
      fetch('/geo/pakistan_simple.geojson').then((r) => r.json()), // 1/3 the corners, for fast inside tests
      fetch('/geo/rivers_pk.geojson').then((r) => r.json()),
    ]);
    const MAJOR = ['Indus', 'Jhelum', 'Chenab', 'Ravi', 'Sutlej', 'Beas'];
    rivers.features = rivers.features.filter((f) => MAJOR.includes(f.properties.name));

    map.addSource('pk-rivers', { type: 'geojson', data: rivers });
    map.addLayer({ id: 'pk-rivers-glow', type: 'line', source: 'pk-rivers', maxzoom: 11, layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.riverGlow, 'line-width': z(4, 5, 10, 16), 'line-opacity': 0.55 } }, 'rivers-glow');
    map.addLayer({ id: 'pk-rivers', type: 'line', source: 'pk-rivers', maxzoom: 11, layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.river, 'line-width': z(4, 1.4, 10, 3), 'line-opacity': z(9, 1, 11, 0) } }, 'rivers-glow');

    map.addSource('pk-mask', { type: 'geojson', data: maskOutside(pk) });
    map.addLayer({ id: 'pk-mask', type: 'fill', source: 'pk-mask', paint: { 'fill-color': C.outside, 'fill-opacity': 0.92 } }, firstLabel);
    map.addSource('pk', { type: 'geojson', data: pk });
    map.addLayer({ id: 'pk-border-glow', type: 'line', source: 'pk',
      paint: { 'line-color': C.cobalt, 'line-width': z(4, 6, 10, 14), 'line-blur': z(4, 6, 10, 14), 'line-opacity': 0.08 } }, firstLabel);
    map.addLayer({ id: 'pk-border', type: 'line', source: 'pk',
      paint: { 'line-color': C.cobalt, 'line-width': z(4, 1, 10, 2), 'line-opacity': 0.55 } }, firstLabel);

    map.pakistan = pkLight.geometry; // App uses this to know if the pin is inside Pakistan

    // Place names sit above the fade, and only names inside Pakistan show (so none get cut at the border).
    const inside = ['within', pkLight];
    for (const id of ['label-city', 'label-town', 'label-village', 'label-street']) {
      const f = map.getFilter(id);
      map.setFilter(id, f ? ['all', f, inside] : inside);
    }

    // River names written along the rivers.
    // One label per river, at the middle of its longest piece (the lines are too wiggly to write along).
    const longest = {};
    for (const f of rivers.features) {
      const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat();
      const n = f.properties.name;
      if (!longest[n] || coords.length > longest[n].length) longest[n] = coords;
    }
    const riverNames = { type: 'FeatureCollection', features: Object.entries(longest).map(([name, c]) => (
      { type: 'Feature', properties: { name: `${name} River` }, geometry: { type: 'Point', coordinates: c[Math.floor(c.length / 2)] } })) };
    map.addSource('pk-river-names', { type: 'geojson', data: riverNames });
    map.addLayer({ id: 'pk-river-names', type: 'symbol', source: 'pk-river-names', minzoom: 4, maxzoom: 11,
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': z(4, 11, 10, 14),
        'text-letter-spacing': 0.08, 'text-offset': [0, -1], 'text-anchor': 'bottom' },
      paint: { 'text-color': '#1E88E5', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } });
  } catch (e) { console.warn('pakistan layers', e); }

  // River forecast points (whole country).
  map.addSource('national', { type: 'geojson', data: empty });
  map.addLayer({ id: 'national-halo', type: 'circle', source: 'national', maxzoom: 12,
    paint: { 'circle-color': levelColorExpr(), 'circle-radius': z(3, 4, 5, 8, 10, 18), 'circle-opacity': 0.18 } });
  map.addLayer({ id: 'national', type: 'circle', source: 'national', maxzoom: 12,
    paint: { 'circle-color': levelColorExpr(), 'circle-radius': z(3, 2.2, 5, 3.6, 10, 7), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': z(3, 1, 6, 2) } });

  // The last spot that was checked.
  map.addSource('checked', { type: 'geojson', data: empty });
  map.addLayer({ id: 'checked', type: 'circle', source: 'checked',
    paint: { 'circle-color': levelColorExpr(), 'circle-radius': 7, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });

  // Your saved home.
  map.addSource('home', { type: 'geojson', data: empty });
  map.addLayer({ id: 'home-ring', type: 'circle', source: 'home',
    paint: { 'circle-color': '#FFFFFF', 'circle-radius': 13, 'circle-stroke-color': C.cobalt, 'circle-stroke-width': 2.5 } });
  map.addLayer({ id: 'home', type: 'circle', source: 'home', paint: { 'circle-color': C.cobalt, 'circle-radius': 6 } });
  map.addLayer({ id: 'home-label', type: 'symbol', source: 'home',
    layout: { 'text-field': 'Home', 'text-font': FONT_BOLD, 'text-size': 12, 'text-offset': [0, 1.7], 'text-anchor': 'top' },
    paint: { 'text-color': C.cobalt, 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } });

  // Your location.
  map.addSource('me', { type: 'geojson', data: empty });
  map.addLayer({ id: 'me-halo', type: 'circle', source: 'me', paint: { 'circle-color': C.cobalt, 'circle-radius': 18, 'circle-opacity': 0.15 } });
  map.addLayer({ id: 'me', type: 'circle', source: 'me',
    paint: { 'circle-color': C.cobalt, 'circle-radius': 6, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });

  map.fire('sailaab:ready');
}
