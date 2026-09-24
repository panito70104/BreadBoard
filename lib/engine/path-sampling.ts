/**
 * Where the marker tip is along a set of SVG paths.
 *
 * The hand has to follow the stroke as it is drawn, so for any progress value
 * we need the point the pen has reached. Browsers expose that exactly through
 * `getPointAtLength`, so we measure against a detached path element and cache
 * the result — the same `d` always yields the same samples, which keeps the
 * hand from jittering between frames.
 */

export interface Point {
  x: number;
  y: number;
}

interface Sampled {
  length: number;
  points: Point[];
}

const cache = new Map<string, Sampled>();
const SAMPLES = 48;

function samplePath(d: string): Sampled {
  const cached = cache.get(d);
  if (cached) return cached;

  const fallback: Sampled = { length: 0, points: [] };
  if (typeof document === "undefined") return fallback;

  try {
    const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
    element.setAttribute("d", d);
    const length = element.getTotalLength();
    if (!Number.isFinite(length) || length === 0) return fallback;

    const points: Point[] = [];
    for (let i = 0; i <= SAMPLES; i += 1) {
      const point = element.getPointAtLength((length * i) / SAMPLES);
      points.push({ x: point.x, y: point.y });
    }

    const sampled = { length, points };
    cache.set(d, sampled);
    return sampled;
  } catch {
    return fallback;
  }
}

export function pathLengths(paths: string[]): number[] {
  return paths.map((d) => samplePath(d).length);
}

/**
 * Splits a 0–1 progress across several paths by length, so a long path takes
 * proportionally longer to draw than a short one.
 */
export function perPathProgress(paths: string[], progress: number): number[] {
  const lengths = pathLengths(paths);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return paths.map(() => (progress >= 1 ? 1 : 0));

  let drawn = progress * total;
  return lengths.map((length) => {
    if (length === 0) return 1;
    const share = Math.min(1, Math.max(0, drawn / length));
    drawn -= length;
    return share;
  });
}

/** The pen position at `progress` along the whole sequence, in path space. */
export function penPoint(paths: string[], progress: number): Point | null {
  const lengths = pathLengths(paths);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return null;

  let remaining = Math.min(Math.max(progress, 0), 1) * total;
  for (const [index, length] of lengths.entries()) {
    if (remaining <= length || index === lengths.length - 1) {
      const { points } = samplePath(paths[index]);
      if (points.length === 0) return null;
      const ratio = length === 0 ? 1 : Math.min(1, remaining / length);
      return points[Math.min(points.length - 1, Math.round(ratio * SAMPLES))];
    }
    remaining -= length;
  }
  return null;
}
