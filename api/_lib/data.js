// Loads the data files Part B makes. If the real file isn't there yet,
// falls back to the mock in shared/mock/ so the API always works.
// (Folders starting with "_" are not turned into URLs by Vercel.)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function readJson(realPath, mockPath) {
  for (const p of [realPath, mockPath]) {
    try {
      return { data: JSON.parse(fs.readFileSync(p, 'utf8')), file: path.relative(ROOT, p) };
    } catch (e) {
      if (e.code !== 'ENOENT') throw e; // broken JSON should fail loudly
    }
  }
  throw new Error(`Missing data file: ${realPath}`);
}

let pointsCache = null;
let nationalIds = [];
// Every forecast point we know about, by id: the showcase points from
// river_points.json plus the ~250 national points.
function getPoints() {
  if (pointsCache) return pointsCache;
  const byId = Object.create(null); // no built-ins, so ?id=toString finds nothing

  const national = readJson(
    path.join(ROOT, 'web', 'public', 'data', 'national_points.geojson'),
    path.join(ROOT, 'shared', 'mock', 'national_points.geojson')
  ).data;
  for (const f of national.features) {
    const [lon, lat] = f.geometry.coordinates;
    byId[f.properties.id] = { ...f.properties, lat, lon };
  }
  nationalIds = national.features.map((f) => f.properties.id);

  // Showcase points win if the same id is in both files.
  const river = readJson(
    path.join(ROOT, 'shared', 'river_points.json'),
    path.join(ROOT, 'shared', 'mock', 'river_points.json')
  ).data;
  for (const p of river) byId[p.id] = p;

  pointsCache = byId;
  return byId;
}

// Just the national points (the ones in national_points.geojson), in file order.
function getNationalPoints() {
  const byId = getPoints();
  return nationalIds.map((id) => byId[id]);
}

let housesCache = null;
// House properties by id. The file can be ~15 MB, so we parse it once per
// server start and keep only the properties (not the polygons).
function getHouses() {
  if (housesCache) return housesCache;
  const { data } = readJson(
    path.join(ROOT, 'web', 'public', 'data', 'houses.geojson'),
    path.join(ROOT, 'shared', 'mock', 'houses.geojson')
  );
  const byId = Object.create(null); // no built-ins, so ?id=toString finds nothing
  for (const f of data.features) byId[f.properties.id] = f.properties;
  housesCache = byId;
  return byId;
}

module.exports = { getPoints, getNationalPoints, getHouses };
