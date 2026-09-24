import { generateTabSlot } from "./tabSlot.ts";
import { JointError, type JointConfig, type JointEdge, type JointFeature } from "./types.ts";

/**
 * Entry point for every joint. Geometry calls this and does not switch on
 * joint-specific math. A new joint type is a new branch here, not a rewrite
 * of the panel builder — once that type has its own generator.
 */
export function generateJoint(edge: JointEdge, config: JointConfig): JointFeature[] {
  switch (config.type) {
    case "tab-slot":
      return generateTabSlot(edge, config);
    default:
      throw new JointError(
        "joint-not-implemented",
        `Тип соединения «${config.type}» пока не реализован. Сейчас доступен tab-slot.`,
      );
  }
}
