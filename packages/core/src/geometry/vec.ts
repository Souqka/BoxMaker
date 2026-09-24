/** Millimetre-space vectors. This module does not know about pixels. */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Size3 {
  width: number;
  depth: number;
  height: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export const MM_EPSILON = 1e-6;

export function almostEqual(a: number, b: number, epsilon = MM_EPSILON): boolean {
  return Math.abs(a - b) <= epsilon;
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function add2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale2(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k };
}

export function boundsOf(points: readonly Vec2[]): Bounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Signed area of a closed ring (first point is not repeated). Positive means CCW. */
export function polygonArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function cloneRing(points: readonly Vec2[]): Vec2[] {
  return points.map((p) => ({ x: p.x, y: p.y }));
}
