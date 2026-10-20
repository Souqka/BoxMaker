import assert from "node:assert/strict";
import test from "node:test";
import { screenToWorld, svgDeltaToLayout, worldToScreen } from "../src/editor/coordinates.js";
import {
  applyShortcut,
  createEditorState,
  createHistory,
  describePanel,
  draggedPlacement,
  geometryFingerprint,
  getPanelBounds,
  layoutWarnings,
  movePanel,
  viewBounds,
  pointerIntent,
  resolvePointerRelease,
  snapValue,
  visibleGridStep,
  zoomAround,
} from "../src/editor/scene.js";
import { buildBoxGeometry } from "../src/geometry/box.js";
import { createBox } from "../src/models/BoxModel.js";
import { renderSvg } from "../src/renderers/svg.js";
import { calculateLayoutBounds, fitLayoutToViewport, panView } from "../src/renderers/viewport.js";

const ABS = 1e-6;

function near(actual, expected, epsilon = ABS) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

function sample() {
  return buildBoxGeometry(
    createBox({
      width: 300,
      depth: 200,
      height: 100,
      dimensionMode: "external",
      material: { thickness: 4, kerf: 0.15, clearance: 0.1 },
    }),
  );
}

test("selecting a panel stores editor selection and leaves the panel object alone", () => {
  const editor = createEditorState();
  const panel = { id: "bottom", width: 300, height: 200, outline: [] };
  const keys = Object.keys(panel);
  const selection = editor.selectPanel("bottom");
  assert.deepEqual(selection, { type: "panel", id: "bottom" });
  assert.equal(editor.selection.id, "bottom");
  assert.equal(editor.interaction.mode, "select");
  editor.clearSelection();
  assert.equal(editor.selection, null);
  assert.equal(editor.interaction.mode, "idle");
  assert.deepEqual(Object.keys(panel), keys);
  assert.equal(panel.isSelected, undefined);
});

test("hover sets hoveredPanelId and clears it", () => {
  const editor = createEditorState();
  editor.selectPanel("bottom");
  assert.equal(editor.hover("front"), "front");
  assert.equal(editor.hoveredPanelId, "front");
  assert.equal(editor.interaction.mode, "hover");
  assert.equal(editor.selection.id, "bottom");
  editor.hover(null);
  assert.equal(editor.hoveredPanelId, null);
  assert.equal(editor.selection.id, "bottom");
});

test("click release selects, an empty click clears, and drag does not pan", () => {
  assert.equal(pointerIntent({ button: 0, onPanel: true }), "select");
  assert.equal(pointerIntent({ button: 0, onPanel: false }), "pan");
  assert.equal(pointerIntent({ button: 1, onPanel: true }), "pan");
  assert.equal(pointerIntent({ button: 0, onPanel: true, space: true }), "pan");
  assert.deepEqual(resolvePointerRelease({ intent: "select", moved: false, panelId: "bottom" }), {
    select: "bottom",
    clear: false,
    commitDrag: false,
  });
  assert.equal(resolvePointerRelease({ intent: "pan", moved: false, panelId: null }).clear, true);
  assert.equal(resolvePointerRelease({ intent: "pan", moved: false, panelId: "bottom" }).clear, false);
  const drag = resolvePointerRelease({ intent: "drag-panel", moved: true, panelId: "bottom" });
  assert.equal(drag.commitDrag, true);
  assert.equal(drag.clear, false);
  assert.notEqual(pointerIntent({ button: 0, onPanel: true }), "pan");
});

test("screen and world coordinates round-trip", () => {
  const viewport = { x: 10, y: 20, width: 200, height: 100 };
  const rect = { left: 5, top: 15, width: 400, height: 400 };
  const world = { x: 110, y: 70 };
  const screen = worldToScreen({ ...world, viewport, rect });
  const back = screenToWorld({ clientX: screen.x, clientY: screen.y, viewport, rect });
  near(back.x, world.x);
  near(back.y, world.y);
  assert.deepEqual(svgDeltaToLayout(10, 5), { x: 10, y: -5 });
});

