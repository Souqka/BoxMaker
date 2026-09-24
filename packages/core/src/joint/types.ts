import type { JointType } from "../model/types.ts";

export interface JointEdge {
  /** Length of the shared contact, mm. */
  length: number;
  role: "tab" | "slot";
  /** Thickness of the other panel, mm. */
  partnerThickness: number;
}

export interface JointConfigBase {
  type: JointType;
}

export interface TabSlotConfig extends JointConfigBase {
  type: "tab-slot";
  tabWidth: number;
  edgeMargin: number;
  minGap: number;
  clearance: number;
  tabCount?: number;
}

export type JointConfig = TabSlotConfig | (JointConfigBase & { type: Exclude<JointType, "tab-slot"> });

/** A feature measured along the contact, from the contact origin. */
export interface JointFeature {
  role: "tab" | "slot";
  offset: number;
  width: number;
  depth: number;
}

export class JointError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "JointError";
    this.code = code;
  }
}
