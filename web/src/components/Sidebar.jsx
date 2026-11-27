import { useState } from 'react';
import { LEVELS, LANGS, fmtDate } from '../levels.js';
import { worst } from '../hazards.js';
import Icon from './Icon.jsx';

const LAYERS = [
  { key: 'rivers', icon: 'waves', label: 'Rivers' },
  { key: 'points', icon: 'drop', label: 'Gauges' },
  { key: 'houses', icon: 'house', label: 'Houses' },
  { key: 'flood2022', icon: 'history', label: '2022 flood' },
  { key: 'provinces', icon: 'grid', label: 'Provinces' },
];

// What Sailaab would have said on day i: the worst river level in the 7 days ahead.
export function saidOn(days, i) {
  const ahead = days.slice(i, i + 7);
  const lvl = worst(...ahead.map((d) => d.level));
  const first = ahead.find((d) => d.level === lvl);
  return { level: lvl, date: first?.date };
}

function Replay({ replay, day, setDay, playing, setPlaying, underwater, totalHouses }) {
  if (!replay) return <div className="sb-empty"><div className="spinner sm" /></div>;
  const days = replay.days;
  const d = days[day];
  const t = replay.thresholds;
  const said = saidOn(days, day);
  const S = LEVELS[said.level];
  const R = LEVELS[d.level];

  const peak = days.reduce((b, x, i) => (x.discharge > days[b].discharge ? i : b), 0);

  const max = Math.max(...days.map((x) => x.discharge), t.peak_2022) * 1.05;
  const W = 280, H = 70;
  const x = (i) => (i / (days.length - 1)) * W;
  const y = (v) => H - (v / max) * H;
  const line = days.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.discharge).toFixed(1)}`).join('');
  const dangerLine = Math.max(0.9 * t.peak_2022, 1.1 * t.p99);

  return (
    <div className="replay">
      {/* TODO: "X days warning before the peak" headline, once Part B adds the archived Aug 2022 GloFAS
          forecasts. Computing it from the real river flow would assume a perfect forecast, so we don't. */}
      <div className="replay-date">{fmtDate(d.date)} <span>2022</span></div>

      <div className="said">
        <div><span>Sailaab says</span><b style={{ color: S.color }}><Icon name={S.icon} size={15} stroke={2.4} />{S.label}</b></div>
        <div><span>River today</span><b style={{ color: R.color }}><Icon name={R.icon} size={15} stroke={2.4} />{R.label}</b></div>
      </div>

      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path d={`${line}L${W},${H}L0,${H}Z`} className="spark-fill" />
        <line x1="0" x2={W} y1={y(dangerLine)} y2={y(dangerLine)} className="spark-th" style={{ stroke: LEVELS.danger.color }} />
        <path d={line} className="spark-line" />
        <line x1={x(peak)} x2={x(peak)} y1="0" y2={H} className="spark-peak" />
        <line x1={x(day)} x2={x(day)} y1="0" y2={H} className="spark-cursor" />
        <circle cx={x(day)} cy={y(d.discharge)} r="4.5" className="spark-dot" style={{ fill: R.color }} />
      </svg>

      <div className="replay-controls">
        <button className="play-sm" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={16} />
        </button>
        <input type="range" min="0" max={days.length - 1} value={day}
          onChange={(e) => { setPlaying(false); setDay(+e.target.value); }} />
      </div>

      <div className="mini-stats">
        <span><Icon name="waves" size={14} />{Math.round(d.discharge).toLocaleString()} m³/s</span>
        <span><Icon name="house" size={14} />{underwater}/{totalHouses} under water</span>
      </div>
    </div>
  );
}

export default function Sidebar(props) {
  const {
    open, setOpen, mode, setMode, layers, toggleLayer, home, homeLevel, setHome, clearHome, goHome,
    lang, setLang, demo, setDemo, replayProps,
  } = props;
  const HL = homeLevel ? LEVELS[homeLevel] : null;
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sb-head">
        <div className="brand-in">
          <span className="brand-mark">سیلاب</span>
          <span className="brand-name">Sailaab</span>
        </div>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="left" size={18} /></button>
      </div>

      <div className="sb-scroll">
        {/* home */}
        {home ? (
          <div className="home-card" style={HL ? { '--c': HL.color, '--soft': HL.soft } : undefined}>
            <button className="home-main" onClick={goHome}>
              <span className="home-icon">{HL ? <Icon name={HL.icon} size={20} /> : <span className="spinner xs light" />}</span>
              <span className="home-text"><small>Home</small><b>{HL ? HL.label : '...'}</b></span>
            </button>
            <button className="icon-btn" onClick={clearHome} aria-label="Remove home"><Icon name="trash" size={16} /></button>
          </div>
        ) : (
          <button className="ghost-btn" onClick={setHome}><Icon name="house" size={16} />Set pin as home</button>
        )}

        {/* mode */}
        <div className="tabs">
          <button className={mode === 'now' ? 'on' : ''} onClick={() => setMode('now')}><Icon name="waves" size={17} />Floods</button>
          <button className={mode === 'past' ? 'on' : ''} onClick={() => setMode('past')}><Icon name="test" size={17} />2022</button>
          <button className={mode === 'air' ? 'on' : ''} onClick={() => setMode('air')}><Icon name="wind" size={17} />Air</button>
        </div>
        {mode === 'past' && <Replay {...replayProps} />}

        {/* layers */}
        <div className="sb-block">
          <div className="sb-label">Map</div>
          <div className="chips">
            {LAYERS.map((l) => (
              <button key={l.key} className={layers[l.key] ? 'on' : ''} onClick={() => toggleLayer(l.key)}>
                <Icon name={l.icon} size={17} /><span>{l.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* colour key */}
        <div className="sb-block">
          <div className="sb-label">Colours</div>
          <div className="key">
            {Object.entries(LEVELS).map(([k, v]) => (
              <span key={k} style={{ '--c': v.color }}><Icon name={v.icon} size={15} stroke={2.4} />{v.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* settings, tucked away at the bottom */}
      <div className="sb-foot">
        {settingsOpen && (
          <div className="settings">
            <div className="seg" title="Voice language">
              {LANGS.map((l) => (
                <button key={l.key} className={`font-${l.font} ${lang === l.key ? 'on' : ''}`} onClick={() => setLang(l.key)}>{l.label}</button>
              ))}
            </div>
            <button className={`toggle ${demo ? 'on' : ''}`} onClick={() => setDemo(!demo)}>
              <Icon name="calendar" size={16} /><span>Demo day: 25 Aug 2022</span><i className="switch" />
            </button>
          </div>
        )}
        <button className={`settings-btn ${settingsOpen ? 'on' : ''}`} onClick={() => setSettingsOpen((o) => !o)}>
          <Icon name="sliders" size={17} /><span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
