import assert from "node:assert/strict";
import test from "node:test";
import { COORDINATES, normalizeDimensions, resolveDimensions } from "../src/geometry/dimensions.js";
import { createJoint } from "../src/geometry/joints.js";

const EPSILON = 1e-9;

const SIZES = [
  { width: 300, depth: 200, height: 100 },
  { width: 120, depth: 80, height: 40 },
  { width: 50.5, depth: 40.25, height: 30.125 },
];

function material(thickness, extras = {}) {
  return { thickness, kerf: 0.15, clearance: 0.1, ...extras };
}

function resolve(dimensions, dimensionMode, thickness, joint = { type: "tab-slot" }, extras = {}) {
  return resolveDimensions({
    dimensions,
    dimensionMode,
    material: material(thickness, extras),
    joint,
  });
}

function assertSize(actual, expected, epsilon = EPSILON) {
  for (const axis of ["width", "depth", "height"]) {
    assert.ok(
      Math.abs(actual[axis] - expected[axis]) <= epsilon,
      `${axis}: ${actual[axis]} is not within ${epsilon} of ${expected[axis]}`,
    );
  }
}

function tabSlotAdjustment(thickness) {
  return createJoint({ type: "tab-slot" }).getDimensionAdjustment(material(thickness));
}

test("coordinates are width, depth and height in millimetres", () => {
  assert.deepEqual(COORDINATES, { X: "width", Y: "depth", Z: "height", unit: "mm" });
});

test("external input resolves the cavity from the joint adjustment", () => {
  const resolved = resolve({ width: 300, depth: 200, height: 100 }, "external", 4);
  assert.equal(resolved.valid, true);
  assert.deepEqual(resolved.input, { width: 300, depth: 200, height: 100, mode: "external" });
  assertSize(resolved.external, { width: 300, depth: 200, height: 100 });
  assertSize(resolved.internal, { width: 292, depth: 192, height: 92 });
});

test("internal input resolves the envelope from the joint adjustment", () => {
  const resolved = resolve({ width: 300, depth: 200, height: 100 }, "internal", 4);
  assert.equal(resolved.valid, true);
  assert.deepEqual(resolved.input, { width: 300, depth: 200, height: 100, mode: "internal" });
  assertSize(resolved.internal, { width: 300, depth: 200, height: 100 });
  assertSize(resolved.external, { width: 308, depth: 208, height: 108 });
});

test("external sizes round-trip through the internal envelope", () => {
  for (const thickness of [3, 4, 6]) {
    for (const size of SIZES) {
      const forward = resolve(size, "external", thickness);
      assert.equal(forward.valid, true, JSON.stringify(forward.errors));
      const back = resolve(forward.internal, "internal", thickness);
      assert.equal(back.valid, true);
      assertSize(back.external, size);
      assertSize(forward.external, size);
    }
  }
});

test("internal sizes round-trip through the external envelope", () => {
  for (const thickness of [3, 4, 6]) {
    for (const size of SIZES) {
      const forward = resolve(size, "internal", thickness);
      assert.equal(forward.valid, true, JSON.stringify(forward.errors));
      const back = resolve(forward.external, "external", thickness);
      assert.equal(back.valid, true);
      assertSize(back.internal, size);
      assertSize(forward.internal, size);
    }
  }
});

test("tab-slot adjustment follows thickness for 3, 4, 6, 9 and 12 mm", () => {
  const size = { width: 400, depth: 250, height: 150 };
  const internals = [];

  for (const thickness of [3, 4, 6, 9, 12]) {
    const adjustment = tabSlotAdjustment(thickness);
    assertSize(adjustment, {
      width: thickness * 2,
      depth: thickness * 2,
      height: thickness * 2,
    });

    const resolved = resolve(size, "external", thickness);
    assert.equal(resolved.valid, true);
    assertSize(resolved.internal, {
      width: size.width - adjustment.width,
      depth: size.depth - adjustment.depth,
      height: size.height - adjustment.height,
    });
    internals.push(resolved.internal.width);
  }

  assert.equal(new Set(internals).size, internals.length);
});

