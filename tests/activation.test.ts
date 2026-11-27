import { describe, expect, it } from "vitest";
import { assignActivationGroup, isActivationCapable, listActivationGroups, partActivationGroup, reorderActivationGroups } from "../src/activation";
import type { BuildPart } from "../src/vehicle-builder-3d";

describe("flight activation groups", () => {
  const parts: BuildPart[] = [
    { id: "engine", kind: "engine", engineStage: 0 },
    { id: "separator", kind: "separator" },
    { id: "thruster", kind: "separator-thruster" },
    { id: "leg", kind: "landing-leg" },
    { id: "solar", kind: "solar" },
    { id: "tank", kind: "tank" }
  ];

  it("allows engines, separation hardware, legs, solar arrays and other action parts", () => {
    for (const kind of ["engine", "separator", "side-decoupler", "separator-thruster", "landing-leg", "solar", "airbrake", "control", "rcs", "fairing", "heat-shield", "wheel", "rover-wheel", "dock"] as const) {
      expect(isActivationCapable({ kind })).toBe(true);
    }
    expect(isActivationCapable({ kind: "tank" })).toBe(false);
  });

  it("assigns and removes selected parts without changing unselected parts", () => {
    const assigned = assignActivationGroup(parts, new Set(["engine", "thruster", "leg"]), 2);
    expect(assigned.find(part => part.id === "engine")?.engineStage).toBe(2);
    expect(assigned.find(part => part.id === "engine")?.activationGroup).toBe(2);
    expect(assigned.find(part => part.id === "thruster")?.activationGroup).toBe(2);
    expect(assigned.find(part => part.id === "leg")?.activationGroup).toBe(2);
    expect(assigned.find(part => part.id === "solar")?.activationGroup).toBeUndefined();
    const removed = assignActivationGroup(assigned, new Set(["engine"]), null);
    expect(removed.find(part => part.id === "engine")?.engineStage).toBe(0);
    expect(removed.find(part => part.id === "engine")?.activationGroup).toBeUndefined();
  });

  it("reads legacy engine stages and lists groups in numeric sequence", () => {
    const assigned = assignActivationGroup(parts, new Set(["solar"]), 4);
    expect(partActivationGroup({ kind: "engine", engineStage: 3 })).toBe(3);
    expect(listActivationGroups([...assigned, { id: "old-engine", kind: "engine", engineStage: 2 }])).toEqual([2, 4]);
  });

  it("reorders every part membership and engine ignition stage together", () => {
    const assigned = assignActivationGroup(parts, new Set(["engine", "leg"]), 1);
    const withSecond = assignActivationGroup(assigned, new Set(["solar"]), 2);
    const reordered = reorderActivationGroups(withSecond, [2, 1]);
    expect(reordered.find(part => part.id === "solar")?.activationGroup).toBe(1);
    expect(reordered.find(part => part.id === "engine")?.activationGroup).toBe(2);
    expect(reordered.find(part => part.id === "engine")?.engineStage).toBe(2);
    expect(reordered.find(part => part.id === "leg")?.activationGroup).toBe(2);
  });

  it("reconstructs the same activation sequence after a craft is saved and loaded again", () => {
    const assigned = assignActivationGroup(parts, new Set(["engine", "separator"]), 1);
    const withLaterActions = assignActivationGroup(assigned, new Set(["solar", "leg"]), 2);
    const reordered = reorderActivationGroups(withLaterActions, [2, 1]);
    const reloaded = JSON.parse(JSON.stringify(reordered)) as BuildPart[];
    expect(listActivationGroups(reloaded)).toEqual([1, 2]);
    expect(reloaded.filter(part => partActivationGroup(part) === 1).map(part => part.id).sort()).toEqual(["leg", "solar"]);
    expect(reloaded.filter(part => partActivationGroup(part) === 2).map(part => part.id).sort()).toEqual(["engine", "separator"]);
    expect(reloaded.find(part => part.id === "engine")?.engineStage).toBe(2);
  });
});
