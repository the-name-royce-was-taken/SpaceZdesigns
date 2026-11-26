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
export type PartKind = "capsule" | "tank" | "engine" | "separator" | "side-decoupler" | "separator-thruster" | "fuel-line" | "fin" | "solar" | "wing" | "control" | "wheel" | "dock" | "battery" | "rcs" | "strut" | "nose-cone" | "fairing" | "airbrake" | "strake";
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
  fuelLineStartId?: string;
  fuelLineEndId?: string;
  topRadius?: number;
  bottomRadius?: number;
  height?: number;
}
interface PartSpec {kind:PartKind;name:string;category:string;mass:number;fuel:number;thrust:number;color:number;size:THREE.Vector3}
const parts:PartSpec[]=[
 {kind:"capsule",name:"Command pod",category:"Controller",mass:1.2,fuel:0,thrust:0,color:0xdce8ef,size:new THREE.Vector3(.9,.9,.9)},
 {kind:"tank",name:"Fuel tank",category:"Power",mass:.8,fuel:120,thrust:0,color:0xb7c8d5,size:new THREE.Vector3(.9,1.1,.9)},
 {kind:"engine",name:"Liquid engine",category:"Engines",mass:.7,fuel:0,thrust:34,color:0xe6a65e,size:new THREE.Vector3(.85,.8,.85)},
 {kind:"separator",name:"Stack decoupler",category:"Couplers",mass:.15,fuel:0,thrust:0,color:0xe5c56d,size:new THREE.Vector3(1,.22,1)},
 {kind:"side-decoupler",name:"Side decoupler",category:"Couplers",mass:.18,fuel:0,thrust:0,color:0xe2bd68,size:new THREE.Vector3(.72,.28,.32)},
 {kind:"separator-thruster",name:"Separation thruster",category:"Couplers",mass:.08,fuel:0,thrust:2,color:0xd68a62,size:new THREE.Vector3(.38,.24,.3)},
 {kind:"fuel-line",name:"Fuel connector pipe",category:"Power",mass:.035,fuel:0,thrust:0,color:0x65aeb4,size:new THREE.Vector3(.8,.12,.12)},
 {kind:"fin",name:"Stability fin",category:"Aerodynamics",mass:.12,fuel:0,thrust:0,color:0x6c9db8,size:new THREE.Vector3(.9,.7,.18)},
 {kind:"wing",name:"Wing panel",category:"Aerodynamics",mass:.24,fuel:0,thrust:0,color:0x759bb7,size:new THREE.Vector3(1.7,.12,1.1)},
 {kind:"control",name:"Elevon",category:"Aerodynamics",mass:.09,fuel:0,thrust:0,color:0xd1a66b,size:new THREE.Vector3(1,.1,.42)},
 {kind:"wheel",name:"Landing gear",category:"Other",mass:.16,fuel:0,thrust:0,color:0x8798a8,size:new THREE.Vector3(.22,.85,.22)},
 {kind:"solar",name:"Solar array",category:"Power",mass:.08,fuel:0,thrust:0,color:0x4b91bb,size:new THREE.Vector3(1.8,.06,.7)},
 {kind:"battery",name:"Battery pack",category:"Power",mass:.1,fuel:0,thrust:0,color:0x8d9b68,size:new THREE.Vector3(.6,.35,.6)},
 {kind:"dock",name:"Docking port",category:"Other",mass:.12,fuel:0,thrust:0,color:0xc2cbd1,size:new THREE.Vector3(.42,.28,.42)},
 {kind:"rcs",name:"RCS thruster",category:"Engines",mass:.07,fuel:0,thrust:0,color:0x9caeba,size:new THREE.Vector3(.4,.32,.4)},
 {kind:"strut",name:"Structural girder",category:"Other",mass:.04,fuel:0,thrust:0,color:0xb7a88d,size:new THREE.Vector3(.12,1,.12)},
 {kind:"nose-cone",name:"Nose cone",category:"Aerodynamics",mass:.12,fuel:0,thrust:0,color:0xd4dfe7,size:new THREE.Vector3(.88,.8,.88)},
 {kind:"fairing",name:"Payload fairing",category:"Aerodynamics",mass:.2,fuel:0,thrust:0,color:0x9bb6c9,size:new THREE.Vector3(.88,1.15,.88)},
 {kind:"airbrake",name:"Airbrake",category:"Aerodynamics",mass:.08,fuel:0,thrust:0,color:0xb78b68,size:new THREE.Vector3(.7,.5,.5)},
 {kind:"strake",name:"Body strake",category:"Aerodynamics",mass:.07,fuel:0,thrust:0,color:0x7898ad,size:new THREE.Vector3(.18,.8,.42)}
];
export const partCatalog=parts;
const clone=(a:BuildPart[])=>a.map(p=>({...p}));

