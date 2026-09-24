export { buildProduct } from "./buildProduct.ts";
export { getConstruction, CLOSED_BOX } from "./dimension/constructions.ts";
export type { ConstructionRules } from "./dimension/constructions.ts";
export { resolveDimensions } from "./dimension/resolveDimensions.ts";
export {
  createEngravingItem,
  duplicateEngraving,
  engravingBounds,
  engravingCorners,
  moveEngraving,
  placeEngraving,
  removeEngraving,
  rotateEngraving,
  scaleEngraving,
  snapToStep,
} from "./engraving/engraving.ts";
export type { EngravingDraft } from "./engraving/engraving.ts";
export {
  buildClosedBoxPanels,
  closedBoxContacts,
  closedBoxPanelSizes,
  measureFromPanels,
  panelPointToWorld,
} from "./geometry/closedBox.ts";
export { contactToOutlineOffset } from "./geometry/edgeMap.ts";
export { offsetOutline } from "./geometry/offset.ts";
export { buildOutline, outwardNormal, pointOnEdge } from "./geometry/outline.ts";
export type { OutlineFeature } from "./geometry/outline.ts";
export { almostEqual, boundsOf, polygonArea, MM_EPSILON } from "./geometry/vec.ts";
export type { Bounds, Size3, Vec2, Vec3 } from "./geometry/vec.ts";
export { generateJoint } from "./joint/generateJoint.ts";
export { layoutTabs } from "./joint/tabSlot.ts";
export { JointError } from "./joint/types.ts";
export type { JointConfig, JointEdge, JointFeature, TabSlotConfig } from "./joint/types.ts";
export { layoutPanels, movePlacement, sheetPointToPanel } from "./layout/layoutPanels.ts";
export { MODEL_ASSUMPTIONS, suggestTabSlotPreset } from "./model/assumptions.ts";
export type { TabSlotPreset } from "./model/assumptions.ts";
export { createPresetBox } from "./model/box.ts";
export { createMaterial, MATERIAL_PRESETS } from "./model/material.ts";
export type {
  BoxModel,
  BuildFailure,
  BuildResult,
  BuildSuccess,
  DimensionMode,
  EdgeId,
  EngravingItem,
  EngravingSource,
  FabricationConstraints,
  JointType,
  LayoutSettings,
  Material,
  Panel,
  PanelFeature,
  PanelGeometry,
  PanelId,
  PanelPose,
  RenderSettings,
  ResolvedDimensions,
  SheetLayout,
  SheetPlacement,
  TabSlotJointConfig,
  UserDimensions,
  ValidationIssue,
} from "./model/types.ts";
export { renderSvg } from "./svg/renderSvg.ts";
export { validateBox } from "./validation/validateBox.ts";
