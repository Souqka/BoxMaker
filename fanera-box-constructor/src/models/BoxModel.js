import { createMaterial } from "./Material.js";

/**
 * Parametric box. Sizes are millimetres.
 * `dimensionMode` says whether width/depth/height are the outside envelope
 * or the useful cavity. The Dimension Engine is the only place that turns
 * one into the other.
 */
export function createBox(input = {}) {
  return {
    width: input.width,
    depth: input.depth,
    height: input.height,
    dimensionMode: input.dimensionMode,
    material: createMaterial(input.material),
    construction: input.construction ?? "tab-slot",
  };
}
