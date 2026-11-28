import { describe, expect, it } from "vitest";
import {
  animateLandingLegModels,
  createEngineModel,
  createLandingLegModel,
  setLandingLegDeployment,
  rotationSnapForShift,
  landingLegDeploymentAngle,
  engineGimbalRotation,
  engineVariants,
  partMassTonnes,
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


  it.each(["liquid", "solid", "methalox", "hydrolox"] as EngineType[])(
    "keeps the %s engine body fixed while exposing a separate nozzle pivot",
    type => {
      const model = createEngineModel(type);
      const nozzle = model.userData.gimbalPivot as {
        parent: unknown;
        position: { y: number };
        children: unknown[];
        rotation: { x: number; z: number };
      };
      expect(nozzle.parent).toBe(model);
      expect(nozzle.children.length).toBeGreaterThan(0);
      expect(nozzle.position.y).toBeLessThan(0);
      expect(model.rotation.x).toBe(0);
      expect(model.rotation.z).toBe(0);
      expect(model.userData.hasGimballedBell).toBe(true);
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
    expect(leg.hinge.rotation.z).toBeCloseTo(-2.3);
    expect(leg.piston.position.y).toBeCloseTo(1.04);
    expect(leg.foot.position.y).toBeCloseTo(1.36);
  });

  it("chooses a downward, outward deployment swing for mirrored side-mounted legs", () => {
    expect(landingLegDeploymentAngle({x:1,rz:0})).toBeCloseTo(-2.3);
    expect(landingLegDeploymentAngle({x:-1,rz:0})).toBeCloseTo(2.3);
    expect(landingLegDeploymentAngle({x:1,rz:Math.PI})).toBeCloseTo(2.3);
    expect(landingLegDeploymentAngle({x:-1,rz:Math.PI})).toBeCloseTo(-2.3);
    const model=createLandingLegModel(false,landingLegDeploymentAngle({x:1,rz:Math.PI}));
    const leg=(model.userData.legs as {hinge:{rotation:{z:number}}}[])[0]!;
    expect(leg.hinge.rotation.z).toBeCloseTo(2.3);
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


  it("uses distinct engine thrust, specific impulse, and dry mass values", () => {
    expect(engineVariants.find(engine => engine.id === "liquid")?.thrustKN).toBe(75);
    expect(engineVariants.find(engine => engine.id === "solid")?.ispSeconds).toBe(245);
    expect(engineVariants.find(engine => engine.id === "ion")?.thrustKN).toBeLessThan(.001);
    expect(partMassTonnes({kind:"engine",engineType:"liquid"})).toBeCloseTo(.18);
    expect(partMassTonnes({kind:"engine",engineType:"ion"})).toBeCloseTo(.06);
  });

  it("maps steering commands to the same six-degree nozzle gimbal used by flight physics", () => {
    const pitch=engineGimbalRotation(1,0);
    const yaw=engineGimbalRotation(0,1);
    expect(pitch.x).toBeCloseTo(-Math.PI/30);
    expect(pitch.z).toBeCloseTo(0);
    expect(yaw.x).toBeCloseTo(0);
    expect(yaw.z).toBeCloseTo(-Math.PI/30);
    expect(engineGimbalRotation(4,-4)).toEqual(engineGimbalRotation(1,-1));
  });

describe("builder rotation snapping", () => {
  it("uses 22.5 degree increments only while Shift is held", () => {
    expect(rotationSnapForShift(true)).toBeCloseTo(Math.PI / 8);
    expect(rotationSnapForShift(false)).toBeNull();
  });
});
