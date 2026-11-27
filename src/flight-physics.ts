export interface FlightInputs { throttle:number; pitch:number; translateX?:number; translateY?:number; }
export interface FlightState { x:number; altitude:number; vx:number; vy:number; angle:number; angularVelocity:number; fuelTonnes:number; rcsFuelTonnes:number; elapsed:number; crashed:boolean; landed:boolean; maxQ:number; currentStage:number; }
export interface FlightEngine { stage:number; thrustKN:number; ispSeconds:number; }
export interface VehiclePhysics {
 dryMassTonnes:number; fuelTonnes:number; thrustKN:number; ispSeconds:number; referenceArea:number; dragCoefficient:number; liftSlope:number; inertia:number;
 reactionWheelTorque?:number; rcsTorque?:number; rcsThrustKN?:number; rcsFuelTonnes?:number; controlSurfaceAuthority?:number; engines?:FlightEngine[]; activationGroups?:number[];
}
const G0=9.80665,EARTH_MU=3.986004418e14,EARTH_RADIUS=6_371_000,SEA_LEVEL_DENSITY=1.225,SCALE_HEIGHT=8500,FIXED_DT=1/120,MAX_SUBSTEPS=24,RCS_ISP=220;
export class FlightSimulator {
 readonly state:FlightState; private accumulator=0;
 constructor(readonly vehicle:VehiclePhysics){this.state={x:0,altitude:0,vx:0,vy:0,angle:0,angularVelocity:0,fuelTonnes:vehicle.fuelTonnes,rcsFuelTonnes:vehicle.rcsFuelTonnes??0,elapsed:0,crashed:false,landed:true,maxQ:0,currentStage:0};}
 launch(){this.state.landed=false;this.state.crashed=false;this.state.elapsed=0;this.state.maxQ=0;}
 reset(){Object.assign(this.state,{x:0,altitude:0,vx:0,vy:0,angle:0,angularVelocity:0,fuelTonnes:this.vehicle.fuelTonnes,rcsFuelTonnes:this.vehicle.rcsFuelTonnes??0,elapsed:0,crashed:false,landed:true,maxQ:0,currentStage:0});this.accumulator=0;}
 activateNextStage(){const stages=this.vehicle.activationGroups??(this.vehicle.engines??[]).map(engine=>engine.stage);const next=stages.filter(stage=>stage>this.state.currentStage).sort((a,b)=>a-b)[0];if(next===undefined)return false;this.state.currentStage=next;return true;}
 activateStage(stage:number){if(!Number.isInteger(stage)||stage<=this.state.currentStage)return false;const stages=this.vehicle.activationGroups??(this.vehicle.engines??[]).map(engine=>engine.stage);const next=stages.filter(value=>value>this.state.currentStage).sort((a,b)=>a-b)[0];if(next!==stage)return false;this.state.currentStage=stage;return true;}
 applyImpulse(deltaVx:number,deltaVy:number){if(this.state.landed||this.state.crashed||!Number.isFinite(deltaVx)||!Number.isFinite(deltaVy))return;this.state.vx+=deltaVx;this.state.vy+=deltaVy;}
 step(frameDt:number,input:FlightInputs){if(this.state.landed||this.state.crashed)return;this.accumulator+=Math.min(Math.max(frameDt,0),.1);let n=0;while(this.accumulator>=FIXED_DT&&n<MAX_SUBSTEPS){this.integrate(FIXED_DT,input);this.accumulator-=FIXED_DT;n++;}if(n===MAX_SUBSTEPS)this.accumulator=0;}
 private integrate(dt:number,input:FlightInputs){
  const s=this.state,v=this.vehicle,r=EARTH_RADIUS+Math.max(0,s.altitude),gravity=EARTH_MU/(r*r),rho=SEA_LEVEL_DENSITY*Math.exp(-Math.max(0,s.altitude)/SCALE_HEIGHT);
  const speed=Math.hypot(s.vx,s.vy),q=.5*rho*speed*speed;s.maxQ=Math.max(s.maxQ,q);
  const flightAngle=speed>1?Math.atan2(s.vx,s.vy):Math.PI/2;let aoa=Math.atan2(Math.sin(s.angle-flightAngle),Math.cos(s.angle-flightAngle));aoa=Math.max(-.7,Math.min(.7,aoa));
  const drag=q*v.referenceArea*v.dragCoefficient,lift=q*v.referenceArea*v.liftSlope*aoa,throttle=Math.max(0,Math.min(1,input.throttle));
  const activeEngines=v.engines?.filter(engine=>engine.stage===s.currentStage)??[],hasManifest=Array.isArray(v.engines);
  const thrustKN=hasManifest?activeEngines.reduce((sum,e)=>sum+e.thrustKN,0):v.thrustKN;
  const mdotPerThrottle=hasManifest?activeEngines.reduce((sum,e)=>sum+e.thrustKN*1000/(e.ispSeconds*G0),0):v.thrustKN*1000/(v.ispSeconds*G0);
  const thrust=s.fuelTonnes>0?thrustKN*1000*throttle:0,mdot=mdotPerThrottle*throttle;
  s.fuelTonnes-=Math.min(s.fuelTonnes,mdot*dt/1000);
  const tx=Math.sin(s.angle)*thrust,ty=Math.cos(s.angle)*thrust;
  const rcsX=Math.max(-1,Math.min(1,input.translateX??0)),rcsY=Math.max(-1,Math.min(1,input.translateY??0)),rcsEnabled=(v.rcsThrustKN??0)>0&&s.rcsFuelTonnes>0;
  let rcsFx=0,rcsFy=0;
  if(rcsEnabled&&(rcsX!==0||rcsY!==0)){
   const localX=rcsX*Math.cos(s.angle)+rcsY*Math.sin(s.angle),localY=-rcsX*Math.sin(s.angle)+rcsY*Math.cos(s.angle),force=(v.rcsThrustKN??0)*1000;
   rcsFx=localX*force;rcsFy=localY*force;const used=Math.min(s.rcsFuelTonnes,force/(RCS_ISP*G0)*dt/1000);s.rcsFuelTonnes-=used;
  }
  const massKg=Math.max(1,(v.dryMassTonnes+s.fuelTonnes+s.rcsFuelTonnes)*1000);
  const dragX=speed>0?-drag*s.vx/speed:0,dragY=speed>0?-drag*s.vy/speed:0,liftX=speed>0?-lift*s.vy/speed:0,liftY=speed>0?lift*s.vx/speed:0;
  s.vx+=(tx+rcsFx+dragX+liftX)/massKg*dt;s.vy+=(ty+rcsFy+dragY+liftY)/massKg*dt-gravity*dt;s.x+=s.vx*dt;s.altitude+=s.vy*dt;s.elapsed+=dt;
  const pitch=Math.max(-1,Math.min(1,input.pitch)),wheelAuthority=(v.reactionWheelTorque??0)*Math.abs(pitch),rcsAuthority=rcsEnabled?(v.rcsTorque??0)*Math.abs(pitch):0,aeroAuthority=(v.controlSurfaceAuthority??0)*q*pitch*.00002;
  s.angularVelocity+=Math.sign(pitch)*(wheelAuthority+rcsAuthority)*dt+aeroAuthority*dt;s.angularVelocity=Math.max(-2.4,Math.min(2.4,s.angularVelocity));s.angularVelocity*=Math.exp(-.9*dt);s.angle+=s.angularVelocity*dt;
  if(s.altitude<=0){s.altitude=0;if(s.vy < -18||Math.abs(s.vx)>24||Math.abs(aoa)>.9)s.crashed=true;else s.landed=true;s.vy=0;}
 }
}
