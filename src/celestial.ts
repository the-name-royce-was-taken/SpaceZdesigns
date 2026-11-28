export interface Vector3 { x:number; y:number; z:number; }
export interface CelestialBody { id:string; name:string; parentId:string|null; massKg:number; radiusM:number; orbitRadiusM:number; periodSeconds:number; phaseRadians:number; }
export interface BodyEphemeris extends CelestialBody { position:Vector3; velocity:Vector3; }
export const G=6.67430e-11;
export const AU=149_597_870_700;
export const SOLAR_SYSTEM:readonly CelestialBody[]=[
 {id:"sun",name:"Sun",parentId:null,massKg:1.98847e30,radiusM:695_700_000,orbitRadiusM:0,periodSeconds:1,phaseRadians:0},
 {id:"mercury",name:"Mercury",parentId:"sun",massKg:3.3011e23,radiusM:2_439_700,orbitRadiusM:.387098*AU,periodSeconds:87.969*86400,phaseRadians:.2},
 {id:"venus",name:"Venus",parentId:"sun",massKg:4.8675e24,radiusM:6_051_800,orbitRadiusM:.723332*AU,periodSeconds:224.701*86400,phaseRadians:1.1},
 {id:"earth",name:"Earth",parentId:"sun",massKg:5.97237e24,radiusM:6_371_000,orbitRadiusM:AU,periodSeconds:365.256*86400,phaseRadians:0},
 {id:"moon",name:"Luna",parentId:"earth",massKg:7.342e22,radiusM:1_737_400,orbitRadiusM:384_400_000,periodSeconds:27.321661*86400,phaseRadians:2.4},
 {id:"mars",name:"Mars",parentId:"sun",massKg:6.4171e23,radiusM:3_389_500,orbitRadiusM:1.523679*AU,periodSeconds:686.98*86400,phaseRadians:2.0},
 {id:"phobos",name:"Phobos",parentId:"mars",massKg:1.0659e16,radiusM:11_267,orbitRadiusM:9_376_000,periodSeconds:7.6538*3600,phaseRadians:.7},
 {id:"jupiter",name:"Jupiter",parentId:"sun",massKg:1.8982e27,radiusM:69_911_000,orbitRadiusM:5.2044*AU,periodSeconds:4332.59*86400,phaseRadians:4.1},
 {id:"europa",name:"Europa",parentId:"jupiter",massKg:4.7998e22,radiusM:1_560_800,orbitRadiusM:671_100_000,periodSeconds:3.551181*86400,phaseRadians:1.7},
 {id:"saturn",name:"Saturn",parentId:"sun",massKg:5.6834e26,radiusM:58_232_000,orbitRadiusM:9.5826*AU,periodSeconds:10759.22*86400,phaseRadians:5.2},
 {id:"titan",name:"Titan",parentId:"saturn",massKg:1.3452e23,radiusM:2_574_700,orbitRadiusM:1_221_870_000,periodSeconds:15.945*86400,phaseRadians:2.8}
];
const add=(a:Vector3,b:Vector3):Vector3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const circular=(radius:number,period:number,phase:number,time:number):{position:Vector3;velocity:Vector3}=>{
 const n=2*Math.PI/period,a=phase+n*time;
 return{position:{x:radius*Math.cos(a),y:0,z:radius*Math.sin(a)},velocity:{x:-radius*n*Math.sin(a),y:0,z:radius*n*Math.cos(a)}};
};
/** Circular, coplanar ephemerides seeded with real mean orbital radii and periods. */
export function ephemerisAt(timeSeconds:number,bodies:readonly CelestialBody[]=SOLAR_SYSTEM):BodyEphemeris[]{
 const byId=new Map<string,BodyEphemeris>();
 for(const body of bodies){const local=body.parentId?circular(body.orbitRadiusM,body.periodSeconds,body.phaseRadians,timeSeconds):{position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0}};const parent=body.parentId?byId.get(body.parentId):undefined;byId.set(body.id,{...body,position:parent?add(parent.position,local.position):local.position,velocity:parent?add(parent.velocity,local.velocity):local.velocity});}
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
