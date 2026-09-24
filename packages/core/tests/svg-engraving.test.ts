import { describe, expect, it } from "vitest";
import { buildProduct } from "../src/buildProduct.ts";
import { boundsOf } from "../src/geometry/vec.ts";
import { sheetPointToPanel } from "../src/layout/layoutPanels.ts";
import {
  createEngravingItem,
  duplicateEngraving,
  engravingBounds,
  engravingCorners,
  moveEngraving,
  rotateEngraving,
  scaleEngraving,
  snapToStep,
} from "../src/engraving/engraving.ts";
import { createPresetBox } from "../src/model/box.ts";
import type { BoxModel } from "../src/model/types.ts";

function readyBox(): BoxModel {
  const model = createPresetBox();
  model.joint = { type: "tab-slot", tabWidth: 16, edgeMargin: 10, minGap: 8 };
  return model;
}

describe("svg", () => {
  it("draws cut, engraving, construction and dimension layers in millimetres", () => {
    const built = buildProduct(readyBox());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.svg).toContain('data-units="mm"');
    expect(built.svg).toContain('id="cutLayer"');
    expect(built.svg).toContain('id="engravingLayer"');
    expect(built.svg).toContain('id="constructionLayer"');
    expect(built.svg).toContain('id="dimensionLayer"');
    expect(built.svg).toContain('data-panel="front"');
    expect(built.svg).toContain("300×100");
    expect(built.svg).toMatch(/width="[\d.]+mm"/);
    expect(built.svg).toContain('data-role="grid"');
    expect(built.layout.width).toBeGreaterThan(300);
    expect(new Set(built.layout.placements.map((item) => item.y)).size).toBeGreaterThan(1);
    const front = built.panels.find((panel) => panel.id === "front")!;
    const placement = built.layout.placements.find((item) => item.panelId === "front")!;
    const bounds = boundsOf(front.geometry.outline);
    expect(sheetPointToPanel(front, placement, { x: placement.x - bounds.minX + 12, y: placement.y - bounds.minY + 7 })).toEqual({
      x: 12,
      y: 7,
    });
    expect(snapToStep(12.4, 1)).toBe(12);
    expect(snapToStep(12.5, 1)).toBe(13);
    const viewBox = built.svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    expect(Number(viewBox?.[1])).toBeCloseTo(built.layout.width, 3);
    expect(Number(viewBox?.[2])).toBeCloseTo(built.layout.height, 3);
  });
});

describe("engraving placement", () => {
  const logo = createEngravingItem({
    id: "logo-1",
    panelId: "front",
    x: 100,
    y: 50,
    width: 80,
    height: 30,
    rotation: 0,
    source: "svg",
    name: "mark.svg",
    content: "<svg xmlns='http://www.w3.org/2000/svg'/>",
  });

  it("stores the logo in panel millimetres", () => {
    const placed = moveEngraving([logo], "logo-1", 120, 40);
    expect(placed[0]).toMatchObject({ panelId: "front", x: 120, y: 40, width: 80, height: 30 });
  });

  it("scales around the same center", () => {
    const scaled = scaleEngraving([logo], "logo-1", 40, 16);
    expect(scaled[0]).toMatchObject({ x: 100, y: 50, width: 40, height: 16 });
    const corners = engravingCorners(scaled[0]!);
    const center = corners.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    expect(center.x / 4).toBeCloseTo(100, 6);
    expect(center.y / 4).toBeCloseTo(50, 6);
  });

  it("rotates about the center and swaps the axis-aligned bounds at 90 degrees", () => {
    const rotated = rotateEngraving([logo], "logo-1", 90);
    expect(rotated[0]?.rotation).toBe(90);
    const bounds = engravingBounds(rotated[0]!);
    expect(bounds.width).toBeCloseTo(30, 6);
    expect(bounds.height).toBeCloseTo(80, 6);
    const corners = engravingCorners(rotated[0]!);
    expect(corners.map((point) => point.x).sort((a, b) => a - b)[0]).toBeCloseTo(100 - 15, 6);
    expect(corners.map((point) => point.y).sort((a, b) => a - b)[0]).toBeCloseTo(50 - 40, 6);
  });

  it("duplicates with an explicit delta and renders the logo into the engraving layer", () => {
    const items = duplicateEngraving([logo], "logo-1", { dx: 5, dy: -5 }, "logo-2");
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ id: "logo-2", x: 105, y: 45 });

    const model = readyBox();
    model.engraving = rotateEngraving(scaleEngraving(items, "logo-1", 40, 20), "logo-1", 15);
    const built = buildProduct(model);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.svg).toContain('id="logo-1"');
    expect(built.svg).toContain('data-rotation="15"');
    expect(built.svg).toContain('id="engravingLayer"');
    const front = built.panels.find((panel) => panel.id === "front");
    expect(front?.engraving).toHaveLength(2);
  });
});
