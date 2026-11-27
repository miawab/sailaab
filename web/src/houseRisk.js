// Colours all showcase houses on the device, with no call per house.
// Same maths as the risk API (api/_lib/risk.js): house score = river severity x house exposure x 100.
// We get each river point's 7-day forecast once, take its worst severity, and let the map
// colour every house from that with one paint expression.
import POINTS from '../../shared/river_points.json';
import { NO_DATA } from './levels.js';

export const RIVER_POINTS = Object.fromEntries(POINTS.map((p) => [p.id, p]));

// The two showcase areas and the river points whose houses they hold.
export const AREAS = {
  nowshera: { name: 'Nowshera', file: '/data/houses_nowshera.geojson', points: ['kabul_nowshera', 'swat_charsadda'],
    main: 'kabul_nowshera', bbox: [71.6, 34.0, 72.1, 34.25], view: { center: [71.97, 34.014], zoom: 15.3 } },
  dadu: { name: 'Dadu', file: '/data/houses_dadu.geojson', points: ['johi_dadu', 'indus_dadu'],
    main: 'johi_dadu', bbox: [67.6, 26.55, 67.95, 26.82], view: { center: [67.627, 26.699], zoom: 14.4 } },
};

export function thresholds(p) {
  const p90 = p.p90 || 0;
  const p99 = Math.max(p.p99 || 0, p90);
  const peak = p.peak_2022 || 0;
  const danger = Math.max(0.9 * peak, 1.1 * p99);
  return { p90, p99, danger, top: Math.max(peak, danger) };
}

// 0 m3/s -> 0, p90 -> 0.3, p99 -> 0.6, danger -> 0.9, 2022 peak -> 1 (straight lines between)
export function severity(q, p) {
  const t = thresholds(p);
  if (!(q > 0)) return 0;
  const a = [[0, 0], [t.p90, 0.3], [t.p99, 0.6], [t.danger, 0.9], [t.top, 1]];
  for (let i = 1; i < a.length; i++) {
    const [x0, y0] = a[i - 1], [x1, y1] = a[i];
    if (q < x1) return x1 === x0 ? y1 : y0 + ((q - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1;
}

const byPoint = (values, fallback) => {
  const pairs = Object.entries(values).flatMap(([k, v]) => [k, v]);
  return pairs.length ? ['match', ['get', 'p'], ...pairs, fallback] : fallback;
};

// Paint: each house's level from its point's worst severity. Grey until the forecast arrives.
export function riskColor(sev) {
  if (!Object.keys(sev).length) return NO_DATA;
  return ['step', ['*', ['get', 'e'], byPoint(sev, 0), 100],
    '#16A34A', 25, '#EAB308', 50, '#F97316', 75, '#DC2626'];
}

// 2022 replay paint: a house is under water once it really flooded in 2022 (f = 1)
// and the water has risen past its height. `cut` is the water height per point today.
export function replayColor(cut) {
  return ['case', ['all', ['==', ['get', 'f'], 1], ['<=', ['get', 'h'], byPoint(cut, -1)]], '#1D4ED8', '#AEB8CA'];
}

// 0 (normal) to 1 (the 2022 peak): how far the real 2022 flood had spread on a day.
// Measured from the river's usual high (p90) up to its own 2022 peak, so it works even where
// the model's 2022 peak stayed under its warning line (like the Kabul River at Nowshera).
export function floodShare(q, p) {
  const peak = p.peak_2022;
  const base = p.p90 < peak ? p.p90 : 0.6 * peak;
  return Math.max(0, Math.min(1, (q - base) / (peak - base)));
}
