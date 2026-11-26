import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { findAvailableAttachmentPlacement, findNearestAttachmentPlacement, validateAssembly } from "./vehicle-assembly";

export type EngineType = "liquid" | "solid" | "ion" | "methalox" | "hydrolox";
export const engineVariants: {id:EngineType;name:string;description:string;accent:number;thrustKN:number;ispSeconds:number}[] = [
 {id:"liquid",name:"Liquid Fuel",description:"Restartable liquid propellant",accent:0xd28a4f,thrustKN:34,ispSeconds:285},
 {id:"solid",name:"Solid Rocket",description:"Simple solid-propellant motor",accent:0xb95d3e,thrustKN:34,ispSeconds:285},
 {id:"ion",name:"Ion Drive",description:"Electric propulsion package",accent:0x4f9bd0,thrustKN:34,ispSeconds:285},
 {id:"methalox",name:"Methalox Engine",description:"Methane and oxygen cycle",accent:0x71a78e,thrustKN:34,ispSeconds:285},
 {id:"hydrolox",name:"Hydrolox Engine",description:"Hydrogen and oxygen cycle",accent:0x91c8d8,thrustKN:34,ispSeconds:285}
];
export type PartKind = "capsule" | "tank" | "engine" | "separator" | "fin" | "solar" | "wing" | "control" | "wheel" | "dock" | "battery" | "rcs" | "strut";
export interface BuildPart {
  kind: PartKind;
  id?: string;
  x?: number; y?: number; z?: number;
  rx?: number; ry?: number; rz?: number;
  parentId?: string;
  parentNode?: string;
  childNode?: string;
  engineType?: EngineType;
  engineStage?: number;
}
interface PartSpec {kind:PartKind;name:string;category:string;mass:number;fuel:number;thrust:number;color:number;size:THREE.Vector3}
const parts:PartSpec[]=[
 {kind:"capsule",name:"Command pod",category:"Command",mass:1.2,fuel:0,thrust:0,color:0xdce8ef,size:new THREE.Vector3(.9,.9,.9)},
 {kind:"tank",name:"Fuel tank",category:"Propulsion",mass:.8,fuel:120,thrust:0,color:0xb7c8d5,size:new THREE.Vector3(.9,1.1,.9)},
 {kind:"engine",name:"Liquid engine",category:"Propulsion",mass:.7,fuel:0,thrust:34,color:0xe6a65e,size:new THREE.Vector3(.85,.8,.85)},
 {kind:"separator",name:"Stack decoupler",category:"Structural",mass:.15,fuel:0,thrust:0,color:0xe5c56d,size:new THREE.Vector3(1,.22,1)},
 {kind:"fin",name:"Stability fin",category:"Aerodynamics",mass:.12,fuel:0,thrust:0,color:0x6c9db8,size:new THREE.Vector3(.9,.7,.18)},
 {kind:"wing",name:"Wing panel",category:"Aerodynamics",mass:.24,fuel:0,thrust:0,color:0x759bb7,size:new THREE.Vector3(1.7,.12,1.1)},
 {kind:"control",name:"Elevon",category:"Aerodynamics",mass:.09,fuel:0,thrust:0,color:0xd1a66b,size:new THREE.Vector3(1,.1,.42)},
 {kind:"wheel",name:"Landing gear",category:"Utility",mass:.16,fuel:0,thrust:0,color:0x8798a8,size:new THREE.Vector3(.22,.85,.22)},
 {kind:"solar",name:"Solar array",category:"Utility",mass:.08,fuel:0,thrust:0,color:0x4b91bb,size:new THREE.Vector3(1.8,.06,.7)},
 {kind:"battery",name:"Battery pack",category:"Utility",mass:.1,fuel:0,thrust:0,color:0x8d9b68,size:new THREE.Vector3(.6,.35,.6)},
 {kind:"dock",name:"Docking port",category:"Utility",mass:.12,fuel:0,thrust:0,color:0xc2cbd1,size:new THREE.Vector3(.42,.28,.42)},
 {kind:"rcs",name:"RCS thruster",category:"Propulsion",mass:.07,fuel:0,thrust:0,color:0x9caeba,size:new THREE.Vector3(.4,.32,.4)},
 {kind:"strut",name:"Structural girder",category:"Structural",mass:.04,fuel:0,thrust:0,color:0xb7a88d,size:new THREE.Vector3(.12,1,.12)}
];
export const partCatalog=parts;
const clone=(a:BuildPart[])=>a.map(p=>({...p}));
export function mountVehicleBuilder(host:HTMLElement,initial:BuildPart[],changed:(parts:BuildPart[])=>void){
 host.innerHTML=`<div class="builder-toolbar"><span>VEHICLE ASSEMBLY BUILDING / 3D EDITOR</span><span>SELECT · ATTACH · MOVE · ROTATE</span></div>
 <div class="vab-tools"><div class="vab-tool-group"><button data-tool="select" class="active">SELECT</button><button data-tool="translate">MOVE</button><button data-tool="rotate">ROTATE</button><button data-tool="delete">DELETE</button></div><div class="vab-tool-group"><span class="vab-snap-status">MAGNETIC ATTACHMENT / NO GRID</span><label>SYMMETRY <select id="vab-symmetry"><option value="1">OFF</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label></div><div class="vab-tool-group"><button id="vab-undo">UNDO</button><button id="vab-redo">REDO</button><button id="vab-reset">RESET VIEW</button></div></div>
 <div class="builder-viewport vab-viewport"><canvas id="vehicle-3d-canvas" tabindex="0" aria-label="3D vehicle builder. Click a part to select it."></canvas><div class="builder-hud" id="vab-status">SELECT A PART OR ADD FROM THE CATALOG</div><div class="vab-axis">X / Y / Z</div></div>
 <div class="vab-lower"><section><div class="vab-section-title">PART CATALOG <small>CLICK TO ADD / SELECT TO EDIT</small></div><div class="builder-palette">${parts.filter(p=>p.kind!=="engine").map(p=>`<button class="part-card" data-add="${p.kind}"><i class="part-swatch" style="--part-color:#${p.color.toString(16).padStart(6,"0")}"></i><span><b>${p.name}</b><small>${p.category} · ${p.mass.toFixed(2)} t</small></span><strong>＋</strong></button>`).join("")}${engineVariants.map(e=>`<button class="part-card engine-variant-card" data-add-engine="${e.id}"><i class="part-swatch" style="--part-color:#${e.accent.toString(16).padStart(6,"0")}"></i><span><b>${e.name}</b><small>${e.description} · 34 kN · ISP 285 s</small></span><strong>＋</strong></button>`).join("")}</div></section><section><div class="vab-section-title">CRAFT HIERARCHY <small id="vab-part-count">0 PARTS</small></div><div class="vab-stage-summary" id="vab-stage-summary">STAGE 0 / ENGINES IGNITE AT LAUNCH</div><div class="builder-stack" id="builder-stack"></div><div class="vab-inspector" id="vab-inspector"><b>NO PART SELECTED</b><small>Select a component to inspect its placement.</small></div></section></div>`;
 const canvas=host.querySelector<HTMLCanvasElement>("#vehicle-3d-canvas")!;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"low-power"});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);renderer.shadowMap.enabled=true;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x081625);
 const camera=new THREE.PerspectiveCamera(42,canvas.clientWidth/canvas.clientHeight,.1,500);camera.position.set(8,6,10);
 const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,1,0);orbit.enableDamping=true;orbit.dampingFactor=.07;
 scene.add(new THREE.HemisphereLight(0xc5e6ff,0x263448,2));
 const key=new THREE.DirectionalLight(0xffedcf,3);key.position.set(5,10,7);key.castShadow=true;scene.add(key);
 const grid=new THREE.GridHelper(40,80,0x3a718a,0x1b354b);scene.add(grid);
 const craftGroup=new THREE.Group();scene.add(craftGroup);
 const transform=new TransformControls(camera,renderer.domElement);transform.setMode("translate");transform.setSpace("world");
 const helper=transform.getHelper();scene.add(helper);
 let craft=clone(initial),selected:THREE.Group|null=null,selectedId:string|null=null,tool="translate",alive=true;
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const history:BuildPart[][]=[clone(craft)];let historyIndex=0,dragged=false;
 const status=host.querySelector<HTMLElement>("#vab-status")!;
 const uid=()=>`part-${Math.random().toString(36).slice(2,10)}`;
 const spec=(kind:PartKind)=>parts.find(p=>p.kind===kind)!;
 function makeMesh(p:BuildPart){
  const s=spec(p.kind),mat=new THREE.MeshStandardMaterial({color:s.color,roughness:.48,metalness:.24,flatShading:false,side:THREE.DoubleSide});
  const g=new THREE.Group();g.userData.partId=p.id;
  const add=(geo:THREE.BufferGeometry,m=mat,pos:THREE.Vector3=new THREE.Vector3())=>{const mesh=new THREE.Mesh(geo,m);mesh.position.copy(pos);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
  if(p.kind==="capsule"){
   const shell=new THREE.MeshStandardMaterial({color:0xe2e9ed,roughness:.34,metalness:.42});
   const dark=new THREE.MeshStandardMaterial({color:0x435b6c,roughness:.28,metalness:.55});
   const glass=new THREE.MeshStandardMaterial({color:0x4bb6d4,roughness:.18,metalness:.58});
   add(new THREE.CylinderGeometry(.43,.49,.62,32,3,false),shell,new THREE.Vector3(0,-.08,0));
   add(new THREE.ConeGeometry(.43,.52,32,3,false),new THREE.MeshStandardMaterial({color:0xcbd7df,roughness:.3,metalness:.38}),new THREE.Vector3(0,.49,0));
   add(new THREE.SphereGeometry(.135,24,16),glass,new THREE.Vector3(0,.02,.425));
   add(new THREE.CylinderGeometry(.49,.49,.08,32),dark,new THREE.Vector3(0,-.405,0));
  }
  else if(p.kind==="tank"){
   const alloy=new THREE.MeshStandardMaterial({color:0xc5d0d8,roughness:.4,metalness:.38});
   const seam=new THREE.MeshStandardMaterial({color:0x536b7d,roughness:.36,metalness:.68});
   add(new THREE.CylinderGeometry(.44,.44,.96,40,4,false),alloy);
   add(new THREE.SphereGeometry(.44,40,16,0,Math.PI*2,0,Math.PI/2),alloy,new THREE.Vector3(0,.48,0));
   add(new THREE.SphereGeometry(.44,40,16,0,Math.PI*2,Math.PI/2,Math.PI/2),alloy,new THREE.Vector3(0,-.48,0));
   for(const y of [-.32,.32])add(new THREE.TorusGeometry(.442,.018,8,40),seam,new THREE.Vector3(0,y,0));
   add(new THREE.CylinderGeometry(.445,.445,.055,40),seam,new THREE.Vector3(0,.49,0));
  }
  else if(p.kind==="engine"){
   const variant=engineVariants.find(e=>e.id===(p.engineType??"liquid"))??engineVariants[0]!;
   const hot=new THREE.MeshStandardMaterial({color:0x8c9ba4,roughness:.32,metalness:.78});
   const bell=new THREE.MeshStandardMaterial({color:variant.accent,roughness:.34,metalness:.68,side:THREE.DoubleSide});
   add(new THREE.CylinderGeometry(.19,.43,.66,40,5,false),bell,new THREE.Vector3(0,-.02,0));
   add(new THREE.CylinderGeometry(.18,.2,.2,32,2,false),hot,new THREE.Vector3(0,.38,0));
   add(new THREE.CylinderGeometry(.16,.16,.08,32),new THREE.MeshStandardMaterial({color:0x263744,metalness:.5}),new THREE.Vector3(0,-.39,0));
   const lowerLip=add(new THREE.TorusGeometry(.425,.035,10,40),hot,new THREE.Vector3(0,-.35,0));lowerLip.rotation.x=Math.PI/2;
   const upperCollar=add(new THREE.TorusGeometry(.205,.022,8,32),hot,new THREE.Vector3(0,.31,0));upperCollar.rotation.x=Math.PI/2;
  }
  else if(p.kind==="separator"){add(new THREE.CylinderGeometry(.5,.5,.2,40,2,false),new THREE.MeshStandardMaterial({color:0xd6b66d,roughness:.42,metalness:.42}));add(new THREE.TorusGeometry(.5,.032,10,40),new THREE.MeshStandardMaterial({color:0xffd77c,metalness:.55}),new THREE.Vector3(0,.09,0));add(new THREE.CylinderGeometry(.44,.44,.055,40),new THREE.MeshStandardMaterial({color:0x536b7d,metalness:.7}),new THREE.Vector3(0,-.12,0));}
  else if(p.kind==="fin"||p.kind==="wing"||p.kind==="control"){const geo=new THREE.BoxGeometry(s.size.x,s.size.y,s.size.z);add(geo);if(p.kind==="fin"){const fin=add(new THREE.BoxGeometry(.12,.72,.55));fin.position.set(.42,-.18,0);fin.rotation.z=-.22;}if(p.kind==="wing"){const tip=add(new THREE.BoxGeometry(.22,.12,.22));tip.position.x=.84;}}
  else if(p.kind==="solar"){add(new THREE.BoxGeometry(.14,.08,.18));for(const side of [-1,1]){const panel=add(new THREE.BoxGeometry(.82,.035,.65),new THREE.MeshStandardMaterial({color:0x2678a5,metalness:.55,roughness:.35}));panel.position.set(side*.48,0,0);}}
  else if(p.kind==="wheel"){const leg=add(new THREE.CylinderGeometry(.055,.07,.72,6));leg.position.y=.12;leg.rotation.z=-.22;const wheel=add(new THREE.CylinderGeometry(.2,.2,.12,10),new THREE.MeshStandardMaterial({color:0x273542,roughness:.9}));wheel.position.set(.18,-.28,0);wheel.rotation.z=Math.PI/2;}
  else if(p.kind==="dock"){const steel=new THREE.MeshStandardMaterial({color:0xb9c7d0,roughness:.3,metalness:.78});add(new THREE.CylinderGeometry(.22,.28,.22,32,2,false),steel);add(new THREE.TorusGeometry(.22,.04,10,32),new THREE.MeshStandardMaterial({color:0x5b768b,metalness:.72}),new THREE.Vector3(0,.13,0));add(new THREE.CylinderGeometry(.14,.14,.05,32),new THREE.MeshStandardMaterial({color:0x243d50,metalness:.45}),new THREE.Vector3(0,.15,0));}
  else if(p.kind==="battery"){add(new THREE.BoxGeometry(.58,.32,.58),new THREE.MeshStandardMaterial({color:0x879b78,roughness:.56,metalness:.25}));for(let x=-1;x<=1;x++)add(new THREE.BoxGeometry(.035,.34,.62),new THREE.MeshStandardMaterial({color:0x354b5c,metalness:.5}),new THREE.Vector3(x*.18,0,0));}
  else if(p.kind==="rcs"){add(new THREE.BoxGeometry(.34,.24,.34),new THREE.MeshStandardMaterial({color:0x8799a7,roughness:.38,metalness:.62}));for(let i=0;i<4;i++){const nozzle=add(new THREE.CylinderGeometry(.055,.095,.2,20,2,false),new THREE.MeshStandardMaterial({color:0x647b8b,metalness:.72,roughness:.32}));nozzle.rotation.z=Math.PI/2;nozzle.position.set(i%2?-.22:.22,0,i<2?-.14:.14);}}
  else if(p.kind==="strut"){add(new THREE.BoxGeometry(.1,1,.1));}
  g.position.set(p.x??0,p.y??(craft.length*.6),p.z??0);g.rotation.set(p.rx??0,p.ry??0,p.rz??0);
  return g;
 }
 function syncPartFromGroup(g:THREE.Group){const p=craft.find(v=>v.id===g.userData.partId);if(!p)return;p.x=g.position.x;p.y=g.position.y;p.z=g.position.z;p.rx=g.rotation.x;p.ry=g.rotation.y;p.rz=g.rotation.z;}
 function record(){history.splice(historyIndex+1);history.push(clone(craft));if(history.length>60)history.shift();historyIndex=history.length-1;changed(clone(craft));}
 function inspect(){
  const box=host.querySelector<HTMLElement>("#vab-inspector")!;
  const p=craft.find(v=>v.id===selectedId);
  if(!p){box.innerHTML="<b>NO PART SELECTED</b><small>Click a component in the 3D view to move, rotate or delete it.</small>";return;}
  const specPart=spec(p.kind),engine=p.kind==="engine"?engineVariants.find(e=>e.id===(p.engineType??"liquid")):undefined;
  const stageControl=p.kind==="engine"?"<label class='engine-stage-control'>IGNITION STAGE <select data-engine-stage>"+[0,1,2,3,4,5].map(i=>"<option value='"+i+"' "+(Number(p.engineStage??0)===i?"selected":"")+">"+(i===0?"0 · LAUNCH":i+" · ACTIVATE")+"</option>").join("")+"</select></label>":"";
  box.innerHTML="<b>"+(engine?.name.toUpperCase()??specPart.name.toUpperCase())+"</b><small>"+specPart.category+" / "+specPart.mass.toFixed(2)+" t / X "+(p.x??0).toFixed(2)+" · Y "+(p.y??0).toFixed(2)+" · Z "+(p.z??0).toFixed(2)+"</small><div class='vab-inspector-actions'><button type='button' data-inspector-tool='translate' class='"+(tool==="translate"?"active":"")+"'>MOVE</button><button type='button' data-inspector-tool='rotate' class='"+(tool==="rotate"?"active":"")+"'>ROTATE</button><button type='button' data-inspector-delete>DELETE PART</button></div>"+stageControl;
  box.querySelectorAll<HTMLButtonElement>("[data-inspector-tool]").forEach(button=>button.onclick=()=>setTool(button.dataset.inspectorTool!));
  box.querySelector<HTMLButtonElement>("[data-inspector-delete]")!.onclick=()=>removePart(p.id!);
  const stageSelect=box.querySelector<HTMLSelectElement>("[data-engine-stage]");
  if(stageSelect)stageSelect.onchange=()=>{p.engineStage=Number(stageSelect.value);redraw();record();};
 }
 function rememberSafePose(g:THREE.Group,p:BuildPart){g.userData.safePose={position:g.position.clone(),rotation:g.rotation.clone(),parentId:p.parentId,parentNode:p.parentNode,childNode:p.childNode};}
 function restoreSafePose(g:THREE.Group,p:BuildPart){const safe=g.userData.safePose as {position:THREE.Vector3;rotation:THREE.Euler;parentId?:string;parentNode?:string;childNode?:string}|undefined;if(!safe)return;g.position.copy(safe.position);g.rotation.copy(safe.rotation);p.x=g.position.x;p.y=g.position.y;p.z=g.position.z;p.rx=g.rotation.x;p.ry=g.rotation.y;p.rz=g.rotation.z;for(const key of ["parentId","parentNode","childNode"] as const){const value=safe[key];if(value===undefined)delete p[key];else p[key]=value;}}
 function hasCollision(g:THREE.Group,p:BuildPart){craftGroup.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);for(const other of craftGroup.children){if(other===g)continue;const otherPart=craft.find(candidate=>candidate.id===other.userData.partId);if(!otherPart)continue;if(p.parentId===otherPart.id||otherPart.parentId===p.id)continue;if(bounds.intersectsBox(new THREE.Box3().setFromObject(other)))return true;}return false;}
 function select(g:THREE.Group|null){selected=g;selectedId=g?.userData.partId??null;if(g){tool="translate";transform.setMode("translate");transform.attach(g);const p=craft.find(part=>part.id===selectedId);if(p)rememberSafePose(g,p);}else{tool="select";transform.detach();}host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));host.querySelectorAll<HTMLElement>(".stack-row").forEach(r=>r.classList.toggle("selected",r.dataset.id===selectedId));inspect();status.textContent=g?"PART SELECTED / MOVE GIZMO ACTIVE · ROTATE AVAILABLE":"SELECT A PART OR ADD FROM THE CATALOG";}
 function redraw(){craftGroup.clear();craft.forEach(p=>{if(!p.id)p.id=uid();craftGroup.add(makeMesh(p));});host.querySelector<HTMLElement>("#builder-stack")!.innerHTML=craft.map((p,i)=>`<div class="stack-row vab-stack-row ${p.id===selectedId?"selected":""}" data-id="${p.id}"><span>${String(i+1).padStart(2,"0")}</span><b>${p.kind==="engine"?"ENGINE · STAGE "+(p.engineStage??0):spec(p.kind).name}</b><small>${(p.x??0).toFixed(1)}, ${(p.y??0).toFixed(1)}, ${(p.z??0).toFixed(1)}</small><button data-remove="${p.id}" aria-label="Remove part">×</button></div>`).join("");host.querySelector("#vab-part-count")!.textContent=`${craft.length} PARTS`;const engineStages=[...new Set(craft.filter(p=>p.kind==="engine").map(p=>p.engineStage??0))].sort((a,b)=>a-b);host.querySelector<HTMLElement>("#vab-stage-summary")!.textContent=engineStages.length?engineStages.map(stage=>"STAGE "+stage+": "+craft.filter(p=>p.kind==="engine"&&(p.engineStage??0)===stage).length+" ENGINE(S)").join(" / "):"NO ENGINES / ADD AN ENGINE TO CREATE A STAGE";host.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b=>b.onclick=e=>{e.stopPropagation();removePart(b.dataset.remove!);});host.querySelectorAll<HTMLElement>(".vab-stack-row").forEach(r=>r.onclick=()=>select(craftGroup.children.find(g=>g.userData.partId===r.dataset.id) as THREE.Group??null));select(craftGroup.children.find(g=>g.userData.partId===selectedId) as THREE.Group??null);changed(clone(craft));}
 function removePart(id:string){craft=craft.filter(p=>p.id!==id);if(selectedId===id){selectedId=null;selected=null;transform.detach();}redraw();record();}
 function addPart(kind:PartKind,engineType:EngineType="liquid"){
  if(craft.length>=120){status.textContent="PART LIMIT / 120";return;}
  const requested=Number(host.querySelector<HTMLSelectElement>("#vab-symmetry")!.value);
  const preferredId=selectedId??[...craft].sort((a,b)=>(b.y??0)-(a.y??0))[0]?.id;
  const anchorPart=craft.find(p=>p.id===preferredId);
  const anchor:readonly [number,number,number]=[anchorPart?.x??0,anchorPart?.y??0,anchorPart?.z??0];
  const first=findAvailableAttachmentPlacement(craft,kind,preferredId,anchor);
  const additions:BuildPart[]=[];
  let count=Math.max(1,requested);
  if(first){
   if(count>1&&first.parentNode.startsWith("stack")){count=1;status.textContent="STACK ATTACHMENT / SYMMETRY SET TO 1×";}
   const working=clone(craft);
   for(let i=0;i<count;i++){
    const placement=i===0?first:findAvailableAttachmentPlacement(working,kind,preferredId,anchor);
    if(!placement)break;
    const part:BuildPart={kind,id:uid(),...(kind==="engine"?{engineType,engineStage:0}:{}),x:placement.x,y:placement.y,z:placement.z,ry:placement.rotationY,parentId:placement.parentId,parentNode:placement.parentNode,childNode:placement.childNode};
    additions.push(part);working.push(part);
   }
  }
  if(!additions.length){
   const maxX=craft.reduce((n,p)=>Math.max(n,(p.x??0)+spec(p.kind).size.x/2),0);
   const topY=craft.reduce((n,p)=>Math.max(n,(p.y??0)+spec(p.kind).size.y/2),0);
   const partSize=spec(kind).size;
   const part:BuildPart={kind,id:uid(),...(kind==="engine"?{engineType,engineStage:0}:{}),x:craft.length?maxX+partSize.x/2+.35:0,y:craft.length?Math.max(partSize.y/2,topY):0,z:0};
   additions.push(part);count=1;
  }
  if(craft.length+additions.length>120){status.textContent="PART LIMIT / 120";return;}
  craft.push(...additions);selectedId=additions[0]?.id??null;redraw();record();
  const issues=validateAssembly(craft);
  status.textContent=issues.length?"ASSEMBLY WARNING / CHECK CONNECTIONS":`${spec(kind).name.toUpperCase()} PLACED / AUTO-SNAPPED · ${additions.length}×`;
 }
 function snapMovedPartToNearbyNode(part:BuildPart,g:THREE.Group){
  const previous={x:part.x,y:part.y,z:part.z,rx:part.rx,ry:part.ry,rz:part.rz,parentId:part.parentId,parentNode:part.parentNode,childNode:part.childNode};
  const placement=findNearestAttachmentPlacement(craft.filter(candidate=>candidate.id!==part.id),part.kind,[part.x??0,part.y??0,part.z??0],.8);
  if(placement){part.x=placement.x;part.y=placement.y;part.z=placement.z;part.ry=placement.rotationY;part.parentId=placement.parentId;part.parentNode=placement.parentNode;part.childNode=placement.childNode;}
  else{delete part.parentId;delete part.parentNode;delete part.childNode;}
  g.position.set(part.x??0,part.y??0,part.z??0);g.rotation.set(part.rx??0,part.ry??0,part.rz??0);
  if(hasCollision(g,part)){Object.assign(part,previous);g.position.set(part.x??0,part.y??0,part.z??0);g.rotation.set(part.rx??0,part.ry??0,part.rz??0);return false;}
  rememberSafePose(g,part);return Boolean(placement);
 }
 function setTool(next:string){if(next==="delete"){if(selectedId)removePart(selectedId);else status.textContent="SELECT A PART TO DELETE";return;}tool=next;host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===next));if(next==="translate"||next==="rotate"){transform.setMode(next);if(selected)transform.attach(selected);}else transform.detach();orbit.enabled=true;inspect();status.textContent=next.toUpperCase()+" TOOL";}
 host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool!));
 host.querySelectorAll<HTMLButtonElement>("[data-add]").forEach(b=>b.onclick=()=>addPart(b.dataset.add as PartKind));
 host.querySelectorAll<HTMLButtonElement>("[data-add-engine]").forEach(b=>b.onclick=()=>addPart("engine",b.dataset.addEngine as EngineType));
 transform.addEventListener("dragging-changed",e=>{orbit.enabled=!(e.value as boolean);dragged=Boolean(e.value);if(!dragged&&selected){syncPartFromGroup(selected);const part=craft.find(v=>v.id===selectedId);if(part){const snapped=snapMovedPartToNearbyNode(part,selected);status.textContent=snapped?"PART SNAPPED TO NEAREST FREE ATTACHMENT":"PART MOVED / FREE PLACEMENT";}record();redraw();}});
 transform.addEventListener("objectChange",()=>{if(selected){const p=craft.find(v=>v.id===selectedId);if(p){p.x=selected.position.x;p.y=selected.position.y;p.z=selected.position.z;p.rx=selected.rotation.x;p.ry=selected.rotation.y;p.rz=selected.rotation.z;const placement=findNearestAttachmentPlacement(craft.filter(candidate=>candidate.id!==p.id),p.kind,[p.x,p.y,p.z],.8);if(placement){p.x=placement.x;p.y=placement.y;p.z=placement.z;p.ry=placement.rotationY;p.parentId=placement.parentId;p.parentNode=placement.parentNode;p.childNode=placement.childNode;selected.position.set(p.x,p.y,p.z);selected.rotation.y=p.ry;}if(hasCollision(selected,p)){restoreSafePose(selected,p);status.textContent="COLLISION BLOCKED / PARTS CANNOT OVERLAP";}else{rememberSafePose(selected,p);if(placement)status.textContent="MAGNETIC ATTACHMENT / LOCKED TO CONNECTOR";inspect();}}}});
 canvas.addEventListener("pointerdown",e=>{if(dragged||transform.dragging||transform.axis)return;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(craftGroup.children,true);if(hits.length){let o=hits[0].object;while(o.parent&&o.parent!==craftGroup)o=o.parent;if(o instanceof THREE.Group){select(o);return;}}if(tool==="select")select(null);});
 host.querySelector("#vab-undo")!.addEventListener("click",()=>{if(historyIndex<=0)return;historyIndex--;craft=clone(history[historyIndex]);selectedId=null;redraw();});
 host.querySelector("#vab-redo")!.addEventListener("click",()=>{if(historyIndex>=history.length-1)return;historyIndex++;craft=clone(history[historyIndex]);selectedId=null;redraw();});
 host.querySelector("#vab-reset")!.addEventListener("click",()=>{camera.position.set(8,6,10);orbit.target.set(0,1,0);orbit.update();});
 host.addEventListener("keydown",e=>{if(e.key==="Delete"||e.key==="Backspace"){if(selectedId)removePart(selectedId);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();host.querySelector<HTMLButtonElement>("#vab-undo")!.click();}if(e.key.toLowerCase()==="w")setTool("translate");if(e.key.toLowerCase()==="e")setTool("rotate");if(e.key.toLowerCase()==="q")setTool("select");});
 const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 const render=()=>{if(!alive)return;orbit.update();renderer.render(scene,camera);requestAnimationFrame(render);};
 craft=craft.map((p,i)=>({...p,id:p.id??uid(),x:p.x??0,y:p.y??(craft.length-1-i)*1.15,z:p.z??0}));redraw();render();
 return {dispose(){alive=false;observer.disconnect();transform.detach();orbit.dispose();renderer.dispose();}};
}