test("zoom and pan change the window and not the geometry", () => {
  const built = sample();
  const before = geometryFingerprint(built.geometry.panels);
  const bounds = calculateLayoutBounds(built.geometry.layout);
  const fitted = fitLayoutToViewport({
    layoutBounds: bounds,
    viewportWidth: 800,
    viewportHeight: 500,
    padding: 16,
  });
  assert.ok(fitted.x <= bounds.x);
  assert.ok(fitted.y <= bounds.y);
  assert.ok(fitted.x + fitted.width >= bounds.x + bounds.width);
  assert.ok(fitted.y + fitted.height >= bounds.y + bounds.height);

  const anchor = { x: bounds.x + 120, y: bounds.y + 80 };
  const zoomed = zoomAround(
    { x: fitted.x, y: fitted.y, width: fitted.width, height: fitted.height },
    2,
    anchor,
    { minZoom: 0.1, maxZoom: 20, referenceWidth: fitted.width },
  );
  near(zoomed.scale, 2);
  near(zoomed.width, fitted.width / 2);
  near(zoomed.height, fitted.height / 2);
  near((anchor.x - zoomed.x) / zoomed.width, (anchor.x - fitted.x) / fitted.width);
  near((anchor.y - zoomed.y) / zoomed.height, (anchor.y - fitted.y) / fitted.height);

  const limited = zoomAround(zoomed, 100, anchor, { minZoom: 0.1, maxZoom: 20, referenceWidth: fitted.width });
  near(limited.scale, 20);

  const panned = panView(zoomed, 12, -4);
  near(panned.x, zoomed.x + 12);
  near(panned.width, zoomed.width);
  assert.equal(geometryFingerprint(built.geometry.panels), before);
  assert.equal(built.geometry.panels.find((panel) => panel.id === "bottom").width, 300);
});

test("drag moves layout and keeps geometry, including a rotated panel", () => {
  const built = sample();
  const before = geometryFingerprint(built.geometry.panels);
  const bottom = built.geometry.panels.find((panel) => panel.id === "bottom");
  const bottomPlace = built.geometry.layout.placements.find((item) => item.panelId === "bottom");
  const next = draggedPlacement(bottomPlace, { x: 10, y: 5 }, { enabled: false, grid: 5 });
  near(next.x, bottomPlace.x + 10);
  near(next.y, bottomPlace.y - 5);
  const moved = movePanel(built.geometry.layout, "bottom", next.x, next.y);
  assert.equal(moved.placements.find((item) => item.panelId === "bottom").x, next.x);
  assert.equal(built.geometry.layout.placements.find((item) => item.panelId === "bottom").x, bottomPlace.x);
  assert.equal(bottom.width, 300);
  assert.equal(bottom.height, 200);

  const side = built.geometry.panels.find((panel) => panel.id === "side-1");
  const sidePlace = built.geometry.layout.placements.find((item) => item.panelId === "side-1");
  assert.equal(sidePlace.rotation, 90);
  assert.equal(side.width, 200);
  assert.equal(side.height, 100);
  const beforeBounds = getPanelBounds(side, sidePlace);
  const shifted = draggedPlacement(sidePlace, { x: 15, y: -8 }, { enabled: false });
  const afterBounds = getPanelBounds(side, { ...sidePlace, ...shifted });
  near(afterBounds.minX - beforeBounds.minX, 15);
  near(afterBounds.minY - beforeBounds.minY, 8);
  near(afterBounds.width, beforeBounds.width);
  near(afterBounds.height, beforeBounds.height);
  assert.equal(side.width, 200);
  assert.equal(side.height, 100);
  assert.equal(geometryFingerprint(built.geometry.panels), before);
});

test("snap rounds layout position and not the outline", () => {
  assert.equal(snapValue(103, 10), 100);
  assert.equal(snapValue(106, 10), 110);
  const snapped = draggedPlacement({ x: 103, y: 17 }, { x: 0, y: 0 }, { enabled: true, grid: 10 });
  assert.equal(snapped.x, 100);
  assert.equal(snapped.y, 20);
  const outline = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }];
  const layout = movePanel(
    { gap: 10, width: 540, height: 650, placements: [{ panelId: "bottom", x: 103, y: 17, rotation: 0 }] },
    "bottom",
    snapped.x,
    snapped.y,
  );
  assert.equal(layout.placements[0].x, 100);
  assert.deepEqual(outline[1], { x: 300, y: 0 });
});

