import { resolveDimensions } from "./dimensions.js";
import { generateBoxGeometry } from "./generate.js";
import { createJoint } from "./joints.js";
import { PANEL_LIMITS } from "./panelLimits.js";

/**
 * User parameters → Dimension Engine → Geometry Engine → layout.
 * The page calls this. Geometry itself never reads the DOM.
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

  const generated = generateBoxGeometry({
    dimensions: {
      external: dimensions.external,
      internal: dimensions.internal,
    },
    material: dimensions.material,
    joint,
    layout: { gap: box.layoutGap ?? 10 },
  });

  if (!generated.validation.valid) {
    return { ok: false, issues: generated.validation.errors };
  }

  return {
    ok: true,
    issues: [],
    geometry: {
      dimensions,
      material: dimensions.material,
      construction: box.construction,
      jointType: box.construction,
      panelLimits: { ...PANEL_LIMITS },
      box: generated.box,
      panels: generated.panels,
      layout: generated.layout,
      validation: generated.validation,
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
