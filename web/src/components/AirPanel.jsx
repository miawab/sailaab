import { LEVELS, fmtDate } from '../levels.js';
import { AIR } from '../air.js';
import Icon from './Icon.jsx';

// The check result in Air mode: today's smog level, the worst day ahead, and 5 bars.
export default function AirPanel({ result, onClose }) {
  const a = result.air;
  const L = a ? LEVELS[a.today.level] : null;
  const max = a ? Math.max(...a.days.map((d) => d.pm), 60) : 1;

  return (
    <aside className="panel" style={L ? { '--lvl': L.color, '--lvl-soft': L.soft } : undefined}>
      <div className="grab" />
      <button className="close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>

      {result.status === 'loading' && <div className="state"><div className="spinner" /></div>}
      {result.status === 'error' && <div className="state err"><Icon name="warning" size={28} /><span>Couldn't check right now</span></div>}

      {result.status === 'ok' && a && (
        <>
          <div className="eyebrow"><Icon name="wind" size={14} />Air here</div>

          <div className="verdict">
            <div className="verdict-icon"><Icon name={L.icon} size={34} stroke={2.2} /></div>
            <div className="verdict-text">
              <div className="verdict-big">{AIR[a.today.level].label}</div>
              <div className="verdict-small">today</div>
            </div>
            <div className="pm"><b>{a.today.pm}</b><span>PM2.5</span></div>
          </div>

          {a.worstDay.date !== a.today.date && a.worstDay.level !== a.today.level && (
            <div className="hz">
              <div className="hz-row">
                <span className="hz-icon"><Icon name="calendar" size={18} /></span>
                <span className="hz-name">Worst day</span>
                <span className="hz-lvl" style={{ '--c': LEVELS[a.worstDay.level].color }}>
                  <Icon name={LEVELS[a.worstDay.level].icon} size={14} stroke={2.4} />{AIR[a.worstDay.level].label}
                </span>
                <span className="hz-when">{fmtDate(a.worstDay.date)}</span>
              </div>
            </div>
          )}

          <div className="chart">
            <div className="chart-head"><span>Next {a.days.length} days</span><span className="unit">PM2.5 µg/m³</span></div>
            <div className="bars">
              {a.days.map((d) => (
                <div key={d.date} className="bar-col" title={`${fmtDate(d.date)}: ${d.pm}`}>
                  <div className="bar" style={{ height: `${Math.max(6, (d.pm / max) * 100)}%`, background: LEVELS[d.level].color }} />
                  <span>{fmtDate(d.date).split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {a.today.level !== 'safe' && (
            <div className="tips">
              <span><Icon name="mask" size={18} />Mask outside</span>
              <span><Icon name="house" size={18} />Windows shut</span>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
