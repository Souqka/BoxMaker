import assert from "node:assert/strict";
import test from "node:test";
import { resolveDimensions, normalizeDimensions } from "../src/geometry/dimensions.js";
import { generateBoxGeometry } from "../src/geometry/generate.js";
import { placementFootprint } from "../src/geometry/layout.js";
import { outlineProblems } from "../src/geometry/primitives.js";
import { renderBoxToSvg } from "../src/renderers/svg.js";
import { buildBoxGeometry } from "../src/geometry/box.js";
import { createBox } from "../src/models/BoxModel.js";

const ABS = 1e-6;

const FACES = {
  lid: ["width", "depth"],
  bottom: ["width", "depth"],
  front: ["width", "height"],
  back: ["width", "height"],
  "side-1": ["depth", "height"],
  "side-2": ["depth", "height"],
};

function near(actual, expected, epsilon = ABS) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

function generated(size, material, layout = { gap: 10 }) {
  const resolved = resolveDimensions({
    dimensions: size,
    dimensionMode: "external",
    material,
    joint: { type: "tab-slot" },
  });
  assert.equal(resolved.valid, true, JSON.stringify(resolved.errors));
  return generateBoxGeometry({
    dimensions: { external: resolved.external, internal: resolved.internal },
    material: resolved.material,
    joint: { type: "tab-slot" },
    layout,
  });
}

function faceSize(panel, external) {
  const [across, up] = FACES[panel.id];
  return { width: external[across], height: external[up] };
}

