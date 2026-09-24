import { getConstruction } from "./dimension/constructions.ts";
import { resolveDimensions } from "./dimension/resolveDimensions.ts";
import { buildClosedBoxPanels } from "./geometry/closedBox.ts";
import { layoutPanels } from "./layout/layoutPanels.ts";
import type { BoxModel, BuildResult, Panel } from "./model/types.ts";
import { renderSvg } from "./svg/renderSvg.ts";
import { validateBox } from "./validation/validateBox.ts";

/**
 * Parameters → dimensions → joints → panels → sheet layout → SVG.
 * UI calls this and does not recalculate geometry.
 */
export function buildProduct(model: BoxModel): BuildResult {
  const issues = validateBox(model);
  if (issues.some((issue) => issue.severity === "error")) {
    return { ok: false, model, issues };
  }

  const dimensions = resolveDimensions({
    dimensions: model.dimensions,
    thickness: model.material.thickness,
    construction: getConstruction(model.construction),
  });

  let panels: Panel[];
  try {
    panels = buildClosedBoxPanels({
      external: dimensions.external,
      thickness: model.material.thickness,
      joint: model.joint,
      clearance: model.material.clearance,
      kerf: model.material.kerf,
      kerfCompensation: model.render.kerfCompensation,
    }).map((panel) => ({
      ...panel,
      engraving: model.engraving.filter((item) => item.panelId === panel.id),
    }));
  } catch (error) {
    return {
      ok: false,
      model,
      issues: [
        ...issues,
        {
          code: "geometry-failed",
          severity: "error",
          message: error instanceof Error ? error.message : "Не удалось построить геометрию.",
        },
      ],
    };
  }

  const layout = layoutPanels(panels, model.layout);
  const svg = renderSvg({
    layout,
    panels,
    kerfCompensation: model.render.kerfCompensation,
    gridStep: model.render.gridStep,
  });

  return { ok: true, model, issues, dimensions, panels, layout, svg };
}