test("inspector reads model size and rotation without swapping axes", () => {
  const built = sample();
  const bottom = built.geometry.panels.find((panel) => panel.id === "bottom");
  const place = built.geometry.layout.placements.find((item) => item.panelId === "bottom");
  const info = describePanel(bottom, place);
  assert.equal(info.title, "Дно");
  assert.equal(info.width, 300);
  assert.equal(info.height, 200);
  assert.equal(info.x, place.x);
  assert.equal(info.y, place.y);
  assert.equal(info.rotation, 0);

  const side = built.geometry.panels.find((panel) => panel.id === "side-1");
  const sidePlace = built.geometry.layout.placements.find((item) => item.panelId === "side-1");
  const sideInfo = describePanel(side, sidePlace);
  assert.equal(sideInfo.width, 200);
  assert.equal(sideInfo.height, 100);
  assert.equal(sideInfo.rotation, 90);
});

test("the standard net is quiet, and a user move can warn without being rejected", () => {
  const built = sample();
  const quiet = layoutWarnings(built.geometry.panels, built.geometry.layout);
  assert.equal(quiet.overlap, false);
  assert.equal(quiet.tight, false);

  const bottom = built.geometry.layout.placements.find((item) => item.panelId === "bottom");
  const overlapped = movePanel(built.geometry.layout, "front", bottom.x, bottom.y);
  const warned = layoutWarnings(built.geometry.panels, overlapped);
  assert.equal(warned.overlap, true);
  assert.match(warned.messages.join(" "), /пересекаются/);
  assert.equal(overlapped.placements.find((item) => item.panelId === "front").x, bottom.x);

  const crowded = movePanel(built.geometry.layout, "front", bottom.x, bottom.y - 104);
  const gap = layoutWarnings(built.geometry.panels, crowded);
  assert.equal(gap.overlap, false);
  assert.equal(gap.tight, true);
});

test("fit includes a panel that was dragged off the sheet", () => {
  const built = sample();
  const layout = movePanel(built.geometry.layout, "bottom", -80, 40);
  const bounds = viewBounds(built.geometry.panels, layout);
  assert.ok(bounds.x < 0);
  const fitted = fitLayoutToViewport({
    layoutBounds: bounds,
    viewportWidth: 900,
    viewportHeight: 700,
    padding: 16,
  });
  assert.ok(fitted.x <= bounds.x);
  assert.ok(fitted.y <= bounds.y);
  assert.ok(fitted.x + fitted.width >= bounds.x + bounds.width);
  assert.ok(fitted.y + fitted.height >= bounds.y + bounds.height);
  assert.equal(built.geometry.panels.find((panel) => panel.id === "bottom").outline.length > 0, true);
});

test("undo restores a layout move and delete does not remove a panel", () => {
  const history = createHistory();
  const before = [{ panelId: "bottom", x: 120, y: 120, rotation: 0 }];
  const after = [{ panelId: "bottom", x: 140, y: 100, rotation: 0 }];
  history.push(before.map((item) => ({ ...item })));
  const restored = history.undo(after);
  assert.equal(restored[0].x, 120);
  const redone = history.redo(restored);
  assert.equal(redone[0].x, 140);
  assert.equal(applyShortcut("Delete").type, "noop-delete");
  assert.equal(applyShortcut("Backspace").type, "noop-delete");
  assert.equal(applyShortcut("Escape").type, "cancel");
  assert.equal(applyShortcut("0").type, "fit");
  assert.equal(applyShortcut("z", { ctrl: true }).type, "undo");
  assert.equal(applyShortcut("0", { typing: true }).type, "ignore");
});

test("grid step stays in millimetres and coarsens when the window is large", () => {
  assert.equal(visibleGridStep({ width: 540, height: 650 }, 800), 10);
  assert.ok(visibleGridStep({ width: 540, height: 650 }, 1200, { screenHeight: 400 }) > 10);
  const coarse = visibleGridStep({ width: 20000, height: 20000 }, 800);
  assert.ok(coarse > 10);
  const built = sample();
  const plain = renderSvg({ panels: built.geometry.panels, layout: built.geometry.layout });
  const marked = renderSvg({
    panels: built.geometry.panels,
    layout: built.geometry.layout,
    options: { grid: true, gridStep: coarse, selectedPanelId: "bottom", hoveredPanelId: "front" },
  });
  const plainPath = plain.match(/data-panel-id="bottom"[^]*?<path d="([^"]+)"/)[1];
  const markedPath = marked.match(/data-panel-id="bottom"[^]*?<path d="([^"]+)"/)[1];
  assert.equal(plainPath, markedPath);
  assert.match(marked, /data-hovered="true"/);
  assert.match(marked, /data-selection="bottom"/);
  assert.equal(built.geometry.panels.find((panel) => panel.id === "bottom").width, 300);
});
