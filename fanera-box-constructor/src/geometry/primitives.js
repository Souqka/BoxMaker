/**
 * Flat geometry in millimetres. Outlines are point lists, not SVG paths.
 */

const EPS = 1e-9;

export function boundingBox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function polygonArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

export function dedupePoints(points) {
  const cleaned = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) <= EPS) continue;
    cleaned.push({ x: point.x, y: point.y });
  }
  if (cleaned.length > 1) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= EPS) cleaned.pop();
  }
  return cleaned;
}

/**
 * A simple polygon has at least three points, positive area, and no
 * non-adjacent edges that cross or overlap.
 */
export function outlineProblems(points) {
  const problems = [];
  if (points.length < 3) {
    problems.push("Outline needs at least three points.");
    return problems;
  }
  const unique = new Set(points.map((point) => `${Math.round(point.x / EPS)}:${Math.round(point.y / EPS)}`));
  if (unique.size < 3) problems.push("Outline needs at least three distinct points.");
  if (!(polygonArea(points) > EPS)) problems.push("Outline area must be positive.");
  const box = boundingBox(points);
  if (!(box.width > EPS) || !(box.height > EPS)) problems.push("Outline bounding box must be positive.");

  const count = points.length;
  for (let index = 0; index < count; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % count];
    for (let other = index + 1; other < count; other += 1) {
      if (adjacent(index, other, count)) continue;
      const c = points[other];
      const d = points[(other + 1) % count];
      if (segmentsConflict(a, b, c, d)) {
        problems.push("Outline edges intersect.");
        return problems;
      }
    }
  }
  return problems;
}

function adjacent(index, other, count) {
  const gap = Math.min(Math.abs(index - other), count - Math.abs(index - other));
  return gap <= 1;
}

function segmentsConflict(a, b, c, d) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const denom = cross(abx, aby, cdx, cdy);
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  if (Math.abs(denom) <= EPS) {
    if (Math.abs(cross(acx, acy, abx, aby)) > EPS) return false;
    return rangesOverlap(a, b, c, d);
  }
  const t = cross(acx, acy, cdx, cdy) / denom;
  const u = cross(acx, acy, abx, aby) / denom;
  return t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS;
}

function rangesOverlap(a, b, c, d) {
  const useX = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const a0 = useX ? a.x : a.y;
  const a1 = useX ? b.x : b.y;
  const b0 = useX ? c.x : c.y;
  const b1 = useX ? d.x : d.y;
  const minA = Math.min(a0, a1);
  const maxA = Math.max(a0, a1);
  const minB = Math.min(b0, b1);
  const maxB = Math.max(b0, b1);
  return Math.min(maxA, maxB) - Math.max(minA, minB) > EPS;
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}
