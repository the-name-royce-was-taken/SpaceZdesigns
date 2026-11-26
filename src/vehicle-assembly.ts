import type { BuildPart, PartKind } from "./vehicle-builder-3d";

export type AttachmentClass = "stack" | "surface";
export interface AttachmentNode {
  id: string;
  attachmentClass: AttachmentClass;
  position: readonly [number, number, number];
  direction: readonly [number, number, number];
}
export interface AttachmentPlacement { x:number; y:number; z:number; parentId:string; parentNode:string; childNode:string; rotationY:number; }
export interface AssemblyIssue { code:"duplicate-id"|"missing-parent"|"self-parent"|"cycle"|"missing-node"|"incompatible-node"; partId:string; message:string; }

const node=(id:string,attachmentClass:AttachmentClass,position:readonly [number,number,number],direction:readonly [number,number,number]):AttachmentNode=>({id,attachmentClass,position,direction});
const rotateY=(v:readonly [number,number,number],a:number):[number,number,number]=>{const c=Math.cos(a),s=Math.sin(a);return [v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c];};
const opposite=(a:readonly number[],b:readonly number[])=>a.length===3&&b.length===3&&Math.abs(a[0]!+b[0]!)<1e-6&&Math.abs(a[1]!+b[1]!)<1e-6&&Math.abs(a[2]!+b[2]!)<1e-6;
const dims:Record<PartKind,readonly [number,number,number]>={capsule:[.9,.9,.9],tank:[.9,1.1,.9],engine:[.85,.8,.85],separator:[1,.22,1],"side-decoupler":[.72,.28,.32],"separator-thruster":[.38,.24,.3],"fuel-line":[.8,.12,.12],fin:[.9,.7,.18],solar:[1.8,.06,.7],wing:[1.7,.12,1.1],control:[1,.1,.42],wheel:[.22,.85,.22],dock:[.42,.28,.42],battery:[.6,.35,.6],rcs:[.4,.32,.4],strut:[.12,1,.12]};
const values=Array.from({length:9},(_,i)=>-1+2*i/8);
function surfaceNodes(kind:PartKind,part?:BuildPart):AttachmentNode[]{
  const [sx,sy,sz]=dims[kind],hx=sx/2,hy=sy/2,hz=sz/2,out:AttachmentNode[]=[];
  if(kind==="tank"){
    const top=Math.max(.08,Math.min(.9,part?.topRadius??.44)),bottom=Math.max(.08,Math.min(.9,part?.bottomRadius??.44));
    // Nine angular columns by nine height rows follow the actual tapered cylindrical wall.
    for(let a=0;a<9;a++)for(let y=0;y<9;y++){const angle=2*Math.PI*a/9,fy=values[y]!,radius=bottom+(top-bottom)*(fy+1)/2;out.push(node(`surface-wall-a${a}-y${y}`,"surface",[Math.cos(angle)*radius,fy*hy,Math.sin(angle)*radius],[Math.cos(angle),0,Math.sin(angle)]));}
    // 9×9 points on each circular end cap, clipped to the actual disk.
    for(const [face,yy,dir] of [["top",hy,[0,1,0]],["bottom",-hy,[0,-1,0]]] as const)for(let x=0;x<9;x++)for(let z=0;z<9;z++){const fx=values[x]!,fz=values[z]!,length=Math.hypot(fx,fz),scale=length>1?1/length:1;const radius=face==="top"?top:bottom;out.push(node(`surface-${face}-x${x}-z${z}`,"surface",[fx*scale*radius,yy,fz*scale*radius],dir));}
    return out;
  }
  const faces=[
    {id:"east",p:(u:number,v:number)=>[number,number,number][hx,u*hy,v*hz],d:[1,0,0] as const},
    {id:"west",p:(u:number,v:number)=>[number,number,number][-hx,u*hy,v*hz],d:[-1,0,0] as const},
    {id:"north",p:(u:number,v:number)=>[number,number,number][u*hx,v*hy,hz],d:[0,0,1] as const},
    {id:"south",p:(u:number,v:number)=>[number,number,number][u*hx,v*hy,-hz],d:[0,0,-1] as const},
    {id:"top",p:(u:number,v:number)=>[number,number,number][u*hx,hy,v*hz],d:[0,1,0] as const},
    {id:"bottom",p:(u:number,v:number)=>[number,number,number][u*hx,-hy,v*hz],d:[0,-1,0] as const}
  ];
  for(const face of faces)for(let row=0;row<9;row++)for(let col=0;col<9;col++)out.push(node(`surface-${face.id}-r${row}-c${col}`,"surface",face.p(values[col]!,values[row]!),face.d));
  return out;
}
export function attachmentNodes(kind:PartKind,part?:BuildPart):AttachmentNode[]{
  if(kind==="fuel-line")return [];
  const [sx,sy,sz]=dims[kind],hx=sx/2,hy=sy/2,hz=sz/2;
  const stack:AttachmentNode[]=[];
  if(kind==="capsule")stack.push(node("stack-top","stack",[0,.75,0],[0,1,0]),node("stack-bottom","stack",[0,-.5,0],[0,-1,0]));
  if(kind==="tank")stack.push(node("stack-top","stack",[0,hy,0],[0,1,0]),node("stack-bottom","stack",[0,-hy,0],[0,-1,0]),node("engine-mount-east","stack",[.9,-hy,0],[0,-1,0]),node("engine-mount-west","stack",[-.9,-hy,0],[0,-1,0]),node("engine-mount-north","stack",[0,-hy,.9],[0,-1,0]),node("engine-mount-south","stack",[0,-hy,-.9],[0,-1,0]));
  if(kind==="engine")stack.push(node("stack-top","stack",[0,.4,0],[0,1,0]));
  if(kind==="separator")stack.push(node("stack-top","stack",[0,.11,0],[0,1,0]),node("stack-bottom","stack",[0,-.11,0],[0,-1,0]));
  if(kind==="strut")stack.push(node("stack-top","stack",[0,.5,0],[0,1,0]),node("stack-bottom","stack",[0,-.5,0],[0,-1,0]));
  return [...stack,...surfaceNodes(kind,part)];
}
export function findAttachmentPlacement(parts:readonly BuildPart[],parentId:string,childKind:PartKind,rotationY=0,reservedParentNodes:readonly string[]=[],childPart?:BuildPart):AttachmentPlacement|null{
 const parent=parts.find(p=>p.id===parentId);if(!parent)return null;
 const pn=attachmentNodes(parent.kind,parent),cn=attachmentNodes(childKind,childPart);
 let best:AttachmentPlacement|null=null,bestScore=Infinity;
 for(const p of pn){if(reservedParentNodes.includes(p.id))continue;const pd=rotateY(p.direction,parent.ry??0),po=rotateY(p.position,parent.ry??0);
  for(const c of cn){if(p.attachmentClass!==c.attachmentClass)continue;const cd=rotateY(c.direction,rotationY);if(!opposite(pd,cd))continue;const co=rotateY(c.position,rotationY);
   const x=(parent.x??0)+po[0]-co[0],y=(parent.y??0)+po[1]-co[1],z=(parent.z??0)+po[2]-co[2];
   const score=(p.attachmentClass==="stack"?-100000:0)+(Math.abs(x-(parent.x??0))+Math.abs(z-(parent.z??0)))*.001;
   if(score<bestScore){bestScore=score;best={x,y,z,parentId,parentNode:p.id,childNode:c.id,rotationY};}
  }
 }
 return best;
}
function occupiedNodes(parts:readonly BuildPart[]){const map=new Map<string,string[]>();for(const p of parts)if(p.parentId&&p.parentNode){const list=map.get(p.parentId)??[];list.push(p.parentNode);map.set(p.parentId,list);}return map;}
export function findAvailableAttachmentPlacement(parts:readonly BuildPart[],childKind:PartKind,preferredParentId?:string,anchor?:readonly [number,number,number]):AttachmentPlacement|null{
 const occupied=occupiedNodes(parts),parents=[...parts].filter(p=>p.id).sort((a,b)=>a.id===preferredParentId?-1:b.id===preferredParentId?1:!anchor?(b.y??0)-(a.y??0):Math.hypot((a.x??0)-anchor[0],(a.y??0)-anchor[1],(a.z??0)-anchor[2])-Math.hypot((b.x??0)-anchor[0],(b.y??0)-anchor[1],(b.z??0)-anchor[2]));
 for(const parent of parents)for(const rotation of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const placement=findAttachmentPlacement(parts,parent.id!,childKind,rotation,occupied.get(parent.id!)??[]);if(placement)return placement;}return null;
}
export function findNearestAttachmentPlacement(parts:readonly BuildPart[],childKind:PartKind,position:readonly [number,number,number],maxDistance=.8,childPart?:BuildPart):AttachmentPlacement|null{
 const occupied=occupiedNodes(parts);let best:AttachmentPlacement|null=null,bestDistance=maxDistance;
 for(const parent of parts){if(!parent.id)continue;for(const rotation of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const placement=findAttachmentPlacement(parts,parent.id,childKind,rotation,occupied.get(parent.id)??[],childPart);if(!placement)continue;const d=Math.hypot(placement.x-position[0],placement.y-position[1],placement.z-position[2]);if(d<bestDistance){best=placement;bestDistance=d;}}}return best;
}
export function validateAssembly(parts:readonly BuildPart[]):AssemblyIssue[]{
 const issues:AssemblyIssue[]=[],byId=new Map<string,BuildPart>();
 for(const p of parts){if(!p.id)continue;if(byId.has(p.id))issues.push({code:"duplicate-id",partId:p.id,message:"Part IDs must be unique."});else byId.set(p.id,p);}
 for(const p of parts){if(!p.parentId)continue;if(p.parentId===p.id){issues.push({code:"self-parent",partId:p.id??"",message:"A part cannot be attached to itself."});continue;}const parent=byId.get(p.parentId);if(!parent){issues.push({code:"missing-parent",partId:p.id??"",message:"The parent part does not exist."});continue;}if(p.parentNode&&p.childNode){const pn=attachmentNodes(parent.kind,parent).find(n=>n.id===p.parentNode),cn=attachmentNodes(p.kind,p).find(n=>n.id===p.childNode);if(!pn||!cn)issues.push({code:"missing-node",partId:p.id??"",message:"The saved attachment node no longer exists."});else if(pn.attachmentClass!==cn.attachmentClass)issues.push({code:"incompatible-node",partId:p.id??"",message:"The saved attachment nodes are incompatible."});}}
 for(const p of parts){const seen=new Set<string>();let current:BuildPart|undefined=p;while(current?.parentId){if(seen.has(current.parentId)){issues.push({code:"cycle",partId:p.id??"",message:"Attachment hierarchy contains a cycle."});break;}seen.add(current.parentId);current=byId.get(current.parentId);if(!current)break;}}
 return issues;
}
export function canAttach(parts:readonly BuildPart[],parentId:string,childKind:PartKind){return findAttachmentPlacement(parts,parentId,childKind)!==null;}
