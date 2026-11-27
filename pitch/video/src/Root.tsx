import React from "react";
import { Composition } from "remotion";
import { Main, TOTAL } from "./Main";
import { Local, TOTAL_LOCAL } from "./Local";

export const Root: React.FC = () => (
  <>
    <Composition id="Main" component={Main} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="Local" component={Local} durationInFrames={TOTAL_LOCAL} fps={30} width={1920} height={1080} />
  </>
);
