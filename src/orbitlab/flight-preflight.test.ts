import { describe, expect, it } from "vitest";
import type { BuildPart } from "../vehicle-builder-3d";
import { prepareSpaceZFlight } from "./flight-preflight";

const starterBuild: BuildPart[] = [
  { kind: "capsule", x: 0, y: 1.885, z: 0 },
  { kind: "tank", x: 0, y: .96, z: 0, topRadius: .44, bottomRadius: .44, height: .96 },
  { kind: "engine", x: 0, y: 0, z: 0 }
];

describe("SpaceZ flight preflight", () => {
  it("compiles per-build mass, propellant, engine stages, inertia and Orbitlab aerodynamics", () => {
    const result = prepareSpaceZFlight(starterBuild, "Preflight test", 1_700_000_000);
    expect(result.dryMassTonnes).toBeGreaterThan(0);
    expect(result.propellantTonnes).toBeGreaterThan(0);
    expect(result.wetMassTonnes).toBeGreaterThan(result.dryMassTonnes);
    expect(result.inertiaRadiusSquared).toBeGreaterThan(0);
    expect(result.vehicle.centerOfMassM).toBeDefined();
    expect(result.vehicle.engineMountM).toBeDefined();
    expect(result.engineCount).toBe(1);
    expect(result.stageNumbers.length).toBeGreaterThan(0);
    expect(result.referenceAreaM2).toBeGreaterThan(0);
    expect(result.vehicle.aeroTable?.mach.length).toBeGreaterThan(1);
    expect(result.vehicle.aeroTable?.axial.length).toBe(result.vehicle.aeroTable?.mach.length);
  });

  it("rejects a craft without a command module before flight scene creation", () => {
    expect(() => prepareSpaceZFlight([
      { kind: "tank", x: 0, y: 0, z: 0 },
      { kind: "engine", x: 0, y: -1, z: 0 }
    ], "Uncommanded")).toThrow(/command pod|remote-control/i);
  });

  it("rejects a craft without propulsion", () => {
    expect(() => prepareSpaceZFlight([
      { kind: "capsule", x: 0, y: 1, z: 0 },
      { kind: "tank", x: 0, y: 0, z: 0 }
    ], "Unpowered")).toThrow(/engine/i);
  });

  it("rejects non-finite custom part placements", () => {
    const invalid = starterBuild.map(part => ({ ...part })) as BuildPart[];
    invalid[1]!.x = Number.NaN;
    expect(() => prepareSpaceZFlight(invalid, "Invalid placement")).toThrow(/non-finite/i);
  });
});
