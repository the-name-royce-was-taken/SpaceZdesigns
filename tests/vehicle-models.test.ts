import { describe, expect, it } from "vitest";
import {
  animateLandingLegModels,
  createEngineModel,
  createLandingLegModel,
  setLandingLegDeployment,
  type EngineType
} from "../src/vehicle-builder-3d";

describe("shared vehicle visual models", () => {
  it.each(["liquid", "solid", "ion", "methalox", "hydrolox"] as EngineType[])(
    "creates the detailed %s engine model used by both scenes",
    type => {
      const model = createEngineModel(type);
      let meshCount = 0;
      model.traverse(object => {
        if ((object as { isMesh?: boolean }).isMesh) meshCount++;
      });
      expect(meshCount).toBeGreaterThan(3);
      expect(model.scale.x).toBeGreaterThan(0);
      expect(model.scale.x).toBe(model.scale.y);
      expect(model.scale.y).toBe(model.scale.z);
    }
  );

  it("builds three hydraulic landing legs and animates their pistons and footpads", () => {
    const model = createLandingLegModel(true);
    expect(model.userData.landingLegModel).toBe(true);
    expect(model.userData.legs).toHaveLength(3);
    expect(model.userData.deploymentProgress).toBe(0);

    setLandingLegDeployment(model, true);
    animateLandingLegModels(model, 1);

    expect(model.userData.deploymentProgress).toBe(1);
    for (const leg of model.userData.legs as { piston: { position: { y: number } }; foot: { position: { y: number } } }[]) {
      expect(leg.piston.position.y).toBeCloseTo(-.94);
      expect(leg.foot.position.y).toBeCloseTo(-1.19);
    }
  });

  it("can retract deployed hydraulic legs", () => {
    const model = createLandingLegModel(false);
    setLandingLegDeployment(model, false);
    animateLandingLegModels(model, 1);
    expect(model.userData.deploymentProgress).toBe(0);
  });
});
