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
    craft: [],
    missions: [],
    research: [],
    blueprints: [{
      id: "bp-001",
      name: "Heavy Lifter",
      parts: [{ id: "pod-1", kind: "capsule", x: 0, y: 1, z: 0 }],
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
  });

  it("stores blueprint records as a separate file inside the .spaze ZIP", () => {
    const files = unzipSync(exportWorld(sampleWorld));
    expect(Object.keys(files).sort()).toEqual(["world/blueprints.json", "world/manifest.json", "world/world.json"]);
    expect(JSON.parse(new TextDecoder().decode(files["world/blueprints.json"]))).toEqual(sampleWorld.state.blueprints);
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