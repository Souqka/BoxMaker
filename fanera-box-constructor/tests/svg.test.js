import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildBoxGeometry } from "../src/geometry/box.js";
import { resolveDimensions } from "../src/geometry/dimensions.js";
import { generateBoxGeometry } from "../src/geometry/generate.js";
import { createBox } from "../src/models/BoxModel.js";
import { renderBoxToSvg, renderSvg } from "../src/renderers/svg.js";
import {
  calculateLayoutBounds,
  calculateUniformScale,
  fitLayoutToViewport,
  panView,
  zoomView,
} from "../src/renderers/viewport.js";

const ABS = 1e-6;

function near(actual, expected, epsilon = ABS) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

function boxGeometry(size, thickness = 4) {
  return buildBoxGeometry(
    createBox({
      width: size.width,
      depth: size.depth,
      height: size.height,
      dimensionMode: "external",
      material: { thickness, kerf: 0.15, clearance: 0.1 },
    }),
  );
}

function pathSpan(svg, panelId) {
  const chunk = svg.split(`data-panel-id="${panelId}"`)[1];
  const path = chunk.match(/<path d="([^"]+)"/)[1];
  const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < numbers.length; index += 2) {
    minX = Math.min(minX, numbers[index]);
    maxX = Math.max(maxX, numbers[index]);
    minY = Math.min(minY, numbers[index + 1]);
    maxY = Math.max(maxY, numbers[index + 1]);
  }
  return { width: maxX - minX, height: maxY - minY, path };
}

