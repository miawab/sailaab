// The Khabardar demo video (under 2 minutes). Real footage of the site, recorded by scripts/record.mjs,
// with an edge-tts voiceover (scripts/vo.py) and burned-in captions. Render: npm run render
import React from "react";
import {
  AbsoluteFill, Audio, Img, continueRender, delayRender, OffthreadVideo, Sequence, Series, interpolate, spring,
  staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import lines from "../public/vo/lines.json";
import VO from "../public/vo/durations.json";
import { LogoMark } from "../../../web/src/components/Logo.jsx";

// Colours from the Khabardar site.
const INK = "#0B0F1A";
const COBALT = "#2540F0";
const BG = "#EEF2F8";
const FONT = '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif';
const DISPLAY = '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';

// The site's fonts, loaded before any frame renders.
const fontHandle = delayRender("fonts");
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Plus+Jakarta+Sans:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@700&display=block";
link.onload = () => Promise.all([
  document.fonts.load('800 100px "Bricolage Grotesque"'),
  document.fonts.load('600 40px "Plus Jakarta Sans"'),
  document.fonts.load('700 80px "Noto Nastaliq Urdu"', "خبردار"),
]).then(() => continueRender(fontHandle), () => continueRender(fontHandle));
link.onerror = () => continueRender(fontHandle);
document.head.appendChild(link);

const FPS = 30;
const s = (sec: number) => Math.round(sec * FPS);

type Scene = { id: keyof typeof VO; len: number; clip?: string; from?: number; rate?: number; extra?: number };
// from = where in the clip to start (s), rate = playback speed, len = scene length (s)
const SCENES: Scene[] = [
  { id: "s0", clip: "intro", from: 0.9, rate: 1, len: 6.0 },
  { id: "s1", clip: "why", from: 0, rate: 0.72, len: 13.6 },
  { id: "s2", clip: "live", from: 1.2, rate: 1, len: 11.6 },
  { id: "s3", clip: "house", from: 6.2, rate: 1.45, len: 13.4 },
  { id: "s4", clip: "end", from: 8.6, rate: 0.8, len: 9.6 },
  { id: "s5", clip: "dadu", from: 3.2, rate: 1, len: 12.6 },
  { id: "s6", clip: "nowshera", from: 6.0, rate: 1, len: 12.8 },
  { id: "s7", len: 8.4 },
  { id: "s8", len: 6.2 },
];
export const TOTAL = SCENES.reduce((a, x) => a + s(x.len), 0);

// Burned-in captions: the voiceover split into short chunks, timed by length.
const Captions: React.FC<{ id: string }> = ({ id }) => {
  const f = useCurrentFrame();
  const text: string = (lines as Record<string, string>)[id];
  const dur = (VO as Record<string, number>)[id];
  const chunks = text.match(/[^.?!,]+[.?!,]*/g)!.map((c) => c.trim()).reduce<string[]>((out, c) => {
    // join very short bits onto the previous chunk, split long ones in half
    if (out.length && (out[out.length - 1].split(" ").length + c.split(" ").length) <= 9) out[out.length - 1] += " " + c;
    else out.push(c);
    return out;
  }, []).flatMap((c) => {
    const w = c.split(" ");
    if (w.length <= 12) return [c];
    const mid = Math.ceil(w.length / 2);
    return [w.slice(0, mid).join(" "), w.slice(mid).join(" ")];
  });
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const t = f / FPS / dur;
  let acc = 0, cur = "";
  for (const c of chunks) { if (t * total >= acc) cur = c; acc += c.length; }
  if (f / FPS > dur + 0.3) return null;
  return (
    <div style={{ position: "absolute", bottom: 52, width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{ background: "rgba(11,15,26,.86)", color: "#fff", fontFamily: FONT, fontSize: 38, fontWeight: 600, padding: "12px 30px", borderRadius: 999, maxWidth: 1500, textAlign: "center", letterSpacing: "-0.01em" }}>{cur.replace(/,$/, "")}</div>
    </div>
  );
};

export const Fade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 8, s(len) - 8, s(len)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

// Big words over the opening footage.
export const Card: React.FC<{ at: number; to: number; big: string; small?: string }> = ({ at, to, big, small }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < s(at) || f > s(to)) return null;
  const p = spring({ frame: f - s(at), fps, config: { damping: 16 } });
  const out = interpolate(f, [s(to) - 8, s(to)], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <div style={{ position: "absolute", right: 120, top: 330, width: 640, opacity: p * out, transform: `translateY(${(1 - p) * 30}px)`,
      background: "rgba(255,255,255,.96)", borderRadius: 32, padding: "36px 44px", boxShadow: "0 24px 60px rgba(16,24,40,.18)", fontFamily: FONT }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 84, fontWeight: 800, letterSpacing: "-0.045em", color: INK, lineHeight: 1 }}>{big}</div>
      {small && <div style={{ fontSize: 32, color: "#4A5468", marginTop: 14, lineHeight: 1.3 }}>{small}</div>}
    </div>
  );
};

