import { useEffect, useRef, useState } from 'react';
import ALERTS from '../../../shared/alerts.json';
import { LANGS, LEVELS, fmtDate } from '../levels.js';
import Icon from './Icon.jsx';
import Replay from './Replay.jsx';

// The guided demo. Separate from the normal app: it replays the real August 2022 floods,
// shows what our model got right and what it missed, and ends by sending you to the live map.
// Each step tells App where to point the map (see STEPS), the card explains it.
export const STEPS = [
  { key: 'why', mode: 'now', view: 'pakistan', flood: true },
  { key: 'what', mode: 'now', view: 'pakistan' },
  { key: 'house', mode: 'now', view: 'dadu' },
  { key: 'dadu', mode: 'past', area: 'dadu', view: 'dadu' },
  { key: 'nowshera', mode: 'past', area: 'nowshera', view: 'nowshera' },
  { key: 'proof', mode: 'past', area: 'nowshera', view: 'nowshera' },
  { key: 'houses', mode: 'now', view: 'dadu' },
  { key: 'voice', mode: 'now', view: 'dadu' },
  { key: 'limits', mode: 'now', view: 'pakistan' },
];

const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

function Stat({ big, label }) {
  return <div className="t-stat"><b>{big}</b><span>{label}</span></div>;
}

function Row({ icon, title, sub }) {
  return (
    <div className="t-row">
      <span className="t-row-icon"><Icon name={icon} size={18} /></span>
      <span><b>{title}</b><small>{sub}</small></span>
    </div>
  );
}

