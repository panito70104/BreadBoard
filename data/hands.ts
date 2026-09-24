/**
 * The hands that draw on the board.
 *
 * Each asset carries the pixel where its tool actually touches the surface —
 * the marker nib, the leading edge of the eraser felt. The engine positions a
 * hand by putting that point on the stroke, so a wrong anchor reads instantly
 * as the hand writing next to its own line.
 *
 * `anchor` is in the image's own pixels; `anchorRatio` is the same point
 * normalized, which is what the renderer uses so scaling stays correct.
 *
 * Cut out from the source JPEGs by `scripts/key-hands.py` — Gemini painted a
 * checkerboard instead of producing real transparency.
 */

export type HandTool = "marker" | "eraser";

export interface HandAsset {
  id: string;
  /** Hands sharing a family are the same person: same skin, sleeve and angle. */
  family: number;
  tool: HandTool;
  src: string;
  width: number;
  height: number;
  /** Where the tool meets the board, in image pixels. */
  anchor: { x: number; y: number };
  /** The same point as a 0–1 fraction of the image. */
  anchorRatio: { x: number; y: number };
  skinTone: "clara" | "media" | "oscura";
}

export const HANDS: HandAsset[] = [
  {
    id: "hand-01-marker",
    family: 1,
    tool: "marker",
    src: "/hands/hand-01-marker.webp",
    width: 851,
    height: 849,
    anchor: { x: 10, y: 107 },
    anchorRatio: { x: 0.01175, y: 0.12603 },
    skinTone: "clara",
  },
  {
    id: "hand-01-eraser",
    family: 1,
    tool: "eraser",
    src: "/hands/hand-01-eraser.webp",
    width: 885,
    height: 910,
    anchor: { x: 148, y: 285 },
    anchorRatio: { x: 0.16723, y: 0.31319 },
    skinTone: "clara",
  },
  {
    id: "hand-02-marker",
    family: 2,
    tool: "marker",
    src: "/hands/hand-02-marker.webp",
    width: 851,
    height: 849,
    anchor: { x: 10, y: 110 },
    anchorRatio: { x: 0.01175, y: 0.12956 },
    skinTone: "clara",
  },
  {
    id: "hand-02-eraser",
    family: 2,
    tool: "eraser",
    src: "/hands/hand-02-eraser.webp",
    width: 860,
    height: 862,
    anchor: { x: 75, y: 185 },
    anchorRatio: { x: 0.08721, y: 0.21462 },
    skinTone: "clara",
  },
  {
    id: "hand-03-marker",
    family: 3,
    tool: "marker",
    src: "/hands/hand-03-marker.webp",
    width: 851,
    height: 849,
    anchor: { x: 10, y: 110 },
    anchorRatio: { x: 0.01175, y: 0.12956 },
    skinTone: "media",
  },
  {
    id: "hand-03-eraser",
    family: 3,
    tool: "eraser",
    src: "/hands/hand-03-eraser.webp",
    width: 860,
    height: 862,
    anchor: { x: 82, y: 181 },
    anchorRatio: { x: 0.09535, y: 0.20998 },
    skinTone: "media",
  },
  {
    id: "hand-04-marker",
    family: 4,
    tool: "marker",
    src: "/hands/hand-04-marker.webp",
    width: 850,
    height: 849,
    anchor: { x: 11, y: 106 },
    anchorRatio: { x: 0.01294, y: 0.12485 },
    skinTone: "oscura",
  },
  {
    id: "hand-04-eraser",
    family: 4,
    tool: "eraser",
    src: "/hands/hand-04-eraser.webp",
    width: 860,
    height: 862,
    anchor: { x: 86, y: 183 },
    anchorRatio: { x: 0.1, y: 0.2123 },
    skinTone: "oscura",
  },
];

/** Default family used until the student picks one. */
export const DEFAULT_HAND_FAMILY = 1;

export function getHand(tool: HandTool, family = DEFAULT_HAND_FAMILY): HandAsset {
  const match = HANDS.find((hand) => hand.tool === tool && hand.family === family);
  if (!match) throw new Error(`No hay mano "${tool}" en la familia ${family}.`);
  return match;
}

export const HAND_FAMILIES = [...new Set(HANDS.map((hand) => hand.family))];
