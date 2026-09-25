/**
 * Joint Engine.
 *
 * Coordinates: X = width, Y = depth, Z = height, millimetres.
 * A joint tells the Dimension Engine how much larger the external envelope
 * is than the internal cavity. It does not own UI state.
 *
 * Closed tab-slot box: the cavity is closed by a sheet at each end of an axis.
 * Width loses side-1 and side-2, depth the front and back, height the bottom
 * and lid. Kerf and clearance describe the cut and the fit; they do not
 * change this nominal envelope.
 */
const JOINTS = {
  "tab-slot": createTabSlotJoint,
};

const CLOSED_TAB_SLOT_PANELS = {
  width: ["side-1", "side-2"],
  depth: ["front", "back"],
  height: ["bottom", "lid"],
};

export function createJoint(config = {}) {
  const type = config.type ?? "tab-slot";
  const build = JOINTS[type];
  if (!build) {
    const error = new Error(`Joint type "${type}" is not supported.`);
    error.code = "UNSUPPORTED_JOINT";
    throw error;
  }
  return build(config);
}

function createTabSlotJoint() {
  return {
    type: "tab-slot",
    getDimensionAdjustment(material) {
      const thickness = material.thickness;
      return {
        width: CLOSED_TAB_SLOT_PANELS.width.length * thickness,
        depth: CLOSED_TAB_SLOT_PANELS.depth.length * thickness,
        height: CLOSED_TAB_SLOT_PANELS.height.length * thickness,
      };
    },
    /**
     * Which side of a mating edge carries the protruding tabs.
     * Caps are female. Front and back receive the sides. The sides are male.
     */
    classifyEdge({ panelId, edge }) {
      if (panelId === "bottom" || panelId === "lid") return "female";
      if ((panelId === "front" || panelId === "back") && (edge === "left" || edge === "right")) {
        return "female";
      }
      return "male";
    },
    planFingers,
    featuresForEdge() {
      return { tabs: [], slots: [] };
    },
  };
}

/**
 * Odd finger count, ends included. The pitch stays as close as possible to
 * two thicknesses. Clearance narrows each tab and widens each slot.
 * Candidates that are not wider than the clearance are discarded first.
 */
export function planFingers({ span, thickness, clearance }) {
  if (!(span > 0) || !(thickness > 0) || !(clearance >= 0)) return null;
  const target = 2 * thickness;
  const floor = Math.max(clearance, target / 4);
  const maxCount = Math.max(3, Math.ceil(span / floor));
  let best = null;

  for (let count = 3; count <= maxCount; count += 2) {
    const fingerWidth = span / count;
    if (!(fingerWidth > clearance)) continue;
    const score = Math.abs(fingerWidth - target);
    if (
      best === null ||
      score < best.score - 1e-9 ||
      (Math.abs(score - best.score) <= 1e-9 && count > best.count)
    ) {
      best = { count, fingerWidth, score };
    }
  }

  if (!best) return null;
  return {
    count: best.count,
    fingerWidth: best.fingerWidth,
    tabWidth: best.fingerWidth - clearance,
    slotWidth: best.fingerWidth + clearance,
  };
}
