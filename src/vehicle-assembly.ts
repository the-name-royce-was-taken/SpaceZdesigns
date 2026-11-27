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
const rotatePart=(v:readonly [number,number,number],part:Pick<BuildPart,"rx"|"ry"|"rz">):[number,number,number]=>{const x=part.rx??0,y=part.ry??0,z=part.rz??0,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);return [cy*cz*v[0]-cy*sz*v[1]+sy*v[2],(sx*sy*cz+cx*sz)*v[0]+(cx*cz-sx*sy*sz)*v[1]-sx*cy*v[2],(sx*sz-cx*sy*cz)*v[0]+(sx*cz+cx*sy*sz)*v[1]+cx*cy*v[2]];};
const opposite=(a:readonly number[],b:readonly number[])=>a.length===3&&b.length===3&&Math.abs(a[0]!+b[0]!)<1e-6&&Math.abs(a[1]!+b[1]!)<1e-6&&Math.abs(a[2]!+b[2]!)<1e-6;
const dims:Record<PartKind,readonly [number,number,number]>={capsule:[.9,.9,.9],tank:[.9,.96,.9],engine:[.85,.8,.85],separator:[1,.22,1],"side-decoupler":[.72,.28,.32],"separator-thruster":[.38,.24,.3],"fuel-line":[.8,.12,.12],fin:[.9,.7,.18],solar:[2.4,.06,.72],wing:[1.7,.12,1.1],control:[1,.1,.42],wheel:[.22,.85,.22],dock:[.42,.28,.42],battery:[.6,.35,.6],rcs:[.4,.32,.4],strut:[.12,1,.12],"nose-cone":[.88,.8,.88],fairing:[.88,1.15,.88],airbrake:[.7,.5,.5],strake:[.18,.8,.42],"conical-fairing":[.88,1.15,.88],"interstage-fairing":[.88,1.15,.88],"clam-shell-fairing":[.88,1.15,.88],"landing-leg":[.3,1.05,.3],"heat-shield":[1,.16,1],"rover-wheel":[.65,.55,.3]};
const isFairingKind=(kind:PartKind)=>kind==="fairing"||kind==="conical-fairing"||kind==="interstage-fairing"||kind==="clam-shell-fairing";
const defaultFairingHeight=(kind:PartKind)=>isFairingKind(kind)?1.15:.8;
const ATTACHMENT_GRID_CUBE_SIZE=.16/1.5;
const centeredOffsets=(halfExtent:number)=>{const steps=Math.floor((halfExtent+1e-8)/ATTACHMENT_GRID_CUBE_SIZE);return Array.from({length:steps*2+1},(_,i)=>(i-steps)*ATTACHMENT_GRID_CUBE_SIZE);};
const isCenterSurfaceNode=(n:AttachmentNode)=>{const p=n.position,d=n.direction,dot=p[0]*d[0]+p[1]*d[1]+p[2]*d[2];return Math.hypot(p[0]-dot*d[0],p[1]-dot*d[1],p[2]-dot*d[2])<1e-6;};
export function tankFuelCapacity(part:Pick<BuildPart,"topRadius"|"bottomRadius"|"height">):number{
 const top=Math.max(.08,Math.min(.9,part.topRadius??.44)),bottom=Math.max(.08,Math.min(.9,part.bottomRadius??.44)),height=Math.max(.25,Math.min(3,part.height??.96));
 const volume=Math.PI*height*(top*top+top*bottom+bottom*bottom)/3,reference=Math.PI*.96*.44*.44;
 return 120*volume/reference;
}
function surfaceNodes(kind:PartKind,part?:BuildPart):AttachmentNode[]{
  const [baseX,sy,sz]=dims[kind],sx=kind==="solar"?Math.max(.8,Math.min(8,part?.solarLength??2.4)):baseX,hx=sx/2,hy=(kind==="tank"||kind==="nose-cone"||isFairingKind(kind))?Math.max(.25,Math.min(3,part?.height??defaultFairingHeight(kind)))/2:sy/2,hz=sz/2,out:AttachmentNode[]=[];
  const addGrid=(face:string,uValues:number[],vValues:number[],point:(u:number,v:number)=>[number,number,number],direction:(u:number,v:number)=>[number,number,number],inside?:(u:number,v:number)=>boolean)=>{
    for(let row=0;row<vValues.length;row++)for(let col=0;col<uValues.length;col++){const u=uValues[col]!,v=vValues[row]!;if(!inside||inside(u,v)){const p=point(u,v),d=direction(u,v);out.push(node(`surface-${face}-r${row}-c${col}`,"surface",p,d));}}
  };
  const disk=(face:"top"|"bottom",radius:number,y:number,dy:number)=>{
    const offsets=centeredOffsets(radius);
    addGrid(face,offsets,offsets,(x,z)=>[x,y,z],()=>[0,dy,0],(x,z)=>Math.hypot(x,z)<=radius+1e-8);
  };
  if(kind==="tank"||kind==="engine"||kind==="separator"||kind==="dock"||kind==="wheel"||kind==="heat-shield"||kind==="capsule"||kind==="nose-cone"||isFairingKind(kind)){
    const top=kind==="heat-shield"?Math.max(.2,Math.min(1.8,part?.radius??.62)):kind==="tank"?Math.max(.08,Math.min(.9,part?.topRadius??.44)):kind==="interstage-fairing"?Math.max(.08,Math.min(.9,part?.bottomRadius??.44))*.78:(kind==="nose-cone"||isFairingKind(kind))?.02:kind==="engine"?.19:kind==="separator"?.5:kind==="dock"?.22:kind==="wheel"?.2:.43;
    const bottom=kind==="heat-shield"?Math.max(.2,Math.min(1.8,part?.radius??.62)):kind==="tank"||kind==="nose-cone"||isFairingKind(kind)?Math.max(.08,Math.min(.9,part?.bottomRadius??.44)):kind==="engine"?.43:kind==="separator"?.5:kind==="dock"?.28:kind==="wheel"?.2:.49;
    const yTop=kind==="capsule"?.23:kind==="engine"?.31:kind==="dock"?.13:kind==="wheel"?.425:kind==="heat-shield"?(part?.thickness??.16)/2:hy;
    const yBottom=kind==="capsule"?-.445:kind==="engine"?-.35:kind==="dock"?-.11:kind==="wheel"?-.425:kind==="heat-shield"?-(part?.thickness??.16)/2:-hy;
    // Curved surfaces use the same fixed cube pitch as flat faces. The grid is
    // centered at the part origin and grows outward to within one cell of its bounds.
    const yOffsets=centeredOffsets(Math.max(Math.abs(yBottom),Math.abs(yTop))).filter(y=>y>=yBottom-1e-8&&y<=yTop+1e-8);
    const maxRadius=Math.max(top,bottom),angleCount=Math.max(8,Math.ceil(2*Math.PI*maxRadius/ATTACHMENT_GRID_CUBE_SIZE));
    for(let a=0;a<angleCount;a++)for(let row=0;row<yOffsets.length;row++){
      const angle=2*Math.PI*a/angleCount,y=yOffsets[row]!;
      const t=(y-yBottom)/(yTop-yBottom);
      let radius=bottom+(top-bottom)*t;
      if(kind==="capsule"&&y>.23)radius=Math.max(.015,.43*(1-(y-.23)/.52));
      if(kind==="engine")radius=.43+(.19-.43)*(y-yBottom)/(yTop-yBottom);
      if(kind==="nose-cone"||kind==="conical-fairing")radius=bottom*(1-t);
      if(kind==="interstage-fairing")radius=bottom*(1-.22*t);
      if(kind==="fairing"||kind==="clam-shell-fairing")radius=bottom*Math.sqrt(Math.max(0,1-t*t));
      out.push(node(`surface-wall-a${a}-y${row}`,"surface",[Math.cos(angle)*radius,y,Math.sin(angle)*radius],[Math.cos(angle),0,Math.sin(angle)]));
    }
    if(kind==="tank"){disk("top",top,yTop,1);disk("bottom",bottom,yBottom,-1);}
    else if(kind==="nose-cone"||isFairingKind(kind))disk("bottom",bottom,yBottom,-1);
    else if(kind==="capsule")disk("bottom",.49,-.445,-1);
    else if(kind==="separator"){disk("top",.5,hy,1);disk("bottom",.5,-hy,-1);}
    else if(kind==="dock"){disk("top",.22,.13,1);disk("bottom",.28,-.11,-1);}
    else if(kind==="wheel"){disk("top",.2,.425,1);disk("bottom",.2,-.425,-1);}
    else if(kind==="engine")disk("top",.19,.31,1);
    else if(kind==="heat-shield"){disk("top",top,yTop,1);disk("bottom",bottom,yBottom,-1);}
    return out;
  }
  // Flat faces share a fixed-pitch cube lattice, centered on the part origin.
  const xOffsets=centeredOffsets(hx),yOffsets=centeredOffsets(hy),zOffsets=centeredOffsets(hz);
  const faces=[
    {id:"east",u:yOffsets,v:zOffsets,p:(u:number,v:number):[number,number,number]=>[hx,u,v],d:[1,0,0] as const},
    {id:"west",u:yOffsets,v:zOffsets,p:(u:number,v:number):[number,number,number]=>[-hx,u,v],d:[-1,0,0] as const},
    {id:"north",u:xOffsets,v:yOffsets,p:(u:number,v:number):[number,number,number]=>[u,v,hz],d:[0,0,1] as const},
    {id:"south",u:xOffsets,v:yOffsets,p:(u:number,v:number):[number,number,number]=>[u,v,-hz],d:[0,0,-1] as const},
    {id:"top",u:xOffsets,v:zOffsets,p:(u:number,v:number):[number,number,number]=>[u,hy,v],d:[0,1,0] as const},
    {id:"bottom",u:xOffsets,v:zOffsets,p:(u:number,v:number):[number,number,number]=>[u,-hy,v],d:[0,-1,0] as const}
  ];
  for(const face of faces)addGrid(face.id,face.u,face.v,face.p,()=>[...face.d] as [number,number,number]);
  return out;
}
export function attachmentNodes(kind:PartKind,part?:BuildPart):AttachmentNode[]{
  if(kind==="fuel-line")return [];
  const stack:AttachmentNode[]=[];
  if(kind==="capsule")stack.push(node("stack-top","stack",[0,.75,0],[0,1,0]),node("stack-bottom","stack",[0,-.445,0],[0,-1,0]));
  if(kind==="tank"){const h=Math.max(.25,Math.min(3,part?.height??.96))/2,r=Math.max(part?.topRadius??.44,part?.bottomRadius??.44);stack.push(node("stack-top","stack",[0,h,0],[0,1,0]),node("stack-bottom","stack",[0,-h,0],[0,-1,0]),node("engine-mount-east","stack",[r+.46,-h,0],[0,-1,0]),node("engine-mount-west","stack",[-r-.46,-h,0],[0,-1,0]),node("engine-mount-north","stack",[0,-h,r+.46],[0,-1,0]),node("engine-mount-south","stack",[0,-h,-r-.46],[0,-1,0]));}
  if(kind==="nose-cone"||isFairingKind(kind))stack.push(node("stack-bottom","stack",[0,-Math.max(.25,Math.min(3,part?.height??defaultFairingHeight(kind)))/2,0],[0,-1,0]));
  if(kind==="engine")stack.push(node("stack-top","stack",[0,.48,0],[0,1,0]));
  if(kind==="heat-shield"){const h=Math.max(.04,Math.min(.5,part?.thickness??.16))/2;stack.push(node("stack-top","stack",[0,h,0],[0,1,0]),node("stack-bottom","stack",[0,-h,0],[0,-1,0]));}
  if(kind==="separator")stack.push(node("stack-top","stack",[0,.1,0],[0,1,0]),node("stack-bottom","stack",[0,-.1,0],[0,-1,0]));
  if(kind==="strut")stack.push(node("stack-top","stack",[0,.5,0],[0,1,0]),node("stack-bottom","stack",[0,-.5,0],[0,-1,0]));
  return [...stack,...surfaceNodes(kind,part)];
}
export function findAttachmentPlacement(parts:readonly BuildPart[],parentId:string,childKind:PartKind,rotationY=0,reservedParentNodes:readonly string[]=[],childPart?:BuildPart):AttachmentPlacement|null{
 const parent=parts.find(p=>p.id===parentId);if(!parent)return null;
 const pn=attachmentNodes(parent.kind,parent),cn=attachmentNodes(childKind,childPart);
 let best:AttachmentPlacement|null=null,bestScore=Infinity;
 for(const p of pn){if(reservedParentNodes.includes(p.id))continue;const pd=rotateY(p.direction,parent.ry??0),po=rotateY(p.position,parent.ry??0);
  for(const c of cn){if(p.attachmentClass!==c.attachmentClass)continue;
   let resolvedRotation=rotationY,cd=rotateY(c.direction,resolvedRotation);
   if(!opposite(pd,cd)&&p.attachmentClass==="surface"&&Math.abs(pd[1])<1e-6&&Math.abs(c.direction[1])<1e-6){
    resolvedRotation=Math.atan2(c.direction[2],c.direction[0])-Math.atan2(pd[2],pd[0])-Math.PI;
    cd=rotateY(c.direction,resolvedRotation);
   }
   if(!opposite(pd,cd))continue;const co=rotateY(c.position,resolvedRotation);
   const x=(parent.x??0)+po[0]-co[0],y=(parent.y??0)+po[1]-co[1],z=(parent.z??0)+po[2]-co[2];
   const score=(p.attachmentClass==="stack"?-100000:0)+(Math.abs(x-(parent.x??0))+Math.abs(z-(parent.z??0)))*.001;
   if(score<bestScore){bestScore=score;best={x,y,z,parentId,parentNode:p.id,childNode:c.id,rotationY:resolvedRotation};}
  }
 }
 return best;
}
function occupiedNodes(parts:readonly BuildPart[]){const map=new Map<string,string[]>();for(const p of parts)if(p.parentId&&p.parentNode){const list=map.get(p.parentId)??[];list.push(p.parentNode);map.set(p.parentId,list);}return map;}
export function findAvailableAttachmentPlacement(parts:readonly BuildPart[],childKind:PartKind,preferredParentId?:string,anchor?:readonly [number,number,number]):AttachmentPlacement|null{
 const occupied=occupiedNodes(parts),parents=[...parts].filter(p=>p.id).sort((a,b)=>a.id===preferredParentId?-1:b.id===preferredParentId?1:!anchor?(b.y??0)-(a.y??0):Math.hypot((a.x??0)-anchor[0],(a.y??0)-anchor[1],(a.z??0)-anchor[2])-Math.hypot((b.x??0)-anchor[0],(b.y??0)-anchor[1],(b.z??0)-anchor[2]));
 for(const parent of parents){
  const nodes=attachmentNodes(parent.kind,parent),used=occupied.get(parent.id!)??[];
  const usedWallAngles=used.map(id=>/^surface-wall-a(\d+)-y\d+$/.exec(id)).filter(Boolean).map(match=>Number(match![1]));
  const candidates=nodes.filter(n=>n.attachmentClass==="stack"||(n.attachmentClass==="surface"&&isCenterSurfaceNode(n)));
  let best:AttachmentPlacement|null=null,bestScore=Infinity;
  for(const candidate of candidates){
   if(used.includes(candidate.id))continue;
   const parentDirection=rotateY(candidate.direction,parent.ry??0),parentPosition=rotateY(candidate.position,parent.ry??0);
   let chosen:AttachmentNode|null=null,normalScore=Infinity,chosenCenterDistance=Infinity;
   for(const childNode of attachmentNodes(childKind).filter(n=>n.attachmentClass===candidate.attachmentClass)){
    const childDirection=rotateY(childNode.direction,0);
    if(candidate.attachmentClass==="stack"&&!opposite(parentDirection,childDirection))continue;
    const alignment=parentDirection[0]*childDirection[0]+parentDirection[1]*childDirection[1]+parentDirection[2]*childDirection[2];
    const score=candidate.attachmentClass==="stack"?0:1+alignment;
    const centerDistance=Math.hypot(...childNode.position);
    if(score<normalScore-1e-9||(candidate.attachmentClass==="surface"&&Math.abs(score-normalScore)<=1e-9&&centerDistance<chosenCenterDistance)){
     normalScore=score;chosen=childNode;chosenCenterDistance=centerDistance;
    }
   }
   if(!chosen)continue;
   const childPosition=rotateY(chosen.position,0);
   const placement:AttachmentPlacement={x:(parent.x??0)+parentPosition[0]-childPosition[0],y:(parent.y??0)+parentPosition[1]-childPosition[1],z:(parent.z??0)+parentPosition[2]-childPosition[2],parentId:parent.id!,parentNode:candidate.id,childNode:chosen.id,rotationY:0};
   let score=normalScore;
   if(candidate.attachmentClass==="stack")score-=10000;
   const wall=/^surface-wall-a(\d+)-y\d+$/.exec(candidate.id);
   if(wall&&usedWallAngles.length){const angle=Number(wall[1]),angleCount=nodes.reduce((max,n)=>{const match=/^surface-wall-a(\d+)-y\d+$/.exec(n.id);return match?Math.max(max,Number(match[1])+1):max;},0);const separation=Math.min(...usedWallAngles.map(other=>{const delta=Math.abs(angle-other);return Math.min(delta,angleCount-delta);}));score-=separation*100;}
   if(score<bestScore){bestScore=score;best=placement;}
  }
  if(best)return best;
 }
 return null;
}
export function findNearestAttachmentPlacement(parts:readonly BuildPart[],childKind:PartKind,position:readonly [number,number,number],maxDistance=.16,childPart?:BuildPart,axis?:string):AttachmentPlacement|null{
 const occupied=occupiedNodes(parts),cn=attachmentNodes(childKind,childPart);
 let best:AttachmentPlacement|null=null,bestDistance=Infinity;
 for(const parent of parts){
  if(!parent.id)continue;
  const parentDistance=Math.hypot((parent.x??0)-position[0],(parent.y??0)-position[1],(parent.z??0)-position[2]);
  if(parentDistance>maxDistance+2.2)continue;
  const reserved=occupied.get(parent.id)??[],pn=attachmentNodes(parent.kind,parent);
  for(const p of pn){
   if(reserved.includes(p.id))continue;
   const pd=rotatePart(p.direction,parent),po=rotatePart(p.position,parent);
   for(const c of cn){
    if(p.attachmentClass!==c.attachmentClass)continue;
    const cd=rotatePart(c.direction,childPart??{});
    // Stack joints must face one another. Surface snapping keeps the existing
    // fixed-size centered surface lattice and ranks the closest available contact normals,
    // rather than rejecting the other grid points and breaking surface snaps.
    if(p.attachmentClass==="stack"&&!opposite(pd,cd))continue;
    const co=rotatePart(c.position,childPart??{});
    const x=(parent.x??0)+po[0]-co[0],y=(parent.y??0)+po[1]-co[1],z=(parent.z??0)+po[2]-co[2];
    const delta:[number,number,number]=[x-position[0],y-position[1],z-position[2]];
    const axisIndex=axis==="X"?0:axis==="Y"?1:axis==="Z"?2:-1;
    const offAxisDistance=axisIndex<0?0:Math.hypot(...delta.filter((_,index)=>index!==axisIndex));
    const distance=axisIndex<0?Math.hypot(...delta):Math.abs(delta[axisIndex as 0|1|2]!);
    const normalPenalty=p.attachmentClass==="surface"?1+(pd[0]*cd[0]+pd[1]*cd[1]+pd[2]*cd[2]):0;
    const score=distance+normalPenalty*.02;
    if(distance<=maxDistance&&(axisIndex<0||offAxisDistance<=ATTACHMENT_GRID_CUBE_SIZE/2)&&score<bestDistance){bestDistance=score;best={x,y,z,parentId:parent.id,parentNode:p.id,childNode:c.id,rotationY:childPart?.ry??0};}
   }
  }
 }
 return best;
}