function previewSvg(kind:string,color:number){
 const fill="#"+color.toString(16).padStart(6,"0");
 const shapes:Record<string,string>={
 capsule:'<path d="M24 39V23l12-14 12 14v16z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><circle cx="36" cy="25" r="5" fill="#50b9d8" stroke="#24465b"/>',
 tank:'<path d="M25 12q11-9 22 0v26q-11 9-22 0z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M25 18h22M25 32h22" stroke="#536b7d" stroke-width="2"/>',
 engine:'<path d="M29 10h14v9l8 20q-15 9-30 0l8-20z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M30 39h12" stroke="#f6c17d" stroke-width="3"/>',
 separator:'<path d="M13 20h46v16H13z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M17 17h38M17 39h38" stroke="#f3d88b" stroke-width="3"/>',
 "side-decoupler":'<path d="M10 25h40v14H10z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M50 22l10 10-10 10" fill="none" stroke="#f3d88b" stroke-width="3"/>',
 "separator-thruster":'<path d="M15 20h27v20H15z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M42 23l15-7v28l-15-7z" fill="#f1a36d"/><path d="M9 30h-5" stroke="#ffd08a" stroke-width="3"/>',
 "fuel-line":'<path d="M12 17h14v18h20V17h14" fill="none" stroke="'+fill+'" stroke-width="7" stroke-linejoin="round"/><path d="M12 17h14v18h20V17h14" fill="none" stroke="#c5e7e8" stroke-width="2"/>',
 solar:'<path d="M8 19h20v22H8zM44 19h20v22H44zM29 28h14v4H29z" fill="'+fill+'" stroke="#8bd7ec" stroke-width="2"/>',
 battery:'<rect x="18" y="14" width="36" height="30" rx="4" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M29 10h14v4H29z" fill="#e3edf5"/>',
 rcs:'<rect x="24" y="19" width="24" height="22" rx="3" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M20 18l-8-7M52 18l8-7M20 42l-8 7M52 42l8 7" stroke="#d9a06f" stroke-width="4"/>',
 dock:'<circle cx="36" cy="30" r="16" fill="'+fill+'" stroke="#e3edf5" stroke-width="3"/><circle cx="36" cy="30" r="7" fill="#263d50"/>',
 fin:'<path d="M15 44L25 12h32L45 44z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
 wing:'<path d="M7 25l52-13 10 9-52 18z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
 control:'<path d="M13 25h46v12H13z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
 wheel:'<path d="M30 10h12v25H30z" fill="'+fill+'"/><circle cx="36" cy="43" r="9" fill="#273542" stroke="#e3edf5" stroke-width="2"/>',
 strut:'<path d="M32 8h8v44h-8z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>'
 };
 return '<svg class="vab-part-preview" viewBox="0 0 72 60" role="img" aria-hidden="true">'+(shapes[kind]??shapes.strut)+'</svg>';
}
function catalogCard(p:PartSpec){
 return '<button type="button" class="vab-part-card" data-add="'+p.kind+'">'+previewSvg(p.kind,p.color)+'<span><b>'+p.name+'</b><small>'+p.mass.toFixed(2)+' t'+(p.fuel? ' · '+p.fuel+' fuel':'')+'</small></span></button>';
}

