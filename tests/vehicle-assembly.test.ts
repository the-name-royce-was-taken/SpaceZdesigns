import { describe, expect, it } from "vitest";
import { canAttach, findAttachmentPlacement, validateAssembly } from "../src/vehicle-assembly";
import type { BuildPart } from "../src/vehicle-builder-3d";

describe("vehicle attachment system", () => {
  it("places a tank on a capsule's upper stack node", () => {
    const parts: BuildPart[] = [{ id: "pod", kind: "capsule", x: 0, y: 2, z: 0 }];
    const placement = findAttachmentPlacement(parts, "pod", "tank");
    expect(placement).not.toBeNull();
    expect(placement?.parentNode).toBe("stack-top");
    expect(placement?.childNode).toBe("stack-bottom");
    expect(placement?.y).toBeCloseTo(3.3);
  });

  it("places an engine below a tank", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank", x: 0, y: 1, z: 0 }];
    const placement = findAttachmentPlacement(parts, "tank", "engine");
    expect(placement?.parentNode).toBe("stack-bottom");
    expect(placement?.childNode).toBe("stack-top");
    expect(placement?.y).toBeCloseTo(0.05);
  });

  it("allows surface-mounted parts on a tank", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank" }];
    expect(canAttach(parts, "tank", "wing")).toBe(true);
    expect(findAttachmentPlacement(parts, "tank", "wing")?.parentNode).toBe("surface-east");
  });

  it("supports four-way radial surface symmetry without overlapping nodes", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank" }];
    const placements = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]
      .map(angle => findAttachmentPlacement(parts, "tank", "wing", angle));
    expect(placements.every(Boolean)).toBe(true);
    expect(new Set(placements.map(p => p?.parentNode)).size).toBe(4);
    expect(placements.map(p => [Number(p?.x?.toFixed(2)), Number(p?.z?.toFixed(2))])).toEqual([
      [0.46, 0], [0, -0.46], [-0.46, 0], [0, 0.46]
    ]);
  });

  it("rejects an engine attached to an engine", () => {
    const parts: BuildPart[] = [{ id: "engine", kind: "engine" }];
    expect(canAttach(parts, "engine", "engine")).toBe(false);
  });

  it("detects missing parents, self-links, duplicate IDs, and cycles", () => {
    const parts: BuildPart[] = [
      { id: "a", kind: "tank", parentId: "b" },
      { id: "b", kind: "tank", parentId: "a" },
      { id: "b", kind: "engine" },
      { id: "orphan", kind: "wing", parentId: "missing" },
      { id: "self", kind: "tank", parentId: "self" }
    ];
    const codes = validateAssembly(parts).map(issue => issue.code);
    expect(codes).toContain("duplicate-id");
    expect(codes).toContain("missing-parent");
    expect(codes).toContain("self-parent");
    expect(codes).toContain("cycle");
  });

  it("does not reject legacy craft without hierarchy data", () => {
    expect(validateAssembly([{ kind: "capsule" }, { kind: "tank" }, { kind: "engine" }])).toEqual([]);
  });
});
