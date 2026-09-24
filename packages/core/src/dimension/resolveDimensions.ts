import type { ResolvedDimensions, UserDimensions } from "../model/types.ts";
import type { ConstructionRules } from "./constructions.ts";

export interface DimensionInput {
  dimensions: UserDimensions;
  thickness: number;
  construction: ConstructionRules;
}

/**
 * Converts the size the user typed into both envelopes.
 * The added length on each axis is `thicknessCount[axis] * thickness`.
 */
export function resolveDimensions(input: DimensionInput): ResolvedDimensions {
  const { dimensions, thickness, construction } = input;
  const delta = {
    width: construction.thicknessCount.width * thickness,
    depth: construction.thicknessCount.depth * thickness,
    height: construction.thicknessCount.height * thickness,
  };

  const external =
    dimensions.mode === "external"
      ? { width: dimensions.width, depth: dimensions.depth, height: dimensions.height }
      : {
          width: dimensions.width + delta.width,
          depth: dimensions.depth + delta.depth,
          height: dimensions.height + delta.height,
        };

  const internal = {
    width: external.width - delta.width,
    depth: external.depth - delta.depth,
    height: external.height - delta.height,
  };

  return {
    construction: construction.id,
    external,
    internal,
    thickness,
  };
}
