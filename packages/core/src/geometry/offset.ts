import type { Vec2 } from "./vec.ts";

interface DirectedLine {
  p: Vec2;
  d: Vec2;
}

/**
 * Offset a CCW ring toward its outside (the waste side of a finished part).
 * Distance is millimetres. Orthogonal tab/slot outlines stay simple as long as
 * the distance is smaller than the narrowest feature.
 */
export function offsetOutline(points: readonly Vec2[], distance: number): Vec2[] {
  if (distance === 0 || points.length < 3) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }

  const edges: DirectedLine[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) continue;
    edges.push({
      p: { x: a.x + (dy / len) * distance, y: a.y + (-dx / len) * distance },
      d: { x: dx / len, y: dy / len },
    });
  }

  const result: Vec2[] = [];
  for (let i = 0; i < edges.length; i++) {
    result.push(intersectLines(edges[i]!, edges[(i + 1) % edges.length]!));
  }
  return result;
}

function intersectLines(a: DirectedLine, b: DirectedLine): Vec2 {
  const cross = a.d.x * b.d.y - a.d.y * b.d.x;
  if (Math.abs(cross) < 1e-12) {
    return { x: a.p.x, y: a.p.y };
  }
  const dx = b.p.x - a.p.x;
  const dy = b.p.y - a.p.y;
  const t = (dx * b.d.y - dy * b.d.x) / cross;
  return { x: a.p.x + t * a.d.x, y: a.p.y + t * a.d.y };
}
