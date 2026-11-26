import { describe, expect, it } from "vitest";
import { engineVariants } from "../src/vehicle-builder-3d";

describe("balanced engine variants", () => {
  it("offers liquid, solid, ion, methalox, and hydrolox engines", () => {
    expect(engineVariants.map(engine => engine.id)).toEqual([
      "liquid", "solid", "ion", "methalox", "hydrolox"
    ]);
  });

  it("keeps thrust and specific impulse identical across engine variants", () => {
    expect(new Set(engineVariants.map(engine => engine.thrustKN))).toEqual(new Set([34]));
    expect(new Set(engineVariants.map(engine => engine.ispSeconds))).toEqual(new Set([285]));
  });
});
