/**
 * Layout Model. Millimetres, y-up. This is where a panel sits on the sheet,
 * not the shape of the panel. Geometry owns outline, tabs, slots, cutouts
 * and engraving. A later scheme can replace "standard" without changing
 * the renderer or the panel model.
 *
 * Standard scheme, logical preview rather than the production joint order:
 *
 *              lid
 *               |
 *            side-1
 *               |
 *     front — bottom — back
 *               |
 *            side-2
 *
 * x and y are the bottom-left of the unrotated part. rotation is degrees
 * counter-clockwise around the part centre. The standard scheme uses 0.
 */
export function layoutPanels(panels, { gap = 12, margin = 10 } = {}) {
  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  const raw = standardPositions(byId, gap);
  if (raw.length === 0) {
    return { scheme: "standard", unit: "mm", width: margin * 2, height: margin * 2, placements: [] };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const placement of raw) {
    const panel = byId.get(placement.panelId);
    minX = Math.min(minX, placement.x);
    minY = Math.min(minY, placement.y);
    maxX = Math.max(maxX, placement.x + panel.width);
    maxY = Math.max(maxY, placement.y + panel.height);
  }

  const shiftX = margin - minX;
  const shiftY = margin - minY;
  return {
    scheme: "standard",
    unit: "mm",
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
    placements: raw.map((placement) => ({
      panelId: placement.panelId,
      x: placement.x + shiftX,
      y: placement.y + shiftY,
      rotation: placement.rotation,
    })),
  };
}

function standardPositions(byId, gap) {
  const bottom = byId.get("bottom");
  const front = byId.get("front");
  const back = byId.get("back");
  const side1 = byId.get("side-1");
  const side2 = byId.get("side-2");
  const lid = byId.get("lid");
  const bottomWidth = bottom?.width ?? 0;
  const bottomHeight = bottom?.height ?? 0;
  const positions = [];

  if (bottom) positions.push(placement("bottom", 0, 0));
  if (front) {
    positions.push(placement("front", -gap - front.width, (bottomHeight - front.height) / 2));
  }
  if (back) {
    positions.push(placement("back", bottomWidth + gap, (bottomHeight - back.height) / 2));
  }
  if (side1) {
    positions.push(placement("side-1", (bottomWidth - side1.width) / 2, bottomHeight + gap));
  }
  if (lid) {
    const belowLid = side1 ? bottomHeight + gap + side1.height + gap : bottomHeight + gap;
    positions.push(placement("lid", (bottomWidth - lid.width) / 2, belowLid));
  }
  if (side2) {
    positions.push(placement("side-2", (bottomWidth - side2.width) / 2, -gap - side2.height));
  }
  return positions;
}

function placement(panelId, x, y) {
  return { panelId, x, y, rotation: 0 };
}
