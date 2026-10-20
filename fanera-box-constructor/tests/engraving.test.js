import assert from "node:assert/strict";
import test from "node:test";
import { attachEngravings } from "../src/editor/logo.js";
import { createEditorState, describeEngraving, geometryFingerprint } from "../src/editor/scene.js";
import {
  ENGRAVING_LIMITS,
  buildEngraving,
  centerOnPanel,
  fitLogoSize,
  sanitizeSvg,
  sourceFromFile,
  svgIntrinsicSize,
  validateLogoFile,
} from "../src/editor/upload.js";
import { buildBoxGeometry } from "../src/geometry/box.js";
import { createBox } from "../src/models/BoxModel.js";
import { createLogo } from "../src/models/Logo.js";
import { movePanel } from "../src/editor/scene.js";
import { renderSvg } from "../src/renderers/svg.js";

const ABS = 1e-6;

function near(actual, expected, epsilon = ABS) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

function box() {
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

function pointsOf(svg, id) {
  const chunk = svg.split(`data-engraving="${id}"`)[1];
  const points = chunk.match(/points="([^"]+)"/)[1];
  const numbers = points.split(/[\s,]+/).map(Number);
  const pairs = [];
  for (let index = 0; index < numbers.length; index += 2) pairs.push({ x: numbers[index], y: numbers[index + 1] });
  return pairs;
}

test("upload accepts svg, png and jpg and rejects other files and oversized files", () => {
  assert.equal(sourceFromFile("logo.svg", ""), "svg");
  assert.equal(sourceFromFile("photo.JPEG", "image/jpeg"), "jpg");
  assert.equal(sourceFromFile("mark.png", "image/png"), "png");
  assert.equal(sourceFromFile("clip.gif", "image/gif"), null);
  assert.equal(validateLogoFile({ name: "a.gif", type: "image/gif", size: 10 }).ok, false);
  assert.equal(validateLogoFile({ name: "a.svg", type: "image/svg+xml", size: ENGRAVING_LIMITS.maxFileBytes }).ok, true);
  assert.equal(validateLogoFile({ name: "a.svg", type: "image/svg+xml", size: ENGRAVING_LIMITS.maxFileBytes + 1 }).ok, false);
  assert.equal(validateLogoFile({ name: "a.png", type: "image/png", size: 50, maxFileBytes: 40 }).ok, false);
});

test("svg sanitizer removes scripts and inline handlers", () => {
  const clean = sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" onclick="alert(1)" onload='bad()'>` +
      `<script>alert(1)</script><rect width="200" height="100" href="javascript:alert(1)"/>` +
      `</svg>`,
  );
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onclick/i);
  assert.doesNotMatch(clean, /onload/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.match(clean, /viewBox="0 0 200 100"/);
  assert.deepEqual(svgIntrinsicSize(clean), { width: 200, height: 100 });
});

test("logo keeps its aspect, fits the panel and stays non-negative", () => {
  const wide = fitLogoSize({ imageWidth: 200, imageHeight: 100, panelWidth: 300, panelHeight: 200 });
  near(wide.width, 100);
  near(wide.height, 50);
  near(wide.width / wide.height, 2);

  const tiny = fitLogoSize({ imageWidth: 2, imageHeight: 1, panelWidth: 300, panelHeight: 200 });
  near(tiny.width / tiny.height, 2);
  near(tiny.width, 100);

  const tight = fitLogoSize({ imageWidth: 200, imageHeight: 100, panelWidth: 40, panelHeight: 30 });
  near(tight.width, 40);
  near(tight.height, 20);
  const place = centerOnPanel(40, 30, tight.width, tight.height);
  near(place.x, 0);
  near(place.y, 5);
  assert.ok(place.x >= 0 && place.y >= 0);

  const built = box();
  const bottom = built.geometry.panels.find((panel) => panel.id === "bottom");
  const made = buildEngraving({
    id: "engraving-1",
    panel: bottom,
    name: "logo.svg",
    source: "svg",
    data: "<svg/>",
    imageWidth: 200,
    imageHeight: 100,
  });
  assert.equal(made.ok, true);
  assert.equal(made.engraving.panelId, "bottom");
  assert.equal(made.engraving.source, "svg");
  assert.equal(made.engraving.name, "logo.svg");
  assert.equal(made.engraving.rotation, 0);
  near(made.engraving.width, 100);
  near(made.engraving.height, 50);
  near(made.engraving.x, (bottom.width - 100) / 2);
  near(made.engraving.y, (bottom.height - 50) / 2);
  assert.equal(bottom.outline.length > 0, true);
  assert.deepEqual(bottom.engraving, []);
});

