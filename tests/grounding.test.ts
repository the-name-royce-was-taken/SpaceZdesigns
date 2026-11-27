import { describe, expect, it } from "vitest";
import { groundClearanceOffset, translatePartsY } from "../src/grounding";

describe("ground clearance", () => {
  it("raises a part whose lowest point is below the ground plane", () => {
    expect(groundClearanceOffset(-0.42)).toBeCloseTo(0.42);
  });

  it("does not move a part that is already on or above the ground", () => {
    expect(groundClearanceOffset(0)).toBe(0);
    expect(groundClearanceOffset(1.25)).toBe(0);
    expect(groundClearanceOffset(Number.NaN)).toBe(0);
  });

  it("translates a selected group rigidly without changing its structure", () => {
    const parts = [
      { id: "a", y: 1.2, parentId: "b", parentNode: "stack-top" },
      { id: "b", y: 2.4, childNode: "stack-bottom" },
      { id: "unselected", y: 4.8 }
    ];
    const moved = translatePartsY(parts, new Set(["a", "b"]), -0.7);
    expect(moved.map(part => part.y)).toEqual([0.5, 1.7, 4.8]);
    expect(moved[0]!.parentId).toBe("b");
    expect(moved[0]!.parentNode).toBe("stack-top");
    expect(moved[1]!.childNode).toBe("stack-bottom");
    expect(moved[1]!.y! - moved[0]!.y!).toBeCloseTo(1.2);
    expect(parts[0]!.y).toBe(1.2);
  });

  it("can lift the whole craft together to keep a newly attached part above ground", () => {
    const craft = [{ id: "root", y: -0.2 }, { id: "child", y: 0.4, parentId: "root" }];
    const lifted = translatePartsY(craft, new Set(craft.map(part => part.id)), groundClearanceOffset(-0.35));
    expect(lifted.map(part => part.y)).toEqual([0.15, 0.75]);
    expect(lifted[1]!.parentId).toBe("root");
  });
});
