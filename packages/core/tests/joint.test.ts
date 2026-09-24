import { describe, expect, it } from "vitest";
import { generateJoint } from "../src/joint/generateJoint.ts";
import { layoutTabs } from "../src/joint/tabSlot.ts";
import { JointError } from "../src/joint/types.ts";

describe("tab-slot joint", () => {
  it("places three tabs with exact end margins on a 100 mm edge", () => {
    const tabs = layoutTabs(100, { tabWidth: 20, edgeMargin: 10, minGap: 10 });
    expect(tabs).toEqual([
      { offset: 10, width: 20 },
      { offset: 40, width: 20 },
      { offset: 70, width: 20 },
    ]);
  });

  it("widens only the slot by clearance and keeps the same centers", () => {
    const edge = { length: 100, partnerThickness: 4 };
    const config = { type: "tab-slot" as const, tabWidth: 20, edgeMargin: 10, minGap: 10, clearance: 0.2 };
    const tabs = generateJoint({ ...edge, role: "tab" }, config);
    const slots = generateJoint({ ...edge, role: "slot" }, config);
    expect(tabs).toHaveLength(slots.length);
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]!;
      const slot = slots[i]!;
      expect(tab.depth).toBe(4);
      expect(slot.depth).toBeCloseTo(4.2, 6);
      expect(slot.width).toBeCloseTo(tab.width + 0.2, 6);
      expect(slot.offset + slot.width / 2).toBeCloseTo(tab.offset + tab.width / 2, 6);
    }
  });

  it.each([0, 0.1, 0.4])("changes slot width with clearance %s and leaves tab width alone", (clearance) => {
    const config = { type: "tab-slot" as const, tabWidth: 16, edgeMargin: 8, minGap: 8, clearance };
    const [tab] = generateJoint({ length: 80, role: "tab", partnerThickness: 6 }, config);
    const [slot] = generateJoint({ length: 80, role: "slot", partnerThickness: 6 }, config);
    expect(tab?.width).toBe(16);
    expect(slot?.width).toBeCloseTo(16 + clearance, 6);
    expect(slot?.depth).toBeCloseTo(6 + clearance, 6);
  });

  it("rejects a joint that does not fit", () => {
    expect(() => layoutTabs(30, { tabWidth: 20, edgeMargin: 10, minGap: 10 })).toThrow(JointError);
  });

  it("does not implement finger joints inside the tab generator", () => {
    expect(() =>
      generateJoint(
        { length: 100, role: "tab", partnerThickness: 4 },
        { type: "finger-joint" },
      ),
    ).toThrow(/finger-joint/);
  });
});
