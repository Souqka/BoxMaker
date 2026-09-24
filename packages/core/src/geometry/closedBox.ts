import { CLOSED_BOX, type ConstructionRules } from "../dimension/constructions.ts";
import { generateJoint } from "../joint/generateJoint.ts";
import type { TabSlotConfig } from "../joint/types.ts";
import type { EdgeId, Panel, PanelFeature, PanelId, PanelPose, TabSlotJointConfig } from "../model/types.ts";
import type { Size3, Vec3 } from "./vec.ts";
import { contactToOutlineOffset, type NominalSize } from "./edgeMap.ts";
import { offsetOutline } from "./offset.ts";
import { buildOutline, type OutlineFeature } from "./outline.ts";

export interface ClosedBoxPanelSize {
  width: number;
  height: number;
}

export interface ContactSpec {
  id: string;
  length: number;
  tab: { panelId: PanelId; edge: EdgeId };
  slot: { panelId: PanelId; edge: EdgeId };
}

const PANEL_IDS: readonly PanelId[] = ["front", "back", "left", "right", "bottom", "lid"];

/**
 * Nominal finished rectangles for the closed box.
 * Front/back span the external width and height.
 * Left/right span the internal depth and the external height.
 * Bottom/lid span the internal width and internal depth.
 */
export function closedBoxPanelSizes(external: Size3, thickness: number, rules: ConstructionRules = CLOSED_BOX): Record<PanelId, ClosedBoxPanelSize> {
  const widthInset = rules.thicknessCount.width * thickness;
  const depthInset = rules.thicknessCount.depth * thickness;
  return {
    front: { width: external.width, height: external.height },
    back: { width: external.width, height: external.height },
    left: { width: external.depth - depthInset, height: external.height },
    right: { width: external.depth - depthInset, height: external.height },
    bottom: { width: external.width - widthInset, height: external.depth - depthInset },
    lid: { width: external.width - widthInset, height: external.depth - depthInset },
  };
}

export function closedBoxContacts(external: Size3, thickness: number, rules: ConstructionRules = CLOSED_BOX): ContactSpec[] {
  const sizes = closedBoxPanelSizes(external, thickness, rules);
  const vertical = external.height;
  return [
    contact("front-left", vertical, "left", "left", "front", "left"),
    contact("front-right", vertical, "right", "left", "front", "right"),
    contact("back-left", vertical, "left", "right", "back", "right"),
    contact("back-right", vertical, "right", "right", "back", "left"),
    contact("bottom-front", sizes.bottom.width, "bottom", "bottom", "front", "bottom"),
    contact("bottom-back", sizes.bottom.width, "bottom", "top", "back", "bottom"),
    contact("bottom-left", sizes.bottom.height, "bottom", "left", "left", "bottom"),
    contact("bottom-right", sizes.bottom.height, "bottom", "right", "right", "bottom"),
    contact("lid-front", sizes.lid.width, "lid", "bottom", "front", "top"),
    contact("lid-back", sizes.lid.width, "lid", "top", "back", "top"),
    contact("lid-left", sizes.lid.height, "lid", "left", "left", "top"),
    contact("lid-right", sizes.lid.height, "lid", "right", "right", "top"),
  ];
}

export interface BuildClosedBoxInput {
  external: Size3;
  thickness: number;
  joint: TabSlotJointConfig;
  clearance: number;
  kerf: number;
  kerfCompensation: boolean;
}

export function buildClosedBoxPanels(input: BuildClosedBoxInput): Panel[] {
  const rules = CLOSED_BOX;
  const sizes = closedBoxPanelSizes(input.external, input.thickness, rules);
  const contacts = closedBoxContacts(input.external, input.thickness, rules);
  const features = new Map<PanelId, PanelFeature[]>();
  for (const id of PANEL_IDS) features.set(id, []);

  const jointConfig: TabSlotConfig = {
    type: "tab-slot",
    tabWidth: input.joint.tabWidth,
    edgeMargin: input.joint.edgeMargin,
    minGap: input.joint.minGap,
    clearance: input.clearance,
    tabCount: input.joint.tabCount,
  };

  for (const spec of contacts) {
    const tabs = generateJoint(
      { length: spec.length, role: "tab", partnerThickness: input.thickness },
      jointConfig,
    );
    const slots = generateJoint(
      { length: spec.length, role: "slot", partnerThickness: input.thickness },
      jointConfig,
    );
    appendFeatures(features, spec.id, spec.tab, tabs, sizes, input.thickness);
    appendFeatures(features, spec.id, spec.slot, slots, sizes, input.thickness);
  }

  return PANEL_IDS.map((id) => {
    const nominal = sizes[id];
    const panelFeatures = features.get(id) ?? [];
    const outlineFeatures: OutlineFeature[] = panelFeatures.map((feature) => ({
      role: feature.role,
      edge: feature.edge,
      offset: feature.offset,
      width: feature.width,
      depth: feature.depth,
    }));
    const outline = buildOutline(nominal.width, nominal.height, outlineFeatures);
    const kerfRadius = input.kerfCompensation ? input.kerf / 2 : 0;
    const cutOutline = kerfRadius === 0 ? outline.map((p) => ({ ...p })) : offsetOutline(outline, kerfRadius);
    return {
      id,
      width: nominal.width,
      height: nominal.height,
      nominalWidth: nominal.width,
      nominalHeight: nominal.height,
      thickness: input.thickness,
      geometry: {
        outline,
        holes: [],
        cutOutline,
        cutHoles: [],
      },
      features: panelFeatures,
      engraving: [],
      pose: poseFor(id, input.external, input.thickness),
    };
  });
}

