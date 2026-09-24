import { describe, expect, it } from "vitest";
import { buildProduct } from "../src/buildProduct.ts";
import { createPresetBox } from "../src/model/box.ts";
import type { BoxModel } from "../src/model/types.ts";

function model(patch?: (input: BoxModel) => void): BoxModel {
  const next = createPresetBox();
  next.fabrication.minimumPanelSize = 10;
  next.fabrication.minimumFeatureSize = 1;
  patch?.(next);
  return next;
}

describe("validation", () => {
  it("rejects zero, negative and non-finite dimensions", () => {
    expect(buildProduct(model((input) => (input.dimensions.width = 0))).ok).toBe(false);
    expect(buildProduct(model((input) => (input.dimensions.depth = -20))).ok).toBe(false);
    expect(buildProduct(model((input) => (input.dimensions.height = Number.NaN))).ok).toBe(false);
    const failed = buildProduct(model((input) => (input.dimensions.width = 0)));
    expect(failed.issues.some((issue) => issue.code === "invalid-dimensions")).toBe(true);
  });

  it("rejects a box whose external size cannot contain the walls", () => {
    const failed = buildProduct(
      model((input) => {
        input.dimensions = { width: 10, depth: 10, height: 10, mode: "external" };
        input.material.thickness = 6;
      }),
    );
    expect(failed.ok).toBe(false);
    expect(failed.issues.some((issue) => issue.code === "internal-non-positive")).toBe(true);
  });

  it("rejects a very small box that breaks the minimum panel size", () => {
    const failed = buildProduct(
      model((input) => {
        input.dimensions = { width: 30, depth: 30, height: 30, mode: "external" };
        input.material.thickness = 6;
        input.fabrication.minimumPanelSize = 40;
        input.joint.edgeMargin = 6 + input.material.clearance * 1.5;
      }),
    );
    expect(failed.ok).toBe(false);
    expect(failed.issues.some((issue) => issue.code === "panel-too-small")).toBe(true);
  });

  it("builds a large box without changing units", () => {
    const built = buildProduct(
      model((input) => {
        input.dimensions = { width: 2400, depth: 1200, height: 800, mode: "internal" };
        input.material.thickness = 6;
        input.joint.tabWidth = 24;
        input.joint.edgeMargin = 20;
        input.joint.minGap = 12;
      }),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dimensions.internal).toEqual({ width: 2400, depth: 1200, height: 800 });
    expect(built.dimensions.external.width).toBe(2412);
    expect(built.panels).toHaveLength(6);
  });

  it("rejects an edge margin that would collide in the corners", () => {
    const failed = buildProduct(
      model((input) => {
        input.joint.edgeMargin = 1;
      }),
    );
    expect(failed.ok).toBe(false);
    expect(failed.issues.some((issue) => issue.code === "edge-margin-too-small")).toBe(true);
  });
});
