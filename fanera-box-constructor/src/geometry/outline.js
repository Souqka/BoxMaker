/**
 * Walks a panel boundary counter-clockwise and folds tabs or slots into the
 * point list. Male edges pass the root line; tabs step outward. Female edges
 * pass the outer line; slots step inward.
 */

export function tracePanel(edges) {
  const points = [];
  const tabs = [];
  const slots = [];

  for (const edge of edges) {
    traceEdge(points, tabs, slots, edge);
  }

  return { points, tabs, slots };
}

function traceEdge(points, tabs, slots, edge) {
  const length = Math.hypot(edge.x1 - edge.x0, edge.y1 - edge.y0);
  const ux = (edge.x1 - edge.x0) / length;
  const uy = (edge.y1 - edge.y0) / length;
  const span0 = edge.margin0;
  const span1 = length - edge.margin1;
  const count = edge.plan.count;
  const finger = (span1 - span0) / count;
  const clearance = edge.plan.fingerWidth - edge.plan.tabWidth;
  const half = clearance / 2;
  const plain = edge.role === "male" ? "root" : "outer";

  const at = (distance, side) => {
    const x = edge.x0 + ux * distance;
    const y = edge.y0 + uy * distance;
    const shift = side === "root" || side === "outer" ? 0 : edge.thickness;
    const sign = side === "pocket" ? -1 : 1;
    return {
      x: x + edge.outwardX * shift * sign,
      y: y + edge.outwardY * shift * sign,
    };
  };

  push(points, at(0, plain));

  for (let index = 0; index < count; index += 1) {
    const start = span0 + index * finger;
    const end = index === count - 1 ? span1 : span0 + (index + 1) * finger;
    const cut = index % 2 === 0;

    if (edge.role === "male" && cut) {
      const tabStart = start + half;
      const tabEnd = end - half;
      push(points, at(tabStart, "root"));
      push(points, at(tabStart, "tip"));
      push(points, at(tabEnd, "tip"));
      push(points, at(tabEnd, "root"));
      tabs.push({
        edge: edge.name,
        start: tabStart,
        width: tabEnd - tabStart,
        depth: edge.thickness,
      });
    } else if (edge.role === "female" && cut) {
      const slotStart = start - half;
      const slotEnd = end + half;
      push(points, at(slotStart, "outer"));
      push(points, at(slotStart, "pocket"));
      push(points, at(slotEnd, "pocket"));
      push(points, at(slotEnd, "outer"));
      slots.push({
        edge: edge.name,
        start: slotStart,
        width: slotEnd - slotStart,
        depth: edge.thickness,
      });
    }
  }

  push(points, at(length, plain));
}

function push(points, point) {
  const previous = points[points.length - 1];
  if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) <= 1e-9) return;
  points.push(point);
}
