import { LogoMark } from './Logo.jsx';
import Icon from './Icon.jsx';

// The first thing people see: who we are, in one breath, then straight to the map or the demo.
export default function Intro({ onOpen, onDemo }) {
  return (
    <div className="intro" role="dialog" aria-label="Welcome to Khabardar">
      <div className="intro-glow" />
      <div className="intro-card">
        <LogoMark size={84} rise />
        <div className="intro-ur">خبردار</div>
        <h1 className="intro-name">Khabardar</h1>
        <p className="intro-tag">Flood warnings for <b>your house</b>, not your district.</p>
        <div className="intro-points">
          <span><Icon name="waves" size={16} />River, rain and hills</span>
          <span><Icon name="house" size={16} />House by house</span>
          <span><Icon name="volume" size={16} />In your language</span>
        </div>
        <div className="intro-actions">
          <button className="intro-go" onClick={onOpen}>Open the map<Icon name="left" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
          <button className="intro-demo" onClick={onDemo}><span><Icon name="play" size={12} /></span>Watch the 2022 demo</button>
        </div>
        <p className="intro-ur-tag">اپنے گھر کے لیے سیلاب کی وارننگ</p>
      </div>
    </div>
  );
}
