import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { exportBuildz, importBuildz, validateBlueprintParts } from "../src/blueprints";
import type { BuildPart } from "../src/vehicle-builder-3d";

const sample: BuildPart[] = [
  { id: "pod-1", kind: "capsule", x: 0.25, y: 1.8, z: -0.1, ry: 0.2 },
  { id: "tank-1", kind: "tank", x: 0, y: 0.8, z: 0, parentId: "pod-1", parentNode: "stack-bottom", childNode: "stack-top", topRadius: 0.62, bottomRadius: 0.44, height: 1.4 },
  { id: "separator-1", kind: "separator", x: 0, y: 0.1, z: 0, activationGroup: 1 },
  { id: "engine-1", kind: "engine", x: 0, y: -0.2, z: 0, engineType: "hydrolox", engineStage: 2, activationGroup: 2, parentId: "tank-1" },
  { id: "solar-1", kind: "solar", x: 1, y: 0.8, z: 0, activationGroup: 3 }
];

describe("buildz blueprint archives", () => {
  it("round-trips a complete craft through a ZIP .buildz archive", () => {
    const bytes = exportBuildz("Heavy Lifter", sample);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const imported = importBuildz(bytes);
    expect(imported).toEqual({ name: "Heavy Lifter", parts: sample });
    expect(imported.parts.map(part => part.activationGroup).filter(Boolean)).toEqual([1, 2, 3]);
  });

  it("normalizes legacy engine stages while retaining blueprint activation groups", () => {
    const validated = validateBlueprintParts([
      { id: "legacy-engine", kind: "engine", engineStage: 2 },
      { id: "panel", kind: "solar", activationGroup: 1 }
    ]);
    expect(validated.find(part => part.id === "legacy-engine")?.activationGroup).toBe(2);
    expect(validated.find(part => part.id === "legacy-engine")?.engineStage).toBe(2);
  });

  it("trims and validates names before exporting", () => {
    expect(importBuildz(exportBuildz("  Pioneer  ", sample)).name).toBe("Pioneer");
    expect(() => exportBuildz("   ", sample)).toThrow(/name cannot be empty/i);
  });

  it("rejects non-ZIP data and malformed archives", () => {
    expect(() => importBuildz(new Uint8Array([1, 2, 3]))).toThrow(/valid .buildz ZIP/i);
    expect(() => importBuildz(new Uint8Array())).toThrow(/empty/i);
  });

  it("rejects unsupported archive versions and invalid part data", () => {
    const unsupported = zipSync({ "blueprint.json": strToU8(JSON.stringify({ format: "spacez-buildz", version: 99, name: "Test", parts: sample })) });
    expect(() => importBuildz(unsupported)).toThrow(/not supported/i);
    expect(() => validateBlueprintParts([{ kind: "not-a-part" }])).toThrow(/unsupported component/i);
    expect(() => validateBlueprintParts([{ kind: "tank", x: Number.NaN }])).toThrow(/invalid x/i);
    expect(() => validateBlueprintParts([{ kind: "tank", id: "same" }, { kind: "engine", id: "same" }])).toThrow(/duplicate part IDs/i);
  });

  it("enforces the builder part limit", () => {
    expect(() => validateBlueprintParts(Array.from({ length: 121 }, () => ({ kind: "tank" })))).toThrow(/between 1 and 120/i);
  });
});

