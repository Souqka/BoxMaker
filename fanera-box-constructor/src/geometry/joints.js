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
    featuresForEdge() {
      return { tabs: [], slots: [] };
    },
  };
}
