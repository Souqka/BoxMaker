import assert from "node:assert/strict";
import test from "node:test";
import { buildBoxGeometry } from "../src/geometry/box.js";
import { layoutPanels, placementFootprint } from "../src/geometry/layout.js";
import { PANEL_LIMITS, validatePanelSize } from "../src/geometry/panelLimits.js";
import { BOX_PANEL_IDS } from "../src/geometry/panels.js";
import { createBox } from "../src/models/BoxModel.js";
import { renderBoxToSvg } from "../src/renderers/svg.js";

const EPSILON = 1e-9;

function box() {
  return createBox({
    width: 300,
    depth: 200,
    height: 100,
    dimensionMode: "external",
    material: { thickness: 4, kerf: 0.15, clearance: 0.1 },
    construction: "tab-slot",
  });
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= EPSILON, `${actual} is not within ${EPSILON} of ${expected}`);
}

test("panel stock limit treats 700 by 500 and 500 by 700 as the same box", () => {
  assert.equal(PANEL_LIMITS.maxWidth, 700);
  assert.equal(PANEL_LIMITS.maxHeight, 500);
  assert.equal(validatePanelSize({ id: "front", width: 700, height: 500 }), null);
  assert.equal(validatePanelSize({ id: "front", width: 500, height: 700 }), null);

  const tooWide = validatePanelSize({ id: "front", width: 701, height: 400 });
  assert.equal(tooWide.code, "PANEL_TOO_LARGE");
  assert.equal(tooWide.panelId, "front");
  assert.equal(tooWide.width, 701);
  assert.equal(tooWide.height, 400);
  assert.equal(tooWide.maxWidth, 700);
  assert.equal(tooWide.maxHeight, 500);
  assert.deepEqual(tooWide.actual, { width: 701, height: 400 });
  assert.deepEqual(tooWide.allowed, { width: 700, height: 500 });

  const tooTall = validatePanelSize({ id: "back", width: 600, height: 600 });
  assert.equal(tooTall.code, "PANEL_TOO_LARGE");
  assert.equal(tooTall.panelId, "back");
});

test("standard layout is a net with equal adjoining edges", () => {
  const built = buildBoxGeometry(box());
  const { layout, panels } = built.geometry;
  const place = Object.fromEntries(layout.placements.map((item) => [item.panelId, item]));
  const part = Object.fromEntries(panels.map((panel) => [panel.id, panel]));
  const foot = Object.fromEntries(
    layout.placements.map((item) => [item.panelId, placementFootprint(part[item.panelId], item)]),
  );

  assert.equal(layout.scheme, "standard");
  assert.equal(layout.unit, "mm");
  assert.deepEqual(Object.keys(place).sort(), [...BOX_PANEL_IDS].sort());
  near(part.lid.width, part.bottom.width);
  near(part.lid.height, part.bottom.height);
  near(part.front.width, part.bottom.width);
  near(part.back.width, part.bottom.width);
  near(part["side-1"].width, part.bottom.height);
  near(part["side-2"].width, part.bottom.height);

  near(foot.bottom.y - (foot.front.y + foot.front.height), 10);
  near(foot.front.width, foot.bottom.width);
  near(foot.front.x, foot.bottom.x);
  near(foot.back.y - (foot.bottom.y + foot.bottom.height), 10);
  near(foot.back.width, foot.bottom.width);
  near(foot.lid.y - (foot.back.y + foot.back.height), 10);
  near(foot.lid.width, foot.back.width);
  near(foot.bottom.x - (foot["side-1"].x + foot["side-1"].width), 10);
  near(foot["side-1"].height, foot.bottom.height);
  near(foot["side-1"].y, foot.bottom.y);
  near(foot["side-2"].x - (foot.bottom.x + foot.bottom.width), 10);
  near(foot["side-2"].height, foot.bottom.height);
  assert.equal(place.lid.rotation, 180);
  assert.equal(place["side-1"].rotation, 90);
  assert.equal(place["side-2"].rotation, -90);
});

test("the svg renderer draws the layout coordinates and not a fixed row", () => {
  const built = buildBoxGeometry(box());
  const svg = renderBoxToSvg(built.geometry);
  for (const id of BOX_PANEL_IDS) assert.match(svg, new RegExp(`data-panel="${id}"`));
  assert.match(svg, /крышка/);
  assert.match(svg, /1 бок/);
  assert.match(svg, /2 бок/);
  assert.doesNotMatch(svg, /лево|право/);
  assert.doesNotMatch(svg, /px/);

  const front = built.geometry.layout.placements.find((item) => item.panelId === "front");
  const moved = {
    ...built.geometry,
    layout: {
      ...built.geometry.layout,
      placements: built.geometry.layout.placements.map((item) =>
        item.panelId === "front" ? { ...item, x: item.x + 25 } : item,
      ),
    },
  };
  const movedSvg = renderBoxToSvg(moved);
  assert.notEqual(svg, movedSvg);
  assert.match(movedSvg, new RegExp(`M ${front.x + 25} `));
});

test("layout rotation is read by the renderer", () => {
  const built = buildBoxGeometry(box());
  const rotated = {
    ...built.geometry,
    layout: {
      ...built.geometry.layout,
      placements: built.geometry.layout.placements.map((item) =>
        item.panelId === "lid" ? { ...item, rotation: 90 } : item,
      ),
    },
  };
  assert.notEqual(renderBoxToSvg(built.geometry), renderBoxToSvg(rotated));
});

test("layout uses panel size, so a different part moves its neighbours", () => {
  const first = layoutPanels([
    { id: "bottom", width: 100, height: 40 },
    { id: "front", width: 100, height: 30 },
    { id: "back", width: 100, height: 30 },
    { id: "side-1", width: 40, height: 30 },
    { id: "side-2", width: 40, height: 30 },
    { id: "lid", width: 100, height: 40 },
  ]);
  const second = layoutPanels([
    { id: "bottom", width: 100, height: 80 },
    { id: "front", width: 100, height: 30 },
    { id: "back", width: 100, height: 30 },
    { id: "side-1", width: 40, height: 30 },
    { id: "side-2", width: 40, height: 30 },
    { id: "lid", width: 100, height: 40 },
  ]);
  const lid = (layout) => layout.placements.find((item) => item.panelId === "lid");
  assert.ok(lid(second).y > lid(first).y);
});
