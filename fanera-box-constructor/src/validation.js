import { normalizeDimensions } from "./geometry/dimensions.js";

export { PANEL_LIMITS, validatePanelSize } from "./geometry/panelLimits.js";

/**
 * Box-level input check. The 10 mm minimum lives in normalizeDimensions.
 * Cavity-versus-joint checks live in resolveDimensions.
 * Finished-part size checks live in validatePanelSize, which Geometry Engine
 * calls with a panel rather than with the box width, depth and height.
 * @returns {{ field: string, code: string, message: string }[]}
 */
export function validateBox(box = {}) {
  const result = normalizeDimensions({
    dimensions: {
      width: box.width,
      depth: box.depth,
      height: box.height,
    },
    dimensionMode: box.dimensionMode,
    material: box.material,
  });
  return result.valid ? [] : result.errors;
}
