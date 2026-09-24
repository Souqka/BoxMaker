import { almostEqual } from "../geometry/vec.ts";
import { JointError, type JointEdge, type JointFeature, type TabSlotConfig } from "./types.ts";

export interface TabPlacement {
  offset: number;
  width: number;
}

/**
 * Place tabs inside `[edgeMargin, length - edgeMargin]`.
 * End gaps are exactly `edgeMargin`. Internal gaps are equal and at least `minGap`.
 * A single tab is centered in the usable span.
 */
export function layoutTabs(length: number, config: Pick<TabSlotConfig, "tabWidth" | "edgeMargin" | "minGap" | "tabCount">): TabPlacement[] {
  const { tabWidth, edgeMargin, minGap } = config;
  if (!(tabWidth > 0) || !(length > 0) || edgeMargin < 0 || minGap < 0) {
    throw new JointError("invalid-tab-parameters", "Ширина шипа, длина кромки и зазоры должны быть положительными.");
  }

  const usable = length - 2 * edgeMargin;
  const maxCount = maxFittingCount(usable, tabWidth, minGap);
  const count = config.tabCount ?? maxCount;
  if (count < 1 || !fits(usable, tabWidth, minGap, count)) {
    throw new JointError(
      "tabs-do-not-fit",
      `На кромке ${formatMm(length)} мм не помещается ${count} шип(ов) шириной ${formatMm(tabWidth)} мм при поле ${formatMm(edgeMargin)} мм и минимальном промежутке ${formatMm(minGap)} мм.`,
    );
  }

  if (count === 1) {
    return [{ offset: edgeMargin + (usable - tabWidth) / 2, width: tabWidth }];
  }

  const gap = (usable - count * tabWidth) / (count - 1);
  const placements: TabPlacement[] = [];
  for (let i = 0; i < count; i++) {
    placements.push({ offset: edgeMargin + i * (tabWidth + gap), width: tabWidth });
  }
  return placements;
}

export function generateTabSlot(edge: JointEdge, config: TabSlotConfig): JointFeature[] {
  if (!(config.clearance >= 0)) {
    throw new JointError("invalid-clearance", "Clearance не может быть отрицательным.");
  }
  if (!(edge.partnerThickness > 0)) {
    throw new JointError("invalid-thickness", "Толщина ответной панели должна быть больше нуля.");
  }

  const tabs = layoutTabs(edge.length, config);
  if (edge.role === "tab") {
    return tabs.map((tab) => ({
      role: "tab",
      offset: tab.offset,
      width: tab.width,
      depth: edge.partnerThickness,
    }));
  }

  const slots = tabs.map((tab) => ({
    role: "slot" as const,
    offset: tab.offset - config.clearance / 2,
    width: tab.width + config.clearance,
    depth: edge.partnerThickness + config.clearance,
  }));

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    if (slot.offset < -1e-9 || slot.offset + slot.width > edge.length + 1e-9) {
      throw new JointError(
        "slot-out-of-edge",
        "Паз с учётом clearance выходит за торец кромки. Увеличьте поле кромки или уменьшите clearance.",
      );
    }
    const next = slots[i + 1];
    if (next && slot.offset + slot.width > next.offset + 1e-9 && !almostEqual(slot.offset + slot.width, next.offset)) {
      throw new JointError(
        "slots-overlap",
        "Соседние пазы пересекаются. Увеличьте minGap или уменьшите clearance.",
      );
    }
  }

  return slots;
}

function maxFittingCount(usable: number, tabWidth: number, minGap: number): number {
  if (usable < tabWidth) return 0;
  const estimate = Math.floor((usable + minGap) / (tabWidth + minGap) + 1e-9);
  let count = Math.max(0, estimate);
  while (count > 0 && !fits(usable, tabWidth, minGap, count)) count -= 1;
  return count;
}

function fits(usable: number, tabWidth: number, minGap: number, count: number): boolean {
  if (count < 1) return false;
  if (count === 1) return usable + 1e-9 >= tabWidth;
  const gap = (usable - count * tabWidth) / (count - 1);
  return gap + 1e-9 >= minGap;
}

function formatMm(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