export function validateAssembly(parts:readonly BuildPart[]):AssemblyIssue[]{
 const issues:AssemblyIssue[]=[],byId=new Map<string,BuildPart>();
 for(const p of parts){if(!p.id)continue;if(byId.has(p.id))issues.push({code:"duplicate-id",partId:p.id,message:"Part IDs must be unique."});else byId.set(p.id,p);}
 for(const p of parts){if(!p.parentId)continue;if(p.parentId===p.id){issues.push({code:"self-parent",partId:p.id??"",message:"A part cannot be attached to itself."});continue;}const parent=byId.get(p.parentId);if(!parent){issues.push({code:"missing-parent",partId:p.id??"",message:"The parent part does not exist."});continue;}if(p.parentNode&&p.childNode){const pn=attachmentNodes(parent.kind,parent).find(n=>n.id===p.parentNode),cn=attachmentNodes(p.kind,p).find(n=>n.id===p.childNode);if(!pn||!cn)issues.push({code:"missing-node",partId:p.id??"",message:"The saved attachment node no longer exists."});else if(pn.attachmentClass!==cn.attachmentClass)issues.push({code:"incompatible-node",partId:p.id??"",message:"The saved attachment nodes are incompatible."});}}
 for(const p of parts){const seen=new Set<string>();let current:BuildPart|undefined=p;while(current?.parentId){if(seen.has(current.parentId)){issues.push({code:"cycle",partId:p.id??"",message:"Attachment hierarchy contains a cycle."});break;}seen.add(current.parentId);current=byId.get(current.parentId);if(!current)break;}}
 return issues;
}
export function canAttach(parts:readonly BuildPart[],parentId:string,childKind:PartKind){return findAttachmentPlacement(parts,parentId,childKind)!==null;}
