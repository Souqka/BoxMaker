import { describe, expect, it } from "vitest";
import { buildProduct } from "../src/buildProduct.ts";
import { buildClosedBoxPanels, panelPointToWorld } from "../src/geometry/closedBox.ts";
import { contactToOutlineOffset } from "../src/geometry/edgeMap.ts";
import { offsetOutline } from "../src/geometry/offset.ts";
import { buildOutline, outwardNormal, pointOnEdge } from "../src/geometry/outline.ts";
import { boundsOf, polygonArea } from "../src/geometry/vec.ts";
import { createPresetBox } from "../src/model/box.ts";
import type { Panel, PanelFeature } from "../src/model/types.ts";

describe("outline", () => {
  it("adds tab area and removes slot area from the nominal rectangle", () => {
    const tabbed = buildOutline(100, 50, [{ role: "tab", edge: "bottom", offset: 40, width: 20, depth: 4 }]);
    const slotted = buildOutline(100, 50, [{ role: "slot", edge: "bottom", offset: 10, width: 10, depth: 4 }]);
    expect(polygonArea(tabbed)).toBeCloseTo(100 * 50 + 20 * 4, 6);
    expect(polygonArea(slotted)).toBeCloseTo(100 * 50 - 10 * 4, 6);
    expect(polygonArea(buildOutline(100, 50, []))).toBeCloseTo(5000, 6);
  });

  it("offsets a rectangle outward by the kerf radius", () => {
    const outline = buildOutline(100, 40, []);
    const cut = offsetOutline(outline, 0.1);
    const bounds = boundsOf(cut);
    expect(bounds.minX).toBeCloseTo(-0.1, 6);
    expect(bounds.minY).toBeCloseTo(-0.1, 6);
    expect(bounds.maxX).toBeCloseTo(100.1, 6);
    expect(bounds.maxY).toBeCloseTo(40.1, 6);
  });
});

describe("closed box panels", () => {
  const panels = buildClosedBoxPanels({
    external: { width: 300, depth: 200, height: 100 },
    thickness: 4,
    joint: { type: "tab-slot", tabWidth: 20, edgeMargin: 10, minGap: 10 },
    clearance: 0.1,
    kerf: 0.2,
    kerfCompensation: true,
  });

  it("gives each panel the nominal size of this construction", () => {
    const byId = Object.fromEntries(panels.map((panel) => [panel.id, panel]));
    expect(byId.front).toMatchObject({ nominalWidth: 300, nominalHeight: 100 });
    expect(byId.back).toMatchObject({ nominalWidth: 300, nominalHeight: 100 });
    expect(byId.left).toMatchObject({ nominalWidth: 192, nominalHeight: 100 });
    expect(byId.right).toMatchObject({ nominalWidth: 192, nominalHeight: 100 });
    expect(byId.bottom).toMatchObject({ nominalWidth: 292, nominalHeight: 192 });
    expect(byId.lid).toMatchObject({ nominalWidth: 292, nominalHeight: 192 });
  });

  it("grows the flat bounds by the tabs and keeps kerf off the nominal size", () => {
    const bottom = panels.find((panel) => panel.id === "bottom")!;
    const front = panels.find((panel) => panel.id === "front")!;
    const left = panels.find((panel) => panel.id === "left")!;
    expect(boundsOf(bottom.geometry.outline)).toMatchObject({ width: 300, height: 200 });
    expect(boundsOf(left.geometry.outline).width).toBeCloseTo(200, 6);
    expect(boundsOf(left.geometry.outline).height).toBeCloseTo(100, 6);
    expect(front.nominalWidth).toBe(300);
    expect(boundsOf(front.geometry.outline).width).toBeCloseTo(300, 6);
    expect(boundsOf(front.geometry.cutOutline).width).toBeCloseTo(300.2, 6);
    expect(boundsOf(bottom.geometry.cutOutline).width).toBeCloseTo(300.2, 6);
  });

  it("mates every tab tip to the matching slot edge in world space", () => {
    for (const panel of panels) {
      for (const feature of panel.features) {
        if (feature.role !== "tab") continue;
        const slot = panels
          .flatMap((candidate) => candidate.features.map((item) => ({ panel: candidate, feature: item })))
          .find(
            (candidate) =>
              candidate.feature.role === "slot" &&
              candidate.feature.contactId === feature.contactId &&
              Math.abs(
                candidate.feature.assemblyOffset +
                  candidate.feature.assemblyWidth / 2 -
                  (feature.assemblyOffset + feature.assemblyWidth / 2),
              ) < 1e-6,
          );
        expect(slot, feature.contactId).toBeDefined();
        const station = feature.assemblyOffset + feature.assemblyWidth / 2;
        const tabTip = panelPointToWorld(panel, sample(panel, feature, station, "tip"));
        const slotRoot = panelPointToWorld(slot!.panel, sample(slot!.panel, slot!.feature, station, "root"));
        expect(tabTip.x).toBeCloseTo(slotRoot.x, 4);
        expect(tabTip.y).toBeCloseTo(slotRoot.y, 4);
        expect(tabTip.z).toBeCloseTo(slotRoot.z, 4);
      }
    }
  });
});

describe("kerf and clearance do not move the finished envelope", () => {
  it.each([
    { kerf: 0, clearance: 0 },
    { kerf: 0.15, clearance: 0.1 },
    { kerf: 0.4, clearance: 0.25 },
  ])("kerf $kerf clearance $clearance", ({ kerf, clearance }) => {
    const model = createPresetBox({
      id: "sheet",
      name: "sheet",
      thickness: 4,
      kerf,
      clearance,
    });
    model.dimensions = { width: 300, depth: 200, height: 100, mode: "external" };
    model.joint = { type: "tab-slot", tabWidth: 20, edgeMargin: 12, minGap: 8 };
    model.render.kerfCompensation = true;
    const built = buildProduct(model);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dimensions.external).toEqual({ width: 300, depth: 200, height: 100 });
    const front = built.panels.find((panel) => panel.id === "front")!;
    const slot = front.features.find((feature) => feature.role === "slot")!;
    expect(slot.assemblyWidth).toBeCloseTo(20 + clearance, 6);
    expect(boundsOf(front.geometry.cutOutline).width).toBeCloseTo(300 + kerf, 4);
    expect(front.nominalWidth).toBe(300);
  });
});

function sample(panel: Panel, feature: PanelFeature, assemblyS: number, place: "root" | "tip") {
  const t = contactToOutlineOffset(
    panel.id,
    feature.edge,
    assemblyS,
    0,
    { width: panel.nominalWidth, height: panel.nominalHeight },
    panel.thickness,
  );
  const root = pointOnEdge(feature.edge, t, panel.nominalWidth, panel.nominalHeight);
  if (place === "root") return root;
  const normal = outwardNormal(feature.edge);
  return {
    x: root.x + normal.x * feature.depth,
    y: root.y + normal.y * feature.depth,
  };
}
