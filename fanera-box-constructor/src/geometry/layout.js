/**
 * Layout Model. Millimetres, y-up. This is where a panel sits on the sheet,
 * not the shape of the panel.
 *
 * The standard scheme is a net. Panels that share a fold are placed on that
 * edge, and the two edges have the same length:
 *
 *                 lid          same width and depth as the bottom
 *                  |           shared edge = bottom width
 *                 back         width × height
 *                  |
 *   side-1 — bottom — side-2   sides turned so their depth edge
 *                  |           meets the bottom's depth edge
 *                front         width × height
 *
 * Bottom and lid keep width across and depth up. Front and back meet the
 * width edges. side-1 and side-2 meet the depth edges, so they are rotated
 * a quarter turn. The lid is turned 180° so its back edge faces the back panel.
 *
 * x and y are the bottom-left of the unrotated part. rotation is degrees
 * counter-clockwise around the part centre.
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
    const footprint = placementFootprint(byId.get(placement.panelId), placement);
    minX = Math.min(minX, footprint.x);
    minY = Math.min(minY, footprint.y);
    maxX = Math.max(maxX, footprint.x + footprint.width);
    maxY = Math.max(maxY, footprint.y + footprint.height);
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

/**
 * Axis-aligned box of a placed panel, after its layout rotation.
 * Width and height here are the size on the sheet, not the unrotated part.
 */
export function placementFootprint(panel, placement) {
  const bounds = rotatedBounds(panel.width, panel.height, placement.rotation ?? 0);
  return {
    x: placement.x + bounds.minX,
    y: placement.y + bounds.minY,
    width: bounds.width,
    height: bounds.height,
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

  if (bottom) positions.push(place("bottom", 0, 0, 0, bottom));
  if (front) positions.push(place("front", 0, -gap - front.height, 0, front));
  if (back) positions.push(place("back", 0, bottomHeight + gap, 0, back));
  if (side1) {
    const footprint = rotatedBounds(side1.width, side1.height, 90);
    positions.push(place("side-1", -gap - footprint.width, 0, 90, side1));
  }
  if (lid) {
    const backHeight = back?.height ?? 0;
    const belowLid = back ? bottomHeight + gap + backHeight + gap : bottomHeight + gap;
    positions.push(place("lid", 0, belowLid, 180, lid));
  }
  if (side2) {
    const footprint = rotatedBounds(side2.width, side2.height, -90);
    positions.push(place("side-2", bottomWidth + gap, 0, -90, side2));
  }
  return positions;
}

function place(panelId, visualX, visualY, rotation, panel) {
  const bounds = rotatedBounds(panel.width, panel.height, rotation);
  return {
    panelId,
    x: visualX - bounds.minX,
    y: visualY - bounds.minY,
    rotation,
  };
}

function rotatedBounds(width, height, rotation) {
  const turn = ((rotation % 360) + 360) % 360;
  if (turn === 90 || turn === 270) {
    return {
      minX: (width - height) / 2,
      minY: (height - width) / 2,
      width: height,
      height: width,
    };
  }
  return { minX: 0, minY: 0, width, height };
}