const Clip: React.FC<{ sc: Scene }> = ({ sc }) => (
  <OffthreadVideo src={staticFile(`clips/${sc.clip}.webm`)} startFrom={s(sc.from ?? 0)} playbackRate={sc.rate ?? 1} muted
    style={{ width: 1920, height: 1080 }} />
);

export const HousesSlide: React.FC<{ len: number }> = ({ len }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, s(len)], [1, 1.06]);
  return (
    <AbsoluteFill style={{ background: "#f7f4ee" }}>
      <Img src={staticFile("houses-slide.png")} style={{ width: 1920, height: 1080, transform: `scale(${z})` }} />
    </AbsoluteFill>
  );
};

export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ background: BG, alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ textAlign: "center", opacity: p, transform: `scale(${0.94 + 0.06 * p})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <LogoMark size={150} />
        <div style={{ fontFamily: '"Noto Nastaliq Urdu", serif', fontSize: 84, color: COBALT, lineHeight: 1.9, marginTop: 10 }}>خبردار</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 130, fontWeight: 800, letterSpacing: "-0.03em", color: INK, lineHeight: 1 }}>Khabardar</div>
        <div style={{ fontSize: 40, color: "#4A5468", marginTop: 28 }}>Flood warnings for your house, not your district</div>
        <div style={{ display: "inline-flex", gap: 16, marginTop: 56 }}>
          <span style={{ background: INK, color: "#fff", borderRadius: 999, padding: "16px 30px", fontSize: 30, fontWeight: 600 }}>github.com/miawab/sailaab</span>
          <span style={{ background: "#fff", color: INK, borderRadius: 999, padding: "16px 30px", fontSize: 30, fontWeight: 600, boxShadow: "0 8px 24px rgba(16,24,40,.1)" }}>Team Puchkebataya</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Main: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <Series>
      {SCENES.map((sc) => (
        <Series.Sequence key={sc.id} durationInFrames={s(sc.len)}>
          <Fade len={sc.len}>
            {sc.clip && <Clip sc={sc} />}
            {sc.id === "s7" && <HousesSlide len={sc.len} />}
            {sc.id === "s8" && <EndCard />}
            {sc.id === "s1" && (
              <>
                <Card at={1.0} to={5.2} big="33 million" small="people hit by the 2022 floods" />
                <Card at={5.4} to={9.4} big="Districts" small="is what the warnings named" />
                <Card at={9.6} to={13.4} big="Houses" small="is what water floods" />
              </>
            )}
          </Fade>
          <Sequence from={s(0.3)}><Audio src={staticFile(`vo/${sc.id}.mp3`)} /></Sequence>
          {sc.id === "s4" && <Sequence from={s(5.2)}><Audio src={staticFile("danger_ur.mp3")} volume={(fr) => interpolate(fr, [0, s(3.6), s(4.3)], [0.9, 0.9, 0], { extrapolateRight: "clamp" })} /></Sequence>}
          <Sequence from={s(0.3)}><Captions id={sc.id} /></Sequence>
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
