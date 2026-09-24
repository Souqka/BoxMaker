import { normalizeDimensions } from "./geometry/dimensions.js";

/**
 * Box-level input check. Cavity-versus-joint checks live in resolveDimensions,
 * because they depend on the joint adjustment.
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