test("kerf and clearance do not change the nominal envelopes", () => {
  const quiet = resolve({ width: 300, depth: 200, height: 100 }, "external", 6, { type: "tab-slot" }, {
    kerf: 0,
    clearance: 0,
  });
  const noisy = resolve({ width: 300, depth: 200, height: 100 }, "external", 6, { type: "tab-slot" }, {
    kerf: 0.2,
    clearance: 0.35,
  });
  assertSize(noisy.external, quiet.external);
  assertSize(noisy.internal, quiet.internal);
});

test("the dimension engine applies the joint adjustment instead of a fixed formula", () => {
  const joint = {
    type: "custom",
    getDimensionAdjustment() {
      return { width: 1, depth: 2.5, height: 7 };
    },
  };
  const resolved = resolveDimensions({
    dimensions: { width: 80, depth: 50, height: 40 },
    dimensionMode: "external",
    material: material(12),
    joint,
  });
  assert.equal(resolved.valid, true);
  assertSize(resolved.internal, { width: 79, depth: 47.5, height: 33 });
  assertSize(resolved.external, { width: 80, depth: 50, height: 40 });
});

test("normalizeDimensions coerces numeric strings and keeps full precision", () => {
  const normalized = normalizeDimensions({
    dimensions: { width: "300.125", depth: "200", height: 100 },
    dimensionMode: "external",
    material: { thickness: "4.5", kerf: "0", clearance: 0 },
  });
  assert.equal(normalized.valid, true);
  assert.equal(normalized.dimensions.width, 300.125);
  assert.equal(normalized.material.thickness, 4.5);
});

test("rejects zero and negative box sizes", () => {
  const cases = [
    [{ width: 0, depth: 200, height: 100 }, "width"],
    [{ width: -1, depth: 200, height: 100 }, "width"],
    [{ width: 300, depth: 0, height: 100 }, "depth"],
    [{ width: 300, depth: 200, height: 0 }, "height"],
  ];

  for (const [dimensions, field] of cases) {
    const resolved = resolve(dimensions, "external", 4);
    assert.equal(resolved.valid, false);
    const issue = resolved.errors.find((item) => item.field === field);
    assert.equal(issue.code, "INVALID_VALUE");
    assert.match(issue.message, /greater than zero/i);
  }
});

test("rejects zero thickness, negative kerf and negative clearance", () => {
  const thickness = resolve({ width: 300, depth: 200, height: 100 }, "external", 0);
  assert.equal(thickness.errors.find((item) => item.field === "thickness").code, "INVALID_VALUE");

  const kerf = resolve({ width: 300, depth: 200, height: 100 }, "external", 4, { type: "tab-slot" }, { kerf: -0.1 });
  assert.equal(kerf.errors.find((item) => item.field === "kerf").code, "INVALID_VALUE");

  const clearance = resolve({ width: 300, depth: 200, height: 100 }, "external", 4, { type: "tab-slot" }, {
    clearance: -0.2,
  });
  assert.equal(clearance.errors.find((item) => item.field === "clearance").code, "INVALID_VALUE");
});

test("rejects NaN and Infinity", () => {
  const nan = resolve({ width: Number.NaN, depth: 200, height: 100 }, "external", 4);
  assert.equal(nan.valid, false);
  assert.equal(nan.errors.find((item) => item.field === "width").code, "NOT_FINITE");

  const infinite = resolve({ width: 300, depth: 200, height: Number.POSITIVE_INFINITY }, "internal", 4);
  assert.equal(infinite.valid, false);
  assert.equal(infinite.errors.find((item) => item.field === "height").code, "NOT_FINITE");
});

test("rejects a cavity that the joint cannot close", () => {
  const resolved = resolve({ width: 10, depth: 10, height: 10 }, "external", 6);
  assert.equal(resolved.valid, false);
  assert.deepEqual(
    resolved.errors.map((item) => item.code),
    ["CAVITY_TOO_SMALL", "CAVITY_TOO_SMALL", "CAVITY_TOO_SMALL"],
  );
});

test("an unknown joint type is reported without building sizes", () => {
  const resolved = resolveDimensions({
    dimensions: { width: 300, depth: 200, height: 100 },
    dimensionMode: "external",
    material: material(4),
    joint: { type: "dovetail" },
  });
  assert.equal(resolved.valid, false);
  assert.equal(resolved.errors[0].code, "UNSUPPORTED_JOINT");
  assert.equal(resolved.external, undefined);
});
