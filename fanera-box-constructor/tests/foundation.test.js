import assert from "node:assert/strict";
import test from "node:test";
import { attachLogo } from "../src/editor/logo.js";
import { createSelection } from "../src/editor/selection.js";
import { resizeLogo, rotateLogo, translateLogo } from "../src/editor/transform.js";
import { buildBoxGeometry, measureEnvelope } from "../src/geometry/box.js";
import { resolveDimensions } from "../src/geometry/dimensions.js";
import { createJoint } from "../src/geometry/joints.js";
import { BOX_PANEL_IDS, createPanel } from "../src/geometry/panels.js";
import { createBox } from "../src/models/BoxModel.js";
import { createLogo } from "../src/models/Logo.js";
import { createMaterial } from "../src/models/Material.js";
import { renderBoxToSvg } from "../src/renderers/svg.js";
import { validateBox } from "../src/validation.js";

function sampleBox(overrides = {}) {
  return createBox({
    width: 300,
    depth: 200,
    height: 100,
    dimensionMode: "external",
    material: { thickness: 4, kerf: 0.15, clearance: 0.1 },
    construction: "tab-slot",
    ...overrides,
  });
}

test("creates a box with material and dimension mode", () => {
  const box = sampleBox({ dimensionMode: "internal" });
  assert.equal(box.dimensionMode, "internal");
  assert.equal(box.construction, "tab-slot");
  assert.deepEqual(box.material, { thickness: 4, kerf: 0.15, clearance: 0.1 });
});

test("material keeps kerf and clearance on the object", () => {
  const material = createMaterial({ thickness: 9, kerf: 0.2, clearance: 0.05 });
  assert.deepEqual(material, { thickness: 9, kerf: 0.2, clearance: 0.05 });
});

test("accepts thicknesses outside 3, 4 and 6 mm", () => {
  for (const thickness of [3, 4, 6, 9, 12]) {
    const box = sampleBox({ material: { thickness, kerf: 0, clearance: 0 } });
    assert.equal(validateBox(box).length, 0);
    assert.equal(buildBoxGeometry(box).ok, true);
  }
});

test("validation reports non-positive sizes and bad kerf or clearance", () => {
  const box = sampleBox({
    width: 0,
    depth: -10,
    height: 100,
    material: { thickness: 0, kerf: -1, clearance: -0.2 },
  });
  const issues = validateBox(box);
  const byField = Object.fromEntries(issues.map((issue) => [issue.field, issue.code]));
  assert.equal(byField.width, "MIN_DIMENSION");
  assert.equal(byField.depth, "MIN_DIMENSION");
  assert.equal(byField.thickness, "INVALID_VALUE");
  assert.equal(byField.kerf, "INVALID_VALUE");
  assert.equal(byField.clearance, "INVALID_VALUE");
  assert.equal(buildBoxGeometry(box).ok, false);
});

test("validation rejects an unknown dimension mode", () => {
  const box = sampleBox({ dimensionMode: "outside" });
  assert.equal(validateBox(box).some((issue) => issue.code === "INVALID_MODE"), true);
});

test("resolveDimensions asks the joint for the size adjustment", () => {
  const material = createMaterial({ thickness: 4, kerf: 0, clearance: 0 });
  const joint = {
    type: "custom",
    getDimensionAdjustment() {
      return { width: 10, depth: 20, height: 30 };
    },
  };
  const external = resolveDimensions({
    dimensions: { width: 300, depth: 200, height: 100 },
    dimensionMode: "external",
    material,
    joint,
  });
  assert.deepEqual(external.external, { width: 300, depth: 200, height: 100 });
  assert.deepEqual(external.internal, { width: 290, depth: 180, height: 70 });

  const internal = resolveDimensions({
    dimensions: { width: 300, depth: 200, height: 100 },
    dimensionMode: "internal",
    material,
    joint,
  });
  assert.deepEqual(internal.internal, { width: 300, depth: 200, height: 100 });
  assert.deepEqual(internal.external, { width: 310, depth: 220, height: 130 });
});

test("tab-slot reports an adjustment and still has no tab geometry", () => {
  const joint = createJoint({ type: "tab-slot" });
  const resolved = resolveDimensions({
    dimensions: { width: 300, depth: 200, height: 100 },
    dimensionMode: "external",
    material: createMaterial({ thickness: 6, kerf: 0, clearance: 0 }),
    joint,
  });
  assert.equal(resolved.valid, true);
  assert.deepEqual(resolved.internal, { width: 288, depth: 188, height: 88 });
  assert.deepEqual(joint.featuresForEdge({ panelId: "front" }), { tabs: [], slots: [] });
});

