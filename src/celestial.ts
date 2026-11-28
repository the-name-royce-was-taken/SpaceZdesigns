export interface Vector3 { x:number; y:number; z:number; }
export interface CelestialBody { id:string; name:string; parentId:string|null; massKg:number; radiusM:number; orbitRadiusM:number; periodSeconds:number; phaseRadians:number; eccentricity?:number; inclinationRadians?:number; ascendingNodeRadians?:number; periapsisArgumentRadians?:number; }
export interface BodyEphemeris extends CelestialBody { position:Vector3; velocity:Vector3; }
export const G=6.67430e-11;
export const AU=149_597_870_700;
export const SOLAR_SYSTEM:readonly CelestialBody[]=[
 {id:"sun",name:"Sun",parentId:null,massKg:1.98847e30,radiusM:695_700_000,orbitRadiusM:0,periodSeconds:1,phaseRadians:0},
 {id:"mercury",name:"Mercury",parentId:"sun",massKg:3.3011e23,radiusM:2_439_700,orbitRadiusM:.387098*AU,periodSeconds:87.969*86400,phaseRadians:.2,eccentricity:0.2056,inclinationRadians:7.005*Math.PI/180,ascendingNodeRadians:48.331*Math.PI/180,periapsisArgumentRadians:29.124*Math.PI/180},
 {id:"venus",name:"Venus",parentId:"sun",massKg:4.8675e24,radiusM:6_051_800,orbitRadiusM:.723332*AU,periodSeconds:224.701*86400,phaseRadians:1.1,eccentricity:0.0068,inclinationRadians:3.3947*Math.PI/180,ascendingNodeRadians:76.68*Math.PI/180,periapsisArgumentRadians:54.884*Math.PI/180},
 {id:"earth",name:"Earth",parentId:"sun",massKg:5.97237e24,radiusM:6_371_000,orbitRadiusM:AU,periodSeconds:365.256*86400,phaseRadians:0,eccentricity:0.0167,inclinationRadians:0.00005*Math.PI/180,ascendingNodeRadians:-11.26*Math.PI/180,periapsisArgumentRadians:114.21*Math.PI/180},
 {id:"moon",name:"Luna",parentId:"earth",massKg:7.342e22,radiusM:1_737_400,orbitRadiusM:384_400_000,periodSeconds:27.321661*86400,phaseRadians:2.4,eccentricity:0.0549,inclinationRadians:5.145*Math.PI/180,ascendingNodeRadians:125.08*Math.PI/180,periapsisArgumentRadians:318.15*Math.PI/180},
 {id:"mars",name:"Mars",parentId:"sun",massKg:6.4171e23,radiusM:3_389_500,orbitRadiusM:1.523679*AU,periodSeconds:686.98*86400,phaseRadians:2.0,eccentricity:0.0934,inclinationRadians:1.85*Math.PI/180,ascendingNodeRadians:49.56*Math.PI/180,periapsisArgumentRadians:286.5*Math.PI/180},
 {id:"phobos",name:"Phobos",parentId:"mars",massKg:1.0659e16,radiusM:11_267,orbitRadiusM:9_376_000,periodSeconds:7.6538*3600,phaseRadians:.7,eccentricity:0.0151,inclinationRadians:1.075*Math.PI/180,ascendingNodeRadians:0*Math.PI/180,periapsisArgumentRadians:0*Math.PI/180},
 {id:"jupiter",name:"Jupiter",parentId:"sun",massKg:1.8982e27,radiusM:69_911_000,orbitRadiusM:5.2044*AU,periodSeconds:4332.59*86400,phaseRadians:4.1,eccentricity:0.0489,inclinationRadians:1.303*Math.PI/180,ascendingNodeRadians:100.46*Math.PI/180,periapsisArgumentRadians:273.87*Math.PI/180},
 {id:"europa",name:"Europa",parentId:"jupiter",massKg:4.7998e22,radiusM:1_560_800,orbitRadiusM:671_100_000,periodSeconds:3.551181*86400,phaseRadians:1.7,eccentricity:0.009,inclinationRadians:0.47*Math.PI/180,ascendingNodeRadians:0*Math.PI/180,periapsisArgumentRadians:0*Math.PI/180},
 {id:"saturn",name:"Saturn",parentId:"sun",massKg:5.6834e26,radiusM:58_232_000,orbitRadiusM:9.5826*AU,periodSeconds:10759.22*86400,phaseRadians:5.2,eccentricity:0.0565,inclinationRadians:2.485*Math.PI/180,ascendingNodeRadians:113.66*Math.PI/180,periapsisArgumentRadians:339.39*Math.PI/180},
 {id:"titan",name:"Titan",parentId:"saturn",massKg:1.3452e23,radiusM:2_574_700,orbitRadiusM:1_221_870_000,periodSeconds:15.945*86400,phaseRadians:2.8,eccentricity:0.0288,inclinationRadians:0.33*Math.PI/180,ascendingNodeRadians:0*Math.PI/180,periapsisArgumentRadians:0*Math.PI/180}
];
const add=(a:Vector3,b:Vector3):Vector3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const orbitalState=(body:CelestialBody,time:number):{position:Vector3;velocity:Vector3}=>{
 const e=Math.max(0,Math.min(.95,body.eccentricity??0)),n=2*Math.PI/body.periodSeconds,M=body.phaseRadians+n*time;let E=M;
 for(let i=0;i<8;i++)E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
 const a=body.orbitRadiusM,root=Math.sqrt(1-e*e),x=a*(Math.cos(E)-e),y=a*root*Math.sin(E),rate=n/(1-e*Math.cos(E)),vx=-a*Math.sin(E)*rate,vy=a*root*Math.cos(E)*rate;
 const O=body.ascendingNodeRadians??0,w=body.periapsisArgumentRadians??0,I=body.inclinationRadians??0,cO=Math.cos(O),sO=Math.sin(O),cw=Math.cos(w),sw=Math.sin(w),cI=Math.cos(I),sI=Math.sin(I);
 const basisX={x:cO*cw-sO*sw*cI,y:sw*sI,z:sO*cw+cO*sw*cI},basisY={x:-cO*sw-sO*cw*cI,y:cw*sI,z:-sO*sw+cO*cw*cI};
 return{position:{x:basisX.x*x+basisY.x*y,y:basisX.y*x+basisY.y*y,z:basisX.z*x+basisY.z*y},velocity:{x:basisX.x*vx+basisY.x*vy,y:basisX.y*vx+basisY.y*vy,z:basisX.z*vx+basisY.z*vy}};
};
/** Three-dimensional Keplerian ephemerides using eccentricity, inclination, node, and periapsis arguments. */
export function ephemerisAt(timeSeconds:number,bodies:readonly CelestialBody[]=SOLAR_SYSTEM):BodyEphemeris[]{
 const byId=new Map<string,BodyEphemeris>();
 for(const body of bodies){const local=body.parentId?orbitalState(body,timeSeconds):{position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0}};const parent=body.parentId?byId.get(body.parentId):undefined;byId.set(body.id,{...body,position:parent?add(parent.position,local.position):local.position,velocity:parent?add(parent.velocity,local.velocity):local.velocity});}
 return [...byId.values()];
}
/** Newtonian point-mass acceleration from every body; inside a body, radius is clamped to its surface. */
export function gravityAt(position:Vector3,bodies:readonly (Pick<CelestialBody,"massKg"|"radiusM">&{position:Vector3})[]):Vector3{
 let x=0,y=0,z=0;
 for(const body of bodies){const dx=body.position.x-position.x,dy=body.position.y-position.y,dz=body.position.z-position.z;const raw=Math.hypot(dx,dy,dz);if(raw===0)continue;const r=Math.max(raw,body.radiusM),scale=G*body.massKg/(r*r*r);x+=dx*scale;y+=dy*scale;z+=dz*scale;}
 return{x,y,z};
}
export interface TransferWindow { departurePhaseRadians:number; transferSeconds:number; departureWindowSeconds:number; deltaVDepartureMps:number; deltaVArrivalMps:number; }
export function hohmannTransferWindow(originRadiusM:number,targetRadiusM:number,originMu:number,targetMeanMotion:number):TransferWindow{
 if(!(originRadiusM>0&&targetRadiusM>0&&originMu>0&&targetMeanMotion>=0))throw new Error("Transfer orbit inputs must be positive.");
 const a=(originRadiusM+targetRadiusM)/2,transferSeconds=Math.PI*Math.sqrt(a*a*a/originMu),departurePhaseRadians=Math.PI-targetMeanMotion*transferSeconds;
 const vOrigin=Math.sqrt(originMu/originRadiusM),vTransfer=Math.sqrt(originMu*(2/originRadiusM-1/a)),vTarget=Math.sqrt(originMu/targetRadiusM),vArrival=Math.sqrt(originMu*(2/targetRadiusM-1/a));
 const deltaVDepartureMps=Math.abs(vTransfer-vOrigin),deltaVArrivalMps=Math.abs(vTarget-vArrival);
 return{departurePhaseRadians,transferSeconds,departureWindowSeconds:2*Math.PI/Math.max(1e-12,Math.abs(Math.sqrt(originMu/originRadiusM**3)-targetMeanMotion)),deltaVDepartureMps,deltaVArrivalMps};
}

/** Differential third-body acceleration relative to the chosen central body's freely-falling frame. */
export function differentialGravityAt(spacecraftPosition:Vector3,referencePosition:Vector3,timeSeconds:number,centralBodyId="earth"):Vector3{
 const ephemeris=ephemerisAt(timeSeconds),perturbers=ephemeris.filter(body=>body.id!==centralBodyId);
 const atCraft=gravityAt(spacecraftPosition,perturbers),atReference=gravityAt(referencePosition,perturbers);
 return{x:atCraft.x-atReference.x,y:atCraft.y-atReference.y,z:atCraft.z-atReference.z};
}

/** Time to the next occurrence of a required relative orbital phase. */
export function secondsUntilPhase(currentPhaseRadians:number,requiredPhaseRadians:number,relativeMeanMotion:number):number{
 if(!Number.isFinite(currentPhaseRadians)||!Number.isFinite(requiredPhaseRadians)||!Number.isFinite(relativeMeanMotion)||Math.abs(relativeMeanMotion)<1e-14)return Infinity;
 const recurrence=2*Math.PI/Math.abs(relativeMeanMotion),raw=(requiredPhaseRadians-currentPhaseRadians)/relativeMeanMotion;
 return((raw%recurrence)+recurrence)%recurrence;
}