test("engraving is drawn on its layer and moves with the panel without changing geometry", () => {
  const built = box();
  const before = geometryFingerprint(built.geometry.panels);
  const bottom = built.geometry.panels.find((panel) => panel.id === "bottom");
  const front = built.geometry.panels.find((panel) => panel.id === "front");
  const first = buildEngraving({
    id: "engraving-1",
    panel: bottom,
    name: "logo.svg",
    source: "svg",
    data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"></svg>`,
    imageWidth: 200,
    imageHeight: 100,
  }).engraving;
  const second = buildEngraving({
    id: "engraving-2",
    panel: front,
    name: "mark.png",
    source: "png",
    data: "data:image/png;base64,aaaa",
    imageWidth: 100,
    imageHeight: 100,
  }).engraving;
  const panels = attachEngravings(built.geometry.panels, [first, second]);
  assert.deepEqual(bottom.engraving, []);
  assert.equal(panels.find((panel) => panel.id === "bottom").engraving.length, 1);
  assert.equal(panels.find((panel) => panel.id === "front").engraving[0].panelId, "front");

  const svg = renderSvg({ panels, layout: built.geometry.layout });
  const cut = svg.split('id="cut-layer"')[1].split('id="engraving-layer"')[0];
  assert.match(svg, /id="engraving-layer"/);
  assert.match(svg, /data-engraving="engraving-1"/);
  assert.match(svg, /data-engraving="engraving-2"/);
  assert.doesNotMatch(cut, /data-engraving|data:image/);
  assert.match(svg, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(svg, /preserveAspectRatio="none"/);

  const place = built.geometry.layout.placements.find((item) => item.panelId === "bottom");
  const movedLayout = movePanel(built.geometry.layout, "bottom", place.x + 40, place.y);
  const moved = renderSvg({ panels, layout: movedLayout });
  const beforePoints = pointsOf(svg, "engraving-1");
  const afterPoints = pointsOf(moved, "engraving-1");
  for (let index = 0; index < beforePoints.length; index += 1) {
    near(afterPoints[index].x, beforePoints[index].x + 40);
    near(afterPoints[index].y, beforePoints[index].y);
  }
  assert.equal(first.x, panels.find((panel) => panel.id === "bottom").engraving[0].x);
  assert.equal(second.panelId, "front");
  assert.equal(pointsOf(moved, "engraving-2").length, pointsOf(svg, "engraving-2").length);
  const zoomed = renderSvg({
    panels,
    layout: built.geometry.layout,
    viewport: { x: 20, y: 10, width: 200, height: 240 },
  });
  assert.deepEqual(pointsOf(zoomed, "engraving-1"), beforePoints);
  assert.equal(geometryFingerprint(built.geometry.panels), before);
  assert.equal(bottom.width, 300);
  assert.equal(bottom.height, 200);
});

test("rotation is stored and drawn, and selection can name an engraving", () => {
  const logo = createLogo({
    id: "engraving-1",
    panelId: "bottom",
    x: 100,
    y: 75,
    width: 100,
    height: 50,
    rotation: 90,
    source: "svg",
    data: "<svg xmlns='http://www.w3.org/2000/svg'/>",
    name: "logo.svg",
  });
  const built = box();
  const panels = attachEngravings(built.geometry.panels, [logo]);
  const svg = renderSvg({
    panels,
    layout: built.geometry.layout,
    options: { selectedEngravingId: "engraving-1" },
  });
  const span = pointsOf(svg, "engraving-1");
  const width = Math.max(...span.map((point) => point.x)) - Math.min(...span.map((point) => point.x));
  const height = Math.max(...span.map((point) => point.y)) - Math.min(...span.map((point) => point.y));
  near(width, 50, 1e-3);
  near(height, 100, 1e-3);
  assert.match(svg.split('id="selection-layer"')[1], /data-selection="engraving-1"/);
  assert.doesNotMatch(svg.split('id="cut-layer"')[1].split('id="engraving-layer"')[0], /engraving-1/);

  const editor = createEditorState();
  assert.deepEqual(editor.selectEngraving("engraving-1"), { type: "engraving", id: "engraving-1" });
  const info = describeEngraving(logo);
  assert.equal(info.title, "Гравировка");
  assert.equal(info.width, 100);
  assert.equal(info.height, 50);
  assert.equal(info.rotation, 90);
  assert.equal(info.x, 100);
  editor.selectPanel("front");
  assert.equal(editor.selection.type, "panel");
  assert.equal(logo.panelId, "bottom");
});
