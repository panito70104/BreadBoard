/**
 * The Remotion entry for headless rendering.
 *
 * The Player mounts `WhiteboardComposition` directly; this file registers the
 * same component as a real Composition so `@remotion/renderer` can drive it.
 * It deliberately adds no drawing logic of its own — a still that went through
 * a second implementation would verify that implementation, not the engine.
 *
 * Today it exists for verification stills (`npm run engine:stills`). It is also
 * the seam an MP4 export would use later, which is why the composition is
 * registered properly instead of being screenshotted out of the Player.
 */

import { Composition } from "remotion";

import {
  WhiteboardComposition,
  storyboardDurationInFrames,
  type WhiteboardCompositionProps,
} from "@/components/engine/whiteboard-composition";
import { BOARD } from "@/lib/engine/board";
import { FIXTURE_A } from "@/fixtures/fase1";

// Imported for the side effect: it holds every frame until the handwriting
// face is loaded, so no still is ever measured with the fallback font.
import "./hand-font";

export const WHITEBOARD_COMPOSITION_ID = "whiteboard";

/**
 * Remotion types a composition's props as an index-signature record, because
 * they arrive as JSON from `--props`. The component's own props are the real
 * contract; this only widens them enough for the registration to typecheck.
 */
type CompositionProps = WhiteboardCompositionProps & Record<string, unknown>;

/*
 * Injected rather than passed as a default prop: `renderStill` is called with
 * its own `inputProps`, and a caller that forgets this one gets a board with no
 * hand on it and no error to explain why.
 */
const Whiteboard: React.FC<CompositionProps> = (props) => (
  <WhiteboardComposition {...(props as unknown as WhiteboardCompositionProps)} assetBase="/public" />
);

export function RemotionRoot() {
  return (
    <Composition
      id={WHITEBOARD_COMPOSITION_ID}
      component={Whiteboard}
      width={BOARD.width}
      height={BOARD.height}
      fps={BOARD.fps}
      // A placeholder: the real length comes from the storyboard actually
      // passed in, via calculateMetadata below.
      durationInFrames={Math.max(1, storyboardDurationInFrames(FIXTURE_A))}
      defaultProps={
        {
          storyboard: FIXTURE_A,
          style: "classic-whiteboard",
        } as CompositionProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, storyboardDurationInFrames(props.storyboard)),
      })}
    />
  );
}
