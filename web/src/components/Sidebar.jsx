import { useState } from 'react';
import { LEVELS, LANGS } from '../levels.js';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

const LAYERS = [
  { key: 'rivers', icon: 'waves', label: 'Rivers' },
  { key: 'points', icon: 'drop', label: 'Gauges' },
  { key: 'houses', icon: 'house', label: 'Houses' },
  { key: 'flood2022', icon: 'history', label: '2022 flood' },
  { key: 'provinces', icon: 'grid', label: 'Provinces' },
];

function Today({ summary }) {
  if (!summary) return <div className="today loading"><div className="spinner xs light" /></div>;
  const { title, when, unit, counts, labels } = summary;
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const worstKey = ['danger', 'warning', 'watch', 'safe'].find((k) => counts[k] > 0) ?? 'safe';
  return (
    <div className="today">
      <div className="today-top">
        <span className="today-title">{title}</span>
        <span className="today-when">{when}</span>
      </div>
      <div className="today-big">
        <b>{total}</b><span>{unit}</span>
        <i className="today-worst" style={{ '--c': LEVELS[worstKey].color }}><Icon name={LEVELS[worstKey].icon} size={14} stroke={2.4} />{labels[worstKey]}</i>
      </div>
      <div className="today-bar">
        {Object.keys(LEVELS).map((k) => counts[k] ? <i key={k} style={{ flex: counts[k], background: LEVELS[k].color }} /> : null)}
      </div>
      <div className="today-key">
        {Object.entries(LEVELS).map(([k, v]) => (
          <span key={k} style={{ '--c': v.color }}><i />{labels[k]}<b>{counts[k] ?? 0}</b></span>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar(props) {
  const {
    open, setOpen, mode, setMode, layers, toggleLayer, home, homeLevel, setHome, clearHome, goHome,
    lang, setLang, startTour, summary,
  } = props;
  const HL = homeLevel ? LEVELS[homeLevel] : null;
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sb-head">
        <Logo size={40} sub="Flood warnings for your house" />
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="left" size={18} /></button>
      </div>

      <div className="sb-scroll">
        {/* today across Pakistan: how many places are at each level */}
        <Today summary={summary} />

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
          <button className={mode === 'air' ? 'on' : ''} onClick={() => setMode('air')}><Icon name="wind" size={17} />Air</button>
        </div>

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


        {/* how it works, in three icons */}
        <div className="sb-block">
          <div className="sb-label">How it works</div>
          <div className="how">
            <span><i><Icon name="pinmap" size={18} /></i><b>Move the pin</b><small>to any place</small></span>
            <span><i><Icon name="drop" size={18} /></i><b>Tap once</b><small>Safe here?</small></span>
            <span><i><Icon name="volume" size={18} /></i><b>Hear it</b><small>in your language</small></span>
          </div>
        </div>
        <p className="sb-credit">River forecast GloFAS, rain ECMWF, buildings Google, 2022 flood map UNOSAT. Free and open data.</p>
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
          </div>
        )}
        <div className="foot-row">
          <button className={`settings-btn ${settingsOpen ? 'on' : ''}`} onClick={() => setSettingsOpen((o) => !o)}>
            <Icon name="sliders" size={17} /><span>Settings</span>
          </button>
          <button className="demo-btn" onClick={startTour}>
            <Icon name="play" size={14} /><span>Demo</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
