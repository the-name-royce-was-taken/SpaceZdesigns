import { describe, expect, it } from "vitest";
import { attachmentNodes, canAttach, findAttachmentPlacement, findAvailableAttachmentPlacement, findNearestAttachmentPlacement, tankFuelCapacity, validateAssembly } from "../src/vehicle-assembly";
import type { BuildPart } from "../src/vehicle-builder-3d";

describe("vehicle attachment system", () => {
  it("places a tank on a capsule's upper stack node", () => {
    const parts: BuildPart[] = [{ id: "pod", kind: "capsule", x: 0, y: 2, z: 0 }];
    const placement = findAttachmentPlacement(parts, "pod", "tank");
    expect(placement).not.toBeNull();
    expect(placement?.parentNode).toBe("stack-top");
    expect(placement?.childNode).toBe("stack-bottom");
    expect(placement?.y).toBeCloseTo(3.23);
  });

  it("places an engine below a tank", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank", x: 0, y: 1, z: 0 }];
    const placement = findAttachmentPlacement(parts, "tank", "engine");
    expect(placement?.parentNode).toBe("stack-bottom");
    expect(placement?.childNode).toBe("stack-top");
    expect(placement?.y).toBeCloseTo(0.04);
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
    expect(placements.map(p => p?.rotationY)).toEqual([0, Math.PI / 2, Math.PI, Math.PI * 1.5]);
    expect(placements.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.z))).toBe(true);
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
    expect(top.length).toBe(49);
    expect(Math.max(...top.map(n=>Math.hypot(n.position[0],n.position[2])))).toBeLessThanOrEqual(.7);
    expect(bottom.length).toBe(49);
    expect(Math.max(...bottom.map(n=>Math.hypot(n.position[0],n.position[2])))).toBeCloseTo(.2);
    const upperWall=nodes.find(n=>n.id==="surface-wall-a0-y8");
    const lowerWall=nodes.find(n=>n.id==="surface-wall-a0-y0");
    expect(Math.hypot(upperWall!.position[0],upperWall!.position[2])).toBeCloseTo(.7);
    expect(Math.hypot(lowerWall!.position[0],lowerWall!.position[2])).toBeCloseTo(.2);
  });

  it("automatically finds a flush surface node and spreads replicated parts around the surface", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank" }];
    const placements = [];
    for (let i = 0; i < 4; i++) {
      const placement = findAvailableAttachmentPlacement(parts, "wing", "tank");
      expect(placement).not.toBeNull();
      placements.push(placement!);
      parts.push({ id: "wing-" + i, kind: "wing", parentId: placement!.parentId, parentNode: placement!.parentNode, childNode: placement!.childNode, x: placement!.x, y: placement!.y, z: placement!.z, ry: placement!.rotationY });
    }
    expect(placements.every(p => p.parentNode.startsWith("surface-wall-"))).toBe(true);
    const angles = placements.map(p => Number(/^surface-wall-a(\d+)-/.exec(p.parentNode)?.[1]));
    expect(new Set(angles).size).toBe(4);
    const sortedAngles = [...angles].sort((a, b) => a - b);
    const circularGaps = sortedAngles.map((angle, index) => ((sortedAngles[(index + 1) % sortedAngles.length]! - angle + 9) % 9));
    expect(Math.min(...circularGaps)).toBeGreaterThanOrEqual(2);
    for (const p of placements) {
      const parentNode = attachmentNodes("tank").find(n => n.id === p.parentNode)!;
      const childNode = attachmentNodes("wing").find(n => n.id === p.childNode)!;
      const c = Math.cos(p.rotationY), s = Math.sin(p.rotationY);
      const childPosition = [childNode.position[0]*c+childNode.position[2]*s, childNode.position[1], -childNode.position[0]*s+childNode.position[2]*c];
      expect(p.x + childPosition[0]).toBeCloseTo(parentNode.position[0]);
      expect(p.y + childPosition[1]).toBeCloseTo(parentNode.position[1]);
      expect(p.z + childPosition[2]).toBeCloseTo(parentNode.position[2]);
    }
  });

  it("keeps the part's rotation unchanged while snapping its connector exactly onto a surface node", () => {
    const tank: BuildPart = { id: "tank", kind: "tank", x: 0, y: 0, z: 0 };
    const wing: BuildPart = { id: "wing", kind: "wing", x: .42, y: 0, z: .18, ry: Math.PI / 9 };
    const placement = findNearestAttachmentPlacement([tank], "wing", [wing.x!, wing.y!, wing.z!], .8, wing);
    expect(placement).not.toBeNull();
    expect(placement!.rotationY).toBeCloseTo(Math.PI / 9);
    const parentNode = attachmentNodes("tank").find(n => n.id === placement!.parentNode)!;
    const childNode = attachmentNodes("wing", wing).find(n => n.id === placement!.childNode)!;
    const c = Math.cos(wing.ry!), s = Math.sin(wing.ry!);
    const childPosition = [childNode.position[0]*c+childNode.position[2]*s, childNode.position[1], -childNode.position[0]*s+childNode.position[2]*c];
    expect(placement!.x + childPosition[0]).toBeCloseTo(parentNode.position[0]);
    expect(placement!.y + childPosition[1]).toBeCloseTo(parentNode.position[1]);
    expect(placement!.z + childPosition[2]).toBeCloseTo(parentNode.position[2]);
  });

  it("uses full XYZ part rotations when aligning flush surface contacts", () => {
    const rotation = { rx: .21, ry: .34, rz: -.16 };
    const tank: BuildPart = { id: "tank", kind: "tank", x: .2, y: .1, z: -.3, ...rotation };
    const wing: BuildPart = { id: "wing", kind: "wing", x: .7, y: .1, z: -.3, ...rotation };
    const placement = findNearestAttachmentPlacement([tank], "wing", [wing.x!, wing.y!, wing.z!], 1, wing);
    expect(placement).not.toBeNull();
    expect(placement!.rotationY).toBeCloseTo(rotation.ry);
    const parentNode = attachmentNodes("tank", tank).find(n => n.id === placement!.parentNode)!;
    const childNode = attachmentNodes("wing", wing).find(n => n.id === placement!.childNode)!;
    const rotate = (v: readonly [number, number, number]) => {
      const x=rotation.rx,y=rotation.ry,z=rotation.rz,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
      return [cy*cz*v[0]-cy*sz*v[1]+sy*v[2],(sx*sy*cz+cx*sz)*v[0]+(cx*cz-sx*sy*sz)*v[1]-sx*cy*v[2],(sx*sz-cx*sy*cz)*v[0]+(sx*cz+cx*sy*sz)*v[1]+cx*cy*v[2]];
    };
    const parentOffset=rotate(parentNode.position),childOffset=rotate(childNode.position);
    expect(placement!.x+childOffset[0]).toBeCloseTo(tank.x!+parentOffset[0]);
    expect(placement!.y+childOffset[1]).toBeCloseTo(tank.y!+parentOffset[1]);
    expect(placement!.z+childOffset[2]).toBeCloseTo(tank.z!+parentOffset[2]);
  });

  it("keeps surface snapping available on the existing 9x9 grid without rotating the part", () => {
    const tank: BuildPart = { id: "tank", kind: "tank" };
    const wing: BuildPart = { id: "wing", kind: "wing", x: .42, y: 0, z: .18, rz: .37 };
    const placement = findNearestAttachmentPlacement([tank], "wing", [wing.x!, wing.y!, wing.z!], .8, wing);
    expect(placement).not.toBeNull();
    expect(placement!.rotationY).toBe(wing.ry ?? 0);
    expect(placement!.parentNode).toMatch(/^surface-/);
    const wall = attachmentNodes("tank").filter(n => n.id.startsWith("surface-wall-"));
    expect(wall).toHaveLength(81);
  });

  it("places a stack part above the highest available stack node", () => {
    const parts: BuildPart[] = [
      { id: "pod", kind: "capsule", x: 0, y: 2, z: 0 },
      { id: "tank-a", kind: "tank", x: 0, y: 2.8, z: 0, parentId: "pod", parentNode: "stack-top", childNode: "stack-bottom" }
    ];
    const placement = findAvailableAttachmentPlacement(parts, "tank", "tank-a");
    expect(placement?.parentId).toBe("tank-a");
    expect(placement?.parentNode).toBe("stack-top");
    expect(placement?.y).toBeCloseTo(3.76);
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


  it("uses PR 41's tighter 0.16-unit magnetic snap catch distance", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank", x: 0, y: 1, z: 0 }];
    const exact = findAttachmentPlacement(parts, "tank", "wing")!;
    const withinDefaultRange = findNearestAttachmentPlacement(
      parts, "wing", [exact.x + .1, exact.y, exact.z]
    );
    expect(withinDefaultRange).not.toBeNull();
    const outsideDefaultRange = findNearestAttachmentPlacement(
      parts, "wing", [exact.x + .5, exact.y, exact.z]
    );
    expect(outsideDefaultRange).toBeNull();
  });

  it("magnetically finds the nearest compatible connector without a grid", () => {
    const parts: BuildPart[] = [{ id: "tank", kind: "tank", x: 0, y: 1, z: 0 }];
    const exact = findAttachmentPlacement(parts, "tank", "wing")!;
    const near = findNearestAttachmentPlacement(parts, "wing", [exact.x + 0.2, exact.y, exact.z], 0.5);
    expect(near?.parentNode).toMatch(/^surface-/);
    expect(Math.hypot(near!.x-(exact.x+0.2),near!.y-exact.y,near!.z-exact.z)).toBeLessThanOrEqual(0.2);
    expect(findNearestAttachmentPlacement(parts, "wing", [exact.x + 2, exact.y, exact.z], 0.5)).toBeNull();
  });


  it("keeps scalable solar-array surface grids centred on the expanding panel", () => {
    const short=attachmentNodes("solar",{kind:"solar",solarLength:.8});
    const long=attachmentNodes("solar",{kind:"solar",solarLength:8});
    const shortCenter=short.find(n=>n.id==="surface-top-r4-c4")!;
    const longCenter=long.find(n=>n.id==="surface-top-r4-c4")!;
    expect(shortCenter.position[0]).toBeCloseTo(.5);
    expect(longCenter.position[0]).toBeCloseTo(4.1);
    expect(Math.min(...long.filter(n=>n.id.startsWith("surface-top-")).map(n=>n.position[0]))).toBeCloseTo(.1);
    expect(Math.max(...long.filter(n=>n.id.startsWith("surface-top-")).map(n=>n.position[0]))).toBeCloseTo(8.1);
    expect(long.filter(n=>n.id.startsWith("surface-top-"))).toHaveLength(81);
  });

  it("scales and centres the rover-wheel grid around its adjustable tyre radius", () => {
    const nodes=attachmentNodes("rover-wheel",{kind:"rover-wheel",radius:.6});
    const top=nodes.find(n=>n.id==="surface-top-r4-c4")!;
    const bottom=nodes.find(n=>n.id==="surface-bottom-r4-c4")!;
    expect(top.position[1]).toBeCloseTo(.22);
    expect(bottom.position[1]).toBeCloseTo(-.72);
    expect(Math.max(...nodes.map(n=>Math.abs(n.position[2])))).toBeCloseTo(.6);
    expect(nodes.filter(n=>n.id.startsWith("surface-top-"))).toHaveLength(81);
  });

  it("aligns the heat-shield grid with the rendered offset and scales it with radius and thickness", () => {
    const nodes=attachmentNodes("heat-shield",{kind:"heat-shield",radius:1.2,thickness:.4});
    const wall=nodes.filter(n=>n.id.startsWith("surface-wall-"));
    expect(Math.min(...wall.map(n=>n.position[1]))).toBeCloseTo(-.4);
    expect(Math.max(...wall.map(n=>n.position[1]))).toBeCloseTo(0);
    expect(Math.max(...wall.map(n=>Math.hypot(n.position[0],n.position[2])))).toBeCloseTo(1.2);
    expect(nodes.find(n=>n.id==="stack-top")?.position[1]).toBeCloseTo(0);
    expect(nodes.find(n=>n.id==="stack-bottom")?.position[1]).toBeCloseTo(-.4);
  });

  it("scales the invisible 9×9 attachment lattice with editable curved geometry", () => {
    const tank = attachmentNodes("tank", { kind:"tank", topRadius:.72, bottomRadius:.28, height:2.4 });
    const tankWall = tank.filter(n=>n.id.startsWith("surface-wall-"));
    expect(tankWall).toHaveLength(81);
    expect(Math.min(...tankWall.map(n=>n.position[1]))).toBeCloseTo(-1.2);
    expect(Math.max(...tankWall.map(n=>n.position[1]))).toBeCloseTo(1.2);
    expect(Math.hypot(...tankWall.find(n=>n.id==="surface-wall-a0-y8")!.position.filter((_,i)=>i!==1))).toBeCloseTo(.72);
    expect(Math.hypot(...tankWall.find(n=>n.id==="surface-wall-a0-y0")!.position.filter((_,i)=>i!==1))).toBeCloseTo(.28);
    for (const kind of ["fairing","conical-fairing","interstage-fairing","clam-shell-fairing"] as const) {
      const nodes=attachmentNodes(kind,{kind,bottomRadius:.63,height:2.2});
      const wall=nodes.filter(n=>n.id.startsWith("surface-wall-"));
      expect(wall).toHaveLength(81);
      expect(Math.min(...wall.map(n=>n.position[1]))).toBeCloseTo(-1.1);
      expect(Math.max(...wall.map(n=>n.position[1]))).toBeCloseTo(1.1);
    }
  });

  it("scales tank fuel capacity with its frustum volume", () => {
    const standard={topRadius:.44,bottomRadius:.44,height:.96};
    expect(tankFuelCapacity(standard)).toBeCloseTo(120);
    expect(tankFuelCapacity({...standard,height:1.92})).toBeCloseTo(240);
    expect(tankFuelCapacity({...standard,topRadius:.88,bottomRadius:.88})).toBeCloseTo(480);
    expect(tankFuelCapacity({...standard,height:.48})).toBeCloseTo(60);
  });

  it("provides adjustable stack and surface attachment nodes for every payload fairing", () => {
    for(const kind of ["fairing","conical-fairing","interstage-fairing","clam-shell-fairing"] as const){
      const part:BuildPart={kind,height:1.8,bottomRadius:.62};
      const nodes=attachmentNodes(kind,part);
      expect(nodes.find(n=>n.id==="stack-bottom")?.position[1]).toBeCloseTo(-.9);
      expect(nodes.some(n=>n.id.startsWith("surface-wall-"))).toBe(true);
      expect(findAttachmentPlacement([{id:"tank",kind:"tank"}],"tank",kind)).not.toBeNull();
    }
  });

  it("moves tank stack connectors when its editable height changes", () => {
    const short=attachmentNodes("tank",{kind:"tank",height:.6});
    const tall=attachmentNodes("tank",{kind:"tank",height:1.8});
    expect(short.find(n=>n.id==="stack-top")?.position[1]).toBeCloseTo(.3);
    expect(tall.find(n=>n.id==="stack-bottom")?.position[1]).toBeCloseTo(-.9);
  });

  it("attaches an adjustable nose cone flush to the tank top", () => {
    const parts:BuildPart[]=[{id:"tank",kind:"tank",x:0,y:1,height:1.4,topRadius:.6,bottomRadius:.4}];
    const placement=findAttachmentPlacement(parts,"tank","nose-cone");
    expect(placement?.parentNode).toBe("stack-top");
    expect(placement?.childNode).toBe("stack-bottom");
    expect(placement?.y).toBeCloseTo(2.1);
    const nodes=attachmentNodes("nose-cone",{kind:"nose-cone",height:1.2,bottomRadius:.55});
    expect(nodes.find(n=>n.id==="stack-bottom")?.position[1]).toBeCloseTo(-.6);
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
