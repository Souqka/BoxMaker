import type { EdgeId } from "../model/types.ts";
import { add2, scale2, type Vec2 } from "./vec.ts";

export interface OutlineFeature {
  role: "tab" | "slot";
  edge: EdgeId;
  /** Start along the CCW walk of the edge, mm. */
  offset: number;
  width: number;
  depth: number;
}

const EDGES: readonly EdgeId[] = ["bottom", "right", "top", "left"];

/**
 * CCW outline of a rectangle with outward tabs and inward edge notches.
 * Local origin is the nominal bottom-left. +Y is up. Units are millimetres.
 */
export function buildOutline(width: number, height: number, features: readonly OutlineFeature[]): Vec2[] {
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Номинальный размер панели должен быть больше нуля.");
  }

  const byEdge = new Map<EdgeId, OutlineFeature[]>();
  for (const edge of EDGES) byEdge.set(edge, []);
  for (const feature of features) {
    byEdge.get(feature.edge)?.push(feature);
  }

  const points: Vec2[] = [];
  for (const edge of EDGES) {
    const length = edgeLength(edge, width, height);
    const items = [...(byEdge.get(edge) ?? [])].sort((a, b) => a.offset - b.offset);
    push(points, pointOnEdge(edge, 0, width, height));
    let cursor = 0;
    for (const feature of items) {
      if (feature.offset < cursor - 1e-6 || feature.width <= 0 || feature.depth < 0) {
        throw new Error(`Элемент соединения на кромке ${edge} пересекается или имеет некорректный размер.`);
      }
      if (feature.offset + feature.width > length + 1e-6) {
        throw new Error(`Элемент соединения выходит за кромку ${edge}.`);
      }
      push(points, pointOnEdge(edge, feature.offset, width, height));
      const outward = outwardNormal(edge);
      const side = feature.role === "tab" ? outward : scale2(outward, -1);
      const depth = scale2(side, feature.depth);
      push(points, add2(pointOnEdge(edge, feature.offset, width, height), depth));
      push(points, add2(pointOnEdge(edge, feature.offset + feature.width, width, height), depth));
      push(points, pointOnEdge(edge, feature.offset + feature.width, width, height));
      cursor = feature.offset + feature.width;
    }
    push(points, pointOnEdge(edge, length, width, height));
  }

  if (points.length > 1) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    if (Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9) {
      points.pop();
    }
  }
  return points;
}

function edgeLength(edge: EdgeId, width: number, height: number): number {
  return edge === "bottom" || edge === "top" ? width : height;
}

export function pointOnEdge(edge: EdgeId, t: number, width: number, height: number): Vec2 {
  switch (edge) {
    case "bottom":
      return { x: t, y: 0 };
    case "right":
      return { x: width, y: t };
    case "top":
      return { x: width - t, y: height };
    case "left":
      return { x: 0, y: height - t };
  }
}

export function outwardNormal(edge: EdgeId): Vec2 {
  switch (edge) {
    case "bottom":
      return { x: 0, y: -1 };
    case "right":
      return { x: 1, y: 0 };
    case "top":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
  }
}

function push(points: Vec2[], point: Vec2): void {
  const prev = points[points.length - 1];
  if (prev && Math.abs(prev.x - point.x) < 1e-9 && Math.abs(prev.y - point.y) < 1e-9) return;
  points.push(point);
}
