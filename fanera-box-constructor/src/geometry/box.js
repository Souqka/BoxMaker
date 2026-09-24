import { resolveDimensions } from "./dimensions.js";
import { createJoint } from "./joints.js";
import { layoutPanels } from "./layout.js";
import { PANEL_LIMITS } from "./panelLimits.js";
import { createBoxPanels } from "./panels.js";

/**
 * User parameters → Dimension Engine → placeholder panels → sheet layout.
 * The result is the handoff for Geometry Engine: both envelopes, material,
 * construction, the 700 × 500 panel limit, and the standard layout.
 * validatePanelSize is not applied here. Placeholder rectangles are not
 * finished parts, and the limit is not a check of the box width.
 */
export function buildBoxGeometry(box) {
  let joint;
  try {
    joint = createJoint({ type: box.construction });
  } catch (cause) {
    return {
      ok: false,
      issues: [
        {
          field: "joint",
          code: cause.code ?? "UNSUPPORTED_JOINT",
          message: cause.message || "This joint type is not supported.",
        },
      ],
    };
  }

  const dimensions = resolveDimensions({
    dimensions: {
      width: box.width,
      depth: box.depth,
      height: box.height,
    },
    dimensionMode: box.dimensionMode,
    material: box.material,
    joint,
  });

  if (!dimensions.valid) {
    return { ok: false, issues: dimensions.errors };
  }

  const panels = createBoxPanels(dimensions, joint);
  const layout = layoutPanels(panels);

  return {
    ok: true,
    issues: [],
    geometry: {
      dimensions,
      material: dimensions.material,
      construction: box.construction,
      jointType: box.construction,
      panelLimits: { ...PANEL_LIMITS },
      panels,
      layout,
    },
  };
}

/**
 * Reads the envelopes produced by the Dimension Engine.
 * A later geometry step can measure panels instead of returning this object.
 */
export function measureEnvelope(geometry) {
  return {
    external: { ...geometry.dimensions.external },
    internal: { ...geometry.dimensions.internal },
  };
}
