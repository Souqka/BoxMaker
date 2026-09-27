/**
 * Editor scene. Selection, hover, viewport zoom and layout commands live
 * here. Panel outlines, tabs and slots are not fields of this state.
 */
import { rotateLocalPoint } from "../geometry/layout.js";
import { boundingBox } from "../geometry/primitives.js";
import { zoomView } from "../renderers/viewport.js";
import { svgDeltaToLayout } from "./coordinates.js";

export const INTERACTION_MODES = ["idle", "hover", "select", "drag-panel", "pan", "zoom"];

const PANEL_TITLES = {
  lid: "Крышка",
  "side-1": "1 бок",
  front: "Перед",
  bottom: "Дно",
  back: "Зад",
  "side-2": "2 бок",
};

export function createEditorState({ minZoom = 0.1, maxZoom = 20, snapGrid = 5 } = {}) {
  let selection = null;
  let hoveredPanelId = null;
  let interaction = idleInteraction();
  let snap = { enabled: false, grid: snapGrid };

  return {
    limits: { minZoom, maxZoom },
    get selection() {
      return selection ? { ...selection } : null;
    },
    get hoveredPanelId() {
      return hoveredPanelId;
    },
    get interaction() {
      return {
        mode: interaction.mode,
        isDragging: interaction.isDragging,
        pointerStart: interaction.pointerStart ? { ...interaction.pointerStart } : null,
        initialValue: interaction.initialValue ? { ...interaction.initialValue } : null,
      };
    },
    get snap() {
      return { ...snap };
    },
    selectPanel(id) {
      selection = id ? { type: "panel", id } : null;
      if (!interaction.isDragging) interaction = { ...idleInteraction(), mode: selection ? "select" : "idle" };
      return selection ? { ...selection } : null;
    },
    selectEngraving(id) {
      selection = id ? { type: "engraving", id } : null;
      if (!interaction.isDragging) interaction = { ...idleInteraction(), mode: selection ? "select" : "idle" };
      return selection ? { ...selection } : null;
    },
    clearSelection() {
      selection = null;
      if (!interaction.isDragging) interaction = idleInteraction();
    },
    hover(id) {
      hoveredPanelId = id ?? null;
      if (interaction.isDragging) return hoveredPanelId;
      interaction = { ...idleInteraction(), mode: hoveredPanelId ? "hover" : selection ? "select" : "idle" };
      return hoveredPanelId;
    },
    setSnap(enabled, grid = snap.grid) {
      snap = { enabled: Boolean(enabled), grid };
      return { ...snap };
    },
    begin(mode, pointerStart = null, initialValue = null) {
      interaction = {
        mode,
        isDragging: mode === "drag-panel" || mode === "pan",
        pointerStart,
        initialValue,
      };
      return this.interaction;
    },
    end() {
      interaction = { ...idleInteraction(), mode: selection ? "select" : "idle" };
      return this.interaction;
    },
  };
}

export function pointerIntent({ button, space = false, onPanel = false } = {}) {
  if (button === 1 || space || !onPanel) return "pan";
  if (button === 0) return "select";
  return "idle";
}

export function resolvePointerRelease({ intent, moved, panelId }) {
  if (intent === "drag-panel") return { select: panelId, clear: false, commitDrag: true };
  if (intent === "select" && !moved) return { select: panelId, clear: false, commitDrag: false };
  if (intent === "pan" && !moved && !panelId) return { select: null, clear: true, commitDrag: false };
  return { select: undefined, clear: false, commitDrag: false };
}

export function applyShortcut(key, { ctrl = false, shift = false, typing = false } = {}) {
  if (typing) return { type: "ignore" };
  if (key === "Escape") return { type: "cancel" };
  if (key === "Delete" || key === "Backspace") return { type: "noop-delete" };
  if (key === "0") return { type: "fit" };
  if (ctrl && key.toLowerCase() === "z" && shift) return { type: "redo" };
  if (ctrl && key.toLowerCase() === "z") return { type: "undo" };
  if (ctrl && key.toLowerCase() === "y") return { type: "redo" };
  return { type: "ignore" };
}

