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

  it("allows every structural part to surface-snap to every other structural part", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank" }];
    expect(canAttach(parts, "tank", "wing")).toBe(true);
    expect(findAttachmentPlacement(parts, "tank", "wing")?.parentNode).toMatch(/^surface-/);
    expect(canAttach([{id:"engine",kind:"engine"}],"engine","engine")).toBe(true);
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


  it("provides a dense 9 by 9 surface grid on the tank wall and end caps", () => {
    const nodes=attachmentNodes("tank");
    const wall=nodes.filter(n=>n.id.startsWith("surface-wall-"));
    expect(wall).toHaveLength(81);
    expect(new Set(wall.map(n=>n.position[1])).size).toBe(9);
    expect(new Set(wall.map(n=>n.id.split("-")[2])).size).toBe(9);
    expect(nodes.filter(n=>n.id.startsWith("surface-top-"))).toHaveLength(49);
    expect(nodes.filter(n=>n.id.startsWith("surface-bottom-"))).toHaveLength(49);
  });

  it("shapes tank snap nodes to its top and bottom radius settings", () => {
    const nodes=attachmentNodes("tank",{kind:"tank",topRadius:.7,bottomRadius:.2});
    const top=nodes.filter(n=>n.id.startsWith("surface-top-"));
    const bottom=nodes.filter(n=>n.id.startsWith("surface-bottom-"));
    expect(Math.max(...top.map(n=>Math.hypot(n.position[0],n.position[2])))).toBeLessThanOrEqual(.7);
    expect(Math.max(...bottom.map(n=>Math.hypot(n.position[0],n.position[2])))).toBeLessThanOrEqual(.2);
    const upperWall=nodes.find(n=>n.id==="surface-wall-a0-y8");
    const lowerWall=nodes.find(n=>n.id==="surface-wall-a0-y0");
    expect(Math.hypot(upperWall!.position[0],upperWall!.position[2])).toBeCloseTo(.7);
    expect(Math.hypot(lowerWall!.position[0],lowerWall!.position[2])).toBeCloseTo(.2);
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

  it("allows engine-to-engine surface attachment", () => {
    const parts: BuildPart[] = [{ id: "engine", kind: "engine" }];
    expect(canAttach(parts, "engine", "engine")).toBe(true);
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