// FFC gauge vs GloFAS at Nowshera, Aug to Sep 2022.
function ProofChart({ proof }) {
  const days = proof.days;
  const W = 300, H = 110;
  const max = Math.max(...days.map((d) => Math.max(d.ffc_m3s ?? 0, d.glofas_m3s ?? 0))) * 1.08;
  const x = (i) => (i / (days.length - 1)) * W;
  const y = (v) => H - (v / max) * H;
  const path = (k) => {
    let s = '', pen = false;
    days.forEach((d, i) => {
      if (d[k] == null) { pen = false; return; }
      s += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`; pen = true;
    });
    return s;
  };
  return (
    <div className="t-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={path('ffc_m3s')} className="l-real" />
        <path d={path('glofas_m3s')} className="l-model" />
      </svg>
      <div className="t-legend">
        <span><i className="k-real" />Real gauge (FFC)</span>
        <span><i className="k-model" />Our model (GloFAS)</span>
      </div>
    </div>
  );
}

function HouseBars({ proof }) {
  return (
    <div className="t-bars">
      {[['dadu', 'Dadu'], ['nowshera', 'Nowshera']].map(([k, name]) => {
        const p = proof[k];
        return (
          <div key={k} className="t-bar-group">
            <div className="t-bar-name">{name}<small>{p.houses.toLocaleString()} houses</small></div>
            <div className="t-bar"><span>Flagged</span><i style={{ '--w': `${p.flaggedHit}%`, '--c': LEVELS.warning.color }} /><b>{p.flaggedHit}%</b></div>
            <div className="t-bar"><span>The rest</span><i style={{ '--w': `${p.restHit}%`, '--c': '#94A3B8' }} /><b>{p.restHit}%</b></div>
          </div>
        );
      })}
    </div>
  );
}

function Voice({ lang, setLang }) {
  const [on, setOn] = useState(false);
  const audio = useRef(null);
  const a = ALERTS.danger?.[lang] ?? ALERTS.danger?.ur;
  const L = LANGS.find((l) => l.key === lang) ?? LANGS[0];
  useEffect(() => () => audio.current?.pause(), []);
  const play = () => {
    if (on) { audio.current?.pause(); setOn(false); return; }
    audio.current?.pause();
    audio.current = new Audio(a.audio);
    audio.current.onended = () => setOn(false);
    audio.current.play().then(() => setOn(true)).catch(() => setOn(false));
  };
  return (
    <>
      <div className="seg">
        {LANGS.map((l) => (
          <button key={l.key} className={`font-${l.font} ${lang === l.key ? 'on' : ''}`} onClick={() => { audio.current?.pause(); setOn(false); setLang(l.key); }}>{l.label}</button>
        ))}
      </div>
      <button className={`t-play ${on ? 'on' : ''}`} onClick={play}>
        <span><Icon name={on ? 'pause' : 'volume'} size={20} /></span>{on ? 'Playing' : 'Play the danger alert'}
      </button>
      <p className={`t-alert font-${L.font}`} dir={L.dir}>{a.text}</p>
    </>
  );
}

export default function DemoTour({ step, go, onExit, replayProps, proofRiver, proofHouses, onCheck, lang, setLang }) {
  const S = STEPS[step];
  const r = replayProps.replay;
  const last = step === STEPS.length - 1;

  // Dadu: from the day the channel first crossed Warning to its peak.
  let lead = null;
  if (S.key === 'dadu' && r) {
    // walk back from the peak to the start of the unbroken Warning-or-worse run that led to it
    const pi = r.days.reduce((b, x, i) => (x.discharge > r.days[b].discharge ? i : b), 0);
    const peak = r.days[pi];
    let k = pi;
    while (k > 0 && ['warning', 'danger'].includes(r.days[k - 1].level)) k--;
    const firstWarn = ['warning', 'danger'].includes(r.days[k].level) ? r.days[k] : null;
    if (firstWarn) lead = { from: firstWarn.date, to: peak.date, n: dayDiff(firstWarn.date, peak.date), q: peak.discharge };
  }
  const pr = proofRiver;

  const body = {
    why: (
      <>
        <div className="t-eyebrow">Why</div>
        <h2>2022: one monsoon hit the whole country</h2>
        <div className="t-stats">
          <Stat big="33M" label="people affected" />
          <Stat big="1,739" label="people killed" />
          <Stat big="2M" label="homes damaged" />
          <Stat big="$30B+" label="damage and losses" />
        </div>
        <p>Warnings named whole districts. A family needs to know about <b>its own house</b>, in <b>its own language</b>.</p>
        <small className="t-src">Govt of Pakistan, UNDP, World Bank: Post-Disaster Needs Assessment (2022); NDMA.</small>
      </>
    ),
    what: (
      <>
        <div className="t-eyebrow">What Sailaab does</div>
        <h2>Move the pin, tap once, get an answer</h2>
        <div className="t-rows">
          <Row icon="waves" title="River" sub="235 points, 7-day forecast" />
          <Row icon="rain" title="Rain" sub="Heavy-rain days ahead" />
          <Row icon="mountain" title="Hills" sub="Flash floods on slopes" />
        </div>
        <p>The dots are the river forecast as it stood on <b>25 Aug 2022</b>.</p>
      </>
    ),
    house: (
      <>
        <div className="t-eyebrow">Each house</div>
        <h2>Every house gets its own score</h2>
        <div className="t-formula">
          <span><Icon name="waves" size={16} />River this week</span><i>×</i><span><Icon name="house" size={16} />This house</span>
        </div>
        <div className="t-chips">
          <span><Icon name="height" size={15} />Height <b>50%</b></span>
          <span><Icon name="distance" size={15} />Distance <b>30%</b></span>
          <span><Icon name="history" size={15} />Flooded before <b>20%</b></span>
        </div>
        <p>Low houses by the bank turn red first. This is near Dadu, Sindh, on 25 Aug 2022.</p>
        <button className="t-action" onClick={onCheck}><Icon name="drop" size={18} />Check the house under the pin</button>
      </>
    ),
    dadu: (
      <>
        <div className="t-eyebrow">Replay: Dadu, Sindh</div>
        <h2>{lead ? <>Warning <span className="hl">{lead.n} days</span> before the peak</> : 'The flood channel past Johi'}</h2>
        <Replay {...replayProps} />
        <p className="t-note">
          {lead ? <>Crossed Warning on {fmtDate(lead.from)}, peaked on {fmtDate(lead.to)} at {Math.round(lead.q).toLocaleString()} m³/s, its highest day on record. </> : null}
          Blue houses really flooded (UN map).
        </p>
      </>
    ),
    nowshera: (
      <>
        <div className="t-eyebrow">Replay: Nowshera, KP</div>
        <h2>Here our model <span className="hl warn">saw too little</span></h2>
        <Replay {...replayProps} />
        <p className="t-note">Houses here really flooded, but the free global model never passed Watch. Next step shows why.</p>
      </>
    ),
    proof: (
      <>
        <div className="t-eyebrow">Checking the model</div>
        <h2>Against Pakistan's own river gauges</h2>
        {pr ? <ProofChart proof={pr} /> : <div className="spinner sm" />}
        {pr && (
          <div className="t-rows">
            <Row icon="safe" title="Timing: right" sub={`Real peak ${fmtDate(pr.ffc_peak.date)}, model ${fmtDate(pr.glofas_peak.date)}`} />
            <Row icon="warning" title="Size: too small" sub={`Model saw about a fifth: ${Math.round(pr.glofas_peak.m3s).toLocaleString()} vs ${Math.round(pr.ffc_peak.m3s).toLocaleString()} m³/s`} />
          </div>
        )}
        <p>Fix: feed in Pakistan's gauge readings where they exist.</p>
        <small className="t-src">Federal Flood Commission daily reports, 1 Aug to 15 Sep 2022.</small>
      </>
    ),
    houses: (
      <>
        <div className="t-eyebrow">Did we pick the right houses?</div>
        <h2>Houses we flag really flooded more</h2>
        {proofHouses ? <HouseBars proof={proofHouses} /> : <div className="spinner sm" />}
        <p className="t-note">We scored every house <b>without</b> telling it about 2022, then checked the UN flood map. Bars: share that really flooded.</p>
      </>
    ),
    voice: (
      <>
        <div className="t-eyebrow">In their language</div>
        <h2>The warning is spoken, not just written</h2>
        <Voice lang={lang} setLang={setLang} />
      </>
    ),
    limits: (
      <>
        <div className="t-eyebrow">Honest limits</div>
        <h2>What it can't do yet</h2>
        <div className="t-rows">
          <Row icon="waves" title="Big rivers only" sub="The global model misses small streams and city drains" />
          <Row icon="height" title="Rough ground height" sub="So we rank houses, we don't promise water depths" />
          <Row icon="sliders" title="Our own weights" sub="50, 30, 20, checked on 2022 only" />
        </div>
        <button className="t-action dark" onClick={onExit}><Icon name="locate" size={18} />Try it live</button>
      </>
    ),
  }[S.key];

  return (
    <>
      <div className="demo-banner">
        <span className="demo-chip">DEMO</span>
        <span className="demo-what">Replaying the 2022 floods</span>
        <button onClick={onExit} aria-label="Exit demo"><Icon name="x" size={16} /></button>
      </div>

      <aside className="tour" key={S.key}>
        <div className="grab" />
        <div className="tour-body">{body}</div>
        <div className="tour-nav">
          <button className="t-nav-btn" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Back"><Icon name="left" size={18} /></button>
          <div className="t-dots">{STEPS.map((s, i) => <i key={s.key} className={i === step ? 'on' : ''} onClick={() => go(i)} />)}</div>
          {last
            ? <button className="t-next" onClick={onExit}>Done</button>
            : <button className="t-next" onClick={() => go(step + 1)}>Next<Icon name="left" size={16} style={{ transform: 'rotate(180deg)' }} /></button>}
        </div>
      </aside>
    </>
  );
}
