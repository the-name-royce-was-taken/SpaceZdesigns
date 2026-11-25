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
 it("resets state and accumulator for a fresh launch",()=>{
  const sim=new FlightSimulator(vehicle);sim.launch();sim.step(.05,{throttle:1,pitch:0});sim.reset();
  expect(sim.state.altitude).toBe(0);expect(sim.state.fuelTonnes).toBe(vehicle.fuelTonnes);expect(sim.state.landed).toBe(true);
 });
});