test("external input round-trips onto the external envelope", () => {
  const built = buildBoxGeometry(sampleBox({ dimensionMode: "external" }));
  assert.equal(built.ok, true);
  const measured = measureEnvelope(built.geometry);
  assert.deepEqual(measured.external, { width: 300, depth: 200, height: 100 });
});

test("internal input round-trips onto the internal envelope", () => {
  const built = buildBoxGeometry(sampleBox({ dimensionMode: "internal" }));
  assert.equal(built.ok, true);
  const measured = measureEnvelope(built.geometry);
  assert.deepEqual(measured.internal, { width: 300, depth: 200, height: 100 });
});

test("creates a panel with geometry collections", () => {
  const panel = createPanel({ id: "front", width: 300, height: 100, outline: [{ x: 0, y: 0 }] });
  assert.equal(panel.id, "front");
  assert.deepEqual(panel.slots, []);
  assert.deepEqual(panel.tabs, []);
  assert.deepEqual(panel.cutouts, []);
  assert.deepEqual(panel.engraving, []);
  assert.equal(panel.outline.length, 1);
});

test("builds six placeholder panels without folding", () => {
  const built = buildBoxGeometry(sampleBox());
  assert.deepEqual(
    built.geometry.panels.map((panel) => panel.id),
    BOX_PANEL_IDS,
  );
  const front = built.geometry.panels.find((panel) => panel.id === "front");
  assert.equal(front.outline.length, 4);
  assert.equal(front.width, 300);
  assert.equal(front.height, 100);
  assert.deepEqual(built.geometry.panelLimits, { maxWidth: 700, maxHeight: 500, unit: "mm" });
  assert.equal(built.geometry.material.thickness, 4);
  assert.equal(built.geometry.material.kerf, 0.15);
  assert.equal(built.geometry.construction, "tab-slot");
});

test("creates a logo in panel millimetres and draws it on the engraving layer", () => {
  const logo = createLogo({
    id: "logo-1",
    panelId: "front",
    x: 40,
    y: 20,
    width: 80,
    height: 30,
    rotation: 15,
    source: "svg",
    data: "<svg xmlns='http://www.w3.org/2000/svg'/>",
  });
  assert.equal(logo.source, "svg");
  assert.equal(logo.x, 40);
  assert.equal(logo.rotation, 15);

  const built = buildBoxGeometry(sampleBox());
  const front = attachLogo(
    built.geometry.panels.find((panel) => panel.id === "front"),
    logo,
  );
  const moved = translateLogo(front.engraving[0], 5, -2);
  const scaled = resizeLogo(moved, 40, 16);
  const rotated = rotateLogo(scaled, 25);
  const geometry = {
    ...built.geometry,
    panels: built.geometry.panels.map((panel) => (panel.id === "front" ? { ...front, engraving: [rotated] } : panel)),
  };
  const svg = renderBoxToSvg(geometry);
  assert.match(svg, /id="cutLayer"/);
  assert.match(svg, /id="engravingLayer"/);
  assert.match(svg, /id="constructionLayer"/);
  assert.match(svg, /id="dimensionLayer"/);
  assert.match(svg, /data-units="mm"/);
  assert.match(svg, /data-engraving="logo-1"/);
  assert.match(svg, /data-panel="front"/);
  assert.doesNotMatch(svg, /px/);
});

test("logo sources are svg, png and jpg", () => {
  for (const source of ["svg", "png", "jpg"]) {
    assert.equal(createLogo({ id: source, panelId: "front", x: 0, y: 0, width: 10, height: 10, source }).source, source);
  }
  assert.throws(() => createLogo({ id: "a", panelId: "front", x: 0, y: 0, width: 1, height: 1, source: "gif" }));
});

test("selection stores a panel id", () => {
  const selection = createSelection();
  selection.select("bottom");
  assert.equal(selection.get(), "bottom");
  selection.clear();
  assert.equal(selection.get(), null);
});

test("an unknown joint is rejected before panels are built", () => {
  const built = buildBoxGeometry(sampleBox({ construction: "finger-joint" }));
  assert.equal(built.ok, false);
  assert.equal(built.issues[0].code, "UNSUPPORTED_JOINT");
});
