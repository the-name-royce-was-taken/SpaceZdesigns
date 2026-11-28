import {describe,expect,it} from "vitest";
import {buildOrbitlabAeroModel} from "../src/orbitlab/vehicle-adapter";
import type {BuildPart} from "../src/vehicle-builder-3d";
const starter:BuildPart[]=[{kind:"capsule",y:1.885},{kind:"tank",y:.96,topRadius:.44,bottomRadius:.44,height:.96},{kind:"engine",y:0,engineType:"liquid"}];
describe("Orbitlab per-build vehicle and aerodynamic adapter",()=>{
 it("translates the built stack into staged mass, propellant and engine data",()=>{
  const model=buildOrbitlabAeroModel(starter,"Test launcher");
  expect(model.vehicleSpec.stages).toHaveLength(1);
  expect(model.vehicleSpec.stages[0]?.dryMass).toBeCloseTo(2700,6);
  expect(model.vehicleSpec.stages[0]?.propellantMass).toBeCloseTo(120,6);
  expect(model.vehicleSpec.stages[0]?.engine.thrustSL).toBeCloseTo(34000,6);
 });
 it("builds a Mach-dependent table from the actual vehicle geometry",()=>{
  const model=buildOrbitlabAeroModel(starter);
  expect(model.referenceArea).toBeGreaterThan(0);
  expect(model.table.axial.length).toBeGreaterThan(5);
  expect(model.table.axial[2]).toBeGreaterThan(model.table.axial[0]);
 });
 it("adds the actual built wing and fin planform to normal-force authority",()=>{
  const plain=buildOrbitlabAeroModel(starter);
  const winged=buildOrbitlabAeroModel([...starter,{kind:"wing",x:0,y:.4,z:0},{kind:"fin",x:.5,y:.2,z:0},{kind:"fin",x:-.5,y:.2,z:0}]);
  expect(winged.surfaceArea).toBeGreaterThan(plain.surfaceArea);
  expect(winged.table.normalSlope[0]).toBeGreaterThan(plain.table.normalSlope[0]);
  expect(winged.table.planformArea).toBeGreaterThan(plain.table.planformArea);
 });
 it("maps engine activation groups to serial stage numbers",()=>{
  const staged:BuildPart[]=[...starter,{kind:"engine",y:-2,activationGroup:2,engineType:"solid"},{kind:"tank",y:-1.2,activationGroup:2}];
  const model=buildOrbitlabAeroModel(staged);
  expect(model.vehicleSpec.stages).toHaveLength(2);
  expect(model.vehicleSpec.stages[1]?.engine.solid).toBe(true);
 });
});
