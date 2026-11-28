import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { exportWorld, importWorld, type WorldRecord } from "../src/worlds";

const sampleWorld: WorldRecord = {
  id: "test-world-001",
  name: "Test Flight",
  mode: "sandbox",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  gameVersion: "0.1.0",
  schemaVersion: 1,
  state: {
    currentScene: "space-center",
    currentBody: "Earth",
    credits: 100000,
    science: 42,
    reputation: 0,
    playTimeSeconds: 3600,
    craft: [{ name: "Heavy Lifter", parts: [
        { id: "pod-1", kind: "capsule", x: 0, y: 1, z: 0 },
        { id: "separator-1", kind: "separator", x: 0, y: 0.5, z: 0, activationGroup: 1 },
        { id: "engine-1", kind: "engine", x: 0, y: 0, z: 0, activationGroup: 2, engineStage: 2 },
        { id: "solar-1", kind: "solar", x: 1, y: 1, z: 0, activationGroup: 3 }
      ] }],
    missions: [
      { kind: "spacez-flight-record", id: "flight-001", craftName: "Heavy Lifter", status: "landed", savedAt: "2026-01-02T01:00:00.000Z", throttle: 0, pitch: 0, vehicle: { dryMassTonnes: 2, fuelTonnes: 0, thrustKN: 4, ispSeconds: 280, referenceArea: 1, dragCoefficient: 0.4, liftSlope: 0.1, inertia: 1 }, state: { altitude: 120000, x: 10, vx: 0, vy: 7500, fuelTonnes: 0, rcsFuelTonnes: 0, angle: 0, angularVelocityScalar: 0, elapsed: 1200, maxQ: 20000, currentStage: 1, landed: true, crashed: false, position: { x: 1, y: 6371000, z: 0 }, velocity: { x: 0, y: 7500, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, angularVelocity: { x: 0, y: 0, z: 0 } } },
      { kind: "spacez-flight-record", id: "flight-002", craftName: "Heavy Lifter", status: "in-flight", savedAt: "2026-01-02T02:00:00.000Z", throttle: 0.6, pitch: 2, vehicle: { dryMassTonnes: 2, fuelTonnes: 0.2, thrustKN: 4, ispSeconds: 280, referenceArea: 1, dragCoefficient: 0.4, liftSlope: 0.1, inertia: 1 }, state: { altitude: 20000, x: 20, vx: 0, vy: 1200, fuelTonnes: 0.1, rcsFuelTonnes: 0, angle: 0.1, angularVelocityScalar: 0, elapsed: 300, maxQ: 30000, currentStage: 1, landed: false, crashed: false, position: { x: 1, y: 6391000, z: 0 }, velocity: { x: 0, y: 1200, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, angularVelocity: { x: 0, y: 0, z: 0 } } }
    ],
    research: [],
    achievements: ["first-launch", "space-100km"],
    purchasedParts: ["part-owned-001"],
    blueprints: [{
      id: "bp-001",
      name: "Heavy Lifter",
      parts: [
        { id: "pod-1", kind: "capsule", x: 0, y: 1, z: 0 },
        { id: "separator-1", kind: "separator", x: 0, y: 0.5, z: 0, activationGroup: 1 },
        { id: "engine-1", kind: "engine", x: 0, y: 0, z: 0, activationGroup: 2, engineStage: 2 },
        { id: "solar-1", kind: "solar", x: 1, y: 1, z: 0, activationGroup: 3 }
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z"
    }]
  }
};

describe(".spaze world archives", () => {
  it("exports and imports a world without losing campaign data", () => {
    const archive = exportWorld(sampleWorld);
    const imported = importWorld(archive);
    expect(imported.name).toBe(sampleWorld.name);
    expect(imported.mode).toBe(sampleWorld.mode);
    expect(imported.state.science).toBe(42);
    expect(imported.state.currentBody).toBe("Earth");
    expect(imported.state.blueprints).toEqual(sampleWorld.state.blueprints);
    expect(imported.state.craft).toEqual(sampleWorld.state.craft);
    expect(imported.state.achievements).toEqual(sampleWorld.state.achievements);
    expect(imported.state.purchasedParts).toEqual(sampleWorld.state.purchasedParts);
    expect(imported.state.missions).toEqual(sampleWorld.state.missions);
  });

  it("stores blueprint records as a separate file inside the .spaze ZIP", () => {
    const files = unzipSync(exportWorld(sampleWorld));
    expect(Object.keys(files).sort()).toEqual(["world/blueprints.json", "world/manifest.json", "world/world.json"]);
    expect(JSON.parse(new TextDecoder().decode(files["world/blueprints.json"]))).toEqual(sampleWorld.state.blueprints);
    const worldData = JSON.parse(new TextDecoder().decode(files["world/world.json"]));
    expect(worldData.state.craft).toEqual(sampleWorld.state.craft);
    expect(worldData.state.missions).toEqual(sampleWorld.state.missions);
    expect(worldData.state.craft[0].parts.filter((part: { activationGroup?: number }) => part.activationGroup).map((part: { activationGroup: number }) => part.activationGroup)).toEqual([1, 2, 3]);
  });

  it("still imports legacy .spaze files that do not contain a blueprint file", () => {
    const legacy = { ...sampleWorld, state: { ...sampleWorld.state } };
    delete legacy.state.blueprints;
    const manifest = {
      format: "spacez-world", formatVersion: 1, gameVersion: legacy.gameVersion,
      worldId: legacy.id, worldName: legacy.name, mode: legacy.mode,
      exportedAt: new Date().toISOString(), files: ["world/world.json"]
    };
    const archive = zipSync({
      "world/manifest.json": strToU8(JSON.stringify(manifest)),
      "world/world.json": strToU8(JSON.stringify(legacy))
    });
    const imported = importWorld(archive);
    expect(imported.state.blueprints).toBeUndefined();
  });

  it("rejects malformed blueprint records inside a .spaze archive", () => {
    const archive = unzipSync(exportWorld(sampleWorld));
    archive["world/blueprints.json"] = strToU8(JSON.stringify([{ id: "bad", name: "Bad blueprint", parts: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]));
    const manifest = JSON.parse(new TextDecoder().decode(archive["world/manifest.json"]));
    const malformed = zipSync({
      "world/manifest.json": strToU8(JSON.stringify(manifest)),
      "world/world.json": archive["world/world.json"]!,
      "world/blueprints.json": archive["world/blueprints.json"]!
    });
    expect(() => importWorld(malformed)).toThrow(/between 1 and 120/i);
  });

  it("assigns an independent ID to imported worlds", () => {
    const imported = importWorld(exportWorld(sampleWorld));
    expect(imported.id).not.toBe(sampleWorld.id);
  });

  it("rejects empty and oversized archives", () => {
    expect(() => importWorld(new Uint8Array())).toThrow(/empty|exceeds/i);
    expect(() => importWorld(new Uint8Array(25 * 1024 * 1024 + 1))).toThrow(/exceeds/i);
  });

  it("rejects non-ZIP data", () => {
    expect(() => importWorld(new TextEncoder().encode("not a zip archive"))).toThrow(/valid ZIP/i);
  });
});