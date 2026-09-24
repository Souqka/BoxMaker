/**
 * Dimension Engine.
 *
 * The entered mode is copied onto `external` or `internal`.
 * The opposite envelope comes only from `joint.projectOppositeEnvelope`.
 * That method is a stub until the construction-aware engine replaces it.
 */
export function resolveDimensions({ dimensions, material, joint }) {
  const entered = {
    width: dimensions.width,
    depth: dimensions.depth,
    height: dimensions.height,
  };
  const opposite = joint.projectOppositeEnvelope(dimensions.mode, entered, material);

  if (dimensions.mode === "internal") {
    return {
      external: opposite,
      internal: entered,
      provisional: joint.envelopeIsProvisional === true,
    };
  }

  return {
    external: entered,
    internal: opposite,
    provisional: joint.envelopeIsProvisional === true,
  };
}
