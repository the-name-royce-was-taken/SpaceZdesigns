import { describe, expect, it } from "vitest";
import { EARTH_ROTATION_RATE, EARTH_SPIN_AXIS, earthRotationAt, FlightSimulator, type VehiclePhysics } from "../src/flight-physics";
const vehicle:VehiclePhysics={dryMassTonnes:2,fuelTonnes:.2,thrustKN:40,ispSeconds:300,referenceArea:.8,dragCoefficient:.5,liftSlope:2,inertia:1};
const rotateByQuaternion=(q:{x:number;y:number;z:number;w:number},v:{x:number;y:number;z:number})=>{
 const p={x:q.y*v.z-q.z*v.y,y:q.z*v.x-q.x*v.z,z:q.x*v.y-q.y*v.x};
 const cross={x:q.y*p.z-q.z*p.y,y:q.z*p.x-q.x*p.z,z:q.x*p.y-q.y*p.x};
 return{x:v.x+2*(q.w*p.x+cross.x),y:v.y+2*(q.w*p.y+cross.y),z:v.z+2*(q.w*p.z+cross.z)};
};
describe("fixed-step flight solver",()=>{
 it("holds the vehicle on the launch pad until thrust exceeds its weight",()=>{
  const sim=new FlightSimulator({...vehicle,spawnClearanceM:.5});sim.launch();
  for(let i=0;i<240;i++)sim.step(1/120,{throttle:.2,pitch:0});
  expect(sim.state.landed).toBe(false);
  expect(sim.state.crashed).toBe(false);
  expect(sim.state.altitude).toBeCloseTo(.5,3);
  for(let i=0;i<240;i++)sim.step(1/120,{throttle:1,pitch:0});
  expect(sim.state.altitude).toBeGreaterThan(.5);
 });

 it("integrates world-space angular velocity as a world-space rotation",()=>{
  const sim=new FlightSimulator(vehicle);sim.launch();
  const position={x:6_371_100,y:0,z:0},surfaceVelocity={x:0,y:EARTH_SPIN_AXIS.z*position.x*EARTH_ROTATION_RATE,z:-EARTH_SPIN_AXIS.y*position.x*EARTH_ROTATION_RATE};
  const initial={...sim.state.orientation},initialForward=rotateByQuaternion(initial,{x:0,y:1,z:0});
  sim.restoreState({...sim.state,position,velocity:surfaceVelocity,angularVelocity:{x:0,y:0,z:1},landed:false,crashed:false});sim.step(1/120,{throttle:0,pitch:0});
  const half=.5*(1/120)*Math.exp(-.35/120),worldDelta={x:0,y:0,z:Math.sin(half),w:Math.cos(half)};
  const expected=rotateByQuaternion(worldDelta,initialForward),actual=rotateByQuaternion(sim.state.orientation,{x:0,y:1,z:0});
  expect(Math.hypot(actual.x-expected.x,actual.y-expected.y,actual.z-expected.z)).toBeLessThan(1e-7);
 });
 it("provides a co-rotating launch-site orientation at Earth's spin rate",()=>{
  const elapsed=120,rotation=earthRotationAt(elapsed),angle=EARTH_ROTATION_RATE*elapsed,sine=Math.sin(angle/2);
  expect(Math.hypot(rotation.x,rotation.y,rotation.z,rotation.w)).toBeCloseTo(1,10);
  expect(2*Math.acos(rotation.w)).toBeCloseTo(angle,10);
  expect(rotation.x/sine).toBeCloseTo(EARTH_SPIN_AXIS.x,10);
  expect(rotation.y/sine).toBeCloseTo(EARTH_SPIN_AXIS.y,10);
  expect(rotation.z/sine).toBeCloseTo(EARTH_SPIN_AXIS.z,10);
 });
 it("starts with a normalized attitude that points the rocket's forward axis radially upward",()=>{
  const sim=new FlightSimulator(vehicle),q=sim.state.orientation,forward=rotateByQuaternion(q,{x:0,y:1,z:0});
  expect(Math.hypot(q.x,q.y,q.z,q.w)).toBeCloseTo(1,8);
  expect(forward.x).toBeCloseTo(1,7);
  expect(forward.y).toBeCloseTo(0,7);
  expect(forward.z).toBeCloseTo(0,7);
 });
 it("directs ignition thrust away from Earth rather than sideways",()=>{
  const powered=new FlightSimulator(vehicle),coasting=new FlightSimulator(vehicle);
  powered.launch();coasting.launch();powered.state.position.x+=1000;coasting.state.position.x+=1000;
  powered.step(1/120,{throttle:1,pitch:0});coasting.step(1/120,{throttle:0,pitch:0});
  const dv={x:powered.state.velocity.x-coasting.state.velocity.x,y:powered.state.velocity.y-coasting.state.velocity.y,z:powered.state.velocity.z-coasting.state.velocity.z};
  expect(dv.x).toBeGreaterThan(0);
  expect(Math.abs(dv.y)).toBeLessThan(dv.x*1e-6);
  expect(Math.abs(dv.z)).toBeLessThan(dv.x*1e-6);
 });
 it("gimballed steering torque follows the commanded pitch and yaw directions",()=>{
  const sim=new FlightSimulator(vehicle);sim.launch();sim.state.position.x+=1000;
  const localX=rotateByQuaternion(sim.state.orientation,{x:1,y:0,z:0}),localZ=rotateByQuaternion(sim.state.orientation,{x:0,y:0,z:1});
  sim.step(1/120,{throttle:1,pitch:1,yaw:1});
  const pitchTorque=sim.state.angularVelocity.x*localX.x+sim.state.angularVelocity.y*localX.y+sim.state.angularVelocity.z*localX.z;
  const yawTorque=sim.state.angularVelocity.x*localZ.x+sim.state.angularVelocity.y*localZ.y+sim.state.angularVelocity.z*localZ.z;
  expect(pitchTorque).toBeGreaterThan(0);
  expect(yawTorque).toBeGreaterThan(0);
 });
 it("produces powered ascent and consumes propellant",()=>{
  const sim=new FlightSimulator(vehicle);sim.launch();
  for(let i=0;i<240;i++)sim.step(1/120,{throttle:1,pitch:0});
  expect(sim.state.altitude).toBeGreaterThan(0);
  expect(sim.state.fuelTonnes).toBeLessThan(vehicle.fuelTonnes);
  expect(sim.state.maxQ).toBeGreaterThan(0);
 });
 it("delivers the specified thrust and Isp-based propellant flow",()=>{const sim=new FlightSimulator(vehicle);sim.launch();const dt=1/120,r=6_371_000.5,mass=(vehicle.dryMassTonnes+vehicle.fuelTonnes)*1000,expectedDeltaV=(vehicle.thrustKN*1000/mass-3.986004418e14/(r*r))*dt,expectedFuel=vehicle.fuelTonnes-(vehicle.thrustKN*1000/(vehicle.ispSeconds*9.80665))*dt/1000;sim.step(dt,{throttle:1,pitch:0});expect(sim.state.vy).toBeCloseTo(expectedDeltaV,3);expect(sim.state.fuelTonnes).toBeCloseTo(expectedFuel,8);});
 it("maintains a circular orbit when tangential speed balances central gravity",()=>{const sim=new FlightSimulator(vehicle);sim.launch();sim.state.position={x:6_371_000+200_000,y:0,z:0};sim.state.velocity={x:0,y:0,z:-Math.sqrt(3.986004418e14/(6_371_000+200_000))};for(let i=0;i<1200;i++)sim.step(1/120,{throttle:0,pitch:0});expect(sim.state.altitude).toBeCloseTo(200_000,0);expect(Math.abs(sim.state.vy)).toBeLessThan(.01);expect(sim.state.x).toBeGreaterThan(70_000);});
 it("accelerates downward under gravity with zero throttle",()=>{
  const sim=new FlightSimulator(vehicle);sim.launch();sim.state.position.x+=1000;
  sim.step(1/120,{throttle:0,pitch:0});
  expect(sim.state.vy).toBeLessThan(0);
 });
 it("increases attitude authority when reaction wheels are installed",()=>{
  const input={throttle:0,pitch:1};
  const baseline=new FlightSimulator(vehicle),assisted=new FlightSimulator({...vehicle,reactionWheelTorque:2});
  baseline.launch();assisted.launch();baseline.state.position.x+=1000;assisted.state.position.x+=1000;baseline.step(1/120,input);assisted.step(1/120,input);
  expect(assisted.state.angularVelocityScalar).toBeGreaterThan(baseline.state.angularVelocityScalar);
 });
 it("sequences all activation groups, including groups without engines",()=>{
  const staged:VehiclePhysics={...vehicle,engines:[{stage:1,thrustKN:40,ispSeconds:300},{stage:3,thrustKN:80,ispSeconds:300}],activationGroups:[1,2,3]};
  const sim=new FlightSimulator(staged);sim.launch();
  expect(sim.state.currentStage).toBe(0);
  expect(sim.activateStage(3)).toBe(false);
  expect(sim.activateNextStage()).toBe(true);
  expect(sim.state.currentStage).toBe(1);
  expect(sim.activateNextStage()).toBe(true);
  expect(sim.state.currentStage).toBe(2);
  expect(sim.activateStage(3)).toBe(true);
  expect(sim.state.currentStage).toBe(3);
  expect(sim.activateNextStage()).toBe(false);
 });
 it("applies separation impulses to an active flight without changing grounded state",()=>{const sim=new FlightSimulator(vehicle);sim.launch();const initial={...sim.state.velocity};sim.applyImpulse(1.5,-.25);expect(sim.state.velocity.x).toBeCloseTo(initial.x+1.5);expect(sim.state.velocity.y).toBeCloseTo(initial.y-.25);sim.reset();const before={...sim.state.velocity};sim.applyImpulse(5,5);expect(sim.state.velocity).toEqual(before);});
 it("uses RCS translation only when fitted and consumes its propellant",()=>{const rcs:VehiclePhysics={...vehicle,rcsThrustKN:.35,rcsFuelTonnes:.02,rcsStages:[1],activationGroups:[1]};const sim=new FlightSimulator(rcs);sim.launch();sim.activateNextStage();sim.state.position.x+=1000;sim.step(1/120,{throttle:0,pitch:0,translateX:1});expect(sim.state.vx).toBeGreaterThan(0);expect(sim.state.rcsFuelTonnes).toBeLessThan(.02);const inactive=new FlightSimulator({...rcs,rcsStages:[2]}),baseline=new FlightSimulator({...rcs,rcsStages:[]});inactive.launch();baseline.launch();inactive.state.position.x+=1000;baseline.state.position.x+=1000;inactive.step(1/120,{throttle:0,pitch:0,translateX:1});baseline.step(1/120,{throttle:0,pitch:0,translateX:1});expect(inactive.state.velocity).toEqual(baseline.state.velocity);expect(inactive.state.rcsFuelTonnes).toBe(.02);});
 it("rotates only with an enabled reaction wheel or RCS attitude system",()=>{const baseline=new FlightSimulator(vehicle),wheel=new FlightSimulator({...vehicle,reactionWheelTorque:3.8,reactionWheelStages:[1],activationGroups:[1]});baseline.launch();wheel.launch();baseline.state.position.x+=1000;wheel.state.position.x+=1000;wheel.activateNextStage();baseline.step(1/120,{throttle:0,pitch:1});wheel.step(1/120,{throttle:0,pitch:1});expect(wheel.state.angularVelocityScalar).toBeGreaterThan(baseline.state.angularVelocityScalar);const rcs=new FlightSimulator({...vehicle,rcsTorque:1.5,rcsThrustKN:.35,rcsFuelTonnes:.02,rcsStages:[1],activationGroups:[1]});rcs.launch();rcs.activateNextStage();rcs.state.position.x+=1000;rcs.step(1/120,{throttle:0,pitch:1});expect(rcs.state.angularVelocityScalar).toBeGreaterThan(0);expect(rcs.state.rcsFuelTonnes).toBeLessThan(.02);});
 it("accelerates out of the orbital plane with a three-axis RCS command",()=>{const sim=new FlightSimulator({...vehicle,rcsThrustKN:.35,rcsFuelTonnes:.02,rcsStages:[1],activationGroups:[1]});sim.launch();sim.activateNextStage();sim.state.position.x+=1000;sim.step(1/120,{throttle:0,pitch:0,translateZ:1});expect(Math.abs(sim.state.velocity.z)).toBeGreaterThan(0);expect(sim.state.position.z).not.toBe(0);});
 it("steers with gimballed engine thrust even without reaction wheels or RCS",()=>{const sim=new FlightSimulator(vehicle),straight=new FlightSimulator(vehicle);sim.launch();straight.launch();sim.state.position.x+=1000;straight.state.position.x+=1000;sim.step(1/120,{throttle:1,pitch:1,yaw:1});straight.step(1/120,{throttle:1,pitch:0,yaw:0});expect(Math.hypot(sim.state.velocity.x-straight.state.velocity.x,sim.state.velocity.y-straight.state.velocity.y,sim.state.velocity.z-straight.state.velocity.z)).toBeGreaterThan(0);expect(Math.abs(sim.state.angularVelocity.x)+Math.abs(sim.state.angularVelocity.z)).toBeGreaterThan(0);});
 it("integrates a full 3D attitude quaternion under yaw and roll inputs",()=>{const sim=new FlightSimulator({...vehicle,reactionWheelTorque:5});sim.launch();sim.state.position.x+=1000;sim.step(1/120,{throttle:0,pitch:.5,yaw:1,roll:1});expect(Math.abs(sim.state.orientation.x)+Math.abs(sim.state.orientation.y)+Math.abs(sim.state.orientation.z)).toBeGreaterThan(0);expect(Math.hypot(sim.state.orientation.x,sim.state.orientation.y,sim.state.orientation.z,sim.state.orientation.w)).toBeCloseTo(1,8);});
 it("keeps a pad-held vehicle co-rotating with Earth and launches radially",()=>{
  const launchVehicle:VehiclePhysics={...vehicle,spawnClearanceM:1,launchRailLengthM:20,dryMassTonnes:10,fuelTonnes:2,thrustKN:1000};
  const sim=new FlightSimulator(launchVehicle);sim.launch();const initial={...sim.state.position};
  for(let i=0;i<60*120;i++)sim.step(1/120,{throttle:0,pitch:0});
  expect(Math.hypot(sim.state.position.x-initial.x,sim.state.position.y-initial.y,sim.state.position.z-initial.z)).toBeGreaterThan(100);
  sim.step(1/120,{throttle:1,pitch:0});
  for(let i=0;i<240;i++)sim.step(1/120,{throttle:1,pitch:0});
  expect(sim.state.altitude).toBeGreaterThan(21);
  const radius=Math.hypot(sim.state.position.x,sim.state.position.y,sim.state.position.z);
  const radial={x:sim.state.position.x/radius,y:sim.state.position.y/radius,z:sim.state.position.z/radius};
  const forward=rotateByQuaternion(sim.state.orientation,{x:0,y:1,z:0});
  const alignmentError=Math.hypot(forward.y*radial.z-forward.z*radial.y,forward.z*radial.x-forward.x*radial.z,forward.x*radial.y-forward.y*radial.x);
  expect(alignmentError).toBeLessThan(.002);
  const omega={x:EARTH_SPIN_AXIS.x,y:EARTH_SPIN_AXIS.y,z:EARTH_SPIN_AXIS.z};
  const air={x:(omega.y*sim.state.position.z-omega.z*sim.state.position.y)*EARTH_ROTATION_RATE,y:(omega.z*sim.state.position.x-omega.x*sim.state.position.z)*EARTH_ROTATION_RATE,z:(omega.x*sim.state.position.y-omega.y*sim.state.position.x)*EARTH_ROTATION_RATE};
  const relative={x:sim.state.velocity.x-air.x,y:sim.state.velocity.y-air.y,z:sim.state.velocity.z-air.z};
  const radialSpeed=relative.x*radial.x+relative.y*radial.y+relative.z*radial.z;
  const lateralSpeed=Math.sqrt(Math.max(0,relative.x**2+relative.y**2+relative.z**2-radialSpeed**2));
  expect(lateralSpeed).toBeLessThan(.1);
 });
 it("records impact speed and crashes on a high-speed ground collision",()=>{
  const sim=new FlightSimulator({...vehicle,spawnClearanceM:.5,launchRailLengthM:20});sim.launch();
  const position={x:6_371_000+25.5,y:0,z:0},surfaceVelocity={x:0,y:EARTH_SPIN_AXIS.z*position.x*EARTH_ROTATION_RATE,z:-EARTH_SPIN_AXIS.y*position.x*EARTH_ROTATION_RATE};
  sim.restoreState({...sim.state,position,velocity:{x:-50,y:surfaceVelocity.y,z:surfaceVelocity.z},landed:false,crashed:false});
  for(let i=0;i<240&&!sim.state.crashed&&!sim.state.landed;i++)sim.step(1/120,{throttle:0,pitch:0});
  expect(sim.state.crashed).toBe(true);
  expect(sim.state.impactSpeedMps).toBeGreaterThan(18);
 });
 it("resets state and accumulator for a fresh launch",()=>{
  const sim=new FlightSimulator(vehicle);sim.launch();sim.step(.05,{throttle:1,pitch:0});sim.reset();
  expect(sim.state.altitude).toBe(0);expect(sim.state.fuelTonnes).toBe(vehicle.fuelTonnes);expect(sim.state.landed).toBe(true);
 });
 it("fires only engines assigned to an activated group and advances in order",()=>{
  const staged:VehiclePhysics={...vehicle,engines:[{stage:1,thrustKN:40,ispSeconds:300},{stage:2,thrustKN:80,ispSeconds:300}],activationGroups:[1,2]};
  const sim=new FlightSimulator(staged);sim.launch();sim.state.position.x+=1000;
  sim.step(1/120,{throttle:1,pitch:0});const unpoweredVelocity=sim.state.vy;
  expect(sim.activateNextStage()).toBe(true);expect(sim.state.currentStage).toBe(1);
  sim.step(1/120,{throttle:1,pitch:0});const firstGroupVelocity=sim.state.vy;
  expect(firstGroupVelocity).toBeGreaterThan(unpoweredVelocity);
  expect(sim.activateNextStage()).toBe(true);expect(sim.state.currentStage).toBe(2);
  sim.step(1/120,{throttle:1,pitch:0});expect(sim.state.vy).toBeGreaterThan(firstGroupVelocity);
  expect(sim.activateNextStage()).toBe(false);
 });

});