function assertPanelFace(panel, external) {
  const face = faceSize(panel, external);
  near(panel.width, face.width);
  near(panel.height, face.height);
  near(panel.boundingBox.minX, 0);
  near(panel.boundingBox.minY, 0);
  near(panel.boundingBox.width, face.width);
  near(panel.boundingBox.height, face.height);
  near(panel.boundingBox.width / panel.boundingBox.height, face.width / face.height);
  assert.ok(Array.isArray(panel.outline));
  assert.ok(panel.outline.length >= 5);
  assert.equal(typeof panel.outline[0], "object");
  assert.ok(panel.outline.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  const interior = panel.outline.some(
    (point) =>
      point.x > ABS &&
      point.y > ABS &&
      point.x < panel.width - ABS &&
      point.y < panel.height - ABS,
  );
  assert.equal(interior, true);
  assert.deepEqual(outlineProblems(panel.outline), []);
  assert.deepEqual(panel.engraving, []);
  assert.deepEqual(panel.cutouts, []);
}

function placementMap(layout) {
  return Object.fromEntries(layout.placements.map((item) => [item.panelId, item]));
}

function assertCross(result, gap) {
  const place = placementMap(result.layout);
  const part = Object.fromEntries(result.panels.map((panel) => [panel.id, panel]));
  const foot = Object.fromEntries(
    result.layout.placements.map((item) => [item.panelId, placementFootprint(part[item.panelId], item)]),
  );
  assert.equal(result.layout.scheme, "standard");
  assert.equal(result.layout.unit, "mm");
  assert.equal(result.layout.gap, gap);
  near(part.lid.width, part.bottom.width);
  near(part.lid.height, part.bottom.height);
  near(foot.bottom.y - (foot.front.y + foot.front.height), gap);
  near(foot.front.width, foot.bottom.width);
  near(foot.back.y - (foot.bottom.y + foot.bottom.height), gap);
  near(foot.back.width, foot.bottom.width);
  near(foot.lid.y - (foot.back.y + foot.back.height), gap);
  near(foot.lid.width, foot.back.width);
  near(foot.bottom.x - (foot["side-1"].x + foot["side-1"].width), gap);
  near(foot["side-1"].height, foot.bottom.height);
  near(foot["side-1"].y, foot.bottom.y);
  near(foot["side-2"].x - (foot.bottom.x + foot.bottom.width), gap);
  near(foot["side-2"].height, foot.bottom.height);
}

test("300 × 200 × 100 at 4 mm keeps real face proportions and a uniform scale", () => {
  const external = { width: 300, depth: 200, height: 100 };
  const result = generated(external, { thickness: 4, kerf: 0.15, clearance: 0.1 });
  assert.equal(result.validation.valid, true);
  assert.deepEqual(result.validation.errors, []);
  assert.deepEqual(
    result.panels.map((panel) => panel.id),
    ["lid", "side-1", "front", "bottom", "back", "side-2"],
  );
  assert.deepEqual(result.box.external, external);
  assert.deepEqual(result.box.internal, { width: 292, depth: 192, height: 92 });
  assert.deepEqual(result.box.material, { thickness: 4, kerf: 0.15, clearance: 0.1 });

  const scales = [];
  for (const panel of result.panels) {
    assertPanelFace(panel, external);
    const face = faceSize(panel, external);
    scales.push(panel.boundingBox.width / face.width, panel.boundingBox.height / face.height);
  }
  for (const scale of scales) near(scale, 1);

  const front = result.panels.find((panel) => panel.id === "front");
  const bottom = result.panels.find((panel) => panel.id === "bottom");
  const side = result.panels.find((panel) => panel.id === "side-1");
  near(front.width / front.height, 3);
  near(bottom.width / bottom.height, 1.5);
  near(side.width / side.height, 2);
  assert.equal(front.tabs.filter((tab) => tab.edge === "bottom").length, bottom.slots.filter((slot) => slot.edge === "bottom").length);
  assert.equal(side.tabs.filter((tab) => tab.edge === "left").length, front.slots.filter((slot) => slot.edge === "left").length);

  assertCross(result, 10);
  assert.deepEqual(
    result.layout.placements.map((item) => [item.panelId, item.x, item.y, item.rotation]),
    [
      ["bottom", 120, 120, 0],
      ["front", 120, 10, 0],
      ["back", 120, 330, 0],
      ["side-1", -40, 170, 90],
      ["lid", 120, 440, 180],
      ["side-2", 380, 170, -90],
    ],
  );
  near(result.layout.width, 540);
  near(result.layout.height, 650);
});

test("reference boxes keep external face ratios", () => {
  const cases = [
    { size: { width: 100, depth: 100, height: 100 }, thickness: 3 },
    { size: { width: 300, depth: 200, height: 100 }, thickness: 4 },
    { size: { width: 500, depth: 400, height: 300 }, thickness: 6 },
  ];
  for (const { size, thickness } of cases) {
    const result = generated(size, { thickness, kerf: 0.15, clearance: 0.1 });
    assert.equal(result.validation.valid, true, JSON.stringify(result.validation.errors));
    for (const panel of result.panels) assertPanelFace(panel, size);
    assertCross(result, 10);
    assert.deepEqual(generated(size, { thickness, kerf: 0.15, clearance: 0.1 }), result);
  }
});

test("thickness changes the teeth and not the face bounding box", () => {
  const size = { width: 400, depth: 250, height: 150 };
  const outlines = [];
  let placement = null;
  for (const thickness of [3, 4, 6, 9, 12]) {
    const result = generated(size, { thickness, kerf: 0, clearance: 0 });
    assert.equal(result.validation.valid, true, JSON.stringify(result.validation.errors));
    for (const panel of result.panels) assertPanelFace(panel, size);
    outlines.push(JSON.stringify(result.panels.map((panel) => panel.outline)));
    const next = JSON.stringify(result.layout.placements);
    if (placement === null) placement = next;
    else assert.equal(next, placement);
  }
  assert.equal(new Set(outlines).size, outlines.length);
});

test("clearance changes the joint and kerf does not", () => {
  const size = { width: 300, depth: 200, height: 100 };
  const quiet = generated(size, { thickness: 4, kerf: 0, clearance: 0.1 });
  const kerf = generated(size, { thickness: 4, kerf: 0.5, clearance: 0.1 });
  assert.deepEqual(
    quiet.panels.map((panel) => panel.outline),
    kerf.panels.map((panel) => panel.outline),
  );
  const loose = generated(size, { thickness: 4, kerf: 0, clearance: 0.4 });
  assert.notDeepEqual(
    quiet.panels.find((panel) => panel.id === "front").outline,
    loose.panels.find((panel) => panel.id === "front").outline,
  );
  assert.deepEqual(quiet.layout.placements, loose.layout.placements);

  const wideGap = generated(size, { thickness: 4, kerf: 10, clearance: 10 }, { gap: 10 });
  assert.equal(wideGap.validation.valid, false);
  const separated = generated(size, { thickness: 4, kerf: 0, clearance: 0 }, { gap: 0.15 });
  assertCross(separated, 0.15);
});

test("layout gap does not rewrite panel geometry", () => {
  const size = { width: 300, depth: 200, height: 100 };
  const material = { thickness: 4, kerf: 0.15, clearance: 0.1 };
  const narrow = generated(size, material, { gap: 10 });
  const wide = generated(size, material, { gap: 25 });
  assert.deepEqual(
    narrow.panels.map((panel) => ({ id: panel.id, width: panel.width, height: panel.height, outline: panel.outline })),
    wide.panels.map((panel) => ({ id: panel.id, width: panel.width, height: panel.height, outline: panel.outline })),
  );
  assertCross(narrow, 10);
  assertCross(wide, 25);
});

test("a part over 700 × 500 is rejected from its bounding box", () => {
  const over = generated({ width: 701, depth: 100, height: 100 }, { thickness: 4, kerf: 0, clearance: 0 });
  assert.equal(over.validation.valid, false);
  assert.deepEqual(
    over.validation.errors.map((error) => error.panelId),
    ["lid", "front", "bottom", "back"],
  );
  for (const error of over.validation.errors) {
    assert.equal(error.code, "PANEL_TOO_LARGE");
    assert.deepEqual(error.allowed, { width: 700, height: 500 });
    assert.ok(error.actual.width > 700);
  }
  assert.equal(over.panels.length, 0);

  const rotatedLimit = generated({ width: 100, depth: 500, height: 700 }, { thickness: 4, kerf: 0, clearance: 0 });
  assert.equal(rotatedLimit.validation.valid, true);
});

test("9 mm is rejected by the single dimension check", () => {
  const result = generateBoxGeometry({
    dimensions: { external: { width: 9, depth: 100, height: 100 } },
    material: { thickness: 4, kerf: 0.15, clearance: 0.1 },
    joint: { type: "tab-slot" },
    layout: { gap: 10 },
  });
  const expected = normalizeDimensions({
    dimensions: { width: 9, depth: 100, height: 100 },
    dimensionMode: "external",
    material: { thickness: 4, kerf: 0.15, clearance: 0.1 },
  });
  assert.deepEqual(result.validation.errors, expected.errors);
  assert.equal(result.panels.length, 0);
});

test("10 × 10 × 10 is a real joint when the cavity stays open", () => {
  for (const thickness of [3, 4]) {
    const result = generated(
      { width: 10, depth: 10, height: 10 },
      { thickness, kerf: 0, clearance: 0 },
    );
    assert.equal(result.validation.valid, true, JSON.stringify(result.validation.errors));
    for (const panel of result.panels) {
      assertPanelFace(panel, { width: 10, depth: 10, height: 10 });
      const features = [...panel.tabs, ...panel.slots];
      assert.ok(features.every((feature) => feature.width > 0 && feature.depth === thickness));
    }
  }
});

test("clearance wider than the corner land is rejected without an outline", () => {
  const result = generated(
    { width: 100, depth: 100, height: 100 },
    { thickness: 3, kerf: 0, clearance: 250 },
  );
  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.length > 0);
  for (const error of result.validation.errors) {
    assert.equal(typeof error.code, "string");
    assert.equal(typeof error.message, "string");
    assert.notEqual(error.code, "MIN_DIMENSION");
    assert.notEqual(error.code, "PANEL_TOO_LARGE");
  }
  assert.equal(result.panels.length, 0);
});

test("the sheet uses one scale in millimetre user units", () => {
  const built = buildBoxGeometry(
    createBox({
      width: 300,
      depth: 200,
      height: 100,
      dimensionMode: "external",
      material: { thickness: 4, kerf: 0.15, clearance: 0.1 },
    }),
  );
  const svg = renderBoxToSvg(built.geometry);
  assert.match(svg, /viewBox="0 0 540 650"/);
  assert.match(svg, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(svg, /preserveAspectRatio="none"/);
  assert.doesNotMatch(svg, /scale\(/);

  const placed = Object.fromEntries(built.geometry.layout.placements.map((item) => [item.panelId, item]));
  for (const panel of built.geometry.panels) {
    const chunk = svg.split(`data-panel="${panel.id}"`)[1];
    const path = chunk.match(/d="([^"]+)"/)[1];
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
    const turn = Math.abs((placed[panel.id].rotation ?? 0) % 180);
    const spanX = turn === 90 ? panel.height : panel.width;
    const spanY = turn === 90 ? panel.width : panel.height;
    near(maxX - minX, spanX, 1e-3);
    near(maxY - minY, spanY, 1e-3);
  }
});
