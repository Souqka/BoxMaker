const JOINTS = {
  "tab-slot": createTabSlotJoint,
};

/**
 * Joint Engine entry point. Geometry asks this object for features and for
 * the envelope projection. It does not switch on `joint.type` itself.
 */
export function createJoint(config = {}) {
  const type = config.type ?? "tab-slot";
  const build = JOINTS[type];
  if (!build) {
    const error = new Error(`Соединение «${type}» пока не поддерживается.`);
    error.code = "unsupported-joint";
    throw error;
  }
  return build(config);
}

/**
 * Tab-and-slot placeholder.
 * `projectOppositeEnvelope` is the seam the Dimension Engine will replace
 * when panel positions exist. Today it keeps the typed size, so the app
 * does not pretend that internal = external − 2 × thickness.
 */
function createTabSlotJoint() {
  return {
    type: "tab-slot",
    envelopeIsProvisional: true,
    projectOppositeEnvelope(_mode, size, _material) {
      return {
        width: size.width,
        depth: size.depth,
        height: size.height,
      };
    },
    featuresForEdge(_edge) {
      return { tabs: [], slots: [] };
    },
  };
}
