export interface FlightInputs { throttle:number; pitch:number; translateX?:number; translateY?:number; }
export interface FlightState { x:number; altitude:number; vx:number; vy:number; angle:number; angularVelocity:number; fuelTonnes:number; rcsFuelTonnes:number; elapsed:number; crashed:boolean; landed:boolean; maxQ:number; currentStage:number; }
export interface FlightEngine { stage:number; thrustKN:number; ispSeconds:number; }
export interface VehiclePhysics { epochSeconds?:number;
 dryMassTonnes:number; fuelTonnes:number; thrustKN:number; ispSeconds:number; referenceArea:number; dragCoefficient:number; liftSlope:number; inertia:number;
 reactionWheelTorque?:number; rcsTorque?:number; rcsThrustKN?:number; rcsFuelTonnes?:number; controlSurfaceAuthority?:number; rcsStages?:number[]; reactionWheelStages?:number[]; controlSurfaceStages?:number[]; engines?:FlightEngine[]; activationGroups?:number[];
}
import { differentialGravityAt, ephemerisAt } from "./celestial";
const G0=9.80665,EARTH_MU=3.986004418e14,EARTH_RADIUS=6_371_000,SEA_LEVEL_DENSITY=1.225,SCALE_HEIGHT=8500,FIXED_DT=1/120,MAX_SUBSTEPS=24,RCS_ISP=220;
export class FlightSimulator {
 readonly state:FlightState; private accumulator=0;
 constructor(readonly vehicle:VehiclePhysics){this.state={x:0,altitude:0,vx:0,vy:0,angle:0,angularVelocity:0,fuelTonnes:vehicle.fuelTonnes,rcsFuelTonnes:vehicle.rcsFuelTonnes??0,elapsed:0,crashed:false,landed:true,maxQ:0,currentStage:0};}
 launch(){this.state.landed=false;this.state.crashed=false;this.state.elapsed=0;this.state.maxQ=0;const firstStage=(this.vehicle.activationGroups??[]).filter(stage=>Number.isInteger(stage)&&stage>0).sort((a,b)=>a-b)[0];this.state.currentStage=firstStage??0;}
 reset(){Object.assign(this.state,{x:0,altitude:0,vx:0,vy:0,angle:0,angularVelocity:0,fuelTonnes:this.vehicle.fuelTonnes,rcsFuelTonnes:this.vehicle.rcsFuelTonnes??0,elapsed:0,crashed:false,landed:true,maxQ:0,currentStage:0});this.accumulator=0;}
 activateNextStage(){const stages=this.vehicle.activationGroups??(this.vehicle.engines??[]).map(engine=>engine.stage);const next=stages.filter(stage=>stage>this.state.currentStage).sort((a,b)=>a-b)[0];if(next===undefined)return false;this.state.currentStage=next;return true;}
 activateStage(stage:number){if(!Number.isInteger(stage)||stage<=this.state.currentStage)return false;const stages=this.vehicle.activationGroups??(this.vehicle.engines??[]).map(engine=>engine.stage);const next=stages.filter(value=>value>this.state.currentStage).sort((a,b)=>a-b)[0];if(next!==stage)return false;this.state.currentStage=stage;return true;}
 applyImpulse(deltaVx:number,deltaVy:number){if(this.state.landed||this.state.crashed||!Number.isFinite(deltaVx)||!Number.isFinite(deltaVy))return;this.state.vx+=deltaVx;this.state.vy+=deltaVy;}
 step(frameDt:number,input:FlightInputs){if(this.state.landed||this.state.crashed)return;this.accumulator+=Math.min(Math.max(frameDt,0),.1);let n=0;while(this.accumulator>=FIXED_DT&&n<MAX_SUBSTEPS){this.integrate(FIXED_DT,input);this.accumulator-=FIXED_DT;n++;}if(n===MAX_SUBSTEPS)this.accumulator=0;}
 private integrate(dt:number,input:FlightInputs){
  const s=this.state,v=this.vehicle,r=EARTH_RADIUS+Math.max(0,s.altitude),gravity=EARTH_MU/(r*r),rho=SEA_LEVEL_DENSITY*Math.exp(-Math.max(0,s.altitude)/SCALE_HEIGHT);
  const theta=s.x/EARTH_RADIUS,epoch=(v.epochSeconds??0)+s.elapsed,earthPosition=ephemerisAt(epoch).find(body=>body.id==="earth")!.position,spacecraftPosition={x:earthPosition.x+r*Math.sin(theta),y:earthPosition.y,z:earthPosition.z+r*Math.cos(theta)};
  const thirdBody=differentialGravityAt(spacecraftPosition,earthPosition,epoch),thirdTangential=thirdBody.x*Math.cos(theta)-thirdBody.z*Math.sin(theta),thirdRadial=thirdBody.x*Math.sin(theta)+thirdBody.z*Math.cos(theta);
  const speed=Math.hypot(s.vx,s.vy),q=.5*rho*speed*speed;s.maxQ=Math.max(s.maxQ,q);
  const flightAngle=speed>1?Math.atan2(s.vx,s.vy):Math.PI/2;let aoa=Math.atan2(Math.sin(s.angle-flightAngle),Math.cos(s.angle-flightAngle));aoa=Math.max(-.7,Math.min(.7,aoa));
  const drag=q*v.referenceArea*v.dragCoefficient,lift=q*v.referenceArea*v.liftSlope*aoa,throttle=Math.max(0,Math.min(1,input.throttle));
  const activeEngines=v.engines?.filter(engine=>engine.stage<=s.currentStage)??[],hasManifest=Array.isArray(v.engines);
  const thrustKN=hasManifest?activeEngines.reduce((sum,e)=>sum+e.thrustKN,0):v.thrustKN;
  const mdotPerThrottle=hasManifest?activeEngines.reduce((sum,e)=>sum+e.thrustKN*1000/(e.ispSeconds*G0),0):v.thrustKN*1000/(v.ispSeconds*G0);
  const thrust=s.fuelTonnes>0?thrustKN*1000*throttle:0,mdot=mdotPerThrottle*throttle;
  s.fuelTonnes-=Math.min(s.fuelTonnes,mdot*dt/1000);
  const tx=Math.sin(s.angle)*thrust,ty=Math.cos(s.angle)*thrust;
  const activeCount=(stages:number[]|undefined,total:number)=>stages?stages.filter(stage=>stage<=s.currentStage).length:total;
  const totalRcs=v.rcsStages?.length??((v.rcsThrustKN??0)>0?1:0),activeRcs=activeCount(v.rcsStages,totalRcs),rcsScale=totalRcs?activeRcs/totalRcs:0;
  const rcsX=Math.max(-1,Math.min(1,input.translateX??0)),rcsY=Math.max(-1,Math.min(1,input.translateY??0)),rcsEnabled=(v.rcsThrustKN??0)>0&&s.rcsFuelTonnes>0&&activeRcs>0;
  let rcsFx=0,rcsFy=0;
  if(rcsEnabled&&(rcsX!==0||rcsY!==0)){
   const localX=rcsX*Math.cos(s.angle)+rcsY*Math.sin(s.angle),localY=-rcsX*Math.sin(s.angle)+rcsY*Math.cos(s.angle),force=(v.rcsThrustKN??0)*1000*rcsScale;
   rcsFx=localX*force;rcsFy=localY*force;
  }
  const massKg=Math.max(1,(v.dryMassTonnes+s.fuelTonnes+s.rcsFuelTonnes)*1000);
  const dragX=speed>0?-drag*s.vx/speed:0,dragY=speed>0?-drag*s.vy/speed:0,liftX=speed>0?-lift*s.vy/speed:0,liftY=speed>0?lift*s.vx/speed:0;
  const tangentialAcceleration=-(s.vy*s.vx/r)+(tx+rcsFx+dragX+liftX)/massKg+thirdTangential;const radialAcceleration=(s.vx*s.vx/r)-gravity+(ty+rcsFy+dragY+liftY)/massKg+thirdRadial;s.vx+=tangentialAcceleration*dt;s.vy+=radialAcceleration*dt;s.x+=s.vx*(EARTH_RADIUS/r)*dt;s.altitude+=s.vy*dt;s.elapsed+=dt;
  const pitch=Math.max(-1,Math.min(1,input.pitch));if(rcsEnabled&&(rcsX!==0||rcsY!==0||pitch!==0)){const rcsUse=Math.min(1,Math.hypot(rcsX,rcsY)+Math.abs(pitch)*.35),activeForce=(v.rcsThrustKN??0)*1000*rcsScale,used=Math.min(s.rcsFuelTonnes,activeForce/(RCS_ISP*G0)*rcsUse*dt/1000);s.rcsFuelTonnes-=used;}
  const wheelCount=v.reactionWheelStages?.length??((v.reactionWheelTorque??0)>0?1:0),activeWheels=activeCount(v.reactionWheelStages,wheelCount),wheelScale=wheelCount?activeWheels/wheelCount:0;
  const surfaceCount=v.controlSurfaceStages?.length??((v.controlSurfaceAuthority??0)>0?1:0),activeSurfaces=activeCount(v.controlSurfaceStages,surfaceCount),surfaceScale=surfaceCount?activeSurfaces/surfaceCount:0;
  const wheelAuthority=(v.reactionWheelTorque??0)*wheelScale*Math.abs(pitch),rcsAuthority=rcsEnabled?(v.rcsTorque??0)*rcsScale*Math.abs(pitch):0,aeroAuthority=(v.controlSurfaceAuthority??0)*surfaceScale*q*pitch*.00002;
  s.angularVelocity+=Math.sign(pitch)*(wheelAuthority+rcsAuthority)*dt+aeroAuthority*dt;s.angularVelocity=Math.max(-2.4,Math.min(2.4,s.angularVelocity));s.angularVelocity*=Math.exp(-.9*dt);s.angle+=s.angularVelocity*dt;
  if(s.altitude<=0){s.altitude=0;if(s.vy < -18||Math.abs(s.vx)>24||Math.abs(aoa)>.9)s.crashed=true;else s.landed=true;s.vy=0;}
 }
}
