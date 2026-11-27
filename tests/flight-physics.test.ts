import { describe, expect, it } from "vitest";
import { FlightSimulator, type VehiclePhysics } from "../src/flight-physics";
const vehicle:VehiclePhysics={dryMassTonnes:2,fuelTonnes:.2,thrustKN:40,ispSeconds:300,referenceArea:.8,dragCoefficient:.5,liftSlope:2,inertia:1};
describe("fixed-step flight solver",()=>{
 it("produces powered ascent and consumes propellant",()=>{
  const sim=new FlightSimulator(vehicle);sim.launch();
  for(let i=0;i<240;i++)sim.step(1/120,{throttle:1,pitch:0});
  expect(sim.state.altitude).toBeGreaterThan(0);
  expect(sim.state.fuelTonnes).toBeLessThan(vehicle.fuelTonnes);
  expect(sim.state.maxQ).toBeGreaterThan(0);
 });
 it("accelerates downward under gravity with zero throttle",()=>{
  const sim=new FlightSimulator(vehicle);sim.launch();sim.state.altitude=1000;
  sim.step(1/120,{throttle:0,pitch:0});
  expect(sim.state.vy).toBeLessThan(0);
 });
 it("increases attitude authority when reaction wheels are installed",()=>{
  const input={throttle:0,pitch:1};
  const baseline=new FlightSimulator(vehicle),assisted=new FlightSimulator({...vehicle,reactionWheelTorque:2});
  baseline.launch();assisted.launch();baseline.step(1/120,input);assisted.step(1/120,input);
  expect(assisted.state.angularVelocity).toBeGreaterThan(baseline.state.angularVelocity);
 });
 it("resets state and accumulator for a fresh launch",()=>{
  const sim=new FlightSimulator(vehicle);sim.launch();sim.step(.05,{throttle:1,pitch:0});sim.reset();
  expect(sim.state.altitude).toBe(0);expect(sim.state.fuelTonnes).toBe(vehicle.fuelTonnes);expect(sim.state.landed).toBe(true);
 });
 it("fires only engines assigned to the active stage and advances in order",()=>{
  const staged:VehiclePhysics={...vehicle,engines:[{stage:0,thrustKN:40,ispSeconds:300},{stage:1,thrustKN:80,ispSeconds:300}]};
  const sim=new FlightSimulator(staged);sim.launch();
  sim.step(1/120,{throttle:1,pitch:0});
  const stageZeroVelocity=sim.state.vy;
  expect(sim.activateNextStage()).toBe(true);
  expect(sim.state.currentStage).toBe(1);
  sim.step(1/120,{throttle:1,pitch:0});
  expect(sim.state.vy-stageZeroVelocity).toBeGreaterThan(0);
  expect(sim.activateNextStage()).toBe(false);
 });

});
