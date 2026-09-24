import { resolveDimensions } from "./dimensions.js";
import { createJoint } from "./joints.js";
import { layoutPanels } from "./layout.js";
import { createBoxPanels } from "./panels.js";

/**
 * User parameters → Dimension Engine → panels → sheet layout.
 * Panel outlines are still placeholders. The joint object is shared so a
 * later geometry step can read the same construction the sizes used.
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
      jointType: box.construction,
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
