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
    research: []
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