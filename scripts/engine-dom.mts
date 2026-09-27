/**
 * The smallest DOM the engine needs, so the whole planner can run in node.
 *
 * Geometry is approximate — curves are flattened and arcs are chorded — which
 * is fine, because everything being asserted (continuity, monotonicity, staying
 * inside the board) holds whatever the geometry is.
 */

type Pt = { x: number; y: number };

function flatten(d: string): Pt[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const points: Pt[] = [];
  let i = 0;
  let cur: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  let command = "M";

  const num = () => Number(tokens[i++]);
  const push = (p: Pt) => {
    points.push(p);
    cur = p;
  };
  const bez = (p1: Pt, p2: Pt, p3: Pt, p0: Pt) => {
    for (let s = 1; s <= 12; s += 1) {
      const t = s / 12;
      const u = 1 - t;
      push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
    }
  };

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++];
    if (i >= tokens.length) break;
    const rel = command === command.toLowerCase();
    const ox = rel ? cur.x : 0;
    const oy = rel ? cur.y : 0;

    switch (command.toUpperCase()) {
      case "M": {
        const p = { x: num() + ox, y: num() + oy };
        push(p);
        start = p;
        command = rel ? "l" : "L";
        break;
      }
      case "L":
        push({ x: num() + ox, y: num() + oy });
        break;
      case "H":
        push({ x: num() + ox, y: cur.y });
        break;
      case "V":
        push({ x: cur.x, y: num() + oy });
        break;
      case "C": {
        const p0 = cur;
        const p1 = { x: num() + ox, y: num() + oy };
        const p2 = { x: num() + ox, y: num() + oy };
        const p3 = { x: num() + ox, y: num() + oy };
        bez(p1, p2, p3, p0);
        break;
      }
      case "S":
      case "Q": {
        const p0 = cur;
        const c = { x: num() + ox, y: num() + oy };
        const p3 = { x: num() + ox, y: num() + oy };
        bez(
          { x: p0.x + (2 / 3) * (c.x - p0.x), y: p0.y + (2 / 3) * (c.y - p0.y) },
          { x: p3.x + (2 / 3) * (c.x - p3.x), y: p3.y + (2 / 3) * (c.y - p3.y) },
          p3,
          p0,
        );
        break;
      }
      case "A": {
        num(); num(); num(); num(); num();
        push({ x: num() + ox, y: num() + oy });
        break;
      }
      case "Z":
        push({ ...start });
        break;
      default:
        i += 1;
    }
  }

  return points.length ? points : [{ x: 0, y: 0 }];
}

function measure(points: Pt[]) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(
      cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y),
    );
  }
  return cumulative;
}

class FakePath {
  private points: Pt[] = [{ x: 0, y: 0 }];
  private cumulative: number[] = [0];

  setAttribute(name: string, value: string) {
    if (name !== "d") return;
    this.points = flatten(value);
    this.cumulative = measure(this.points);
  }

  getTotalLength() {
    return this.cumulative[this.cumulative.length - 1];
  }

  getPointAtLength(length: number) {
    const total = this.getTotalLength();
    if (total === 0) return { ...this.points[0] };
    const target = Math.min(Math.max(length, 0), total);
    let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i] < target) i += 1;
    const span = this.cumulative[i] - this.cumulative[i - 1] || 1;
    const t = (target - this.cumulative[i - 1]) / span;
    const a = this.points[i - 1];
    const b = this.points[i];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
}

const context = {
  font: "10px sans-serif",
  measureText(text: string) {
    const size = Number(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10);
    // Roughly the metrics of a condensed handwriting face.
    return { width: text.length * size * 0.42 };
  },
};

export function installDom() {
  const globals = globalThis as Record<string, unknown>;
  globals.document = {
    createElementNS: () => new FakePath(),
    createElement: () => ({ getContext: () => context }),
    documentElement: {},
    fonts: { ready: Promise.resolve() },
  };
  globals.getComputedStyle = () => ({ getPropertyValue: () => "Caveat" });
}
