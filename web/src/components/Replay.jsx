import { LEVELS, fmtDate } from '../levels.js';
import { worst } from '../hazards.js';
import Icon from './Icon.jsx';

// What Khabardar would have said on day i: the worst river level in the 7 days ahead.
export function saidOn(days, i) {
  const ahead = days.slice(i, i + 7);
  const lvl = worst(...ahead.map((d) => d.level));
  const first = ahead.find((d) => d.level === lvl);
  return { level: lvl, date: first?.date };
}

// The 2022 replay player: date, what Khabardar said vs the river that day, the river line, play + slider.
export default function Replay({ replay, day, setDay, playing, setPlaying, underwater, totalHouses }) {
  if (!replay) return <div className="sb-empty"><div className="spinner sm" /></div>;
  const days = replay.days;
  const d = days[Math.min(day, days.length - 1)];
  const t = replay.thresholds;
  const said = saidOn(days, day);
  const S = LEVELS[said.level];
  const R = LEVELS[d.level];

  const peak = days.reduce((b, x, i) => (x.discharge > days[b].discharge ? i : b), 0);
  const max = Math.max(...days.map((x) => x.discharge), t.p99) * 1.08;
  const W = 280, H = 64;
  const x = (i) => (i / (days.length - 1)) * W;
  const y = (v) => H - (v / max) * H;
  const line = days.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.discharge).toFixed(1)}`).join('');

  return (
    <div className="replay">
      <div className="replay-date">{fmtDate(d.date)} <span>2022</span></div>

      <div className="said">
        <div><span>Khabardar said</span><b style={{ color: S.color }}><Icon name={S.icon} size={15} stroke={2.4} />{S.label}</b></div>
        <div><span>River that day</span><b style={{ color: R.color }}><Icon name={R.icon} size={15} stroke={2.4} />{R.label}</b></div>
      </div>

      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={`${line}L${W},${H}L0,${H}Z`} className="spark-fill" />
        <line x1="0" x2={W} y1={y(t.p99)} y2={y(t.p99)} className="spark-th" style={{ stroke: LEVELS.warning.color }} />
        <path d={line} className="spark-line" />
        <line x1={x(peak)} x2={x(peak)} y1="0" y2={H} className="spark-peak" />
        <line x1={x(day)} x2={x(day)} y1="0" y2={H} className="spark-cursor" />
        <circle cx={x(day)} cy={y(d.discharge)} r="4.5" className="spark-dot" style={{ fill: R.color }} />
      </svg>
      <div className="spark-key"><i style={{ background: LEVELS.warning.color }} />Warning line</div>

      <div className="replay-controls">
        <button className="play-sm" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={16} />
        </button>
        <input type="range" min="0" max={days.length - 1} value={day} aria-label="Day"
          onChange={(e) => { setPlaying(false); setDay(+e.target.value); }} />
      </div>

      <div className="mini-stats">
        <span><Icon name="waves" size={14} />{Math.round(d.discharge).toLocaleString()} m³/s</span>
        <span><Icon name="house" size={14} />{underwater.toLocaleString()} / {totalHouses.toLocaleString()} flooded</span>
      </div>
    </div>
  );
}
