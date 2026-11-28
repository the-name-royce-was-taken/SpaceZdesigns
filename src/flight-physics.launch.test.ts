import { describe, expect, it } from "vitest";
import {
  EARTH_ROTATION_RATE,
  EARTH_SPIN_AXIS,
  FlightSimulator,
  type VehiclePhysics
} from "./flight-physics";

const vehicle: VehiclePhysics = {
  spawnClearanceM: 1,
  launchRailLengthM: 20,
  dryMassTonnes: 9,
  fuelTonnes: 1,
  thrustKN: 300,
  ispSeconds: 300,
  referenceArea: 1,
  dragCoefficient: .3,
  liftSlope: 2,
  inertia: 1
};

function atmosphereVelocity(position: {x:number;y:number;z:number}) {
  const a = EARTH_SPIN_AXIS;
  return {
    x: (a.y * position.z - a.z * position.y) * EARTH_ROTATION_RATE,
    y: (a.z * position.x - a.x * position.z) * EARTH_ROTATION_RATE,
    z: (a.x * position.y - a.y * position.x) * EARTH_ROTATION_RATE
  };
}

describe("launch rail constraint", () => {
  it("keeps a low-throttle vehicle on the pad below liftoff thrust", () => {
    const sim = new FlightSimulator(vehicle);
    sim.launch();
    sim.step(1, { throttle: .02, pitch: 0 });
    expect(sim.state.altitude).toBeCloseTo(1, 2);
    const air = atmosphereVelocity(sim.state.position);
    const relative = {
      x: sim.state.velocity.x - air.x,
      y: sim.state.velocity.y - air.y,
      z: sim.state.velocity.z - air.z
    };
    expect(Math.hypot(relative.x, relative.y, relative.z)).toBeLessThan(.01);
  });

  it("constrains lateral motion and attitude while the rocket is on the launch rail", () => {
    const sim = new FlightSimulator(vehicle);
    sim.launch();
    sim.step(.25, { throttle: .5, pitch: 0, yaw: 0, roll: 0 });
    expect(sim.state.altitude).toBeGreaterThan(1);
    expect(sim.state.altitude).toBeLessThan(21);
    const air = atmosphereVelocity(sim.state.position);
    const relative = {
      x: sim.state.velocity.x - air.x,
      y: sim.state.velocity.y - air.y,
      z: sim.state.velocity.z - air.z
    };
    const radial = {
      x: sim.state.position.x / Math.hypot(sim.state.position.x, sim.state.position.y, sim.state.position.z),
      y: sim.state.position.y / Math.hypot(sim.state.position.x, sim.state.position.y, sim.state.position.z),
      z: sim.state.position.z / Math.hypot(sim.state.position.x, sim.state.position.y, sim.state.position.z)
    };
    const radialSpeed = relative.x * radial.x + relative.y * radial.y + relative.z * radial.z;
    const lateralSpeed = Math.sqrt(Math.max(0, relative.x ** 2 + relative.y ** 2 + relative.z ** 2 - radialSpeed ** 2));
    expect(lateralSpeed).toBeLessThan(.02);
    expect(Math.hypot(sim.state.angularVelocity.x, sim.state.angularVelocity.y, sim.state.angularVelocity.z)).toBe(0);
  });
});
