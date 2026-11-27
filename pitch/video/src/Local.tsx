// The Khabardar demo video, local-voice cut (under 2 minutes).
// Same story and footage as Main.tsx, plus:
//  - real 2022 imagery: NASA Landsat images of Lake Manchar before and during the flood (public domain)
//  - a 3D flyover of Dadu on 27 Aug 2022 (flyover/index.html, recorded by scripts/record_flyover.mjs)
//  - voiceover made on this computer with Kokoro (scripts/vo_local.py)
//  - captions timed word by word by Whisper, also run locally (scripts/captions_local.py)
// Scene order and lengths: public/vo-local/scenes.json. Render: npm run render:local
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, Series, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Card, EndCard, Fade, HousesSlide } from "./Main";
import scenes from "../public/vo-local/scenes.json";
import captions from "../public/vo-local/captions.json";

const FPS = 30;
const s = (sec: number) => Math.round(sec * FPS);
const FONT = '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif';
const VO_DELAY = 0.3; // the voice starts this long after each scene begins

type Scene = { id: string; len: number; clip?: string; from?: number; rate?: number; kind?: string };
const SCENES = scenes as Scene[];
export const TOTAL_LOCAL = SCENES.reduce((a, x) => a + s(x.len), 0);

type Line = { start: number; end: number; text: string };

// Captions from Whisper's word timings: each line shows from its first word until the next line starts.
const Captions: React.FC<{ id: string }> = ({ id }) => {
  const t = useCurrentFrame() / FPS;
  const lines = (captions as Record<string, Line[]>)[id] ?? [];
  const i = lines.findIndex((l, k) => t >= l.start && t < (lines[k + 1]?.start ?? l.end + 0.5));
  if (i < 0) return null;
  return (
    <div style={{ position: "absolute", bottom: id === "s9" ? 84 : 52, width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{ background: "rgba(11,15,26,.86)", color: "#fff", fontFamily: FONT, fontSize: 38, fontWeight: 600, padding: "12px 30px",
        borderRadius: 999, maxWidth: 1500, textAlign: "center", letterSpacing: "-0.01em" }}>{lines[i].text}</div>
    </div>
  );
};

const Clip: React.FC<{ sc: Scene }> = ({ sc }) => (
  <OffthreadVideo src={staticFile(`clips/${sc.clip}.webm`)} startFrom={s(sc.from ?? 0)} playbackRate={sc.rate ?? 1} muted
    style={{ width: 1920, height: 1080 }} />
);

const Label: React.FC<{ big: string; small: string }> = ({ big, small }) => (
  <div style={{ position: "absolute", left: 48, top: 40, fontFamily: FONT, color: "#fff", background: "rgba(11,15,26,.72)",
    padding: "14px 24px", borderRadius: 16 }}>
    <div style={{ fontSize: 30, fontWeight: 700 }}>{big}</div>
    <div style={{ fontSize: 22, color: "#c9d1e0", marginTop: 2 }}>{small}</div>
  </div>
);

// Real 2022 imagery: Lake Manchar (next to Dadu) on 25 June, then flooded on 5 September. Slow push-in, crossfade.
const NasaScene: React.FC<{ len: number }> = ({ len }) => {
  const f = useCurrentFrame();
  const cut = len * 0.45;
  const after = interpolate(f, [s(cut - 0.6), s(cut + 0.6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(f, [0, s(len)], [1.0, 1.12]);
  const img = (src: string, o: number) => (
    <Img src={staticFile(src)} style={{ position: "absolute", width: 1920, height: 1795, top: -357, objectFit: "cover",
      transform: `scale(${zoom})`, transformOrigin: "52% 47%", opacity: o }} />
  );
  return (
    <AbsoluteFill style={{ background: "#0b0f1a", overflow: "hidden" }}>
      {img("real/manchar_oli2_2022176.jpg", 1)}
      {img("real/manchar_oli_2022248.jpg", after)}
      <div style={{ opacity: 1 - after }}><Label big="Lake Manchar, Sindh · 25 Jun 2022" small="Before the monsoon" /></div>
      <div style={{ opacity: after }}><Label big="Lake Manchar, Sindh · 5 Sep 2022" small="The lake has burst, the Indus is in flood" /></div>
      <div style={{ position: "absolute", left: 48, bottom: 128, fontFamily: FONT, fontSize: 18, color: "rgba(255,255,255,.85)",
        background: "rgba(11,15,26,.6)", padding: "6px 12px", borderRadius: 8 }}>
        NASA Earth Observatory images by Joshua Stevens, using Landsat data from the U.S. Geological Survey
      </div>
    </AbsoluteFill>
  );
};

export const Local: React.FC = () => (
  <AbsoluteFill style={{ background: "#EEF2F8" }}>
    <Series>
      {SCENES.map((sc) => {
        const k = sc.len / 13.6; // Main.tsx placed the s1 cards for a 13.6 s scene
        return (
          <Series.Sequence key={sc.id} durationInFrames={s(sc.len)}>
            <Fade len={sc.len}>
              {sc.clip && <Clip sc={sc} />}
              {sc.kind === "nasa" && (
                <>
                  <NasaScene len={sc.len} />
                  <Card at={1.0 * k} to={5.2 * k} big="33 million" small="people hit by the 2022 floods" />
                  <Card at={5.4 * k} to={9.4 * k} big="Districts" small="is what the warnings named" />
                  <Card at={9.6 * k} to={13.4 * k} big="Houses" small="is what water floods" />
                </>
              )}
              {sc.kind === "houses" && <HousesSlide len={sc.len} />}
              {sc.kind === "end" && <EndCard />}
            </Fade>
            <Sequence from={s(VO_DELAY)}><Audio src={staticFile(`vo-local/${sc.id}.mp3`)} /></Sequence>
            {sc.id === "s4" && (
              <Sequence from={s(5.2)}>
                <Audio src={staticFile("danger_ur.mp3")} volume={(fr) => interpolate(fr, [0, s(3.0), s(3.6)], [0.9, 0.9, 0], { extrapolateRight: "clamp" })} />
              </Sequence>
            )}
            <Sequence from={s(VO_DELAY)}><Captions id={sc.id} /></Sequence>
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);
