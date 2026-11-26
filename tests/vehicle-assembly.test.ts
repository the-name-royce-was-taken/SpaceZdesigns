import { describe, expect, it } from "vitest";
import { attachmentNodes, canAttach, findAttachmentPlacement, findAvailableAttachmentPlacement, findNearestAttachmentPlacement, validateAssembly } from "../src/vehicle-assembly";
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


  it("provides nine surface snap points per tank side including the exact centre", () => {
    const east = attachmentNodes("tank").filter(node => node.id.startsWith("surface-east"));
    expect(east).toHaveLength(9);
    const centre = east.find(node => node.id === "surface-east");
    expect(centre?.position).toEqual([0.46, 0, 0]);
    expect(new Set(east.map(node => node.position[1])).size).toBe(3);
    expect(new Set(east.map(node => node.position[2])).size).toBe(3);
  });

  it("automatically finds the next free attachment node", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank" }];
    const first = findAvailableAttachmentPlacement(parts, "wing", "tank");
    expect(first).not.toBeNull();
    parts.push({ id: "wing-a", kind: "wing", parentId: first!.parentId, parentNode: first!.parentNode, childNode: first!.childNode, x: first!.x, y: first!.y, z: first!.z });
    const second = findAvailableAttachmentPlacement(parts, "wing", "tank");
    expect(second).not.toBeNull();
    expect(second?.parentNode).not.toBe(first?.parentNode);
    // The 3×3 surface layout intentionally fills neighbouring sections on
    // the same face before moving to another face.
    expect(second?.rotationY).toBe(first?.rotationY);
  });

  it("places a stack part above the highest available stack node", () => {
    const parts: BuildPart[] = [
      { id: "pod", kind: "capsule", x: 0, y: 2, z: 0 },
      { id: "tank-a", kind: "tank", x: 0, y: 2.8, z: 0, parentId: "pod", parentNode: "stack-top", childNode: "stack-bottom" }
    ];
    const placement = findAvailableAttachmentPlacement(parts, "tank", "tank-a");
    expect(placement?.parentId).toBe("tank-a");
    expect(placement?.parentNode).toBe("stack-top");
    expect(placement?.y).toBeCloseTo(3.9);
  });

  it("provides separate underside attachment points for a five-engine cluster", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank" }];
    const placements = [];
    for (let i = 0; i < 5; i++) {
      const placement = findAvailableAttachmentPlacement(parts, "engine", "tank");
      expect(placement).not.toBeNull();
      placements.push(placement!);
      parts.push({ id: "engine-" + i, kind: "engine", parentId: placement!.parentId, parentNode: placement!.parentNode, childNode: placement!.childNode, x: placement!.x, y: placement!.y, z: placement!.z });
    }
    expect(new Set(placements.map(placement => placement.parentNode)).size).toBe(5);
    expect(placements.map(placement => placement.parentNode)).toContain("stack-bottom");
    expect(placements.filter(placement => placement.parentNode.startsWith("engine-mount-"))).toHaveLength(4);
  });

  it("magnetically finds the nearest compatible connector without a grid", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank", x: 0, y: 1, z: 0 }];
    const exact = findAttachmentPlacement(parts, "tank", "wing")!;
    const near = findNearestAttachmentPlacement(parts, "wing", [exact.x + 0.2, exact.y, exact.z], 0.5);
    expect(near?.parentNode).toBe(exact.parentNode);
    expect(findNearestAttachmentPlacement(parts, "wing", [exact.x + 2, exact.y, exact.z], 0.5)).toBeNull();
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
