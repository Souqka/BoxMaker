import { describe, expect, it } from "vitest";
import { CLOSED_BOX } from "../src/dimension/constructions.ts";
import { resolveDimensions } from "../src/dimension/resolveDimensions.ts";
import { buildProduct } from "../src/buildProduct.ts";
import { measureFromPanels } from "../src/geometry/closedBox.ts";
import { createPresetBox } from "../src/model/box.ts";
import type { BoxModel, DimensionMode } from "../src/model/types.ts";

function box(mode: DimensionMode, size: { width: number; depth: number; height: number }, thickness: number): BoxModel {
  const model = createPresetBox({
    id: "sheet",
    name: "sheet",
    thickness,
    kerf: 0.15,
    clearance: 0.1,
  });
  model.dimensions = { ...size, mode };
  model.fabrication.minimumPanelSize = 5;
  model.joint.edgeMargin = thickness + 0.1 * 1.5;
  model.joint.tabWidth = Math.max(thickness * 2, 8);
  model.joint.minGap = thickness;
  return model;
}

describe("resolveDimensions", () => {
  it("keeps external input and derives the cavity from the construction thickness count", () => {
    const resolved = resolveDimensions({
      dimensions: { width: 300, depth: 200, height: 100, mode: "external" },
      thickness: 4,
      construction: CLOSED_BOX,
    });
    expect(resolved.external).toEqual({ width: 300, depth: 200, height: 100 });
    expect(resolved.internal).toEqual({ width: 292, depth: 192, height: 92 });
  });

  it("treats internal input as the cavity and grows the envelope by the construction, not by a hardcoded +2", () => {
    const resolved = resolveDimensions({
      dimensions: { width: 300, depth: 200, height: 100, mode: "internal" },
      thickness: 4,
      construction: CLOSED_BOX,
    });
    const count = CLOSED_BOX.thicknessCount;
    expect(resolved.internal).toEqual({ width: 300, depth: 200, height: 100 });
    expect(resolved.external).toEqual({
      width: 300 + count.width * 4,
      depth: 200 + count.depth * 4,
      height: 100 + count.height * 4,
    });
  });

  it.each([3, 4, 6, 9, 12])("uses thickness %s mm as a value, including thicknesses outside the first presets", (thickness) => {
    const external = resolveDimensions({
      dimensions: { width: 300, depth: 200, height: 100, mode: "external" },
      thickness,
      construction: CLOSED_BOX,
    });
    const internal = resolveDimensions({
      dimensions: { ...external.internal, mode: "internal" },
      thickness,
      construction: CLOSED_BOX,
    });
    expect(external.internal.height).toBeCloseTo(100 - CLOSED_BOX.thicknessCount.height * thickness, 6);
    expect(internal.external).toEqual(external.external);
  });
});

describe("dimension round trip through geometry", () => {
  it("external → panels → external", () => {
    const model = box("external", { width: 300, depth: 200, height: 100 }, 4);
    const built = buildProduct(model);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const measured = measureFromPanels(built.panels, model.material.thickness);
    expect(measured.external).toEqual({ width: 300, depth: 200, height: 100 });
    expect(measured.internal).toEqual(built.dimensions.internal);
  });

  it("internal → panels → internal", () => {
    const model = box("internal", { width: 300, depth: 200, height: 100 }, 4);
    const built = buildProduct(model);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const measured = measureFromPanels(built.panels, model.material.thickness);
    expect(measured.internal).toEqual({ width: 300, depth: 200, height: 100 });
    expect(measured.external).toEqual(built.dimensions.external);
    expect(built.dimensions.external.height).toBe(100 + CLOSED_BOX.thicknessCount.height * 4);
  });

  it.each([3, 4, 6])("preserves an external 300×200×100 box at %s mm", (thickness) => {
    const model = box("external", { width: 300, depth: 200, height: 100 }, thickness);
    const built = buildProduct(model);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(measureFromPanels(built.panels, thickness).external).toEqual({
      width: 300,
      depth: 200,
      height: 100,
    });
    const front = built.panels.find((panel) => panel.id === "front");
    expect(front?.nominalWidth).toBe(300);
    expect(front?.nominalHeight).toBe(100);
  });
});
