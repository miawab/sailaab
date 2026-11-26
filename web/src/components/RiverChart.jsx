import { LEVELS, fmtDate } from '../levels.js';

// The river for the next days: one bar per day, coloured by that day's river level.
export default function RiverChart({ days }) {
  const max = Math.max(...days.map((d) => d.discharge ?? 0), 1);
  return (
    <div className="chart">
      <div className="chart-head"><span>River, next {days.length} days</span><span className="unit">m³/s</span></div>
      <div className="bars">
        {days.map((d) => {
          const lvl = d.river_level ?? d.level;
          const h = Math.max(6, ((d.discharge ?? 0) / max) * 100);
          return (
            <div key={d.date} className="bar-col" title={`${fmtDate(d.date)}: ${Math.round(d.discharge)} m³/s`}>
              <div className="bar" style={{ height: `${h}%`, background: LEVELS[lvl]?.color ?? '#94A3B8' }} />
              <span>{fmtDate(d.date).split(' ')[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
