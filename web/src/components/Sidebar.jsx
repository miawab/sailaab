import { useState } from 'react';
import { LEVELS, LANGS } from '../levels.js';
import Icon from './Icon.jsx';

const LAYERS = [
  { key: 'rivers', icon: 'waves', label: 'Rivers' },
  { key: 'points', icon: 'drop', label: 'Gauges' },
  { key: 'houses', icon: 'house', label: 'Houses' },
  { key: 'flood2022', icon: 'history', label: '2022 flood' },
  { key: 'provinces', icon: 'grid', label: 'Provinces' },
];

export default function Sidebar(props) {
  const {
    open, setOpen, mode, setMode, layers, toggleLayer, home, homeLevel, setHome, clearHome, goHome,
    lang, setLang, startTour,
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
