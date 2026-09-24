import { resolveDimensions } from "./dimensions.js";
import { createJoint } from "./joints.js";
import { layoutPanels } from "./layout.js";
import { createBoxPanels } from "./panels.js";
import { validateBox } from "../validation.js";

/**
 * User parameters → joint → dimensions → panels → sheet layout.
 * Renderers consume the returned geometry and do not recalculate it.
 */
export function buildBoxGeometry(box) {
  const issues = validateBox(box);
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  let joint;
  try {
    joint = createJoint({ type: box.construction });
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          code: error.code ?? "unsupported-joint",
          message: error.message,
          path: "construction",
        },
      ],
    };
  }

  const dimensions = resolveDimensions({
    dimensions: {
      width: box.width,
      depth: box.depth,
      height: box.height,
      mode: box.dimensionMode,
    },
    material: box.material,
    joint,
  });
  const panels = createBoxPanels(dimensions, joint);
  const layout = layoutPanels(panels);

  return {
    ok: true,
    issues: [],
    geometry: {
      dimensions,
      jointType: joint.type,
      panels,
      layout,
    },
  };
}

/**
 * Reads the envelopes back from a built geometry.
 * Today it returns the Dimension Engine result. When panels carry a real
 * construction, this function should measure them instead.
 */
export function measureEnvelope(geometry) {
  return {
    external: { ...geometry.dimensions.external },
    internal: { ...geometry.dimensions.internal },
  };
}
