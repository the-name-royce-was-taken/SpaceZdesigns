export interface FlightInputs { throttle:number; pitch:number; }
export interface FlightState {
  x:number; altitude:number; vx:number; vy:number; angle:number; angularVelocity:number;
  fuelTonnes:number; elapsed:number; crashed:boolean; landed:boolean; maxQ:number; currentStage:number;
}
export interface FlightEngine { stage:number; thrustKN:number; ispSeconds:number; }
export interface VehiclePhysics {
  dryMassTonnes:number; fuelTonnes:number; thrustKN:number; ispSeconds:number;
  referenceArea:number; dragCoefficient:number; liftSlope:number; inertia:number; engines?:FlightEngine[];
}
const G0=9.80665, EARTH_MU=3.986004418e14, EARTH_RADIUS=6_371_000, SEA_LEVEL_DENSITY=1.225, SCALE_HEIGHT=8500;
const FIXED_DT=1/120, MAX_SUBSTEPS=24;
export class FlightSimulator {
  readonly state:FlightState;
  private accumulator=0;
  constructor(readonly vehicle:VehiclePhysics){
    this.state={x:0,altitude:0,vx:0,vy:0,angle:0,angularVelocity:0,fuelTonnes:vehicle.fuelTonnes,elapsed:0,crashed:false,landed:true,maxQ:0,currentStage:0};
  }
  launch(){this.state.landed=false;this.state.crashed=false;this.state.elapsed=0;this.state.maxQ=0;}
  reset(){Object.assign(this.state,{x:0,altitude:0,vx:0,vy:0,angle:0,angularVelocity:0,fuelTonnes:this.vehicle.fuelTonnes,elapsed:0,crashed:false,landed:true,maxQ:0,currentStage:0});this.accumulator=0;}
  activateNextStage(){const stages=(this.vehicle.engines??[]).map(engine=>engine.stage);const next=stages.filter(stage=>stage>this.state.currentStage).sort((a,b)=>a-b)[0];if(next===undefined)return false;this.state.currentStage=next;return true;}
  step(frameDt:number,input:FlightInputs){
    if(this.state.landed||this.state.crashed)return;
    this.accumulator+=Math.min(Math.max(frameDt,0),.1);
    let n=0;while(this.accumulator>=FIXED_DT&&n<MAX_SUBSTEPS){this.integrate(FIXED_DT,input);this.accumulator-=FIXED_DT;n++;}
    if(n===MAX_SUBSTEPS)this.accumulator=0;
  }
  private integrate(dt:number,input:FlightInputs){
    const s=this.state,v=this.vehicle,r=EARTH_RADIUS+Math.max(0,s.altitude);
    const gravity=EARTH_MU/(r*r),rho=SEA_LEVEL_DENSITY*Math.exp(-Math.max(0,s.altitude)/SCALE_HEIGHT);
    const speed=Math.hypot(s.vx,s.vy),q=.5*rho*speed*speed;
    s.maxQ=Math.max(s.maxQ,q);
    const flightAngle=speed>1?Math.atan2(s.vx,s.vy):Math.PI/2;
    let aoa=Math.atan2(Math.sin(s.angle-flightAngle),Math.cos(s.angle-flightAngle));
    aoa=Math.max(-.7,Math.min(.7,aoa));
    const drag=q*v.referenceArea*v.dragCoefficient;
    const lift=q*v.referenceArea*v.liftSlope*aoa;
    const massKg=Math.max(1,(v.dryMassTonnes+s.fuelTonnes)*1000);
    const throttle=Math.max(0,Math.min(1,input.throttle));
    const activeEngines=v.engines?.filter(engine=>engine.stage===s.currentStage)??[];
    const hasEngineManifest=Array.isArray(v.engines);
    const thrustKN=hasEngineManifest?activeEngines.reduce((sum,engine)=>sum+engine.thrustKN,0):v.thrustKN;
    const mdotPerThrottle=hasEngineManifest?activeEngines.reduce((sum,engine)=>sum+engine.thrustKN*1000/(engine.ispSeconds*G0),0):v.thrustKN*1000/(v.ispSeconds*G0);
    const thrust=s.fuelTonnes>0?thrustKN*1000*throttle:0;
    const mdot=mdotPerThrottle*throttle;
    const fuelUsed=Math.min(s.fuelTonnes,mdot*dt/1000);
    s.fuelTonnes-=fuelUsed;
    const tx=Math.sin(s.angle)*thrust,ty=Math.cos(s.angle)*thrust;
    const dragX=speed>0?-drag*s.vx/speed:0,dragY=speed>0?-drag*s.vy/speed:0;
    const liftX=speed>0?-lift*s.vy/speed:0,liftY=speed>0?lift*s.vx/speed:0;
    s.vx+=(tx+dragX+liftX)/massKg*dt;
    s.vy+=(ty+dragY+liftY)/massKg*dt-gravity*dt;
    s.x+=s.vx*dt;s.altitude+=s.vy*dt;s.elapsed+=dt;
    const controlTorque=input.pitch* Math.max(0,Math.min(1,Math.abs(input.throttle)+.25))*v.inertia*.9;
    const aeroTorque=-aoa*q*v.referenceArea*.12;
    s.angularVelocity+=(controlTorque+aeroTorque)/(v.inertia*massKg)*dt;
    s.angularVelocity*=Math.exp(-.55*dt);
    s.angle+=s.angularVelocity*dt;
    if(s.altitude<=0){s.altitude=0;if(s.vy < -18 || Math.abs(s.vx)>24 || Math.abs(aoa)>.9){s.crashed=true;}else{s.landed=true;}s.vy=0;}
  }
}
