import { boundsOf, type Vec2 } from "../geometry/vec.ts";
import type { LayoutSettings, Panel, SheetLayout, SheetPlacement } from "../model/types.ts";

/**
 * Places panel bounding boxes (tabs included) in a single row, y-up, millimetres.
 * This is sheet arrangement, not the assembly pose.
 */
export function layoutPanels(panels: readonly Panel[], settings: LayoutSettings): SheetLayout {
  const placements: SheetPlacement[] = [];
  let x = settings.margin;
  let y = settings.margin;
  let rowHeight = 0;
  let width = settings.margin;

  for (const panel of panels) {
    const bounds = boundsOf(panel.geometry.outline);
    if (x > settings.margin && x + bounds.width > settings.maxRowWidth) {
      x = settings.margin;
      y += rowHeight + settings.spacing;
      rowHeight = 0;
    }
    placements.push({
      panelId: panel.id,
      x,
      y,
      width: bounds.width,
      height: bounds.height,
    });
    x += bounds.width + settings.spacing;
    rowHeight = Math.max(rowHeight, bounds.height);
    width = Math.max(width, x - settings.spacing + settings.margin);
  }

  return {
    width,
    height: y + rowHeight + settings.margin,
    placements,
  };
}

/** Inverse of the sheet placement used by the SVG renderer. Both spaces are y-up millimetres. */
export function sheetPointToPanel(panel: Panel, placement: SheetPlacement, sheet: Vec2): Vec2 {
  const bounds = boundsOf(panel.geometry.outline);
  return {
    x: sheet.x - placement.x + bounds.minX,
    y: sheet.y - placement.y + bounds.minY,
  };
}

export function movePlacement(layout: SheetLayout, panelId: SheetPlacement["panelId"], x: number, y: number): SheetLayout {
  return {
    ...layout,
    placements: layout.placements.map((placement) =>
      placement.panelId === panelId ? { ...placement, x, y } : placement,
    ),
  };
}
