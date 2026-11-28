import { describe, expect, it } from "vitest";
import { engineVariants } from "../src/vehicle-builder-3d";

describe("balanced engine variants", () => {
  it("offers liquid, solid, ion, methalox, and hydrolox engines", () => {
    expect(engineVariants.map(engine => engine.id)).toEqual([
      "liquid", "solid", "ion", "methalox", "hydrolox"
    ]);
  });

  it("uses engine-specific thrust and specific impulse values", () => {
    expect(new Set(engineVariants.map(engine => engine.thrustKN)).size).toBe(5);
    expect(new Set(engineVariants.map(engine => engine.ispSeconds)).size).toBe(5);
    expect(engineVariants.find(engine => engine.id === "ion")?.thrustKN).toBeLessThan(.001);
    expect(engineVariants.find(engine => engine.id === "hydrolox")?.ispSeconds).toBeGreaterThan(400);
  });
});
