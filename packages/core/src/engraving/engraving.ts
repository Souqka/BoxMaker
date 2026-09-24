import type { EngravingItem, PanelId } from "../model/types.ts";
import type { Vec2 } from "../geometry/vec.ts";

export interface EngravingDraft {
  panelId: PanelId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  source: EngravingItem["source"];
  name: string;
  content: string;
  id?: string;
}

let sequence = 0;

export function createEngravingItem(draft: EngravingDraft): EngravingItem {
  sequence += 1;
  return {
    id: draft.id ?? `logo-${sequence}`,
    panelId: draft.panelId,
    x: draft.x,
    y: draft.y,
    width: draft.width,
    height: draft.height,
    rotation: draft.rotation ?? 0,
    source: draft.source,
    name: draft.name,
    content: draft.content,
  };
}

export function placeEngraving(items: readonly EngravingItem[], item: EngravingItem): EngravingItem[] {
  return [...items.filter((existing) => existing.id !== item.id), item];
}

export function moveEngraving(items: readonly EngravingItem[], id: string, x: number, y: number): EngravingItem[] {
  return mapOne(items, id, (item) => ({ ...item, x, y }));
}

export function scaleEngraving(items: readonly EngravingItem[], id: string, width: number, height: number): EngravingItem[] {
  return mapOne(items, id, (item) => ({ ...item, width, height }));
}

export function rotateEngraving(items: readonly EngravingItem[], id: string, rotation: number): EngravingItem[] {
  return mapOne(items, id, (item) => ({ ...item, rotation }));
}

export function removeEngraving(items: readonly EngravingItem[], id: string): EngravingItem[] {
  return items.filter((item) => item.id !== id);
}

export function duplicateEngraving(
  items: readonly EngravingItem[],
  id: string,
  delta: { dx: number; dy: number },
  newId?: string,
): EngravingItem[] {
  const source = items.find((item) => item.id === id);
  if (!source) return [...items];
  const copy = createEngravingItem({
    ...source,
    id: newId,
    x: source.x + delta.dx,
    y: source.y + delta.dy,
  });
  return [...items, copy];
}

/** Corners of the unrotated rectangle after CCW rotation around its center. */
export function snapToStep(value: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(value)) return value;
  return Math.round(value / step) * step;
}

export function engravingCorners(item: Pick<EngravingItem, "x" | "y" | "width" | "height" | "rotation">): Vec2[] {
  const hw = item.width / 2;
  const hh = item.height / 2;
  const local = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  const radians = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return local.map((point) => ({
    x: item.x + point.x * cos - point.y * sin,
    y: item.y + point.x * sin + point.y * cos,
  }));
}

export function engravingBounds(item: Pick<EngravingItem, "x" | "y" | "width" | "height" | "rotation">): {
  width: number;
  height: number;
} {
  const corners = engravingCorners(item);
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function mapOne(items: readonly EngravingItem[], id: string, update: (item: EngravingItem) => EngravingItem): EngravingItem[] {
  return items.map((item) => (item.id === id ? update(item) : item));
}
