import type { EdgeId, PanelId } from "../model/types.ts";

export interface NominalSize {
  width: number;
  height: number;
}

/**
 * Maps a contact coordinate `s` onto the CCW outline parameter of a panel edge.
 *
 * `s` starts at the documented origin of that contact (bottom of a vertical
 * joint, or the left / front end of a horizontal joint) and increases with
 * the box axis. `size` is the feature length along the same axis.
 * `thickness` is the wall inset where a shorter panel meets a full-size wall.
 */
export function contactToOutlineOffset(
  panelId: PanelId,
  edge: EdgeId,
  s: number,
  size: number,
  nominal: NominalSize,
  thickness: number,
): number {
  const key = `${family(panelId)}.${edge}`;
  switch (key) {
    case "front.left":
    case "back.left":
    case "side.left":
    case "bottom.left":
      return nominal.height - s - size;
    case "front.right":
    case "back.right":
    case "side.right":
    case "bottom.right":
      return s;
    case "front.bottom":
      return thickness + s;
    case "front.top":
      return nominal.width - thickness - s - size;
    case "back.bottom":
      return nominal.width - thickness - s - size;
    case "back.top":
      return thickness + s;
    case "side.bottom":
    case "bottom.bottom":
      return s;
    case "side.top":
    case "bottom.top":
      return nominal.width - s - size;
    default:
      throw new Error(`Нет отображения кромки ${panelId}.${edge}.`);
  }
}

function family(panelId: PanelId): "front" | "back" | "side" | "bottom" {
  if (panelId === "front" || panelId === "back") return panelId;
  if (panelId === "left" || panelId === "right") return "side";
  return "bottom";
}
