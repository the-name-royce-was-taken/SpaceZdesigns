import { describe, expect, it } from "vitest";
import { groundClearanceOffset, groundDropDistance, groundSnapOffset, leftwardClearanceOffset, sideSpawnPosition, translatePartsY } from "../src/grounding";

describe("ground clearance", () => {
  it("spawns a new part beside the craft and rests its local bottom on the ground", () => {
    const position = sideSpawnPosition(3.2, -0.6, -0.45);
    expect(position.x).toBeCloseTo(4.15);
    expect(position.y).toBeCloseTo(0.45);
  });

  it("moves an overlapping spawn left until clear, then leaves two extra units", () => {
    const candidate = { minX: 1, maxX:2, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    const obstacles = [{ minX: 0, maxX: 1.5, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }];
    const offset = leftwardClearanceOffset(candidate, obstacles, .1, 2);
    expect(offset).toBeLessThan(-2);
    const moved = { ...candidate, minX: candidate.minX + offset, maxX: candidate.maxX + offset };
    expect(obstacles.some(obstacle => moved.minX < obstacle.maxX && moved.maxX > obstacle.minX && moved.minY < obstacle.maxY && moved.maxY > obstacle.minY && moved.minZ < obstacle.maxZ && moved.maxZ > obstacle.minZ)).toBe(false);
    expect(leftwardClearanceOffset(candidate, [{ ...obstacles[0]!, minY: 2, maxY: 3 }], .1, 2)).toBe(0);
  });

  it("moves spawned parts down to the ground when floating and up when below it", () => {
    expect(groundSnapOffset(1.25)).toBeCloseTo(-1.25);
    expect(groundSnapOffset(-0.4)).toBeCloseTo(0.4);
    expect(groundSnapOffset(0)).toBe(0);
  });

  it("raises a part whose lowest point is below the ground plane", () => {
    expect(groundClearanceOffset(-0.42)).toBeCloseTo(0.42);
  });

  it("drops only the selected group by the distance from its lowest point to ground", () => {
    expect(groundDropDistance(2.75)).toBeCloseTo(2.75);
    expect(groundDropDistance(0)).toBe(0);
    expect(groundDropDistance(-0.2)).toBe(0);
    const parts = [
      { id: "selected-a", y: 2.5 },
      { id: "selected-b", y: 3.5 },
      { id: "not-selected", y: 8 }
    ];
    const drop = groundDropDistance(1.25);
    const moved = translatePartsY(parts, new Set(["selected-a", "selected-b"]), -drop);
    expect(moved[0]!.y).toBeCloseTo(1.25);
    expect(moved[1]!.y).toBeCloseTo(2.25);
    expect(moved[2]!.y).toBe(8);
    expect(moved[1]!.y! - moved[0]!.y!).toBeCloseTo(1);
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

  it("applies spawn clearance to new parts without changing the existing craft", () => {
    const existingCraft = [{ id: "grounded", y: 0 }, { id: "upper", y: 2, parentId: "grounded" }];
    const additions = [{ id: "new-part", y: -0.35 }];
    const lift = groundClearanceOffset(-0.35);
    const correctedAdditions = translatePartsY(additions, new Set(["new-part"]), lift);
    expect(correctedAdditions[0]!.y).toBeCloseTo(0);
    expect(existingCraft.map(part => part.y)).toEqual([0, 2]);
  });
});
