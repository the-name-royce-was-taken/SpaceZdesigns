import { describe, expect, it } from "vitest";
import {
  animateLandingLegModels,
  createEngineModel,
  createLandingLegModel,
  setLandingLegDeployment,
  rotationSnapForShift,
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

  it("builds one side-mounted hydraulic leg that stows upward and extends down and outward", () => {
    const model = createLandingLegModel();
    expect(model.userData.landingLegModel).toBe(true);
    expect(model.userData.legs).toHaveLength(1);
    expect(model.userData.deploymentProgress).toBe(0);
    const leg = (model.userData.legs as { hinge: { rotation: { z: number } }; piston: { position: { y: number } }; foot: { position: { y: number } } }[])[0]!;
    expect(leg.hinge.rotation.z).toBeCloseTo(0);
    expect(leg.piston.position.y).toBeCloseTo(.58);
    expect(leg.foot.position.y).toBeCloseTo(.82);

    setLandingLegDeployment(model, true);
    animateLandingLegModels(model, 1);

    expect(model.userData.deploymentProgress).toBe(1);
    expect(leg.hinge.rotation.z).toBeCloseTo(-2.0);
    expect(leg.piston.position.y).toBeCloseTo(.92);
    expect(leg.foot.position.y).toBeCloseTo(1.24);
  });

  it("can retract the hydraulic leg", () => {
    const model = createLandingLegModel(false);
    setLandingLegDeployment(model, false);
    animateLandingLegModels(model, 1);
    expect(model.userData.deploymentProgress).toBe(0);
    const leg = (model.userData.legs as { hinge: { rotation: { z: number } } }[])[0]!;
    expect(leg.hinge.rotation.z).toBeCloseTo(0);
  });
});

describe("builder rotation snapping", () => {
  it("uses 22.5 degree increments only while Shift is held", () => {
    expect(rotationSnapForShift(true)).toBeCloseTo(Math.PI / 8);
    expect(rotationSnapForShift(false)).toBeNull();
  });
});