test("renderSvg returns a millimetre sheet with layers and panel ids", () => {
  const built = boxGeometry({ width: 300, depth: 200, height: 100 });
  const before = JSON.stringify(built.geometry.panels.map((panel) => panel.outline));
  const svg = renderBoxToSvg(built.geometry);
  assert.equal(JSON.stringify(built.geometry.panels.map((panel) => panel.outline)), before);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 540 650"/);
  assert.match(svg, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(svg, /preserveAspectRatio="none"/);
  assert.doesNotMatch(svg, /scale\(/);
  assert.doesNotMatch(svg, /px/);
  for (const id of ["background-layer", "construction-layer", "cut-layer", "engraving-layer", "dimension-layer", "selection-layer"]) {
    assert.match(svg, new RegExp(`id="${id}"`));
  }
  for (const id of ["lid", "side-1", "front", "bottom", "back", "side-2"]) {
    assert.match(svg, new RegExp(`data-panel-id="${id}"`));
  }
  assert.match(svg, /data-label="bottom"[^>]*>дно</);
  assert.match(svg, /data-dimension="bottom"[^>]*>300 × 200 мм</);
  const cut = svg.split('id="cut-layer"')[1].split('id="engraving-layer"')[0];
  assert.doesNotMatch(cut, /крышка|дно|перед/);
});

test("uniform scale is the minimum of the two axis scales", () => {
  const wide = calculateUniformScale({
    geometryBounds: { width: 540, height: 650 },
    viewportWidth: 1000,
    viewportHeight: 400,
    padding: 20,
  });
  assert.equal(wide.scale, Math.min(wide.scaleX, wide.scaleY));
  assert.ok(wide.scaleX > wide.scaleY);
  near(wide.scale, wide.scaleY);

  const tall = calculateUniformScale({
    geometryBounds: { width: 540, height: 650 },
    viewportWidth: 300,
    viewportHeight: 900,
    padding: 0,
  });
  near(tall.scale, tall.scaleX);
  assert.ok(tall.scaleX < tall.scaleY);
});

test("fit, zoom and pan change the window and not the cut path", () => {
  const built = boxGeometry({ width: 300, depth: 200, height: 100 });
  const bounds = calculateLayoutBounds(built.geometry.layout);
  const fitted = fitLayoutToViewport({
    layoutBounds: bounds,
    viewportWidth: 800,
    viewportHeight: 500,
    padding: 16,
  });
  near(fitted.width - bounds.width, fitted.height - bounds.height);
  assert.ok(fitted.width > bounds.width);
  assert.ok(fitted.height > bounds.height);
  const zoomed = zoomView(fitted, 2, { x: fitted.x + fitted.width / 2, y: fitted.y + fitted.height / 2 });
  near(zoomed.width / zoomed.height, fitted.width / fitted.height);
  near(zoomed.width, fitted.width / 2);
  const panned = panView(zoomed, 12, -4);
  near(panned.x, zoomed.x + 12);
  near(panned.width, zoomed.width);

  const plain = renderSvg({ panels: built.geometry.panels, layout: built.geometry.layout });
  const framed = renderSvg({
    panels: built.geometry.panels,
    layout: built.geometry.layout,
    viewport: panned,
  });
  assert.equal(pathSpan(plain, "bottom").path, pathSpan(framed, "bottom").path);
  assert.notEqual(plain.match(/viewBox="[^"]+"/)[0], framed.match(/viewBox="[^"]+"/)[0]);
});

test("drawn aspect matches the panel, including a quarter turn", () => {
  const cases = [
    { width: 100, depth: 100, height: 100 },
    { width: 300, depth: 200, height: 100 },
    { width: 500, depth: 300, height: 200 },
    { width: 700, depth: 500, height: 100 },
  ];
  for (const size of cases) {
    const built = boxGeometry(size);
    assert.equal(built.ok, true, JSON.stringify(built.issues));
    const svg = renderBoxToSvg(built.geometry);
    const placed = Object.fromEntries(built.geometry.layout.placements.map((item) => [item.panelId, item]));
    for (const panel of built.geometry.panels) {
      const span = pathSpan(svg, panel.id);
      const turn = Math.abs((placed[panel.id].rotation ?? 0) % 180);
      const geometricWidth = turn === 90 ? panel.height : panel.width;
      const geometricHeight = turn === 90 ? panel.width : panel.height;
      near(span.width / span.height, geometricWidth / geometricHeight, 1e-3);
      near(span.width, geometricWidth, 1e-3);
      near(span.height, geometricHeight, 1e-3);
      assert.ok(Array.isArray(panel.outline));
      assert.equal(typeof panel.outline[0], "object");
    }
  }
});

test("grid, selection and labels do not change the cut outline", () => {
  const built = boxGeometry({ width: 300, depth: 200, height: 100 });
  const plain = renderSvg({ panels: built.geometry.panels, layout: built.geometry.layout });
  const dressed = renderSvg({
    panels: built.geometry.panels,
    layout: built.geometry.layout,
    options: { grid: true, gridStep: 10, selectedPanelId: "bottom" },
  });
  assert.equal(pathSpan(plain, "front").path, pathSpan(dressed, "front").path);
  assert.match(dressed, /data-grid="x"/);
  assert.match(dressed, /data-panel-id="bottom"[^>]*data-selected="true"/);
  assert.match(dressed, /data-panel-id="front"[^>]*data-selected="false"/);
  assert.match(dressed, /data-selection="bottom"/);
  const labels = dressed.split('id="dimension-layer"')[1].split('id="selection-layer"')[0];
  assert.match(labels, /дно/);
  assert.doesNotMatch(dressed.split('id="cut-layer"')[1].split('id="engraving-layer"')[0], /дно|200 × 100/);
  const bottom = built.geometry.panels.find((panel) => panel.id === "bottom");
  assert.equal(bottom.width, 300);
  assert.equal(bottom.height, 200);
});

test("viewBox follows each sheet, not one hardcoded window", () => {
  const sheets = [
    { size: { width: 100, depth: 100, height: 100 }, viewBox: "0 0 340 450" },
    { size: { width: 300, depth: 200, height: 100 }, viewBox: "0 0 540 650" },
    { size: { width: 500, depth: 300, height: 200 }, viewBox: "0 0 940 1050" },
    { size: { width: 700, depth: 500, height: 100 }, viewBox: "0 0 940 1250" },
  ];
  for (const item of sheets) {
    const built = boxGeometry(item.size);
    assert.equal(built.ok, true);
    const svg = renderBoxToSvg(built.geometry);
    assert.match(svg, new RegExp(`viewBox="${item.viewBox}"`));
    const bottom = pathSpan(svg, "bottom");
    near(bottom.width, item.size.width, 1e-3);
    near(bottom.height, item.size.depth, 1e-3);
    const front = pathSpan(svg, "front");
    near(front.width, item.size.width, 1e-3);
    near(front.height, item.size.height, 1e-3);
    const side = pathSpan(svg, "side-1");
    near(side.width, item.size.height, 1e-3);
    near(side.height, item.size.depth, 1e-3);
  }
});

test("an oversized panel is reported and not redrawn smaller", () => {
  const resolved = resolveDimensions({
    dimensions: { width: 800, depth: 200, height: 100 },
    dimensionMode: "external",
    material: { thickness: 4, kerf: 0, clearance: 0 },
    joint: { type: "tab-slot" },
  });
  const geometry = generateBoxGeometry({
    dimensions: { external: resolved.external, internal: resolved.internal },
    material: resolved.material,
    joint: { type: "tab-slot" },
    layout: { gap: 10 },
  });
  assert.equal(geometry.validation.valid, false);
  const svg = renderSvg({
    panels: [{
      id: "bottom",
      width: 800,
      height: 200,
      outline: [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 200 }, { x: 0, y: 200 }],
    }],
    layout: {
      width: 800,
      height: 200,
      placements: [{ panelId: "bottom", x: 0, y: 0, rotation: 0 }],
    },
    options: { validation: geometry.validation },
  });
  assert.match(svg, /exceeds/);
  assert.doesNotMatch(svg, /data-panel-id/);
  assert.doesNotMatch(svg, /<path /);
  assert.doesNotMatch(svg, /viewBox="0 0 700 /);
});

test("the renderer has no thickness switch", () => {
  const source = readFileSync(new URL("../src/renderers/svg.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /thickness\s*===\s*\d/);
  const thin = boxGeometry({ width: 300, depth: 200, height: 100 }, 3);
  const thick = boxGeometry({ width: 300, depth: 200, height: 100 }, 10);
  assert.notEqual(
    renderBoxToSvg(thin.geometry).match(/data-panel-id="front"[^]*?<path d="([^"]+)"/)[1],
    renderBoxToSvg(thick.geometry).match(/data-panel-id="front"[^]*?<path d="([^"]+)"/)[1],
  );
  assert.equal(thin.geometry.panels.find((panel) => panel.id === "bottom").width, 300);
  assert.equal(thick.geometry.panels.find((panel) => panel.id === "bottom").width, 300);
});
