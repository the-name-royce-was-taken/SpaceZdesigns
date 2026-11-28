import type { BuildPart } from "./vehicle-builder-3d";
export interface PartComponent { partIds:string[]; parts:BuildPart[]; commandable:boolean; }
const DIMENSIONS:Record<BuildPart["kind"],[number,number,number]>={
 capsule:[.98,1.25,.98],tank:[.88, .96,.88],engine:[.75,1.36,.75],separator:[1,.2,1],"side-decoupler":[.72,.34,.38],"separator-thruster":[.38,.24,.3],"fuel-line":[.12,.12,.12],fin:[.9,.7,.18],solar:[2.4,.12,.72],wing:[1.7,.12,1.1],control:[1,.1,.42],wheel:[.5,.72,.5],dock:[.56,.28,.56],battery:[.6,.35,.6],"remote-control":[.56,.28,.56],"reaction-wheel":[.56,.28,.56],rcs:[.4,.32,.4],strut:[.12,1,.12],"nose-cone":[.88,.8,.88],fairing:[.88,1.15,.88],"conical-fairing":[.88,1.15,.88],"interstage-fairing":[.88,1.15,.88],"clam-shell-fairing":[.88,1.15,.88],airbrake:[.7,.5,.5],strake:[.18,.8,.42],"landing-leg":[.3,1.05,.3],"heat-shield":[1,.18,1],"rover-wheel":[.65,.55,.3],"structural-beam":[.28,1.2,.28],"structural-angle":[.55,.55,.22],"structural-hub":[.48,.48,.48]
};
function halfExtents(p:BuildPart):[number,number,number]{
 const d=[...DIMENSIONS[p.kind]] as [number,number,number];
 if(p.kind==="tank")d[1]=p.height??.96;
 if(p.kind==="structural-beam")d[1]=Math.max(1,Math.min(12,Math.round(p.structuralLength??3)))*.4;
 if(p.kind==="heat-shield")d[1]=p.thickness??.16;
 if(p.kind==="remote-control"||p.kind==="reaction-wheel")d[1]=.28;
 if(p.kind==="solar")d[0]=p.solarLength??2.4;
 const c=Math.abs(Math.cos(p.ry??0)),s=Math.abs(Math.sin(p.ry??0));
 return[(d[0]*c+d[2]*s)/2,d[1]/2,(d[0]*s+d[2]*c)/2];
}
function touching(a:BuildPart,b:BuildPart,tolerance:number):boolean{
 if(a.kind==="fuel-line"||b.kind==="fuel-line")return false;
 const ah=halfExtents(a),bh=halfExtents(b),ax=a.x??0,ay=a.y??0,az=a.z??0,bx=b.x??0,by=b.y??0,bz=b.z??0;
 return Math.abs(ax-bx)<=ah[0]+bh[0]+tolerance&&Math.abs(ay-by)<=ah[1]+bh[1]+tolerance&&Math.abs(az-bz)<=ah[2]+bh[2]+tolerance;
}
/** Returns physically connected rigid groups. Saved attachment links count as joints; coincident touching hulls also connect. */
export function connectedPartComponents(parts:readonly BuildPart[],tolerance=.035):PartComponent[]{
 const parent=parts.map((_,i)=>i),find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]!));
 const join=(a:number,b:number)=>{const ra=find(a),rb=find(b);if(ra!==rb)parent[rb]=ra;};
 const byId=new Map(parts.map((p,i)=>[p.id,i] as const));
 for(let i=0;i<parts.length;i++){const p=parts[i]!;const pi=p.parentId?byId.get(p.parentId):undefined;if(pi!==undefined)join(i,pi);for(let j=0;j<i;j++)if(touching(p,parts[j]!,tolerance))join(i,j);}
 const groups=new Map<number,BuildPart[]>();parts.forEach((p,i)=>{const root=find(i),list=groups.get(root)??[];list.push(p);groups.set(root,list);});
 return [...groups.values()].map(group=>({parts:group,partIds:group.flatMap(p=>p.id?[p.id]:[]),commandable:group.some(p=>p.kind==="capsule"||p.kind==="remote-control")}));
}
