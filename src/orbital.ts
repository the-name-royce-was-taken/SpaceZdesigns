export interface OrbitState { altitude:number; vx:number; vy:number; }
export interface OrbitPrediction { valid:boolean; escaped:boolean; circularSpeed:number; orbitalSpeed:number; periapsisAltitude:number|null; apoapsisAltitude:number|null; periodSeconds:number|null; eccentricity:number|null; }
export function predictOrbit(state:OrbitState,bodyRadiusKm=6371,mu=3.986004418e14):OrbitPrediction{
 const radius=bodyRadiusKm*1000+Math.max(0,state.altitude),speed=Math.hypot(state.vx,state.vy),circularSpeed=Math.sqrt(mu/radius),energy=speed*speed/2-mu/radius,angularMomentum=radius*state.vx,eccentricity=Math.sqrt(Math.max(0,1+(2*energy*angularMomentum*angularMomentum)/(mu*mu)));
 if(!Number.isFinite(energy)||!Number.isFinite(eccentricity)||speed<1)return{valid:false,escaped:false,circularSpeed,orbitalSpeed:speed,periapsisAltitude:null,apoapsisAltitude:null,periodSeconds:null,eccentricity:null};
 if(energy>=0)return{valid:true,escaped:true,circularSpeed,orbitalSpeed:speed,periapsisAltitude:Math.max(0,(angularMomentum*angularMomentum/(mu*(1+eccentricity))-bodyRadiusKm*1000)/1000),apoapsisAltitude:null,periodSeconds:null,eccentricity};
 const a=-mu/(2*energy),peri=a*(1-eccentricity),apo=a*(1+eccentricity);
 return{valid:true,escaped:false,circularSpeed,orbitalSpeed:speed,periapsisAltitude:(peri-bodyRadiusKm*1000)/1000,apoapsisAltitude:(apo-bodyRadiusKm*1000)/1000,periodSeconds:2*Math.PI*Math.sqrt(a**3/mu),eccentricity};
}
export function formatDuration(seconds:number|null):string{if(seconds===null||!Number.isFinite(seconds))return"—";if(seconds<3600)return Math.round(seconds/60)+" min";if(seconds<86400)return(seconds/3600).toFixed(1)+" hr";return(seconds/86400).toFixed(1)+" days";}
