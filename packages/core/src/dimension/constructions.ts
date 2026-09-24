import type { ConstructionId } from "../model/types.ts";

/**
 * How many sheet thicknesses sit between the internal cavity and the
 * external envelope on each axis.
 *
 * `closed-box`: left+right, front+back, bottom+lid. This is not a global law —
 * an open box would use height: 1, a slip lid would use a different count.
 */
export interface ConstructionRules {
  id: ConstructionId;
  thicknessCount: {
    width: number;
    depth: number;
    height: number;
  };
}

export const CLOSED_BOX: ConstructionRules = {
  id: "closed-box",
  thicknessCount: { width: 2, depth: 2, height: 2 },
};

const CONSTRUCTIONS: Record<ConstructionId, ConstructionRules> = {
  "closed-box": CLOSED_BOX,
};

export function getConstruction(id: ConstructionId): ConstructionRules {
  return CONSTRUCTIONS[id];
}
