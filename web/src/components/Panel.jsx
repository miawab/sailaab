import { useEffect, useRef, useState } from 'react';
import alerts from '../../../shared/alerts.json';
import { LEVELS, LANGS, daysUntil } from '../levels.js';
import { worst } from '../hazards.js';
import Icon from './Icon.jsx';
import RiverChart from './RiverChart.jsx';

const HAZARDS = [
  { key: 'river', icon: 'waves', name: 'River' },
  { key: 'rain', icon: 'rain', name: 'Rain' },
  { key: 'flash', icon: 'mountain', name: 'Hills' },
];

function reasonIcon(text) {
  const t = text.toLowerCase();
  if (t.includes('above') || t.includes('below')) return 'height';
  if (t.includes(' from ') || t.includes('away') || t.includes(' km')) return 'distance';
  if (t.includes('2022')) return 'history';
  return 'drop';
}

function when(date, today) {
  const n = daysUntil(date, today);
  if (n == null) return null;
  if (n <= 0) return 'now';
  return n === 1 ? 'tomorrow' : `in ${n} days`;
}

function Chance({ value, color }) {
  if (value == null) return null;
  return (
    <span className="chance" title={`${value}% of forecast runs agree`}>
      <i style={{ '--w': `${value}%`, '--c': color }} />{value}%
    </span>
  );
}

export default function Panel({ result, hz, lang, setLang, today, onClose }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [readOpen, setReadOpen] = useState(false);
  const [more, setMore] = useState(false);
  const d = result.data;

  // Overall = the worst of river, rain and hills.
  const levels = { river: d?.level, rain: hz?.rain?.level, flash: hz?.flash?.level };
  const overall = d ? worst(levels.river, levels.rain, levels.flash) : null;
  const L = overall ? LEVELS[overall] : null;
  const driver = HAZARDS.find((h) => levels[h.key] === overall)?.key ?? 'river';
  const driverDate = driver === 'river' ? d?.first_date : hz?.[driver]?.date;
  const driverChance = driver === 'river' ? hz?.river?.chance : hz?.[driver]?.chance;

  const alert = overall ? alerts[overall]?.[lang] : null;
  const audioSrc = alert?.audio ?? (overall ? alerts[overall]?.ur?.audio : null);
  const langInfo = LANGS.find((l) => l.key === lang);

  useEffect(() => { audioRef.current?.pause(); setPlaying(false); }, [lang, result]);
  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = () => {
    if (!audioSrc) return;
    if (!audioRef.current || audioRef.current.dataset.src !== audioSrc) {
      audioRef.current?.pause();
      audioRef.current = new Audio(audioSrc);
      audioRef.current.dataset.src = audioSrc;
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.currentTime = 0; audioRef.current.play(); setPlaying(true); }
  };

  return (
    <aside className="panel" style={L ? { '--lvl': L.color, '--lvl-soft': L.soft } : undefined}>
      <div className="grab" />
      <button className="close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>

      {result.status === 'loading' && <div className="state"><div className="spinner" /></div>}
      {result.status === 'error' && <div className="state err"><Icon name="warning" size={28} /><span>Couldn't check right now</span></div>}

      {result.status === 'ok' && L && (
        <>
          <div className="eyebrow">
            <Icon name={result.kind === 'house' ? 'house' : 'pinmap'} size={14} />
            {result.kind === 'house' ? 'This house' : 'This spot'}
            {hz && !hz.live && <span className="tag">2022</span>}
          </div>

          {/* the answer */}
          <div className="verdict">
            <div className="verdict-icon"><Icon name={L.icon} size={34} stroke={2.2} /></div>
            <div className="verdict-text">
              <div className="verdict-big">{L.label}</div>
              <div className="verdict-small">{overall === 'safe' ? 'next 7 days' : when(driverDate, today) ?? 'this week'}</div>
            </div>
            <Chance value={driverChance} color={L.color} />
          </div>

          {/* three kinds of flood */}
          <div className="hz">
            {HAZARDS.map((h) => {
              const lvl = levels[h.key];
              const info = h.key === 'river' ? { date: d.first_date, chance: hz?.river?.chance } : hz?.[h.key];
              const HL = lvl ? LEVELS[lvl] : null;
              return (
                <div key={h.key} className="hz-row">
                  <span className="hz-icon"><Icon name={h.icon} size={18} /></span>
                  <span className="hz-name">{h.name}</span>
                  {HL ? (
                    <>
                      <span className="hz-lvl" style={{ '--c': HL.color }}><Icon name={HL.icon} size={14} stroke={2.4} />{HL.label}</span>
                      <span className="hz-when">{lvl !== 'safe' ? when(info?.date, today) ?? '' : ''}</span>
                    </>
                  ) : <span className="hz-wait"><span className="spinner xs" /></span>}
                </div>
              );
            })}
          </div>

          {/* listen */}
          <div className={`listen ${playing ? 'on' : ''}`}>
            <button className="listen-main" onClick={toggle} disabled={!audioSrc} aria-label={playing ? 'Pause voice note' : 'Play voice note'}>
              <span className="listen-btn"><Icon name={playing ? 'pause' : 'play'} size={18} /></span>
              <span className="wave">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</span>
            </button>
            <button className={`read-btn ${readOpen ? 'on' : ''}`} onClick={() => setReadOpen((o) => !o)} aria-label="Read the message">
              <Icon name="text" size={17} />
            </button>
          </div>
          <div className="langs">
            {LANGS.map((l) => (
              <button key={l.key} className={`lang font-${l.font} ${lang === l.key ? 'on' : ''}`} onClick={() => setLang(l.key)}>{l.label}</button>
            ))}
          </div>
          {readOpen && alert?.text && <p className={`say font-${langInfo.font}`} dir={langInfo.dir}>{alert.text}</p>}

          {/* why + river chart, folded away */}
          <button className={`more ${more ? 'on' : ''}`} onClick={() => setMore((m) => !m)}>
            <span>Details</span><Icon name="left" size={16} />
          </button>
          {more && (
            <div className="more-body">
              {d.reasons?.length > 0 && (
                <div className="why">
                  {d.reasons.map((r) => (
                    <div key={r} className="why-row"><span className="why-icon"><Icon name={reasonIcon(r)} size={16} /></span>{r}</div>
                  ))}
                </div>
              )}
              {d.days?.length > 0 && <RiverChart days={d.days} />}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
