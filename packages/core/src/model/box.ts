import { suggestTabSlotPreset } from "./assumptions.ts";
import type { BoxModel, Material } from "./types.ts";

const DEFAULT_THICKNESS = 4;
const DEFAULT_CLEARANCE = 0.1;

/**
 * A documented starting model for the application.
 * Joint numbers come from `suggestTabSlotPreset` and stay overridable.
 */
export function createPresetBox(material?: Material): BoxModel {
  const sheet: Material = material ?? {
    id: "plywood-4",
    name: "Фанера 4 мм",
    thickness: DEFAULT_THICKNESS,
    kerf: 0.15,
    clearance: DEFAULT_CLEARANCE,
  };
  const joint = suggestTabSlotPreset(sheet.thickness, sheet.clearance);
  return {
    type: "box",
    construction: "closed-box",
    dimensions: {
      width: 300,
      depth: 200,
      height: 100,
      mode: "external",
    },
    material: sheet,
    joint: {
      type: "tab-slot",
      tabWidth: joint.tabWidth,
      edgeMargin: joint.edgeMargin,
      minGap: joint.minGap,
    },
    fabrication: {
      minimumFeatureSize: 1,
      minimumPanelSize: 20,
    },
    engraving: [],
    layout: {
      spacing: 12,
      margin: 10,
      maxRowWidth: 960,
    },
    render: {
      kerfCompensation: false,
      gridStep: 10,
    },
  };
}