export function mountVehicleBuilder(host:HTMLElement,initial:BuildPart[],changed:(parts:BuildPart[])=>void){
 host.innerHTML=`<div class="vab-tools"><div class="vab-tool-group"><button data-tool="select" class="active">SELECT</button><button data-tool="translate">MOVE</button><button data-tool="rotate">ROTATE</button><button data-tool="delete">DELETE</button></div><div class="vab-tool-group"><span class="vab-snap-status">MAGNETIC ATTACHMENT / NO GRID</span><label>SYMMETRY <select id="vab-symmetry"><option value="1">OFF</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label></div><div class="vab-tool-group"><button id="vab-undo">UNDO</button><button id="vab-redo">REDO</button><button id="vab-reset">RESET VIEW</button></div></div>
 <div class="vab-workspace"><div class="builder-toolbar"><span>VEHICLE ASSEMBLY BUILDING / 3D EDITOR</span><span>SELECT · ATTACH · MOVE · ROTATE</span></div><aside class="vab-catalog"><div class="vab-section-title">PARTS <small>SELECT TO ADD</small></div><label class="vab-category-label" for="vab-category-select">CATEGORY</label><select id="vab-category-select" class="vab-category-select" aria-label="Part category">${["Power","Aerodynamics","Other","Engines","Couplers","Controller"].map((name,i)=>`<option value="${name}" ${i===0?"selected":""}>${name.toUpperCase()}</option>`).join("")}</select><div class="vab-catalog-items" id="vab-catalog-items"></div></aside><div class="vab-workarea"><div class="builder-viewport vab-viewport"><canvas id="vehicle-3d-canvas" tabindex="0" aria-label="3D vehicle builder. Click a part to select it."></canvas><div class="builder-hud" id="vab-status">SELECT A PART OR ADD FROM THE CATALOG</div><div class="vab-axis">X / Y / Z</div></div><div class="vab-lower"><section><div class="vab-section-title">CRAFT HIERARCHY <small id="vab-part-count">0 PARTS</small></div><div class="vab-stage-summary" id="vab-stage-summary">STAGE 0 / ENGINES IGNITE AT LAUNCH</div><div class="builder-stack" id="builder-stack"></div><div class="vab-inspector" id="vab-inspector"><b>NO PART SELECTED</b><small>Select a component to inspect its placement.</small></div></section></div></div></div>`;
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
 let fuelLineStartId:string|null=null;
 let fuelLineDrawing=false;
 const fuelLinePreview=new THREE.Group();fuelLinePreview.visible=false;scene.add(fuelLinePreview);
 const fuelLineValidMaterial=new THREE.MeshStandardMaterial({color:0x65d6c8,emissive:0x168f83,emissiveIntensity:1.2,roughness:.25,metalness:.55});
 const fuelLineInvalidMaterial=new THREE.MeshStandardMaterial({color:0xff3b45,emissive:0xff0018,emissiveIntensity:2.4,roughness:.2,metalness:.25});
 function tankPart(id:string|null|undefined){if(!id)return undefined;return craft.find(p=>p.id===id&&p.kind==="tank");}
 function pipeGeometry(a:THREE.Vector3,b:THREE.Vector3,startId:string,endId:string){const delta=b.clone().sub(a),dir=delta.clone().normalize();const start=a.clone().add(dir.clone().multiplyScalar(.46)),end=b.clone().sub(dir.clone().multiplyScalar(.46)),mid=start.clone().add(end).multiplyScalar(.5);const obstacles=craft.filter(p=>p.id!==startId&&p.id!==endId&&p.kind!=="fuel-line").map(p=>{const center=new THREE.Vector3(p.x??0,p.y??0,p.z??0),size=spec(p.kind).size;return new THREE.Box3(center.clone().sub(size.clone().multiplyScalar(.5)),center.clone().add(size.clone().multiplyScalar(.5))).expandByScalar(.16);});const makeCurve=(points:THREE.Vector3[])=>new THREE.CatmullRomCurve3(points,false,"centripetal",.5);const directMid=mid.clone();directMid.y-=Math.min(.65,Math.max(.22,delta.length()*.18));const candidates:THREE.CatmullRomCurve3[]=[makeCurve([start,start.clone().lerp(directMid,.55),directMid,end.clone().lerp(directMid,.55),end])];const blocked=(curve:THREE.CatmullRomCurve3)=>{for(let i=0;i<=64;i++){const point=curve.getPoint(i/64);if(obstacles.some(box=>box.containsPoint(point)))return true;}return false;};let clear=!blocked(candidates[0]!);if(!clear){const horizontal=new THREE.Vector3(-dir.z,0,dir.x);if(horizontal.lengthSq()<.01)horizontal.set(1,0,0);horizontal.normalize();const sides=[horizontal,horizontal.clone().negate(),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];let best:THREE.CatmullRomCurve3|null=null,bestLength=Infinity;for(const side of sides){const required=Math.max(.8,...obstacles.map(box=>{const center=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);return Math.abs(center.clone().sub(mid).dot(side))+Math.abs(side.x)*half.x+Math.abs(side.y)*half.y+Math.abs(side.z)*half.z+.28;}));for(let offset=required;offset<=required+5;offset+=.35){const shift=side.clone().multiplyScalar(offset),curve=makeCurve([start,start.clone().add(shift),end.clone().add(shift),end]);if(!blocked(curve)){const length=curve.getLength();if(length<bestLength){best=curve;bestLength=length;}break;}}}if(best){candidates[0]=best;clear=true;}}const curve=candidates[0]!;const localPoints=curve.getPoints(64).map(point=>point.sub(mid));return {geometry:new THREE.TubeGeometry(new THREE.CatmullRomCurve3(localPoints),64,.045,8,false),midpoint:mid,clear};}
 function tankWorldPosition(p:BuildPart){return new THREE.Vector3(p.x??0,p.y??0,p.z??0);}
 function updateFuelLinePreview(target:THREE.Object3D|null,valid:boolean){fuelLinePreview.children.forEach(child=>{const mesh=child as THREE.Mesh;mesh.geometry.dispose();});fuelLinePreview.clear();if(!fuelLineStartId)return;const start=tankPart(fuelLineStartId);if(!start)return;let endPart:BuildPart|undefined; if(target){let root=target;while(root.parent&&root.parent!==craftGroup)root=root.parent;endPart=craft.find(p=>p.id===root.userData.partId);}
  if(!endPart){fuelLinePreview.visible=false;return;}const a=tankWorldPosition(start),b=tankWorldPosition(endPart);const route=pipeGeometry(a,b,start.id!,endPart.id!);const line=new THREE.Mesh(route.geometry,valid&&route.clear?fuelLineValidMaterial:fuelLineInvalidMaterial);fuelLinePreview.add(line);fuelLinePreview.position.copy(route.midpoint);fuelLinePreview.visible=true;}
 function beginFuelLineDrawing(){fuelLineDrawing=true;fuelLineStartId=null;fuelLinePreview.visible=false;select(null);status.textContent="FUEL PIPE MODE / CLICK A FUEL TANK";orbit.enabled=true;}
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
   const topRadius=Math.max(.08,Math.min(.9,p.topRadius??.44)),bottomRadius=Math.max(.08,Math.min(.9,p.bottomRadius??.44)),height=Math.max(.25,Math.min(3,p.height??.96)),half=height/2;
   add(new THREE.CylinderGeometry(topRadius,bottomRadius,height,48,12,false),alloy);
   for(const t of [.16,.5,.84]){const y=(t-.5)*height,radius=bottomRadius+(topRadius-bottomRadius)*t;const band=add(new THREE.TorusGeometry(radius+.006,.014,8,48),seam,new THREE.Vector3(0,y,0));band.rotation.x=Math.PI/2;}
   const topRim=add(new THREE.TorusGeometry(topRadius,.018,8,48),seam,new THREE.Vector3(0,half,0));topRim.rotation.x=Math.PI/2;
   const bottomRim=add(new THREE.TorusGeometry(bottomRadius,.018,8,48),seam,new THREE.Vector3(0,-half,0));bottomRim.rotation.x=Math.PI/2;
  }
  else if(p.kind==="nose-cone"||p.kind==="fairing"){
   const base=Math.max(.08,Math.min(.9,p.bottomRadius??.44)),height=Math.max(.25,Math.min(3,p.height??(p.kind==="fairing"?1.15:.8)));
   const shell=new THREE.MeshStandardMaterial({color:p.kind==="fairing"?0x9bb6c9:0xd4dfe7,roughness:.38,metalness:.28,side:THREE.DoubleSide});
   if(p.kind==="nose-cone")add(new THREE.ConeGeometry(base,height,48,12,false),shell);
   else {add(new THREE.CylinderGeometry(.035,base,height,48,12,false),shell);const rim=add(new THREE.TorusGeometry(base,.018,8,48),new THREE.MeshStandardMaterial({color:0x536b7d,metalness:.65}),new THREE.Vector3(0,-height/2,0));rim.rotation.x=Math.PI/2;}
  }
  else if(p.kind==="airbrake"){
   const metal=new THREE.MeshStandardMaterial({color:0xb78b68,metalness:.55,roughness:.42});add(new THREE.BoxGeometry(.7,.08,.5),metal);for(const side of [-1,1]){const panel=add(new THREE.BoxGeometry(.06,.42,.5),metal,new THREE.Vector3(side*.31,.22,0));panel.rotation.z=side*.22;}
  }
  else if(p.kind==="strake"){const metal=new THREE.MeshStandardMaterial({color:0x7898ad,metalness:.45,roughness:.4});add(new THREE.BoxGeometry(.12,.8,.42),metal);}
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
  else if(p.kind==="separator"){add(new THREE.CylinderGeometry(.5,.5,.2,40,2,false),new THREE.MeshStandardMaterial({color:0xd6b66d,roughness:.42,metalness:.42}));const ring=add(new THREE.TorusGeometry(.5,.032,10,40),new THREE.MeshStandardMaterial({color:0xffd77c,metalness:.55}),new THREE.Vector3(0,.09,0));ring.rotation.x=Math.PI/2;add(new THREE.CylinderGeometry(.44,.44,.055,40),new THREE.MeshStandardMaterial({color:0x536b7d,metalness:.7}),new THREE.Vector3(0,-.12,0));}
  else if(p.kind==="side-decoupler"){const metal=new THREE.MeshStandardMaterial({color:0xe0bd70,metalness:.55,roughness:.4});add(new THREE.BoxGeometry(.72,.24,.3),metal);add(new THREE.BoxGeometry(.12,.34,.38),new THREE.MeshStandardMaterial({color:0x5d7483,metalness:.65}),new THREE.Vector3(.28,0,0));add(new THREE.BoxGeometry(.12,.34,.38),metal,new THREE.Vector3(-.28,0,0));}
  else if(p.kind==="separator-thruster"){const metal=new THREE.MeshStandardMaterial({color:0xb6c3cb,metalness:.65,roughness:.36});add(new THREE.BoxGeometry(.32,.22,.3),metal);for(const side of [-1,1]){const nozzle=add(new THREE.CylinderGeometry(.07,.11,.22,16),new THREE.MeshStandardMaterial({color:0xd88b62,metalness:.55}));nozzle.rotation.z=Math.PI/2;nozzle.position.x=side*.2;}}
  else if(p.kind==="fuel-line"){const a=tankPart(p.fuelLineStartId),b=tankPart(p.fuelLineEndId);if(a&&b){const route=pipeGeometry(tankWorldPosition(a),tankWorldPosition(b),a.id!,b.id!);const pipe=new THREE.MeshStandardMaterial({color:0x65aeb4,metalness:.7,roughness:.3,emissive:0x123b3e,emissiveIntensity:.35});add(route.geometry,pipe);for(const x of [-.46,.46])add(new THREE.CylinderGeometry(.075,.075,.12,16),new THREE.MeshStandardMaterial({color:0xd3e2e8,metalness:.7}),new THREE.Vector3(x,0,0));g.position.copy(route.midpoint);} }
  else if(p.kind==="fin"||p.kind==="wing"||p.kind==="control"){const geo=new THREE.BoxGeometry(s.size.x,s.size.y,s.size.z);add(geo);if(p.kind==="fin"){const fin=add(new THREE.BoxGeometry(.12,.72,.55));fin.position.set(.42,-.18,0);fin.rotation.z=-.22;}if(p.kind==="wing"){const tip=add(new THREE.BoxGeometry(.22,.12,.22));tip.position.x=.84;}}
  else if(p.kind==="solar"){add(new THREE.BoxGeometry(.14,.08,.18));for(const side of [-1,1]){const panel=add(new THREE.BoxGeometry(.82,.035,.65),new THREE.MeshStandardMaterial({color:0x2678a5,metalness:.55,roughness:.35}));panel.position.set(side*.48,0,0);}}
  else if(p.kind==="wheel"){const leg=add(new THREE.CylinderGeometry(.055,.07,.72,6));leg.position.y=.12;leg.rotation.z=-.22;const wheel=add(new THREE.CylinderGeometry(.2,.2,.12,10),new THREE.MeshStandardMaterial({color:0x273542,roughness:.9}));wheel.position.set(.18,-.28,0);wheel.rotation.z=Math.PI/2;}
  else if(p.kind==="dock"){const steel=new THREE.MeshStandardMaterial({color:0xb9c7d0,roughness:.3,metalness:.78});add(new THREE.CylinderGeometry(.22,.28,.22,32,2,false),steel);const dockRing=add(new THREE.TorusGeometry(.22,.04,10,32),new THREE.MeshStandardMaterial({color:0x5b768b,metalness:.72}),new THREE.Vector3(0,.13,0));dockRing.rotation.x=Math.PI/2;add(new THREE.CylinderGeometry(.14,.14,.05,32),new THREE.MeshStandardMaterial({color:0x243d50,metalness:.45}),new THREE.Vector3(0,.15,0));}
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
  const stageControl=p.kind==="engine"?"<label class='engine-stage-control'>ENGINE IGNITION GROUP <select data-engine-stage>"+[0,1,2,3,4,5].map(i=>"<option value='"+i+"' "+(Number(p.engineStage??0)===i?"selected":"")+">"+(i===0?"0 · LAUNCH":i+" · ACTIVATE")+"</option>").join("")+"</select></label><small class=\"engine-stage-hint\">Engines in the same group fire together. Different groups activate in sequence.</small>":"";
  const profileControl=(key:string,label:string,value:number,min:number,max:number)=>"<label><span>"+label+"</span><input type='range' min='"+min+"' max='"+max+"' step='.01' value='"+value+"' data-profile-range='"+key+"'><input type='number' min='"+min+"' max='"+max+"' step='.01' value='"+value.toFixed(2)+"' data-profile-number='"+key+"'></label>";
  const tankControls=p.kind==="tank"?"<div class='tank-profile-controls'>"+profileControl("topRadius","TOP RADIUS",p.topRadius??.44,.08,.9)+profileControl("bottomRadius","BOTTOM RADIUS",p.bottomRadius??.44,.08,.9)+profileControl("height","HEIGHT",p.height??.96,.25,3)+"</div>":"";
  const coneControls=p.kind==="nose-cone"||p.kind==="fairing"?"<div class='tank-profile-controls'>"+profileControl("bottomRadius","BASE RADIUS",p.bottomRadius??.44,.08,.9)+profileControl("height","HEIGHT",p.height??(p.kind==="fairing"?1.15:.8),.25,3)+"</div>":"";
  box.innerHTML="<b>"+(engine?.name.toUpperCase()??specPart.name.toUpperCase())+"</b><small>"+specPart.category+" / "+specPart.mass.toFixed(2)+" t / X "+(p.x??0).toFixed(2)+" · Y "+(p.y??0).toFixed(2)+" · Z "+(p.z??0).toFixed(2)+"</small><div class='vab-inspector-actions'><button type='button' data-inspector-tool='translate' class='"+(tool==="translate"?"active":"")+"'>MOVE</button><button type='button' data-inspector-tool='rotate' class='"+(tool==="rotate"?"active":"")+"'>ROTATE</button><button type='button' data-inspector-delete>DELETE PART</button></div>"+tankControls+coneControls+stageControl;
  box.querySelectorAll<HTMLButtonElement>("[data-inspector-tool]").forEach(button=>button.onclick=()=>setTool(button.dataset.inspectorTool!));
  box.querySelector<HTMLButtonElement>("[data-inspector-delete]")!.onclick=()=>removePart(p.id!);
  const rebuildProfile=(key:string,value:number)=>{const group=craftGroup.children.find(g=>g.userData.partId===p.id) as THREE.Group|undefined;if(!group)return;const replacement=makeMesh(p);group.clear();replacement.children.forEach(child=>group.add(child));const range=box.querySelector<HTMLInputElement>("[data-profile-range='"+key+"']"),number=box.querySelector<HTMLInputElement>("[data-profile-number='"+key+"']");if(range)range.value=String(value);if(number)number.value=value.toFixed(2);};
  box.querySelectorAll<HTMLInputElement>("[data-profile-range]").forEach(input=>{const key=input.dataset.profileRange!,min=Number(input.min),max=Number(input.max);input.oninput=()=>{const raw=Number(input.value);if(!Number.isFinite(raw))return;const value=Math.min(max,Math.max(min,raw));(p as unknown as Record<string,number>)[key]=value;rebuildProfile(key,value);record();};});
  box.querySelectorAll<HTMLInputElement>("[data-profile-number]").forEach(input=>{const key=input.dataset.profileNumber!,min=Number(input.min),max=Number(input.max);input.onchange=()=>{const raw=Number(input.value);if(!Number.isFinite(raw))return;const value=Math.min(max,Math.max(min,raw));(p as unknown as Record<string,number>)[key]=value;rebuildProfile(key,value);record();};});
  const stageSelect=box.querySelector<HTMLSelectElement>("[data-engine-stage]");
  if(stageSelect)stageSelect.onchange=()=>{p.engineStage=Number(stageSelect.value);redraw();record();};
 }
 function rememberSafePose(g:THREE.Group,p:BuildPart){g.userData.safePose={position:g.position.clone(),rotation:g.rotation.clone(),parentId:p.parentId,parentNode:p.parentNode,childNode:p.childNode};}

 function hasCollision(g:THREE.Group,p:BuildPart){craftGroup.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);for(const other of craftGroup.children){if(other===g)continue;const otherPart=craft.find(candidate=>candidate.id===other.userData.partId);if(!otherPart)continue;if(p.parentId===otherPart.id||otherPart.parentId===p.id)continue;if(bounds.intersectsBox(new THREE.Box3().setFromObject(other)))return true;}return false;}
 function select(g:THREE.Group|null){selected=g;selectedId=g?.userData.partId??null;if(g){tool="translate";transform.setMode("translate");transform.attach(g);const p=craft.find(part=>part.id===selectedId);if(p)rememberSafePose(g,p);}else{tool="select";transform.detach();}host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));host.querySelectorAll<HTMLElement>(".stack-row").forEach(r=>r.classList.toggle("selected",r.dataset.id===selectedId));inspect();status.textContent=g?"PART SELECTED / MOVE GIZMO ACTIVE · ROTATE AVAILABLE":"SELECT A PART OR ADD FROM THE CATALOG";}
 function renderCatalog(category:string){const target=host.querySelector<HTMLElement>("#vab-catalog-items")!;const chosen=parts.filter(p=>p.category===category);const cards=chosen.filter(p=>p.kind!=="engine").map(catalogCard).join("")+(category==="Engines"?engineVariants.map(e=>`<button type="button" class="vab-part-card" data-add-engine="${e.id}">${previewSvg("engine",e.accent)}<span><b>${e.name}</b><small>${e.description}<br>34 kN · ISP 285 s</small></span></button>`).join(""):"");target.innerHTML=cards||"<small class=\"vab-empty-category\">NO PARTS IN THIS CATEGORY</small>";target.querySelectorAll<HTMLButtonElement>("[data-add]").forEach(button=>button.onclick=()=>addPart(button.dataset.add as PartKind));target.querySelectorAll<HTMLButtonElement>("[data-add-engine]").forEach(button=>button.onclick=()=>addPart("engine",button.dataset.addEngine as EngineType));}
 function redraw(){craftGroup.clear();craft.forEach(p=>{if(!p.id)p.id=uid();craftGroup.add(makeMesh(p));});host.querySelector<HTMLElement>("#builder-stack")!.innerHTML=craft.map((p,i)=>`<div class="stack-row vab-stack-row ${p.id===selectedId?"selected":""}" data-id="${p.id}"><span>${String(i+1).padStart(2,"0")}</span><b>${p.kind==="engine"?"ENGINE · STAGE "+(p.engineStage??0):spec(p.kind).name}</b><small>${(p.x??0).toFixed(1)}, ${(p.y??0).toFixed(1)}, ${(p.z??0).toFixed(1)}</small><button data-remove="${p.id}" aria-label="Remove part">×</button></div>`).join("");host.querySelector("#vab-part-count")!.textContent=`${craft.length} PARTS`;const engineStages=[...new Set(craft.filter(p=>p.kind==="engine").map(p=>p.engineStage??0))].sort((a,b)=>a-b);host.querySelector<HTMLElement>("#vab-stage-summary")!.textContent=engineStages.length?engineStages.map(stage=>"GROUP "+stage+": "+craft.filter(p=>p.kind==="engine"&&(p.engineStage??0)===stage).length+" ENGINE(S)").join(" / "):"NO ENGINES / ADD AN ENGINE TO CREATE AN IGNITION GROUP";host.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b=>b.onclick=e=>{e.stopPropagation();removePart(b.dataset.remove!);});host.querySelectorAll<HTMLElement>(".vab-stack-row").forEach(r=>r.onclick=()=>select(craftGroup.children.find(g=>g.userData.partId===r.dataset.id) as THREE.Group??null));select(craftGroup.children.find(g=>g.userData.partId===selectedId) as THREE.Group??null);changed(clone(craft));}
 function removePart(id:string){craft=craft.filter(p=>p.id!==id&&!(p.kind==="fuel-line"&&(p.fuelLineStartId===id||p.fuelLineEndId===id)));if(selectedId===id){selectedId=null;selected=null;transform.detach();}redraw();record();}
 function addPart(kind:PartKind,engineType:EngineType="liquid"){
  if(kind==="fuel-line"){beginFuelLineDrawing();return;}
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
    const part:BuildPart={kind,id:uid(),...(kind==="tank"?{topRadius:.44,bottomRadius:.44,height:.96}:{}),...((kind==="nose-cone"||kind==="fairing")?{bottomRadius:.44,height:kind==="fairing"?1.15:.8}:{}),...(kind==="engine"?{engineType,engineStage:0}:{}),x:placement.x,y:placement.y,z:placement.z,ry:placement.rotationY,parentId:placement.parentId,parentNode:placement.parentNode,childNode:placement.childNode};
    additions.push(part);working.push(part);
   }
  }
  if(!additions.length){
   const maxX=craft.reduce((n,p)=>Math.max(n,(p.x??0)+spec(p.kind).size.x/2),0);
   const topY=craft.reduce((n,p)=>Math.max(n,(p.y??0)+spec(p.kind).size.y/2),0);
   const partSize=spec(kind).size;
   const part:BuildPart={kind,id:uid(),...(kind==="tank"?{topRadius:.44,bottomRadius:.44}:{}),...(kind==="engine"?{engineType,engineStage:0}:{}),x:craft.length?maxX+partSize.x/2+.35:0,y:craft.length?Math.max(partSize.y/2,topY):0,z:0};
   additions.push(part);count=1;
  }
  if(craft.length+additions.length>120){status.textContent="PART LIMIT / 120";return;}
  craft.push(...additions);selectedId=additions[0]?.id??null;redraw();record();
  const issues=validateAssembly(craft);
  status.textContent=issues.length?"ASSEMBLY WARNING / CHECK CONNECTIONS":`${spec(kind).name.toUpperCase()} PLACED / AUTO-SNAPPED · ${additions.length}×`;
 }
 function snapMovedPartToNearbyNode(part:BuildPart,g:THREE.Group){
  const previous={x:part.x,y:part.y,z:part.z,rx:part.rx,ry:part.ry,rz:part.rz,parentId:part.parentId,parentNode:part.parentNode,childNode:part.childNode};
  const placement=findNearestAttachmentPlacement(craft.filter(candidate=>candidate.id!==part.id),part.kind,[part.x??0,part.y??0,part.z??0],.8,part);
  if(placement){part.x=placement.x;part.y=placement.y;part.z=placement.z;part.ry=placement.rotationY;part.parentId=placement.parentId;part.parentNode=placement.parentNode;part.childNode=placement.childNode;}
  else{delete part.parentId;delete part.parentNode;delete part.childNode;}
  g.position.set(part.x??0,part.y??0,part.z??0);g.rotation.set(part.rx??0,part.ry??0,part.rz??0);
  if(hasCollision(g,part)){Object.assign(part,previous);g.position.set(part.x??0,part.y??0,part.z??0);g.rotation.set(part.rx??0,part.ry??0,part.rz??0);return false;}
  rememberSafePose(g,part);return Boolean(placement);
 }
 function setTool(next:string){if(next==="delete"){if(selectedId)removePart(selectedId);else status.textContent="SELECT A PART TO DELETE";return;}tool=next;host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===next));if(next==="translate"||next==="rotate"){transform.setMode(next);if(selected)transform.attach(selected);}else transform.detach();orbit.enabled=true;inspect();status.textContent=next.toUpperCase()+" TOOL";}
 host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool!));
 host.querySelector<HTMLSelectElement>("#vab-category-select")!.addEventListener("change",event=>renderCatalog((event.currentTarget as HTMLSelectElement).value));
 renderCatalog("Power");
 transform.addEventListener("dragging-changed",e=>{orbit.enabled=!(e.value as boolean);dragged=Boolean(e.value);if(!dragged&&selected){syncPartFromGroup(selected);const part=craft.find(v=>v.id===selectedId);if(part){const snapped=snapMovedPartToNearbyNode(part,selected);status.textContent=snapped?"PART SNAPPED TO NEAREST FREE ATTACHMENT":"PART MOVED / FREE PLACEMENT";}record();redraw();}});
 transform.addEventListener("objectChange",()=>{if(selected)syncPartFromGroup(selected);});
 canvas.addEventListener("pointermove",e=>{if(!fuelLineDrawing)return;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(craftGroup.children,true);let root:THREE.Object3D|null=hits[0]?.object??null;if(root)while(root.parent&&root.parent!==craftGroup)root=root.parent;const targetId=root?.userData.partId as string|undefined;const target=targetId?craft.find(p=>p.id===targetId):undefined;updateFuelLinePreview(root,target?.kind==="tank"&&target.id!==fuelLineStartId);if(root&&target?.kind!=="tank"){fuelLinePreview.children.forEach(o=>{const m=o as THREE.Mesh;m.material=fuelLineInvalidMaterial;});}});
 canvas.addEventListener("pointerdown",e=>{if(dragged||transform.dragging||transform.axis)return;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(craftGroup.children,true);if(fuelLineDrawing){let root:THREE.Object3D|null=hits[0]?.object??null;if(root)while(root.parent&&root.parent!==craftGroup)root=root.parent;const targetId=root?.userData.partId as string|undefined;const target=tankPart(targetId??null);if(!fuelLineStartId){if(!target){status.textContent="INVALID START / FUEL PIPES CAN ONLY START ON FUEL TANKS";return;}fuelLineStartId=target.id!;status.textContent="START TANK LOCKED / CLICK A SECOND FUEL TANK";return;}if(!target||target.id===fuelLineStartId){status.textContent="INVALID TARGET / FUEL PIPES ONLY CONNECT TWO DIFFERENT FUEL TANKS";fuelLinePreview.children.forEach(o=>{(o as THREE.Mesh).material=fuelLineInvalidMaterial;});return;}const start=tankPart(fuelLineStartId)!;const a=tankWorldPosition(start),b=tankWorldPosition(target),route=pipeGeometry(a,b,start.id!,target.id!);if(!route.clear){status.textContent="NO CLEAR PIPE ROUTE / MOVE COMPONENTS OR CHOOSE ANOTHER TANK";return;}const mid=route.midpoint;const line:BuildPart={kind:"fuel-line",id:uid(),x:mid.x,y:mid.y,z:mid.z,fuelLineStartId:start.id,fuelLineEndId:target.id};craft.push(line);fuelLineStartId=null;fuelLineDrawing=false;fuelLinePreview.visible=false;redraw();record();status.textContent="FUEL PIPE CONNECTED / TANK TO TANK";return;}if(hits.length){let o=hits[0].object;while(o.parent&&o.parent!==craftGroup)o=o.parent;if(o instanceof THREE.Group){if(tool==="fuel-line-draw")return;select(o);return;}}if(tool==="select")select(null);});
 host.querySelector("#vab-undo")!.addEventListener("click",()=>{if(historyIndex<=0)return;historyIndex--;craft=clone(history[historyIndex]);selectedId=null;redraw();});
 host.querySelector("#vab-redo")!.addEventListener("click",()=>{if(historyIndex>=history.length-1)return;historyIndex++;craft=clone(history[historyIndex]);selectedId=null;redraw();});
 host.querySelector("#vab-reset")!.addEventListener("click",()=>{camera.position.set(8,6,10);orbit.target.set(0,1,0);orbit.update();});
 host.addEventListener("keydown",e=>{if((e.key==="Escape"||e.key==="Backspace")&&fuelLineDrawing){e.preventDefault();e.stopPropagation();fuelLineDrawing=false;fuelLineStartId=null;fuelLinePreview.visible=false;fuelLinePreview.children.forEach(child=>(child as THREE.Mesh).geometry.dispose());fuelLinePreview.clear();status.textContent="FUEL PIPE PLACEMENT CANCELLED";return;}if(e.key==="Delete"||e.key==="Backspace"){if(selectedId)removePart(selectedId);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();host.querySelector<HTMLButtonElement>("#vab-undo")!.click();}if(e.key.toLowerCase()==="w")setTool("translate");if(e.key.toLowerCase()==="e")setTool("rotate");if(e.key.toLowerCase()==="q")setTool("select");});
 const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 const render=()=>{if(!alive)return;orbit.update();renderer.render(scene,camera);requestAnimationFrame(render);};
 craft=craft.map((p,i)=>({...p,id:p.id??uid(),x:p.x??0,y:p.y??(craft.length===3&&craft[0]?.kind==="capsule"&&craft[1]?.kind==="tank"&&craft[2]?.kind==="engine"?([1.885,.96,0][i]??0):(craft.length-1-i)*.96),z:p.z??0}));redraw();render();
 return {dispose(){alive=false;observer.disconnect();transform.detach();orbit.dispose();renderer.dispose();}};
}