export function createHistory() {
  const undoStack = [];
  const redoStack = [];
  return {
    push(snapshot) {
      undoStack.push(snapshot);
      redoStack.length = 0;
    },
    undo(current) {
      if (!undoStack.length) return null;
      redoStack.push(current);
      return undoStack.pop();
    },
    redo(current) {
      if (!redoStack.length) return null;
      undoStack.push(current);
      return redoStack.pop();
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
  };
}

export function movePanel(layout, panelId, x, y) {
  return {
    ...layout,
    placements: (layout.placements ?? []).map((placement) =>
      placement.panelId === panelId ? { ...placement, x, y } : placement,
    ),
  };
}

export function snapValue(value, grid) {
  if (!(grid > 0)) return value;
  return Math.round(value / grid) * grid;
}

export function draggedPlacement(initial, svgDelta, snap) {
  const delta = svgDeltaToLayout(svgDelta?.x ?? 0, svgDelta?.y ?? 0);
  let x = initial.x + delta.x;
  let y = initial.y + delta.y;
  if (snap?.enabled) {
    x = snapValue(x, snap.grid);
    y = snapValue(y, snap.grid);
  }
  return { x, y };
}

export function getPanelBounds(panel, placement) {
  const points = outlinePoints(panel).map((point) => layoutPoint(point, panel, placement));
  return boundingBox(points);
}

export function describeEngraving(engraving) {
  return {
    id: engraving.id,
    type: "engraving",
    title: "Гравировка",
    panelId: engraving.panelId,
    panelTitle: PANEL_TITLES[engraving.panelId] ?? engraving.panelId,
    name: engraving.name ?? "",
    x: engraving.x,
    y: engraving.y,
    width: engraving.width,
    height: engraving.height,
    rotation: engraving.rotation ?? 0,
  };
}

export function describePanel(panel, placement) {
  return {
    id: panel.id,
    type: "panel",
    title: PANEL_TITLES[panel.id] ?? panel.id,
    width: panel.width,
    height: panel.height,
    x: placement.x,
    y: placement.y,
    rotation: placement.rotation ?? 0,
  };
}

/**
 * Window that contains the original sheet and any panel that was dragged
 * outside it. Coordinates are SVG millimetres, y down.
 */
export function viewBounds(panels, layout) {
  const sheetWidth = Number(layout?.width) || 0;
  const sheetHeight = Number(layout?.height) || 0;
  let minX = 0;
  let minY = 0;
  let maxX = sheetWidth;
  let maxY = sheetHeight;
  const byId = new Map((panels ?? []).map((panel) => [panel.id, panel]));
  for (const placement of layout?.placements ?? []) {
    const panel = byId.get(placement.panelId);
    if (!panel) continue;
    const box = getPanelBounds(panel, placement);
    minX = Math.min(minX, box.minX);
    maxX = Math.max(maxX, box.maxX);
    minY = Math.min(minY, sheetHeight - box.maxY);
    maxY = Math.max(maxY, sheetHeight - box.minY);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 0),
    height: Math.max(maxY - minY, 0),
  };
}

export function layoutWarnings(panels, layout) {
  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  const placed = (layout.placements ?? [])
    .map((placement) => {
      const panel = byId.get(placement.panelId);
      if (!panel) return null;
      return { id: panel.id, bounds: getPanelBounds(panel, placement) };
    })
    .filter(Boolean);

  let overlap = false;
  let tight = false;
  const limit = Number(layout.gap) || 0;
  for (let index = 0; index < placed.length; index += 1) {
    for (let other = index + 1; other < placed.length; other += 1) {
      const gap = axisGap(placed[index].bounds, placed[other].bounds);
      if (gap.overlap) overlap = true;
      else if (limit > 0 && gap.distance + 1e-6 < limit) tight = true;
    }
  }

  const messages = [];
  if (overlap) messages.push("Детали пересекаются");
  if (tight) messages.push("Зазор между деталями меньше зазора раскладки");
  return { overlap, tight, messages };
}

export function geometryFingerprint(panels) {
  return JSON.stringify(
    panels.map((panel) => ({
      id: panel.id,
      width: panel.width,
      height: panel.height,
      outline: panel.outline,
      tabs: panel.tabs,
      slots: panel.slots,
    })),
  );
}

export function visibleGridStep(view, screenWidth, { base = 10, minPixels = 12, maxLines = 80, screenHeight = screenWidth } = {}) {
  const steps = [1, 5, 10, 50, 100, 250, 500, 1000, 5000];
  const scaleX = screenWidth > 0 && view?.width > 0 ? screenWidth / view.width : 1;
  const scaleY = screenHeight > 0 && view?.height > 0 ? screenHeight / view.height : scaleX;
  const pxPerMm = Math.min(scaleX, scaleY);
  let chosen = steps[steps.length - 1];
  for (const step of steps) {
    if (step < base) continue;
    if (step * pxPerMm >= minPixels && view.width / step <= maxLines) return step;
    chosen = step;
  }
  return chosen;
}

/**
 * Zoom factor is relative to the fitted window: 1 means fit.
 * The anchor stays on the same point in the window.
 */
export function zoomAround(view, factor, anchor, { minZoom = 0.1, maxZoom = 20, referenceWidth } = {}) {
  const current = referenceWidth > 0 && view.width > 0 ? referenceWidth / view.width : 1;
  const next = Math.min(maxZoom, Math.max(minZoom, current * factor));
  const applied = current === 0 ? 1 : next / current;
  if (Math.abs(applied - 1) < 1e-12) return { ...view, scale: current };
  return { ...zoomView(view, applied, anchor), scale: next };
}

function idleInteraction() {
  return { mode: "idle", isDragging: false, pointerStart: null, initialValue: null };
}

function outlinePoints(panel) {
  if (Array.isArray(panel.outline) && panel.outline.length) return panel.outline;
  return [
    { x: 0, y: 0 },
    { x: panel.width, y: 0 },
    { x: panel.width, y: panel.height },
    { x: 0, y: panel.height },
  ];
}

function layoutPoint(point, panel, placement) {
  const local = rotateLocalPoint(point, placement.rotation ?? 0, panel.width, panel.height);
  return {
    x: placement.x + local.x,
    y: placement.y + local.y,
  };
}

function axisGap(a, b) {
  const dx = Math.max(a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(a.minY - b.maxY, b.minY - a.maxY);
  if (dx < 0 && dy < 0) return { overlap: true, distance: 0 };
  if (dx < 0) return { overlap: false, distance: dy };
  if (dy < 0) return { overlap: false, distance: dx };
  return { overlap: false, distance: Math.hypot(dx, dy) };
}
