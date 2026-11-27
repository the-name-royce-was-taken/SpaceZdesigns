import { describe, expect, it } from "vitest";
import { engineVariants, partCatalog, partCost } from "../src/vehicle-builder-3d";

describe("fixed vehicle part prices", () => {
  it("assigns a positive fixed price to every catalog part", () => {
    expect(partCatalog.every(part => Number.isFinite(part.cost) && part.cost > 0)).toBe(true);
    expect(partCost("fuel-line")).toBeGreaterThan(0);
  });

  it("prices engine variants independently", () => {
    expect(engineVariants.map(engine => engine.cost)).toEqual([175000, 45000, 220000, 160000, 230000]);
    expect(partCost("engine", "solid")).toBe(45000);
  });
});
