import type { Size3, Vec2, Vec3 } from "../geometry/vec.ts";

export type DimensionMode = "external" | "internal";

export type PanelId = "bottom" | "front" | "back" | "left" | "right" | "lid";

export type EdgeId = "bottom" | "right" | "top" | "left";

/** Joint kinds the model can name. Only `tab-slot` is implemented. */
export type JointType = "tab-slot" | "finger-joint" | "dovetail" | "butt" | "custom";

export type ConstructionId = "closed-box";

export type EngravingSource = "svg" | "png" | "jpg";

/**
 * Sheet material. Thickness, kerf and clearance are data — algorithms must not
 * branch on a fixed list of thicknesses.
 */
export interface Material {
  id: string;
  name: string;
  /** Finished sheet thickness, mm. */
  thickness: number;
  /** Beam / tool kerf, mm. Compensated on the cut path, not in nominal size. */
  kerf: number;
  /**
   * Extra opening of a slot relative to its tab, mm.
   * Applied symmetrically along the edge and on the inner side of the slot depth.
   */
  clearance: number;
}

export interface UserDimensions {
  width: number;
  depth: number;
  height: number;
  mode: DimensionMode;
}

export interface ResolvedDimensions {
  construction: ConstructionId;
  external: Size3;
  internal: Size3;
  thickness: number;
}

export interface TabSlotJointConfig {
  type: "tab-slot";
  /** Finished tab length along the edge, mm. */
  tabWidth: number;
  /** Distance from each end of the contact to the first tab, mm. */
  edgeMargin: number;
  /** Minimum gap between adjacent tabs, mm. */
  minGap: number;
  /** When set, every contact uses this count instead of the automatic fit. */
  tabCount?: number;
}

export interface FabricationConstraints {
  /** Smallest tab, slot or other cut feature, mm. */
  minimumFeatureSize: number;
  /** Smallest nominal panel width or height, mm. */
  minimumPanelSize: number;
}

/**
 * Engraving placement in the coordinate system of one panel.
 * `x` and `y` are the center, in millimetres. `rotation` is degrees CCW.
 */
export interface EngravingItem {
  id: string;
  panelId: PanelId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  source: EngravingSource;
  name: string;
  /** Data URL (png/jpg/svg) or raw SVG markup. */
  content: string;
}

export interface LayoutSettings {
  /** Gap between panel bounding boxes, mm. */
  spacing: number;
  /** Sheet margin around the arrangement, mm. */
  margin: number;
  /** Wrap to the next row after this width, mm. A single panel may exceed it. */
  maxRowWidth: number;
}

export interface RenderSettings {
  /**
   * When true, cut paths are offset into the waste by kerf/2.
   * Nominal panel sizes stay the finished sizes either way.
   */
  kerfCompensation: boolean;
  /** Construction grid spacing in mm. Zero hides the grid. */
  gridStep: number;
}

export interface BoxModel {
  type: "box";
  construction: ConstructionId;
  dimensions: UserDimensions;
  material: Material;
  joint: TabSlotJointConfig;
  fabrication: FabricationConstraints;
  engraving: EngravingItem[];
  layout: LayoutSettings;
  render: RenderSettings;
}

export interface PanelFeature {
  id: string;
  contactId: string;
  role: "tab" | "slot";
  edge: EdgeId;
  /** Start of the feature along the outline walk of `edge`, mm. */
  offset: number;
  /** Size along the outline walk, mm. */
  width: number;
  /** Distance perpendicular to the edge, mm. Tabs go outward, slots inward. */
  depth: number;
  /** Start along the shared contact axis, mm. Comparable across the mating pair. */
  assemblyOffset: number;
  assemblyWidth: number;
}

/** Outer-face placement of a panel in the assembled box, millimetres. */
export interface PanelPose {
  origin: Vec3;
  xAxis: Vec3;
  yAxis: Vec3;
  /** Unit vector pointing from the outer face into the sheet. */
  thicknessAxis: Vec3;
}

export interface PanelGeometry {
  /** Finished outline, CCW, mm, in panel coordinates. Tabs included, slots notched in. */
  outline: Vec2[];
  holes: Vec2[][];
  /** Cut toolpath. Equals `outline` when kerf compensation is off. */
  cutOutline: Vec2[];
  cutHoles: Vec2[][];
}

export interface Panel {
  id: PanelId;
  /** Nominal rectangle, excluding tabs, mm. */
  width: number;
  height: number;
  nominalWidth: number;
  nominalHeight: number;
  thickness: number;
  geometry: PanelGeometry;
  features: PanelFeature[];
  engraving: EngravingItem[];
  pose: PanelPose;
}

export interface SheetPlacement {
  panelId: PanelId;
  /** Bounding-box minimum corner on the sheet, y-up, mm. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SheetLayout {
  width: number;
  height: number;
  placements: SheetPlacement[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  path?: string;
}

export interface BuildSuccess {
  ok: true;
  model: BoxModel;
  issues: ValidationIssue[];
  dimensions: ResolvedDimensions;
  panels: Panel[];
  layout: SheetLayout;
  svg: string;
}

export interface BuildFailure {
  ok: false;
  model: BoxModel;
  issues: ValidationIssue[];
}

export type BuildResult = BuildSuccess | BuildFailure;
