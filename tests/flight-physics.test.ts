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
 it("maintains a circular orbit when tangential speed balances central gravity",()=>{const sim=new FlightSimulator(vehicle);sim.launch();sim.state.altitude=200_000;sim.state.vx=Math.sqrt(3.986004418e14/(6_371_000+200_000));for(let i=0;i<1200;i++)sim.step(1/120,{throttle:0,pitch:0});expect(sim.state.altitude).toBeCloseTo(200_000,2);expect(Math.abs(sim.state.vy)).toBeLessThan(.01);expect(sim.state.x).toBeGreaterThan(70_000);});
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
 it("sequences all activation groups, including groups without engines",()=>{
  const staged:VehiclePhysics={...vehicle,engines:[{stage:0,thrustKN:40,ispSeconds:300},{stage:3,thrustKN:80,ispSeconds:300}],activationGroups:[1,2,3]};
  const sim=new FlightSimulator(staged);sim.launch();
  expect(sim.state.currentStage).toBe(1);
  expect(sim.activateStage(3)).toBe(false);
  expect(sim.activateNextStage()).toBe(true);
  expect(sim.state.currentStage).toBe(2);
  expect(sim.activateStage(3)).toBe(true);
  expect(sim.state.currentStage).toBe(3);
  expect(sim.activateNextStage()).toBe(false);
 });
 it("applies separation impulses to an active flight without changing grounded state",()=>{const sim=new FlightSimulator(vehicle);sim.launch();sim.applyImpulse(1.5,-.25);expect(sim.state.vx).toBeCloseTo(1.5);expect(sim.state.vy).toBeCloseTo(-.25);sim.reset();sim.applyImpulse(5,5);expect(sim.state.vx).toBe(0);expect(sim.state.vy).toBe(0);});
 it("uses RCS translation only when fitted and consumes its propellant",()=>{const rcs:VehiclePhysics={...vehicle,rcsThrustKN:.35,rcsFuelTonnes:.02,rcsStages:[0]};const sim=new FlightSimulator(rcs);sim.launch();sim.state.altitude=1000;sim.step(1/120,{throttle:0,pitch:0,translateX:1});expect(sim.state.vx).toBeGreaterThan(0);expect(sim.state.rcsFuelTonnes).toBeLessThan(.02);const inactive=new FlightSimulator({...rcs,rcsStages:[2]});inactive.launch();inactive.state.altitude=1000;inactive.step(1/120,{throttle:0,pitch:0,translateX:1});expect(inactive.state.vx).toBeCloseTo(0,6);});
 it("rotates only with an enabled reaction wheel or RCS attitude system",()=>{const baseline=new FlightSimulator(vehicle),wheel=new FlightSimulator({...vehicle,reactionWheelTorque:3.8,reactionWheelStages:[0]});baseline.launch();wheel.launch();baseline.step(1/120,{throttle:0,pitch:1});wheel.step(1/120,{throttle:0,pitch:1});expect(wheel.state.angularVelocity).toBeGreaterThan(baseline.state.angularVelocity);const rcs=new FlightSimulator({...vehicle,rcsTorque:1.5,rcsThrustKN:.35,rcsFuelTonnes:.02,rcsStages:[0]});rcs.launch();rcs.state.altitude=1000;rcs.step(1/120,{throttle:0,pitch:1});expect(rcs.state.angularVelocity).toBeGreaterThan(0);expect(rcs.state.rcsFuelTonnes).toBeLessThan(.02);});
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
