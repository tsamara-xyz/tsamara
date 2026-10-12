import { Composition } from "remotion";
import { DEMO_FRAMES, Demo } from "./Demo";
import { PITCH_FRAMES, Pitch } from "./Pitch";
import { FPS } from "./ui";

export function Root() {
  return (
    <>
      <Composition id="Demo" component={Demo} durationInFrames={DEMO_FRAMES} fps={FPS} width={1920} height={1080} />
      <Composition id="Pitch" component={Pitch} durationInFrames={PITCH_FRAMES} fps={FPS} width={1920} height={1080} />
    </>
  );
}
