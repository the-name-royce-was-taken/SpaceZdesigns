import { describe, expect, it } from "vitest";
import { engineThrustDirection, landingLegBounds } from "../src/orbitlab/flight-preflight";
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
    const leg = (model.userData.legs as { hinge: { rotation: { z: number } }; piston: { position: { y: number }; scale: { y: number }; geometry: { parameters: { height: number } } }; foot: { position: { y: number } } }[])[0]!;
    expect(leg.hinge.rotation.z).toBeCloseTo(0);
    expect(leg.foot.position.y).toBeCloseTo(.82);
    expect(leg.piston.position.y + leg.piston.geometry.parameters.height * leg.piston.scale.y / 2).toBeCloseTo(leg.foot.position.y + .01);

    setLandingLegDeployment(model, true);
    animateLandingLegModels(model, 1);

    expect(model.userData.deploymentProgress).toBe(1);
    expect(leg.hinge.rotation.z).toBeCloseTo(-(2.3+Math.PI/9));
    expect(leg.foot.position.y).toBeCloseTo(1.36);
    expect(leg.piston.position.y + leg.piston.geometry.parameters.height * leg.piston.scale.y / 2).toBeCloseTo(leg.foot.position.y + .01);
    expect(leg.piston.position.y + leg.piston.geometry.parameters.height * leg.piston.scale.y / 2).toBeLessThan(leg.foot.position.y + .045);
  });

  it("chooses a downward, outward deployment swing for mirrored side-mounted legs", () => {
    expect(landingLegDeploymentAngle({x:1,rz:0})).toBeCloseTo(-(2.3+Math.PI/9));
    expect(landingLegDeploymentAngle({x:-1,rz:0})).toBeCloseTo(2.3+Math.PI/9);
    expect(landingLegDeploymentAngle({x:1,rz:Math.PI})).toBeCloseTo(2.3+Math.PI/9);
    expect(landingLegDeploymentAngle({x:-1,rz:Math.PI})).toBeCloseTo(-(2.3+Math.PI/9));
    const model=createLandingLegModel(false,landingLegDeploymentAngle({x:1,rz:Math.PI}));
    const leg=(model.userData.legs as {hinge:{rotation:{z:number}};foot:{children:{geometry:{type:string}}[]}}[])[0]!;
    expect(leg.hinge.rotation.z).toBeCloseTo(2.3+Math.PI/9);
    expect(leg.foot.children.some(child=>child.geometry.type==="CylinderGeometry")).toBe(true);
  });


  it("compiles the saved XYZ rotation into the craft-local engine thrust axis", () => {
    const axis = engineThrustDirection([{ kind: "engine", rx: 0, ry: 0, rz: Math.PI / 2 }]);
    expect(axis.x).toBeCloseTo(-1, 8);
    expect(axis.y).toBeCloseTo(0, 8);
    expect(axis.z).toBeCloseTo(0, 8);
  });

  it("uses the deployed landing foot as the lowest physical support bounds", () => {
    const stowed=landingLegBounds({kind:"landing-leg",x:1,rz:0},false);
    const deployed=landingLegBounds({kind:"landing-leg",x:1,rz:0},true);
    expect(deployed.min.y).toBeLessThan(-1);
    expect(deployed.max.y).toBeGreaterThan(stowed.min.y);
    expect(deployed.min.x).toBeLessThan(deployed.max.x);
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
