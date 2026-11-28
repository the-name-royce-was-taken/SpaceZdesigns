import { atMach, type AeroTable } from "./orbitlab/aero-tables";
import { differentialGravityAt, ephemerisAt } from "./celestial";
export interface Vector3 { x:number; y:number; z:number; }
export interface Quaternion { x:number; y:number; z:number; w:number; }
export interface FlightInputs { throttle:number; pitch:number; yaw?:number; roll?:number; translateX?:number; translateY?:number; translateZ?:number; }
export interface FlightState {
 position:Vector3; velocity:Vector3; orientation:Quaternion; angularVelocity:Vector3;
 /** Compatibility telemetry projections; the solver itself integrates position and velocity in 3D. */
 x:number; altitude:number; vx:number; vy:number; angle:number; angularVelocityScalar:number;
 fuelTonnes:number; rcsFuelTonnes:number; elapsed:number; crashed:boolean; landed:boolean; impactSpeedMps?:number; maxQ:number; currentStage:number;
}
export interface FlightEngine { stage:number; thrustKN:number; ispSeconds:number; }
export interface VehiclePhysics { epochSeconds?:number; spawnClearanceM?:number; launchRailLengthM?:number; centerOfMassM?:Vector3; engineMountM?:Vector3; aeroDatumY?:number; dryMassTonnes:number; fuelTonnes:number; thrustKN:number; ispSeconds:number; referenceArea:number; aeroTable?:AeroTable; dragCoefficient:number; liftSlope:number; inertia:number; reactionWheelTorque?:number; rcsTorque?:number; rcsThrustKN?:number; rcsFuelTonnes?:number; controlSurfaceAuthority?:number; rcsStages?:number[]; reactionWheelStages?:number[]; controlSurfaceStages?:number[]; engines?:FlightEngine[]; activationGroups?:number[]; }
const G0=9.80665,EARTH_MU=3.986004418e14,EARTH_RADIUS=6_371_000,SEA_LEVEL_DENSITY=1.225,SCALE_HEIGHT=8500,FIXED_DT=1/120,MAX_SUBSTEPS=24,RCS_ISP=220;
export const EARTH_ROTATION_RATE=7.2921159e-5;
export const EARTH_OBLIQUITY=23.43928*Math.PI/180;
export const EARTH_SPIN_AXIS:Vector3={x:0,y:Math.cos(EARTH_OBLIQUITY),z:Math.sin(EARTH_OBLIQUITY)};
export const earthRotationAt=(elapsedSeconds:number):Quaternion=>{const half=EARTH_ROTATION_RATE*elapsedSeconds/2,sine=Math.sin(half);return{x:EARTH_SPIN_AXIS.x*sine,y:EARTH_SPIN_AXIS.y*sine,z:EARTH_SPIN_AXIS.z*sine,w:Math.cos(half)};};
export const EARTH_LAUNCH_ORIENTATION:Quaternion={x:-0.38801515,y:-0.38801515,z:-0.59113809,w:0.59113809};
const cross=(a:Vector3,b:Vector3):Vector3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const add=(a:Vector3,b:Vector3):Vector3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vector3,b:Vector3):Vector3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(a:Vector3,k:number):Vector3=>({x:a.x*k,y:a.y*k,z:a.z*k});
const dot=(a:Vector3,b:Vector3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const length=(a:Vector3)=>Math.hypot(a.x,a.y,a.z);
const unit=(a:Vector3):Vector3=>scale(a,1/Math.max(1e-12,length(a)));
const qmul=(a:Quaternion,b:Quaternion):Quaternion=>({x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z});
const rotate=(q:Quaternion,v:Vector3):Vector3=>{const p=qmul(qmul(q,{x:v.x,y:v.y,z:v.z,w:0}),{x:-q.x,y:-q.y,z:-q.z,w:q.w});return{x:p.x,y:p.y,z:p.z};};
const normalizeQ=(q:Quaternion):Quaternion=>{const n=Math.hypot(q.x,q.y,q.z,q.w)||1;return{x:q.x/n,y:q.y/n,z:q.z/n,w:q.w/n};};
const integrateOrientation=(q:Quaternion,omega:Vector3,dt:number):Quaternion=>{const angle=length(omega)*dt;if(angle<1e-12)return q;const axis=unit(omega),half=angle/2,dq={x:axis.x*Math.sin(half),y:axis.y*Math.sin(half),z:axis.z*Math.sin(half),w:Math.cos(half)};return normalizeQ(qmul(dq,q));};
const gravityEarth=(p:Vector3):Vector3=>{const r=Math.max(length(p),EARTH_RADIUS),factor=-EARTH_MU/(r*r*r);return scale(p,factor);};
export class FlightSimulator {
 readonly state:FlightState; private accumulator=0; private hasClearedPad=false;
 constructor(readonly vehicle:VehiclePhysics){this.state={position:{x:EARTH_RADIUS+(vehicle.spawnClearanceM??.5),y:0,z:0},velocity:scale(cross(EARTH_SPIN_AXIS,{x:EARTH_RADIUS,y:0,z:0}),EARTH_ROTATION_RATE),orientation:{...EARTH_LAUNCH_ORIENTATION},angularVelocity:{x:0,y:0,z:0},x:0,altitude:0,vx:0,vy:0,angle:0,angularVelocityScalar:0,fuelTonnes:vehicle.fuelTonnes,rcsFuelTonnes:vehicle.rcsFuelTonnes??0,elapsed:0,crashed:false,landed:true,impactSpeedMps:0,maxQ:0,currentStage:0};}
 launch(){this.state.landed=false;this.state.crashed=false;this.state.impactSpeedMps=0;this.state.elapsed=0;this.state.maxQ=0;this.state.currentStage=0;this.hasClearedPad=false;}
 restoreState(state:FlightState){Object.assign(this.state,state);this.hasClearedPad=length(this.state.position)>EARTH_RADIUS+(this.vehicle.spawnClearanceM??.5)+(this.vehicle.launchRailLengthM??20);this.accumulator=0;this.syncTelemetry();}
 reset(){Object.assign(this.state,{position:{x:EARTH_RADIUS+(this.vehicle.spawnClearanceM??.5),y:0,z:0},velocity:scale(cross(EARTH_SPIN_AXIS,{x:EARTH_RADIUS,y:0,z:0}),EARTH_ROTATION_RATE),orientation:{...EARTH_LAUNCH_ORIENTATION},angularVelocity:{x:0,y:0,z:0},x:0,altitude:0,vx:0,vy:0,angle:0,angularVelocityScalar:0,fuelTonnes:this.vehicle.fuelTonnes,rcsFuelTonnes:this.vehicle.rcsFuelTonnes??0,elapsed:0,crashed:false,landed:true,maxQ:0,currentStage:0});this.accumulator=0;this.hasClearedPad=false;}
 activateNextStage(){const stages=this.vehicle.activationGroups??(this.vehicle.engines??[]).map(e=>e.stage),next=stages.filter(n=>n>this.state.currentStage).sort((a,b)=>a-b)[0];if(next===undefined)return false;this.state.currentStage=next;return true;}
 activateStage(stage:number){if(!Number.isInteger(stage)||stage<=this.state.currentStage)return false;const stages=this.vehicle.activationGroups??(this.vehicle.engines??[]).map(e=>e.stage),next=stages.filter(n=>n>this.state.currentStage).sort((a,b)=>a-b)[0];if(next!==stage)return false;this.state.currentStage=stage;return true;}
 applyImpulse(dx:number,dy:number,dz=0){if(this.state.landed||this.state.crashed||![dx,dy,dz].every(Number.isFinite))return;this.state.velocity=add(this.state.velocity,{x:dx,y:dy,z:dz});this.syncTelemetry();}
 step(frameDt:number,input:FlightInputs){if(this.state.landed||this.state.crashed)return;this.accumulator+=Math.min(Math.max(frameDt,0),.1);let n=0;while(this.accumulator>=FIXED_DT&&n<MAX_SUBSTEPS){this.integrate(FIXED_DT,input);this.accumulator-=FIXED_DT;n++;}if(n===MAX_SUBSTEPS)this.accumulator=0;}
 private syncTelemetry(){const s=this.state,r=length(s.position),radial=unit(s.position);s.altitude=r-EARTH_RADIUS;s.x=s.position.x;s.vx=Math.sqrt(Math.max(0,dot(s.velocity,s.velocity)-dot(s.velocity,radial)**2));s.vy=dot(s.velocity,radial);const forward=rotate(s.orientation,{x:0,y:1,z:0}),east={x:radial.z,y:0,z:-radial.x};s.angle=Math.atan2(dot(forward,east),dot(forward,radial));s.angularVelocityScalar=dot(s.angularVelocity,rotate(s.orientation,{x:1,y:0,z:0}));}
 private integrate(dt:number,input:FlightInputs){
  const s=this.state,v=this.vehicle,r=length(s.position),altitude=r-EARTH_RADIUS,epoch=(v.epochSeconds??0)+s.elapsed,earth=ephemerisAt(epoch).find(b=>b.id==="earth")!;
  const padAltitude=v.spawnClearanceM??.5,railLength=Math.max(0,v.launchRailLengthM??20);
  const onLaunchRail=!this.hasClearedPad&&altitude<=padAltitude+railLength;
  // The launch pad is Earth-fixed, not inertially fixed. Keep the vehicle's
  // body axis aligned with the rotating launch site while it is rail-constrained.
  if(onLaunchRail)s.orientation=normalizeQ(qmul(earthRotationAt(s.elapsed),EARTH_LAUNCH_ORIENTATION));
  const heliocentricCraft=add(earth.position,s.position),third=differentialGravityAt(heliocentricCraft,earth.position,epoch),gravity=add(gravityEarth(s.position),third);
  const rho=altitude>0?SEA_LEVEL_DENSITY*Math.exp(-altitude/SCALE_HEIGHT):SEA_LEVEL_DENSITY,atmosphereVelocity=scale(cross(EARTH_SPIN_AXIS,s.position),EARTH_ROTATION_RATE),airVelocity=sub(s.velocity,atmosphereVelocity),speed=length(airVelocity),q=.5*rho*speed*speed;s.maxQ=Math.max(s.maxQ,q);
  const forward=unit(rotate(s.orientation,{x:0,y:1,z:0})),flightDirection=speed>1?unit(airVelocity):forward,cosAoA=Math.max(-1,Math.min(1,dot(forward,flightDirection))),aoa=Math.acos(cosAoA);
  const throttle=Math.max(0,Math.min(1,input.throttle)),active=v.engines?.filter(e=>e.stage>0&&e.stage<=s.currentStage)??[],hasManifest=Array.isArray(v.engines),thrustKN=hasManifest?active.reduce((sum,e)=>sum+e.thrustKN,0):v.thrustKN,mdot=hasManifest?active.reduce((sum,e)=>sum+e.thrustKN*1000/(e.ispSeconds*G0),0):v.thrustKN*1000/(v.ispSeconds*G0);
  const thrust=s.fuelTonnes>0?thrustKN*1000*throttle:0;s.fuelTonnes-=Math.min(s.fuelTonnes,mdot*throttle*dt/1000);
  const gimbalAngle=6*Math.PI/180,gimbalPitch=Math.max(-1,Math.min(1,input.pitch))*gimbalAngle,gimbalYaw=Math.max(-1,Math.min(1,input.yaw??0))*gimbalAngle,localThrustDirection=unit({x:Math.sin(gimbalYaw)*Math.cos(gimbalPitch),y:Math.cos(gimbalYaw)*Math.cos(gimbalPitch),z:-Math.sin(gimbalPitch)}),thrustForce=scale(rotate(s.orientation,localThrustDirection),thrust),cg=v.centerOfMassM??{x:0,y:0,z:0},engineMount=v.engineMountM??{x:0,y:-.55,z:0},engineLever=sub(engineMount,cg),engineGimbalTorque=rotate(s.orientation,cross(engineLever,scale(localThrustDirection,thrust)));
  const temperature=altitude<11000?288.15-.0065*Math.max(0,altitude):216.65,soundSpeed=Math.sqrt(1.4*287.05287*Math.max(150,temperature)),mach=speed/Math.max(1,soundSpeed),baseFirst=dot(forward,flightDirection)<0,dragCurve=v.aeroTable?(baseFirst?v.aeroTable.baseAxial:v.aeroTable.axial):undefined,dragCoefficient=dragCurve?atMach(v.aeroTable!,dragCurve,mach):v.dragCoefficient,liftSlope=v.aeroTable?(baseFirst?v.aeroTable.baseNormalSlope:atMach(v.aeroTable,v.aeroTable.normalSlope,mach)):v.liftSlope;
  const sideDrag=v.aeroTable?v.aeroTable.planformArea*v.aeroTable.crossflowEta*1.2*Math.sin(aoa)**2:0,dragMagnitude=q*(v.referenceArea*dragCoefficient+sideDrag),drag= speed>1?scale(flightDirection,-dragMagnitude):{x:0,y:0,z:0};
  const liftAxis=sub(forward,scale(flightDirection,dot(forward,flightDirection))),liftDirection=length(liftAxis)>1e-8?unit(liftAxis):{x:0,y:0,z:0},liftMagnitude=q*v.referenceArea*liftSlope*Math.min(.7,aoa);
  const aero=add(drag,scale(liftDirection,liftMagnitude));
  const stages=(list:number[]|undefined,total:number)=>list?list.filter(n=>n>0&&n<=s.currentStage).length:total;
  const rcsTotal=v.rcsStages?.length??((v.rcsThrustKN??0)>0?1:0),rcsActive=stages(v.rcsStages,rcsTotal),rcsScale=rcsTotal?rcsActive/rcsTotal:0,rx=Math.max(-1,Math.min(1,input.translateX??0)),ry=Math.max(-1,Math.min(1,input.translateY??0)),rz=Math.max(-1,Math.min(1,input.translateZ??0)),rcsEnabled=(v.rcsThrustKN??0)>0&&s.rcsFuelTonnes>0&&rcsActive>0;
  const rcsLocal={x:rx,y:ry,z:rz},rcsDirection=length(rcsLocal)>0?unit(rotate(s.orientation,rcsLocal)):{x:0,y:0,z:0},rcsForce=rcsEnabled?scale(rcsDirection,(v.rcsThrustKN??0)*1000*rcsScale):{x:0,y:0,z:0};
  const mass=Math.max(1,(v.dryMassTonnes+s.fuelTonnes+s.rcsFuelTonnes)*1000),acceleration=add(gravity,scale(add(add(thrustForce,rcsForce),aero),1/mass));
  const radial=unit(s.position),padRadius=EARTH_RADIUS+padAltitude,relativeRadialSpeed=dot(sub(s.velocity,atmosphereVelocity),radial),radialAcceleration=dot(acceleration,radial);
  if(onLaunchRail){
   // The launch rail constrains lateral translation and attitude until the
   // vehicle has cleared the pad. Only positive/negative radial motion is
   // integrated here; otherwise tiny thrust or off-axis engine placement can
   // inject an enormous sideways velocity before the craft has room to fly.
   const nextRadialSpeed=relativeRadialSpeed+radialAcceleration*dt;
   if(nextRadialSpeed<=1e-8&&altitude<=padAltitude+.05){
    // A vehicle resting on the pad must still move in inertial space with
    // Earth's rotation. Holding position fixed while assigning surface
    // velocity lets the launch site rotate away underneath the rocket.
    const coRotatedPosition=add(s.position,scale(atmosphereVelocity,dt));
    s.position=scale(unit(coRotatedPosition),padRadius);
    s.velocity=scale(cross(EARTH_SPIN_AXIS,s.position),EARTH_ROTATION_RATE);
   }else{s.velocity=add(atmosphereVelocity,scale(radial,nextRadialSpeed));s.position=add(s.position,scale(s.velocity,dt));if(length(s.position)<=padRadius&&nextRadialSpeed<0){const groundRadial=unit(s.position);s.position=scale(groundRadial,padRadius);s.velocity=scale(cross(EARTH_SPIN_AXIS,s.position),EARTH_ROTATION_RATE);}}
   if(length(s.position)-EARTH_RADIUS>padAltitude+railLength)this.hasClearedPad=true;
  }else{s.velocity=add(s.velocity,scale(acceleration,dt));s.position=add(s.position,scale(s.velocity,dt));}
  const pitch=Math.max(-1,Math.min(1,input.pitch)),yaw=Math.max(-1,Math.min(1,input.yaw??0)),roll=Math.max(-1,Math.min(1,input.roll??0));
  const wheelCount=v.reactionWheelStages?.length??((v.reactionWheelTorque??0)>0?1:0),wheelScale=wheelCount?stages(v.reactionWheelStages,wheelCount)/wheelCount:0,surfaceCount=v.controlSurfaceStages?.length??((v.controlSurfaceAuthority??0)>0?1:0),surfaceScale=surfaceCount?stages(v.controlSurfaceStages,surfaceCount)/surfaceCount:0;
  const rcsUse=rcsEnabled?Math.min(1,Math.hypot(rx,ry,rz)+Math.hypot(pitch,yaw,roll)*.35):0,rcsTorque=(v.rcsTorque??0)*rcsScale,torque=(v.reactionWheelTorque??0)*wheelScale,airTorque=(v.controlSurfaceAuthority??0)*surfaceScale*q*.00002;
  const cpStation=v.aeroTable?atMach(v.aeroTable,v.aeroTable.cpX,mach):0,aeroLever=rotate(s.orientation,{x:0,y:cpStation+(v.aeroDatumY??0)-cg.y,z:0}),aeroLiftForce=scale(liftDirection,liftMagnitude),aeroMoment=cross(aeroLever,aeroLiftForce);
  const localTorque={x:pitch*(torque+rcsTorque+airTorque),y:roll*(torque+rcsTorque+airTorque),z:yaw*(torque+rcsTorque+airTorque)},worldTorque=add(add(rotate(s.orientation,localTorque),engineGimbalTorque),aeroMoment),inertia=Math.max(.01,v.inertia*mass);
  if(onLaunchRail){s.angularVelocity={x:0,y:0,z:0};s.orientation=normalizeQ(qmul(earthRotationAt(s.elapsed+dt),EARTH_LAUNCH_ORIENTATION));}
  else{s.angularVelocity=add(s.angularVelocity,scale(worldTorque,dt/inertia));s.angularVelocity=scale(s.angularVelocity,Math.exp(-.35*dt));s.orientation=integrateOrientation(s.orientation,s.angularVelocity,dt);}
  if(rcsUse>0){const force=(v.rcsThrustKN??0)*1000*rcsScale,used=Math.min(s.rcsFuelTonnes,force/(RCS_ISP*G0)*rcsUse*dt/1000);s.rcsFuelTonnes-=used;}
  s.elapsed+=dt;this.syncTelemetry();
  const contactRadius=EARTH_RADIUS+(v.spawnClearanceM??.5);if(!onLaunchRail&&length(s.position)<=contactRadius){const radial=unit(s.position),surfaceVelocity=scale(cross(EARTH_SPIN_AXIS,s.position),EARTH_ROTATION_RATE),relativeVelocity=sub(s.velocity,surfaceVelocity),normalSpeed=dot(relativeVelocity,radial),tangent=sub(relativeVelocity,scale(radial,normalSpeed));if(normalSpeed< -18||length(tangent)>24||aoa>.9){s.crashed=true;s.impactSpeedMps=length(relativeVelocity);}else{s.landed=true;s.impactSpeedMps=0;}s.position=scale(radial,contactRadius);s.velocity=sub(s.velocity,scale(radial,normalSpeed));this.syncTelemetry();}
 }
}