/** Reconstruct envelopes from finished panel rectangles. Used to test the round trip. */
export function measureFromPanels(
  panels: readonly Pick<Panel, "id" | "nominalWidth" | "nominalHeight">[],
  thickness: number,
  rules: ConstructionRules = CLOSED_BOX,
): { external: Size3; internal: Size3 } {
  const front = requirePanel(panels, "front");
  const left = requirePanel(panels, "left");
  const external = {
    width: front.nominalWidth,
    depth: left.nominalWidth + rules.thicknessCount.depth * thickness,
    height: front.nominalHeight,
  };
  const internal = {
    width: external.width - rules.thicknessCount.width * thickness,
    depth: external.depth - rules.thicknessCount.depth * thickness,
    height: external.height - rules.thicknessCount.height * thickness,
  };
  return { external, internal };
}

export function panelPointToWorld(panel: Pick<Panel, "pose">, point: { x: number; y: number }): Vec3 {
  const { origin, xAxis, yAxis } = panel.pose;
  return {
    x: origin.x + xAxis.x * point.x + yAxis.x * point.y,
    y: origin.y + xAxis.y * point.x + yAxis.y * point.y,
    z: origin.z + xAxis.z * point.x + yAxis.z * point.y,
  };
}

function appendFeatures(
  target: Map<PanelId, PanelFeature[]>,
  contactId: string,
  mount: { panelId: PanelId; edge: EdgeId },
  generated: { role: "tab" | "slot"; offset: number; width: number; depth: number }[],
  sizes: Record<PanelId, NominalSize>,
  thickness: number,
): void {
  const list = target.get(mount.panelId);
  if (!list) return;
  generated.forEach((feature, index) => {
    list.push({
      id: `${contactId}-${mount.panelId}-${feature.role}-${index}`,
      contactId,
      role: feature.role,
      edge: mount.edge,
      offset: contactToOutlineOffset(mount.panelId, mount.edge, feature.offset, feature.width, sizes[mount.panelId], thickness),
      width: feature.width,
      depth: feature.depth,
      assemblyOffset: feature.offset,
      assemblyWidth: feature.width,
    });
  });
}

function contact(
  id: string,
  length: number,
  tabPanel: PanelId,
  tabEdge: EdgeId,
  slotPanel: PanelId,
  slotEdge: EdgeId,
): ContactSpec {
  return {
    id,
    length,
    tab: { panelId: tabPanel, edge: tabEdge },
    slot: { panelId: slotPanel, edge: slotEdge },
  };
}

function poseFor(id: PanelId, external: Size3, thickness: number): PanelPose {
  const { width: w, depth: d, height: h } = external;
  switch (id) {
    case "front":
      return pose(v(0, 0, 0), v(1, 0, 0), v(0, 0, 1), v(0, 1, 0));
    case "back":
      return pose(v(w, d, 0), v(-1, 0, 0), v(0, 0, 1), v(0, -1, 0));
    case "left":
      return pose(v(0, thickness, 0), v(0, 1, 0), v(0, 0, 1), v(1, 0, 0));
    case "right":
      return pose(v(w, thickness, 0), v(0, 1, 0), v(0, 0, 1), v(-1, 0, 0));
    case "bottom":
      return pose(v(thickness, thickness, 0), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1));
    case "lid":
      return pose(v(thickness, thickness, h), v(1, 0, 0), v(0, 1, 0), v(0, 0, -1));
  }
}

function pose(origin: Vec3, xAxis: Vec3, yAxis: Vec3, thicknessAxis: Vec3): PanelPose {
  return { origin, xAxis, yAxis, thicknessAxis };
}

function v(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function requirePanel<T extends { id: PanelId }>(panels: readonly T[], id: PanelId): T {
  const panel = panels.find((item) => item.id === id);
  if (!panel) throw new Error(`Панель ${id} отсутствует.`);
  return panel;
}
