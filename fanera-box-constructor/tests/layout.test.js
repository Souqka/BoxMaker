import assert from "node:assert/strict";
import test from "node:test";
import { buildBoxGeometry } from "../src/geometry/box.js";
import { layoutPanels } from "../src/geometry/layout.js";
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

  const tooTall = validatePanelSize({ id: "back", width: 600, height: 600 });
  assert.equal(tooTall.code, "PANEL_TOO_LARGE");
  assert.equal(tooTall.panelId, "back");
});

test("standard layout places the six panels in millimetres", () => {
  const built = buildBoxGeometry(box());
  const { layout, panels } = built.geometry;
  const place = Object.fromEntries(layout.placements.map((item) => [item.panelId, item]));
  const part = Object.fromEntries(panels.map((panel) => [panel.id, panel]));

  assert.equal(layout.scheme, "standard");
  assert.equal(layout.unit, "mm");
  assert.deepEqual(Object.keys(place).sort(), [...BOX_PANEL_IDS].sort());
  for (const placement of layout.placements) {
    assert.equal(placement.rotation, 0);
    assert.equal(typeof placement.x, "number");
    assert.equal(typeof placement.y, "number");
  }

  near(place.bottom.x - (place.front.x + part.front.width), 12);
  near(place.back.x - (place.bottom.x + part.bottom.width), 12);
  near(place["side-1"].y - (place.bottom.y + part.bottom.height), 12);
  near(place.lid.y - (place["side-1"].y + part["side-1"].height), 12);
  near(place.bottom.y - (place["side-2"].y + part["side-2"].height), 12);
  near(place.lid.y, Math.max(...layout.placements.map((item) => item.y)));
  near(place["side-2"].y, Math.min(...layout.placements.map((item) => item.y)));
  assert.ok(place.front.x < place.bottom.x);
  assert.ok(place.bottom.x < place.back.x);

  const bottomCenter = place.bottom.x + part.bottom.width / 2;
  near(place.lid.x + part.lid.width / 2, bottomCenter);
  near(place["side-1"].x + part["side-1"].width / 2, bottomCenter);
  near(place["side-2"].x + part["side-2"].width / 2, bottomCenter);
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
