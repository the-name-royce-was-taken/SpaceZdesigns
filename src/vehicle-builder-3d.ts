import * as THREE from "three";
import { assignActivationGroup, isActivationCapable, listActivationGroups, partActivationGroup, reorderActivationGroups } from "./activation";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { findAvailableAttachmentPlacement, findNearestAttachmentPlacement, tankFuelCapacity, validateAssembly } from "./vehicle-assembly";
import { groundDropDistance, groundSnapOffset, leftwardClearanceOffset, sideSpawnPosition, translatePartsY } from "./grounding";

export type EngineType = "liquid" | "solid" | "ion" | "methalox" | "hydrolox";
export const rotationSnapForShift=(shift:boolean)=>shift?Math.PI/8:null;
export const engineVariants: {id:EngineType;name:string;description:string;accent:number;thrustKN:number;ispSeconds:number;cost:number}[] = [
 {id:"liquid",name:"Liquid Fuel",description:"Restartable liquid propellant",accent:0xd28a4f,thrustKN:34,ispSeconds:285,cost:175000},
 {id:"solid",name:"Solid Rocket",description:"Simple solid-propellant motor",accent:0xb95d3e,thrustKN:34,ispSeconds:285,cost:45000},
 {id:"ion",name:"Ion Drive",description:"Electric propulsion package",accent:0x4f9bd0,thrustKN:34,ispSeconds:285,cost:220000},
 {id:"methalox",name:"Methalox Engine",description:"Methane and oxygen cycle",accent:0x71a78e,thrustKN:34,ispSeconds:285,cost:160000},
 {id:"hydrolox",name:"Hydrolox Engine",description:"Hydrogen and oxygen cycle",accent:0x91c8d8,thrustKN:34,ispSeconds:285,cost:230000}
];
export type PartKind = "capsule" | "tank" | "engine" | "separator" | "side-decoupler" | "separator-thruster" | "fuel-line" | "fin" | "solar" | "wing" | "control" | "wheel" | "dock" | "battery" | "remote-control" | "reaction-wheel" | "rcs" | "strut" | "nose-cone" | "fairing" | "conical-fairing" | "interstage-fairing" | "clam-shell-fairing" | "airbrake" | "strake" | "landing-leg" | "heat-shield" | "rover-wheel" | "structural-beam" | "structural-angle" | "structural-hub";
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
  retracted?: boolean;
  radius?: number;
  thickness?: number;
  solarLength?: number;
  structuralLength?: number;
  solarDeployed?: boolean;
  activationGroup?: number;
}
interface PartSpec {kind:PartKind;name:string;category:string;mass:number;fuel:number;thrust:number;cost:number;color:number;size:THREE.Vector3}
const parts:PartSpec[]=[
 {kind:"capsule",name:"Command pod",category:"Controller",mass:1.2,fuel:0,thrust:0,cost:240000,color:0xdce8ef,size:new THREE.Vector3(.9,.9,.9)},
 {kind:"remote-control",name:"Remote control module",category:"Controller",mass:.16,fuel:0,thrust:0,cost:35000,color:0x6fa7bd,size:new THREE.Vector3(.56,.28,.56)},
 {kind:"reaction-wheel",name:"Reaction wheel",category:"Controller",mass:.22,fuel:0,thrust:0,cost:18000,color:0xb8c2ca,size:new THREE.Vector3(.56,.28,.56)},
 {kind:"tank",name:"Fuel tank",category:"Power",mass:.8,fuel:120,thrust:0,cost:65000,color:0xb7c8d5,size:new THREE.Vector3(.9,1.1,.9)},
 {kind:"engine",name:"Liquid engine",category:"Engines",mass:.7,fuel:0,thrust:34,cost:175000,color:0xe6a65e,size:new THREE.Vector3(.85,.8,.85)},
 {kind:"separator",name:"Stack decoupler",category:"Couplers",mass:.15,fuel:0,thrust:0,cost:12000,color:0xe5c56d,size:new THREE.Vector3(1,.22,1)},
 {kind:"side-decoupler",name:"Side decoupler",category:"Couplers",mass:.18,fuel:0,thrust:0,cost:15000,color:0xe2bd68,size:new THREE.Vector3(.72,.28,.32)},
 {kind:"separator-thruster",name:"Separation thruster",category:"Couplers",mass:.08,fuel:0,thrust:2,cost:8000,color:0xd68a62,size:new THREE.Vector3(.38,.24,.3)},
 {kind:"fuel-line",name:"Fuel connector pipe",category:"Power",mass:.035,fuel:0,thrust:0,cost:3500,color:0x65aeb4,size:new THREE.Vector3(.8,.12,.12)},
 {kind:"fin",name:"Stability fin",category:"Aerodynamics",mass:.12,fuel:0,thrust:0,cost:7000,color:0x6c9db8,size:new THREE.Vector3(.9,.7,.18)},
 {kind:"wing",name:"Wing panel",category:"Aerodynamics",mass:.24,fuel:0,thrust:0,cost:18000,color:0x759bb7,size:new THREE.Vector3(1.7,.12,1.1)},
 {kind:"control",name:"Elevon",category:"Aerodynamics",mass:.09,fuel:0,thrust:0,cost:9000,color:0xd1a66b,size:new THREE.Vector3(1,.1,.42)},
 {kind:"landing-leg",name:"Retractable landing leg",category:"Other",mass:.2,fuel:0,thrust:0,cost:22000,color:0x8798a8,size:new THREE.Vector3(.3,1.05,.3)},
 {kind:"heat-shield",name:"Heat shield",category:"Other",mass:.28,fuel:0,thrust:0,cost:28000,color:0x9a6b50,size:new THREE.Vector3(1,.18,1)},
 {kind:"rover-wheel",name:"Rover wheel",category:"Other",mass:.12,fuel:0,thrust:0,cost:12000,color:0x34434e,size:new THREE.Vector3(.65,.55,.3)},
 {kind:"wheel",name:"Legacy landing gear",category:"Other",mass:.16,fuel:0,thrust:0,cost:9000,color:0x8798a8,size:new THREE.Vector3(.22,.85,.22)},
 {kind:"solar",name:"Solar array",category:"Power",mass:.08,fuel:0,thrust:0,cost:18000,color:0x4b91bb,size:new THREE.Vector3(1.8,.06,.7)},
 {kind:"battery",name:"Battery pack",category:"Power",mass:.1,fuel:0,thrust:0,cost:12000,color:0x8d9b68,size:new THREE.Vector3(.6,.35,.6)},
 {kind:"dock",name:"Docking port",category:"Other",mass:.12,fuel:0,thrust:0,cost:30000,color:0xc2cbd1,size:new THREE.Vector3(.42,.28,.42)},
 {kind:"rcs",name:"RCS thruster",category:"Engines",mass:.07,fuel:0,thrust:0,cost:14000,color:0x9caeba,size:new THREE.Vector3(.4,.32,.4)},
 {kind:"strut",name:"Structural girder",category:"Other",mass:.04,fuel:0,thrust:0,cost:1500,color:0xb7a88d,size:new THREE.Vector3(.12,1,.12)},
 {kind:"structural-beam",name:"Braced beam",category:"Structural",mass:.09,fuel:0,thrust:0,cost:4500,color:0x9eacb7,size:new THREE.Vector3(.28,1.2,.28)},
 {kind:"structural-angle",name:"Right-angle connector",category:"Structural",mass:.06,fuel:0,thrust:0,cost:3500,color:0xd0a66d,size:new THREE.Vector3(.55,.55,.22)},
 {kind:"structural-hub",name:"Six-way connector",category:"Structural",mass:.08,fuel:0,thrust:0,cost:5000,color:0xc0ccd4,size:new THREE.Vector3(.48,.48,.48)},
 {kind:"nose-cone",name:"Nose cone",category:"Aerodynamics",mass:.12,fuel:0,thrust:0,cost:8000,color:0xd4dfe7,size:new THREE.Vector3(.88,.8,.88)},
 {kind:"fairing",name:"Ogive payload fairing",category:"Payload",mass:.2,fuel:0,thrust:0,cost:22000,color:0x9bb6c9,size:new THREE.Vector3(.88,1.15,.88)},
 {kind:"conical-fairing",name:"Conical payload fairing",category:"Payload",mass:.19,fuel:0,thrust:0,cost:18000,color:0xb6c7d4,size:new THREE.Vector3(.88,1.15,.88)},
 {kind:"interstage-fairing",name:"Interstage adapter fairing",category:"Payload",mass:.22,fuel:0,thrust:0,cost:26000,color:0x8ea7b8,size:new THREE.Vector3(.88,1.15,.88)},
 {kind:"clam-shell-fairing",name:"Clamshell payload fairing",category:"Payload",mass:.24,fuel:0,thrust:0,cost:32000,color:0xc2d0d9,size:new THREE.Vector3(.88,1.15,.88)},
 {kind:"airbrake",name:"Airbrake",category:"Aerodynamics",mass:.08,fuel:0,thrust:0,cost:9000,color:0xb78b68,size:new THREE.Vector3(.7,.5,.5)},
 {kind:"strake",name:"Body strake",category:"Aerodynamics",mass:.07,fuel:0,thrust:0,cost:4500,color:0x7898ad,size:new THREE.Vector3(.18,.8,.42)}
];
export const partCatalog=parts;
export const partCost=(kind:PartKind,engineType:EngineType="liquid")=>kind==="engine"?(engineVariants.find(engine=>engine.id===engineType)?.cost??engineVariants[0]!.cost):(parts.find(part=>part.kind===kind)?.cost??0);
export const isFairingKind=(kind:PartKind)=>kind==="fairing"||kind==="conical-fairing"||kind==="interstage-fairing"||kind==="clam-shell-fairing";
export const defaultFairingHeight=(kind:PartKind)=>isFairingKind(kind)?1.15:.8;
const clone=(a:BuildPart[])=>a.map(p=>({...p}));
const engineDisplayName=(p:BuildPart)=>engineVariants.find(e=>e.id===(p.engineType??"liquid"))?.name??"Liquid Fuel";

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
 solar:'<path d="M15 15h42v30H15z" fill="'+fill+'" stroke="#8bd7ec" stroke-width="2"/><path d="M25.5 15v30M36 15v30M46.5 15v30M15 25h42M15 35h42" stroke="#d5f4ff" stroke-width="1.5"/><path d="M10 30h5M57 30h5" stroke="#e3edf5" stroke-width="3"/>',
 battery:'<rect x="18" y="14" width="36" height="30" rx="4" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M29 10h14v4H29z" fill="#e3edf5"/>',
 "remote-control":'<rect x="17" y="19" width="38" height="27" rx="4" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M36 19V8m0 0l-8 5m8-5l8 5" stroke="#d9e8ef" stroke-width="3"/><circle cx="27" cy="31" r="3" fill="#69e0c1"/><circle cx="39" cy="31" r="3" fill="#e8c36d"/>',
 "reaction-wheel":'<circle cx="36" cy="30" r="21" fill="'+fill+'" stroke="#e3edf5" stroke-width="3"/><circle cx="36" cy="30" r="8" fill="#344c5d" stroke="#dce8ef" stroke-width="2"/><path d="M36 9v13m0 16v13M15 30h13m16 0h13" stroke="#dce8ef" stroke-width="3"/>',
 rcs:'<rect x="24" y="19" width="24" height="22" rx="3" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M20 18l-8-7M52 18l8-7M20 42l-8 7M52 42l8 7" stroke="#d9a06f" stroke-width="4"/>',
 dock:'<circle cx="36" cy="30" r="16" fill="'+fill+'" stroke="#e3edf5" stroke-width="3"/><circle cx="36" cy="30" r="7" fill="#263d50"/>',
 fin:'<path d="M15 44L25 12h32L45 44z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
 wing:'<path d="M7 25l52-13 10 9-52 18z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
 control:'<path d="M13 25h46v12H13z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
 wheel:'<path d="M30 10h12v25H30z" fill="'+fill+'"/><circle cx="36" cy="43" r="9" fill="#273542" stroke="#e3edf5" stroke-width="2"/>',
 strut:'<path d="M32 8h8v44h-8z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
  "structural-beam":'<path d="M24 7h24v46H24z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M24 7l24 15-24 15 24 16M48 7L24 22l24 15-24 16" fill="none" stroke="#dce8ef" stroke-width="2"/>',
  "structural-angle":'<path d="M18 8h13v31h31v13H18z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
  "structural-hub":'<path d="M25 25V7h22v18h18v22H47v18H25V47H7V25z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
  "nose-cone":'<path d="M36 7L12 48h48z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
  fairing:'<path d="M36 7Q31 17 18 26L13 48h46L54 26Q41 17 36 7z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
  "conical-fairing":'<path d="M36 7L13 48h46z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/>',
  "interstage-fairing":'<path d="M18 12h36l-5 36H23z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M18 12h36M23 48h26" stroke="#dce8ef" stroke-width="2"/>',
  "clam-shell-fairing":'<path d="M36 7Q31 17 18 26L13 48h46L54 26Q41 17 36 7z" fill="'+fill+'" stroke="#e3edf5" stroke-width="2"/><path d="M36 10v36" stroke="#344d61" stroke-width="2"/>'

 };
 return '<svg class="vab-part-preview" viewBox="0 0 72 60" role="img" aria-hidden="true">'+(shapes[kind]??shapes.strut)+'</svg>';
}
function catalogCard(p:PartSpec){
 return '<button type="button" class="vab-part-card" data-add="'+p.kind+'">'+previewSvg(p.kind,p.color)+'<span><b>'+p.name+'</b><small>'+p.mass.toFixed(2)+' t'+(p.fuel? ' · '+p.fuel+' fuel':'')+'<br><strong>'+p.cost.toLocaleString()+' cr</strong></small></span></button>';
}

export function createEngineModel(type:EngineType):THREE.Group{const g=new THREE.Group();const add=(geometry:THREE.BufferGeometry,material:THREE.Material,position=new THREE.Vector3())=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(position);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
   
   const steel=new THREE.MeshStandardMaterial({color:0x9aa8ae,roughness:.34,metalness:.82});
   const gold=new THREE.MeshStandardMaterial({color:0xc49a55,roughness:.38,metalness:.76});
   const bellMaterial=new THREE.MeshStandardMaterial({color:0x8e9da4,roughness:.3,metalness:.84,side:THREE.DoubleSide});
   const band=(radius:number,y:number,tube=.014,material=steel)=>{const ring=add(new THREE.TorusGeometry(radius,tube,5,12),material,new THREE.Vector3(0,y,0));ring.rotation.x=Math.PI/2;return ring;};
   const pipe=(points:THREE.Vector3[],radius=.018,material=gold)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,radius,5,false),material);
   const continuousCore=(profile:THREE.Vector2[])=>add(new THREE.LatheGeometry(profile,12),bellMaterial);
   if(type==="solid"){
    // One closed pressure-case/nozzle shell: the domed head, case and throat are a single surface.
    continuousCore([
     new THREE.Vector2(0,.46),new THREE.Vector2(.12,.445),new THREE.Vector2(.205,.39),new THREE.Vector2(.245,.31),
     new THREE.Vector2(.245,-.08),new THREE.Vector2(.23,-.18),new THREE.Vector2(.18,-.26),new THREE.Vector2(.27,-.49),
     new THREE.Vector2(.245,-.49),new THREE.Vector2(.15,-.27),new THREE.Vector2(.105,-.18),new THREE.Vector2(.105,.25),
     new THREE.Vector2(.08,.34),new THREE.Vector2(0,.34)
    ]);
    for(const y of [-.08,.2])band(.248,y,.022,steel);
    band(.258,-.475,.02,gold);
    band(.075,.425,.012,gold);
   }else if(type==="ion"){
    // The barrel, mounting flange and emitter plate share one continuous solid profile.
    continuousCore([
     new THREE.Vector2(0,.40),new THREE.Vector2(.255,.40),new THREE.Vector2(.255,.36),new THREE.Vector2(.29,.36),
     new THREE.Vector2(.29,.29),new THREE.Vector2(.255,.29),new THREE.Vector2(.255,-.10),new THREE.Vector2(.285,-.10),
     new THREE.Vector2(.285,-.18),new THREE.Vector2(.235,-.18),new THREE.Vector2(.235,-.195),new THREE.Vector2(0,-.195)
    ]);
    for(const radius of [.11,.17,.22])band(radius,-.194,.008,gold);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*.205,z=Math.sin(a)*.205;add(new THREE.CylinderGeometry(.014,.014,.045,6),gold,new THREE.Vector3(x,-.155,z));}
    for(let i=0;i<4;i++){const a=i*Math.PI/2,x=Math.cos(a)*.277,z=Math.sin(a)*.277;add(new THREE.CylinderGeometry(.022,.022,.16,8),steel,new THREE.Vector3(x,.12,z));}
   }else if(type==="hydrolox"){
    // A single thin-wall cryogenic chamber, throat and high-expansion vacuum bell.
    continuousCore([
     new THREE.Vector2(0,.46),new THREE.Vector2(.225,.46),new THREE.Vector2(.225,.39),new THREE.Vector2(.145,.37),
     new THREE.Vector2(.145,.18),new THREE.Vector2(.12,.09),new THREE.Vector2(.105,-.035),new THREE.Vector2(.16,-.22),
     new THREE.Vector2(.27,-.49),new THREE.Vector2(.375,-.72),new THREE.Vector2(.356,-.72),new THREE.Vector2(.255,-.48),
     new THREE.Vector2(.145,-.20),new THREE.Vector2(.09,-.035),new THREE.Vector2(.095,.10),new THREE.Vector2(.105,.29),
     new THREE.Vector2(.105,.36),new THREE.Vector2(0,.36)
    ]);
    for(const side of [-1,1]){
     add(new THREE.CylinderGeometry(.075,.085,.19,8),steel,new THREE.Vector3(side*.205,.285,0));
     add(new THREE.CylinderGeometry(.075,.09,.09,8),gold,new THREE.Vector3(side*.205,.16,0));
     pipe([new THREE.Vector3(side*.2,.38,0),new THREE.Vector3(side*.32,.29,0),new THREE.Vector3(side*.29,.12,0),new THREE.Vector3(side*.13,.04,0)],.014,gold);
    }
    band(.375,-.705,.016,steel);band(.13,-.16,.014,gold);
    for(const y of [.27,.32])band(.147,y,.008,gold);
   }else if(type==="methalox"){
    // Continuous stout chamber, converging throat and regeneratively cooled bell shell.
    continuousCore([
     new THREE.Vector2(0,.46),new THREE.Vector2(.235,.46),new THREE.Vector2(.235,.385),new THREE.Vector2(.17,.385),
     new THREE.Vector2(.17,.20),new THREE.Vector2(.145,.09),new THREE.Vector2(.105,-.035),new THREE.Vector2(.15,-.20),
     new THREE.Vector2(.245,-.43),new THREE.Vector2(.345,-.62),new THREE.Vector2(.326,-.62),new THREE.Vector2(.23,-.42),
     new THREE.Vector2(.135,-.18),new THREE.Vector2(.09,-.035),new THREE.Vector2(.11,.10),new THREE.Vector2(.12,.30),
     new THREE.Vector2(.12,.36),new THREE.Vector2(0,.36)
    ]);
    for(const side of [-1,1]){
     add(new THREE.CylinderGeometry(.07,.09,.2,8),gold,new THREE.Vector3(side*.22,.27,0));
     add(new THREE.CylinderGeometry(.075,.09,.085,8),steel,new THREE.Vector3(side*.22,.13,0));
     pipe([new THREE.Vector3(side*.2,.4,0),new THREE.Vector3(side*.31,.31,0),new THREE.Vector3(side*.31,.08,0),new THREE.Vector3(side*.13,-.02,0)],.016,gold);
    }
    for(let row=0;row<4;row++){const y=-.245-row*.09,r=.17+row*.043;band(r,y,.009,gold);}
    for(let i=0;i<4;i++){const a=i*Math.PI/2;const brace=add(new THREE.BoxGeometry(.025,.16,.025),steel,new THREE.Vector3(Math.cos(a)*.175,.34,Math.sin(a)*.175));brace.rotation.z=-Math.cos(a)*.16;brace.rotation.x=Math.sin(a)*.16;}
    band(.345,-.605,.016,steel);
   }else{
    // Conventional pump-fed kerolox engine with a continuous smooth-bell chamber/nozzle shell.
    continuousCore([
     new THREE.Vector2(0,.46),new THREE.Vector2(.255,.46),new THREE.Vector2(.255,.385),new THREE.Vector2(.17,.385),
     new THREE.Vector2(.17,.20),new THREE.Vector2(.145,.09),new THREE.Vector2(.105,-.035),new THREE.Vector2(.16,-.22),
     new THREE.Vector2(.27,-.49),new THREE.Vector2(.375,-.68),new THREE.Vector2(.356,-.68),new THREE.Vector2(.255,-.48),
     new THREE.Vector2(.145,-.20),new THREE.Vector2(.09,-.035),new THREE.Vector2(.11,.10),new THREE.Vector2(.12,.30),
     new THREE.Vector2(.12,.36),new THREE.Vector2(0,.36)
    ]);
    band(.14,-.19,.016,steel);band(.375,-.665,.016,steel);
    for(let i=0;i<4;i++){const angle=i*Math.PI/2,strut=add(new THREE.BoxGeometry(.035,.19,.035),steel,new THREE.Vector3(Math.cos(angle)*.175,.34,Math.sin(angle)*.175));strut.rotation.z=-Math.cos(angle)*.18;strut.rotation.x=Math.sin(angle)*.18;}
    pipe([new THREE.Vector3(.16,.36,0),new THREE.Vector3(.25,.25,.02),new THREE.Vector3(.22,.02,.02),new THREE.Vector3(.13,-.08,0)],.014,gold);
   }
   // Scale engine families to believable proportions relative to the 0.9 m tank body.
   const engineScale:Record<EngineType,number>={liquid:.76,solid:.78,ion:.72,methalox:.78,hydrolox:.84};
   g.scale.setScalar(engineScale[type]);
  return g;}
export function createLandingLegModel(retracted=true):THREE.Group{
 const root=new THREE.Group();
 const steel=new THREE.MeshStandardMaterial({color:0x9aa9b2,metalness:.78,roughness:.32});
 const dark=new THREE.MeshStandardMaterial({color:0x536b78,metalness:.72,roughness:.38});
 const pistonMetal=new THREE.MeshStandardMaterial({color:0xd6e0e5,metalness:.88,roughness:.24});
 const footMaterial=new THREE.MeshStandardMaterial({color:0x687985,metalness:.62,roughness:.5});
 // The mounting plate sits against the vehicle's side; the leg stows vertically.
 const mount=new THREE.Mesh(new THREE.BoxGeometry(.14,.38,.34),dark);
 mount.position.set(-.035,.08,0);mount.castShadow=true;mount.receiveShadow=true;root.add(mount);
 const hinge=new THREE.Group();hinge.position.set(.045,.12,0);root.add(hinge);
 const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.065,.075,.62,12),steel);
 sleeve.position.y=.31;sleeve.castShadow=true;sleeve.receiveShadow=true;hinge.add(sleeve);
 const collar=new THREE.Mesh(new THREE.CylinderGeometry(.082,.082,.065,12),dark);
 collar.position.y=.59;hinge.add(collar);
 const piston=new THREE.Mesh(new THREE.CylinderGeometry(.031,.038,.5,12),pistonMetal);
 piston.position.y=.58+(retracted?0:.34);piston.castShadow=true;piston.receiveShadow=true;hinge.add(piston);
 const foot=new THREE.Group();foot.position.y=retracted?.82:1.24;hinge.add(foot);
 const pad=new THREE.Mesh(new THREE.BoxGeometry(.32,.065,.26),footMaterial);pad.castShadow=true;pad.receiveShadow=true;foot.add(pad);
 const toe=new THREE.Mesh(new THREE.BoxGeometry(.24,.035,.3),dark);toe.position.y=-.035;foot.add(toe);
 hinge.rotation.z=retracted?0:-2.0;
 foot.rotation.z=-hinge.rotation.z;
 root.userData.landingLegModel=true;
 root.userData.deploymentProgress=retracted?0:1;
 root.userData.deploymentTarget=retracted?0:1;
 root.userData.legs=[{hinge,piston,foot}];
 return root;
}
export function setLandingLegDeployment(root:THREE.Object3D,extended=true){
 root.traverse(o=>{if(o.userData.landingLegModel)o.userData.deploymentTarget=extended?1:0;});
}
export function animateLandingLegModels(root:THREE.Object3D,dt:number){
 root.traverse(o=>{
  if(!o.userData.landingLegModel)return;
  const p0=Number(o.userData.deploymentProgress??0),target=Number(o.userData.deploymentTarget??p0);
  const p=p0+(target-p0)*Math.min(1,Math.max(0,dt)*3.2);
  o.userData.deploymentProgress=Math.abs(target-p)<.002?target:p;
  for(const leg of o.userData.legs as {hinge:THREE.Group;piston:THREE.Mesh;foot:THREE.Group}[]){
   leg.hinge.rotation.z=-2.0*p;
   leg.piston.position.y=.58+.34*p;
   leg.foot.position.y=.82+.42*p;
   leg.foot.rotation.z=-leg.hinge.rotation.z;
  }
 });
}
export function mountVehicleBuilder(host:HTMLElement,initial:BuildPart[],changed:(parts:BuildPart[])=>void,economy?:{purchase:(parts:BuildPart[])=>boolean}){
 host.innerHTML=`<div class="vab-tools"><div class="vab-tool-group"><button data-tool="select" class="active">SELECT</button><button data-tool="translate">MOVE</button><button data-tool="rotate">ROTATE</button><button data-tool="delete">DELETE</button></div><div class="vab-tool-group"><span class="vab-snap-status">MAGNETIC PART SNAP / ALWAYS ON · INVISIBLE 9×9 SURFACE NODES</span><label>SYMMETRY <select id="vab-symmetry"><option value="1">OFF</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label></div><div class="vab-tool-group"><button id="vab-undo">UNDO</button><button id="vab-redo">REDO</button><button id="vab-reset">RESET VIEW</button></div></div>
 <div class="vab-workspace"><div class="builder-toolbar"><span>VEHICLE ASSEMBLY BUILDING / 3D EDITOR</span><span>SELECT · ATTACH · MOVE · ROTATE</span><button type="button" id="vab-blueprints-toggle" class="vab-blueprints-trigger" aria-expanded="false">BLUEPRINTS</button></div><section id="vab-blueprints-panel" class="vab-blueprints-panel" hidden><div class="vab-blueprints-head"><div><b>BLUEPRINT LIBRARY</b><small>LOCAL INDEXEDDB STORAGE</small></div><button type="button" id="vab-blueprints-close" aria-label="Close blueprints">×</button></div><div id="vab-blueprints-list" class="vab-blueprints-list"><div class="vab-blueprints-empty">Loading saved builds…</div></div><div class="vab-blueprints-footer"><button type="button" id="vab-blueprint-add" class="vab-blueprint-add">＋ NEW BLUEPRINT</button></div></section><aside class="vab-catalog"><div class="vab-section-title">PARTS <small>SELECT TO ADD</small></div><label class="vab-category-label" for="vab-category-select">CATEGORY</label><select id="vab-category-select" class="vab-category-select" aria-label="Part category">${["Power","Aerodynamics","Payload","Other","Engines","Couplers","Controller","Structural"].map((name,i)=>`<option value="${name}" ${i===0?"selected":""}>${name.toUpperCase()}</option>`).join("")}</select><div class="vab-catalog-items" id="vab-catalog-items"></div></aside><div class="vab-workarea"><div class="builder-viewport vab-viewport"><canvas id="vehicle-3d-canvas" tabindex="0" aria-label="3D vehicle builder. Click to select; Control or Command click to add or remove parts; Shift click to select a range."></canvas><div class="builder-hud" id="vab-status">SELECT A PART OR ADD FROM THE CATALOG</div><div class="vab-axis">X / Y / Z</div></div><div class="vab-lower"><section><div class="vab-section-title"><span>CRAFT HIERARCHY <small id="vab-part-count">0 PARTS</small></span><button type="button" id="vab-activation-toggle" class="vab-activation-trigger" aria-expanded="false">ACTIVATION LIST</button></div><div class="vab-stage-summary" id="vab-stage-summary">NO ACTIVATION GROUPS / ADD A GROUP TO SEQUENCE PART ACTIONS</div><div class="builder-stack" id="builder-stack"></div><div class="vab-inspector" id="vab-inspector"><b>NO PART SELECTED</b><small>Select a component to inspect its placement.</small></div></section></div><section id="vab-activation-panel" class="vab-activation-panel" hidden><div class="vab-activation-head"><div><b>ACTIVATION LIST</b><small>ORDERED FLIGHT ACTION GROUPS</small></div><button type="button" id="vab-activation-add" aria-label="Add activation group">＋</button></div><div id="vab-activation-groups" class="vab-activation-groups"></div><div id="vab-activation-editor" class="vab-activation-editor" hidden></div></section></div></div>`;
 const canvas=host.querySelector<HTMLCanvasElement>("#vehicle-3d-canvas")!;
 const purchaseParts=(items:BuildPart[])=>!economy||economy.purchase(items);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"low-power"});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);renderer.shadowMap.enabled=true;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x101d2a);
 // Industrial VAB shell: open toward the camera so the craft remains easy to work on.
 const hangar=new THREE.Group();hangar.name="vehicle-assembly-hangar";scene.add(hangar);
 const hangarSteel=new THREE.MeshStandardMaterial({color:0x34495a,roughness:.78,metalness:.58});
 const hangarEdge=new THREE.MeshStandardMaterial({color:0x78909f,roughness:.48,metalness:.72});
 const hangarWall=new THREE.MeshStandardMaterial({color:0x1b2d3c,roughness:.86,metalness:.28,side:THREE.DoubleSide});
 const hangarDoor=new THREE.MeshStandardMaterial({color:0x263f50,roughness:.7,metalness:.45});
 const hangarGlow=new THREE.MeshStandardMaterial({color:0x9bd9e4,emissive:0x4b9db2,emissiveIntensity:1.5,roughness:.35});
 const hangarBox=(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=true;hangar.add(mesh);return mesh;};
 // Full-length concrete slab with aggregate texture and expansion joints.
 const concreteCanvas=document.createElement("canvas");concreteCanvas.width=512;concreteCanvas.height=1024;const concreteCtx=concreteCanvas.getContext("2d")!;concreteCtx.fillStyle="#68727a";concreteCtx.fillRect(0,0,512,1024);let noiseSeed=7319;for(let i=0;i<22000;i++){noiseSeed=(noiseSeed*1664525+1013904223)>>>0;const x=noiseSeed%512;noiseSeed=(noiseSeed*1664525+1013904223)>>>0;const y=noiseSeed%1024;noiseSeed=(noiseSeed*1664525+1013904223)>>>0;const shade=105+(noiseSeed%75);concreteCtx.fillStyle="rgba("+shade+","+shade+","+shade+","+(0.035+(noiseSeed%12)/180)+")";const size=1+(noiseSeed%3);concreteCtx.fillRect(x,y,size,size);}
 concreteCtx.strokeStyle="rgba(25,35,42,.32)";concreteCtx.lineWidth=3;for(let y=256;y<1024;y+=256){concreteCtx.beginPath();concreteCtx.moveTo(0,y);concreteCtx.lineTo(512,y);concreteCtx.stroke();}for(let x=256;x<512;x+=256){concreteCtx.beginPath();concreteCtx.moveTo(x,0);concreteCtx.lineTo(x,1024);concreteCtx.stroke();}
 concreteCtx.strokeStyle="rgba(220,225,226,.13)";concreteCtx.lineWidth=1;for(let y=258;y<1024;y+=256){concreteCtx.beginPath();concreteCtx.moveTo(0,y);concreteCtx.lineTo(512,y);concreteCtx.stroke();}
 const concreteTexture=new THREE.CanvasTexture(concreteCanvas);concreteTexture.wrapS=THREE.RepeatWrapping;concreteTexture.wrapT=THREE.RepeatWrapping;concreteTexture.repeat.set(2,4);concreteTexture.colorSpace=THREE.SRGBColorSpace;concreteTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();
 const hangarFloor=new THREE.Mesh(new THREE.PlaneGeometry(22,40),new THREE.MeshStandardMaterial({color:0xffffff,map:concreteTexture,roughness:.96,metalness:.025}));hangarFloor.rotation.x=-Math.PI/2;hangarFloor.position.set(0,-.035,-1);hangarFloor.receiveShadow=true;hangar.add(hangarFloor);
 hangarBox(22,.18,.22,0,.02,18.8,hangarEdge);hangarBox(22,.18,.22,0,.02,-20.8,hangarEdge);
 // Side walls, structural columns, roof trusses and overhead service rails.
 hangarBox(.32,15.6,40,-10.8,7.8,-1,hangarSteel);hangarBox(.32,15.6,40,10.8,7.8,-1,hangarSteel);
 hangarBox(.12,13.2,39,-10.58,7.8,-1,hangarWall);hangarBox(.12,13.2,39,10.58,7.8,-1,hangarWall);
 for(let z=-19;z<=17;z+=4){hangarBox(.42,15.6,.42,-10.35,7.8,z,hangarEdge);hangarBox(.42,15.6,.42,10.35,7.8,z,hangarEdge);hangarBox(21.2,.32,.34,0,15.35,z,hangarEdge);hangarBox(.22,.22,21,0,14.9,z,hangarSteel);}
 hangarBox(21.6,.42,.42,0,15.55,-1,hangarEdge);hangarBox(21.6,.42,.42,0,15.55,17,hangarEdge);
 // Tall segmented blast doors at the far end of the bay.
 hangarBox(21.6,15.6,.36,0,7.8,-21.05,hangarSteel);
 for(let x=-9.6;x<=9.6;x+=1.6){hangarBox(1.48,12.8,.12,x,6.8,-20.82,hangarDoor);hangarBox(.045,12.4,.035,x+.74,6.8,-20.73,hangarEdge);}
 hangarBox(21.4,.28,.24,0,14.15,-20.65,hangarEdge);hangarBox(21.4,.28,.24,0,.25,-20.65,hangarEdge);
 // Repeating roof lights and yellow safety markings around the assembly pad.
 for(let z=-17;z<=15;z+=5){hangarBox(7,.055,.42,0,15.05,z,hangarGlow);hangarBox(.12,.08,36,-10.1,.08,z,hangarGlow);hangarBox(.12,.08,36,10.1,.08,z,hangarGlow);}
 const safetyYellow=new THREE.MeshStandardMaterial({color:0xe3b64d,roughness:.8,metalness:.12});
 hangarBox(.16,.025,36,-8.9,.012,-1,safetyYellow);hangarBox(.16,.025,36,8.9,.012,-1,safetyYellow);
 for(let z=-17;z<=15;z+=3){hangarBox(1.2,.018,.09,0,.014,z,hangarEdge);}
 // Workshop clutter: maintenance benches, tool storage, spare hardware and corner equipment.
 const hangarTool=new THREE.MeshStandardMaterial({color:0x31566a,roughness:.62,metalness:.58});
 const hangarRubber=new THREE.MeshStandardMaterial({color:0x202a30,roughness:.94,metalness:.04});
 const hangarWood=new THREE.MeshStandardMaterial({color:0x705b42,roughness:.9,metalness:.02});
 const hangarOrange=new THREE.MeshStandardMaterial({color:0xc47738,roughness:.72,metalness:.28});
 const hangarCable=new THREE.MeshStandardMaterial({color:0x343b40,roughness:.82,metalness:.42});
 const hangarBrass=new THREE.MeshStandardMaterial({color:0xb18b4c,roughness:.48,metalness:.72});
 const hangarCylinder=(radius:number,length:number,x:number,y:number,z:number,material:THREE.Material,axis:"x"|"y"|"z"="y")=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,12),material);if(axis==="x")mesh.rotation.z=Math.PI/2;else if(axis==="z")mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;hangar.add(mesh);return mesh;};
 const hangarRope=(points:THREE.Vector3[],radius:number,material:THREE.Material)=>{const curve=new THREE.CatmullRomCurve3(points);const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,points.length*12),radius,6,false),material);mesh.castShadow=true;hangar.add(mesh);return mesh;};
 // Side-wall tool benches and cabinets, kept outside the vehicle assembly footprint.
 for(const side of [-1,1]){
  const x=side*9.55;
  hangarBox(1.55,1.05,2.6,x,.58,7.4,hangarSteel);
  hangarBox(1.62,.09,2.68,x,1.13,7.4,hangarEdge);
  for(let z=6.55;z<=8.25;z+=.85){hangarBox(1.42,.025,.035,x,1.18,z,hangarBrass);}
  hangarBox(.82,1.65,.72,side*9.48,.88,3.1,hangarTool);
  hangarBox(.9,.08,.8,side*9.48,1.72,3.1,hangarEdge);
  for(let y=.42;y<=1.35;y+=.3)hangarBox(.72,.035,.035,side*9.48,y,3.48,hangarBrass);
  // Wall-mounted pipe racks, reels and a ladder at each service bay.
  hangarBox(.12,2.4,.12,side*10.05,1.35,-4.8,hangarEdge);
  hangarBox(.12,2.4,.12,side*9.62,1.35,-4.8,hangarEdge);
  for(let y=.35;y<=2.35;y+=.4)hangarBox(.52,.055,.07,side*9.84,y,-4.8,hangarTool);
  hangarCylinder(.42,.22,side*9.55,2.25,-9.1,hangarCable,"x");
  hangarCylinder(.29,.24,side*9.55,2.25,-9.1,hangarOrange,"x");
  hangarCylinder(.075,.62,side*9.55,2.25,-9.1,hangarCable,"x");
  // Low stacked shipping cases and spare tyre assemblies in the rear corners.
  hangarBox(1.25,.72,1.05,side*8.95,.38,-17.1,hangarWood);
  hangarBox(1.05,.58,.88,side*9.15,1.02,-17.15,hangarOrange);
  hangarBox(1.32,.06,1.12,side*8.95,.76,-17.1,hangarEdge);
  hangarCylinder(.42,.2,side*9.35,.23,-13.1,hangarRubber,"x");
  hangarCylinder(.25,.22,side*9.35,.23,-13.1,hangarEdge,"x");
  // A few wall conduit runs and brackets.
  hangarRope([new THREE.Vector3(side*10.22,4.8,-18),new THREE.Vector3(side*10.22,4.8,-10),new THREE.Vector3(side*10.22,4.5,-6)],.035,hangarCable);
  for(let z=-16;z<=-8;z+=2)hangarBox(.18,.16,.12,side*10.18,4.8,z,hangarBrass);
 }
 // Scattered floor-side maintenance gear: hose reels, tool chests and secured crates.
 hangarBox(1.45,.95,1.05,-8.75,.48,12.2,hangarOrange);
 hangarBox(1.52,.09,1.12,-8.75,.99,12.2,hangarEdge);
 hangarBox(1.2,.035,.04,-8.75,1.04,12.2,hangarCable);
 hangarBox(1.25,.68,.95,8.9,.34,12.6,hangarWood);
 hangarBox(1.3,.07,1,8.9,.72,12.6,hangarEdge);
 hangarCylinder(.48,.22,-8.85,.5,9.1,hangarCable,"x");
 hangarCylinder(.3,.24,-8.85,.5,9.1,hangarOrange,"x");
 hangarCylinder(.1,.28,-8.85,.5,9.1,hangarBrass,"x");
 hangarBox(.72,.88,.62,8.9,.44,-8.8,hangarTool);
 hangarBox(.78,.07,.68,8.9,.91,-8.8,hangarEdge);
 hangarBox(.05,.08,.035,8.9,.78,-8.46,hangarBrass);
 // Overhead service crane: trolley, twin sheaves, hanging steel cables and a hook block.
 const craneY=14.72,craneZ=-5.5;
 hangarBox(2.25,.24,.72,-1.7,craneY,craneZ,hangarSteel);
 hangarBox(1.35,.14,.82,-1.7,craneY-.2,craneZ,hangarOrange);
 for(const x of [-2.0,-1.05]){
  hangarCylinder(.34,.2,x,craneY-.52,craneZ,hangarCable,"z");
  hangarCylinder(.23,.22,x,craneY-.52,craneZ,hangarBrass,"z");
  hangarRope([new THREE.Vector3(x,craneY-.62,craneZ),new THREE.Vector3(x,10.25,craneZ)],.035,hangarCable);
 }
 hangarBox(1.72,.2,.42,-1.7,10.12,craneZ,hangarOrange);
 hangarBox(1.35,.16,.28,-1.7,9.94,craneZ,hangarSteel);
 hangarCylinder(.1,.62,-1.7,9.55,craneZ,hangarCable);
 hangarRope([new THREE.Vector3(-1.7,9.27,craneZ),new THREE.Vector3(-1.7,9.02,craneZ+.08),new THREE.Vector3(-1.7,8.92,craneZ+.26),new THREE.Vector3(-1.7,9.08,craneZ+.38)],.045,hangarBrass);
 // Two slack overhead utility runs, supported by ceiling pulleys and cable saddles.
 hangarRope([new THREE.Vector3(-8.4,14.85,-14),new THREE.Vector3(-5.2,14.35,-12),new THREE.Vector3(-1.8,14.2,-10),new THREE.Vector3(2.4,14.45,-8),new THREE.Vector3(7.9,14.85,-6)],.045,hangarCable);
 hangarRope([new THREE.Vector3(-8.1,14.55,9),new THREE.Vector3(-4.5,14.1,7),new THREE.Vector3(0,14.0,5),new THREE.Vector3(4.1,14.3,3),new THREE.Vector3(8.1,14.65,1)],.028,hangarBrass);
 for(const [x,z] of [[-5.2,-12],[-1.8,-10],[2.4,-8],[-4.5,7],[0,5],[4.1,3]] as [number,number][]){
  hangarCylinder(.13,.22,x,15.0,z,hangarSteel);
  hangarCylinder(.085,.25,x,14.86,z,hangarBrass);
 }
 const camera=new THREE.PerspectiveCamera(42,canvas.clientWidth/canvas.clientHeight,.1,500);camera.position.set(8,6,10);
 const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,1,0);orbit.enableDamping=true;orbit.dampingFactor=.07;orbit.minDistance=3.5;orbit.maxDistance=23.5;orbit.minPolarAngle=.08;orbit.maxPolarAngle=Math.PI/2-.035;
 scene.add(new THREE.HemisphereLight(0xc5e6ff,0x263448,2));
 const key=new THREE.DirectionalLight(0xffedcf,3);key.position.set(5,10,7);key.castShadow=true;scene.add(key);
 const grid=new THREE.GridHelper(40,80,0x3a718a,0x1b354b);grid.visible=false;scene.add(grid);
 const craftGroup=new THREE.Group();scene.add(craftGroup);
 const transform=new TransformControls(camera,renderer.domElement);transform.setMode("translate");transform.setSpace("world");const multiSelectionPivot=new THREE.Group();multiSelectionPivot.name="multi-selection-transform-pivot";scene.add(multiSelectionPivot);let multiSelectionActive=false;
 const helper=transform.getHelper();scene.add(helper);
 let craft=clone(initial),selected:THREE.Group|null=null,selectedId:string|null=null,selectedIds=new Set<string>(),selectionAnchorId:string|null=null,tool="translate",alive=true;
 let activationEditGroup:number|null=null,activationOrder:number[]=[];
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
  const add=(geo:THREE.BufferGeometry,m:THREE.Material=mat,pos:THREE.Vector3=new THREE.Vector3())=>{const mesh=new THREE.Mesh(geo,m);mesh.position.copy(pos);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
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
  else if(p.kind==="nose-cone"||isFairingKind(p.kind)){
   const base=Math.max(.08,Math.min(.9,p.bottomRadius??.44)),height=Math.max(.25,Math.min(3,p.height??defaultFairingHeight(p.kind)));
   const shell=new THREE.MeshStandardMaterial({color:s.color,roughness:.38,metalness:.28,side:THREE.DoubleSide});
   if(p.kind==="nose-cone")add(new THREE.ConeGeometry(base,height,48,12,false),shell);
   else if(p.kind==="conical-fairing")add(new THREE.CylinderGeometry(.018,base,height,48,12,false),shell);
   else if(p.kind==="interstage-fairing"){
    add(new THREE.CylinderGeometry(base*.78,base,height,48,2,true),shell);
    for(const [y,r] of [[-height/2,base],[height/2,base*.78]] as const){const rim=add(new THREE.TorusGeometry(r,.018,8,48),new THREE.MeshStandardMaterial({color:0x536b7d,metalness:.65}),new THREE.Vector3(0,y,0));rim.rotation.x=Math.PI/2;}
   }else{
    const points=Array.from({length:25},(_,i)=>{const t=i/24;const radius=base*Math.sqrt(Math.max(0,1-t*t));return new THREE.Vector2(radius,-height/2+t*height);});
    add(new THREE.LatheGeometry(points,48),shell);
    if(p.kind==="clam-shell-fairing"){const seam=new THREE.MeshStandardMaterial({color:0x536b7d,metalness:.55});for(const side of [-1,1])add(new THREE.CylinderGeometry(.008,.008,height*.82,8),seam,new THREE.Vector3(side*base*.7,0,0));}
   }
   const rim=add(new THREE.TorusGeometry(base,.018,8,48),new THREE.MeshStandardMaterial({color:0x536b7d,metalness:.65}),new THREE.Vector3(0,-height/2,0));rim.rotation.x=Math.PI/2;
  }
  else if(p.kind==="airbrake"){
   const metal=new THREE.MeshStandardMaterial({color:0xb78b68,metalness:.55,roughness:.42});add(new THREE.BoxGeometry(.7,.08,.5),metal);for(const side of [-1,1]){const panel=add(new THREE.BoxGeometry(.06,.42,.5),metal,new THREE.Vector3(side*.31,.22,0));panel.rotation.z=side*.22;}
  }
  else if(p.kind==="strake"){const metal=new THREE.MeshStandardMaterial({color:0x7898ad,metalness:.45,roughness:.4});add(new THREE.BoxGeometry(.12,.8,.42),metal);}
  else if(p.kind==="engine"){g.add(createEngineModel(p.engineType??"liquid"));}else if(p.kind==="separator"){add(new THREE.CylinderGeometry(.5,.5,.2,40,2,false),new THREE.MeshStandardMaterial({color:0xd6b66d,roughness:.42,metalness:.42}));const ring=add(new THREE.TorusGeometry(.5,.032,10,40),new THREE.MeshStandardMaterial({color:0xffd77c,metalness:.55}),new THREE.Vector3(0,.09,0));ring.rotation.x=Math.PI/2;add(new THREE.CylinderGeometry(.44,.44,.055,40),new THREE.MeshStandardMaterial({color:0x536b7d,metalness:.7}),new THREE.Vector3(0,-.12,0));}
  else if(p.kind==="side-decoupler"){const metal=new THREE.MeshStandardMaterial({color:0xe0bd70,metalness:.55,roughness:.4});add(new THREE.BoxGeometry(.72,.24,.3),metal);add(new THREE.BoxGeometry(.12,.34,.38),new THREE.MeshStandardMaterial({color:0x5d7483,metalness:.65}),new THREE.Vector3(.28,0,0));add(new THREE.BoxGeometry(.12,.34,.38),metal,new THREE.Vector3(-.28,0,0));}
  else if(p.kind==="separator-thruster"){const metal=new THREE.MeshStandardMaterial({color:0xb6c3cb,metalness:.65,roughness:.36});add(new THREE.BoxGeometry(.32,.22,.3),metal);for(const side of [-1,1]){const nozzle=add(new THREE.CylinderGeometry(.07,.11,.22,16),new THREE.MeshStandardMaterial({color:0xd88b62,metalness:.55}));nozzle.rotation.z=Math.PI/2;nozzle.position.x=side*.2;}}
  else if(p.kind==="fuel-line"){const a=tankPart(p.fuelLineStartId),b=tankPart(p.fuelLineEndId);if(a&&b){const route=pipeGeometry(tankWorldPosition(a),tankWorldPosition(b),a.id!,b.id!);const pipe=new THREE.MeshStandardMaterial({color:0x65aeb4,metalness:.7,roughness:.3,emissive:0x123b3e,emissiveIntensity:.35});add(route.geometry,pipe);g.position.copy(route.midpoint);} }
  else if(p.kind==="fin"||p.kind==="wing"||p.kind==="control"){const geo=new THREE.BoxGeometry(s.size.x,s.size.y,s.size.z);add(geo);if(p.kind==="fin"){const fin=add(new THREE.BoxGeometry(.12,.72,.55));fin.position.set(.42,-.18,0);fin.rotation.z=-.22;}if(p.kind==="wing"){const tip=add(new THREE.BoxGeometry(.22,.12,.22));tip.position.x=.84;}}
  else if(p.kind==="solar"){const length=Math.max(.8,Math.min(8,p.solarLength??2.4)),deployed=p.solarDeployed===true;add(new THREE.BoxGeometry(.2,.12,.22),new THREE.MeshStandardMaterial({color:0x8799a7,metalness:.65,roughness:.38}));const hinge=new THREE.Group();hinge.position.x=.1;hinge.rotation.z=deployed?0:-Math.PI/2;const panelMaterial=new THREE.MeshStandardMaterial({color:0x2678a5,metalness:.55,roughness:.35});const gridMaterial=new THREE.MeshStandardMaterial({color:0x9be4f4,metalness:.35,roughness:.42});const panel=new THREE.Mesh(new THREE.BoxGeometry(length,.035,.72),panelMaterial);panel.position.x=length/2;panel.castShadow=true;panel.receiveShadow=true;hinge.add(panel);for(let i=1;i<8;i++){const x=length*i/8,z=-.36+.72*i/8;const vertical=new THREE.Mesh(new THREE.BoxGeometry(.012,.004,.72),gridMaterial);vertical.position.set(x,.0195,0);hinge.add(vertical);const horizontal=new THREE.Mesh(new THREE.BoxGeometry(length,.004,.012),gridMaterial);horizontal.position.set(length/2,.0195,z);hinge.add(horizontal);}g.add(hinge);}
  else if(p.kind==="landing-leg"){g.add(createLandingLegModel(p.retracted!==false));}
   else if(p.kind==="wheel"){const steel=new THREE.MeshStandardMaterial({color:0x9aa9b2,metalness:.72,roughness:.36}),rubber=new THREE.MeshStandardMaterial({color:0x273542,roughness:.92});const strut=add(new THREE.CylinderGeometry(.055,.07,.72,12),steel,new THREE.Vector3(0,-.12,0));strut.rotation.z=-.22;const wheel=add(new THREE.CylinderGeometry(.14,.14,.09,12),rubber,new THREE.Vector3(.22,-.48,0));wheel.rotation.z=Math.PI/2;}
   else if(p.kind==="rover-wheel"){
   const rubber=new THREE.MeshStandardMaterial({color:0x26343d,roughness:.96}),hub=new THREE.MeshStandardMaterial({color:0x9aa8ad,metalness:.7,roughness:.32}),axle=new THREE.MeshStandardMaterial({color:0x667986,metalness:.65}),radius=p.radius??.24;
   add(new THREE.BoxGeometry(.58,.12,.24),axle,new THREE.Vector3(0,.16,0));
   for(const side of [-1,1]){const tire=add(new THREE.CylinderGeometry(radius,radius,.18,16,1),rubber,new THREE.Vector3(side*.22,-.12,0));tire.rotation.z=Math.PI/2;const rim=add(new THREE.CylinderGeometry(radius*.58,radius*.58,.19,12),hub,new THREE.Vector3(side*.22,-.12,0));rim.rotation.z=Math.PI/2;for(let i=0;i<16;i++){const a=i*Math.PI/8;const lug=add(new THREE.BoxGeometry(.2,.045,.045),rubber,new THREE.Vector3(side*.22,-.12+Math.cos(a)*(radius+.006),Math.sin(a)*(radius+.006)));lug.rotation.x=a;}}
  }else if(p.kind==="heat-shield"){
   const radius=p.radius??.62,thickness=p.thickness??.16,ablative=new THREE.MeshStandardMaterial({color:0x9a6548,roughness:.88,metalness:.08}),rim=new THREE.MeshStandardMaterial({color:0xc2a18a,roughness:.6,metalness:.35});
   add(new THREE.CylinderGeometry(radius*.96,radius,thickness,32,2,false),ablative,new THREE.Vector3(0,-thickness/2,0));const edge=add(new THREE.TorusGeometry(radius*.97,.025,6,32),rim,new THREE.Vector3(0,-thickness-.002,0));edge.rotation.x=Math.PI/2;add(new THREE.CylinderGeometry(radius*.58,radius*.7,.012,32),new THREE.MeshStandardMaterial({color:0x493d38,roughness:.95}),new THREE.Vector3(0,.006,0));
  }
  else if(p.kind==="dock"){const steel=new THREE.MeshStandardMaterial({color:0xb9c7d0,roughness:.3,metalness:.78});add(new THREE.CylinderGeometry(.22,.28,.22,32,2,false),steel);const dockRing=add(new THREE.TorusGeometry(.22,.04,10,32),new THREE.MeshStandardMaterial({color:0x5b768b,metalness:.72}),new THREE.Vector3(0,.13,0));dockRing.rotation.x=Math.PI/2;add(new THREE.CylinderGeometry(.14,.14,.05,32),new THREE.MeshStandardMaterial({color:0x243d50,metalness:.45}),new THREE.Vector3(0,.15,0));}
  else if(p.kind==="battery"){add(new THREE.BoxGeometry(.58,.32,.58),new THREE.MeshStandardMaterial({color:0x879b78,roughness:.56,metalness:.25}));for(let x=-1;x<=1;x++)add(new THREE.BoxGeometry(.035,.34,.62),new THREE.MeshStandardMaterial({color:0x354b5c,metalness:.5}),new THREE.Vector3(x*.18,0,0));}
  else if(p.kind==="remote-control"||p.kind==="reaction-wheel"){
   const topRadius=Math.max(.08,Math.min(.9,p.topRadius??.28)),bottomRadius=Math.max(.08,Math.min(.9,p.bottomRadius??.28)),height=.28,half=height/2;
   const shell=new THREE.MeshStandardMaterial({color:p.kind==="remote-control"?0x718fa0:0x9baab4,roughness:.36,metalness:.68}),trim=new THREE.MeshStandardMaterial({color:p.kind==="remote-control"?0x29495b:0x344d5e,roughness:.3,metalness:.8}),detail=new THREE.MeshStandardMaterial({color:p.kind==="remote-control"?0x4bb6d4:0xcbd5db,emissive:p.kind==="remote-control"?0x103c4b:0x000000,emissiveIntensity:.45,roughness:.24,metalness:.55});
   add(new THREE.CylinderGeometry(topRadius,bottomRadius,height,40,4,false),shell);
   for(const [y,radius] of [[-half,bottomRadius],[half,topRadius]] as const){const rim=add(new THREE.TorusGeometry(radius,.014,8,40),trim,new THREE.Vector3(0,y,0));rim.rotation.x=Math.PI/2;}
   const band=add(new THREE.TorusGeometry((topRadius+bottomRadius)/2,.012,8,40),trim);band.rotation.x=Math.PI/2;
   if(p.kind==="remote-control"){add(new THREE.CylinderGeometry(topRadius*.22,topRadius*.22,.018,16),detail,new THREE.Vector3(0,half+.009,0));for(let i=0;i<3;i++)add(new THREE.SphereGeometry(.018,8,6),new THREE.MeshStandardMaterial({color:[0x58d6ad,0xe7bd62,0x70aee0][i],emissive:[0x145a43,0x624b18,0x183c62][i]}),new THREE.Vector3((i-1)*topRadius*.32,0,bottomRadius+.008));}
   else{add(new THREE.CylinderGeometry(Math.min(topRadius,bottomRadius)*.34,Math.min(topRadius,bottomRadius)*.34,.035,20),detail,new THREE.Vector3(0,half+.018,0));const ring=add(new THREE.TorusGeometry(Math.min(topRadius,bottomRadius)*.58,.018,8,32),trim,new THREE.Vector3(0,half+.02,0));ring.rotation.x=Math.PI/2;}
  }
  else if(p.kind==="rcs"){add(new THREE.BoxGeometry(.34,.24,.34),new THREE.MeshStandardMaterial({color:0x8799a7,roughness:.38,metalness:.62}));for(let i=0;i<4;i++){const x=i%2?-.707:.707,z=i<2?-.707:.707;const direction=new THREE.Vector3(x,0,z).normalize();const nozzle=add(new THREE.CylinderGeometry(.055,.095,.2,12,2,false),new THREE.MeshStandardMaterial({color:0x647b8b,metalness:.72,roughness:.32}));nozzle.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);nozzle.position.set(direction.x*.265,0,direction.z*.265);}g.scale.setScalar(.5);}
  else if(p.kind==="strut"){add(new THREE.BoxGeometry(.1,1,.1));}
  else if(p.kind==="structural-beam"){
   const bays=Math.max(1,Math.min(12,Math.round(p.structuralLength??3))),bayLength=.4,half=bays*bayLength/2,rail=.105,tube=.022;
   const steel=new THREE.MeshStandardMaterial({color:0xaab8c2,metalness:.72,roughness:.34}),brace=new THREE.MeshStandardMaterial({color:0x687d8d,metalness:.68,roughness:.4});
   const bar=(start:THREE.Vector3,end:THREE.Vector3,r:number,m:THREE.Material)=>{const delta=end.clone().sub(start),mesh=add(new THREE.CylinderGeometry(r,r,delta.length(),8),m,start.clone().add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());};
   for(const x of [-rail,rail])for(const z of [-rail,rail])bar(new THREE.Vector3(x,-half,z),new THREE.Vector3(x,half,z),tube,steel);
   for(let i=0;i<=bays;i++){const y=-half+i*bayLength;for(const x of [-rail,rail])bar(new THREE.Vector3(x,y,-rail),new THREE.Vector3(x,y,rail),tube,steel);for(const z of [-rail,rail])bar(new THREE.Vector3(-rail,y,z),new THREE.Vector3(rail,y,z),tube,steel);}
   for(let i=0;i<bays;i++){const y0=-half+i*bayLength,y1=y0+bayLength;for(const z of [-rail,rail]){bar(new THREE.Vector3(-rail,y0,z),new THREE.Vector3(rail,y1,z),tube,brace);bar(new THREE.Vector3(rail,y0,z),new THREE.Vector3(-rail,y1,z),tube,brace);}for(const x of [-rail,rail]){bar(new THREE.Vector3(x,y0,-rail),new THREE.Vector3(x,y1,rail),tube,brace);bar(new THREE.Vector3(x,y0,rail),new THREE.Vector3(x,y1,-rail),tube,brace);}}
   for(const y of [-half,half])add(new THREE.BoxGeometry(.25,.035,.25),steel,new THREE.Vector3(0,y,0));
  }
  else if(p.kind==="structural-angle"){
   const steel=new THREE.MeshStandardMaterial({color:0xd0a66d,metalness:.7,roughness:.34});
   add(new THREE.BoxGeometry(.2,.2,.2),steel);
   add(new THREE.BoxGeometry(.16,.32,.16),steel,new THREE.Vector3(0,.22,0));
   add(new THREE.BoxGeometry(.32,.16,.16),steel,new THREE.Vector3(.22,0,0));
  }
  else if(p.kind==="structural-hub"){
   const steel=new THREE.MeshStandardMaterial({color:0xc0ccd4,metalness:.72,roughness:.3}),dark=new THREE.MeshStandardMaterial({color:0x607789,metalness:.68});
   add(new THREE.BoxGeometry(.22,.22,.22),steel);
   for(const [x,y,z,axis] of [[0,.16,0,"y"],[0,-.16,0,"y"],[.16,0,0,"x"],[-.16,0,0,"x"],[0,0,.16,"z"],[0,0,-.16,"z"]] as [number,number,number,string][]){const socket=add(new THREE.CylinderGeometry(.09,.09,.12,8),dark,new THREE.Vector3(x,y,z));if(axis==="x")socket.rotation.z=Math.PI/2;else if(axis==="z")socket.rotation.x=Math.PI/2;}
  }
  g.position.set(p.x??0,p.y??(craft.length*.6),p.z??0);g.rotation.set(p.rx??0,p.ry??0,p.rz??0);
  return g;
 }
 function syncPartFromGroup(g:THREE.Group){const p=craft.find(v=>v.id===g.userData.partId);if(!p)return;p.x=g.position.x;p.y=g.position.y;p.z=g.position.z;p.rx=g.rotation.x;p.ry=g.rotation.y;p.rz=g.rotation.z;}
 function syncMultiSelectionParts(){multiSelectionPivot.updateMatrixWorld(true);const partsById=new Map(craft.map(part=>[part.id,part]));for(const child of multiSelectionPivot.children){if(!(child instanceof THREE.Group))continue;const p=partsById.get(String(child.userData.partId));if(!p)continue;const position=child.getWorldPosition(new THREE.Vector3()),rotation=new THREE.Euler().setFromQuaternion(child.getWorldQuaternion(new THREE.Quaternion()),"XYZ");p.x=position.x;p.y=position.y;p.z=position.z;p.rx=rotation.x;p.ry=rotation.y;p.rz=rotation.z;}}
 function releaseMultiSelectionTransform(){if(!multiSelectionActive)return;multiSelectionPivot.updateMatrixWorld(true);for(const child of [...multiSelectionPivot.children]){if(child instanceof THREE.Group){craftGroup.attach(child);syncPartFromGroup(child);}}multiSelectionActive=false;transform.detach();}
 function activateMultiSelectionTransform(){releaseMultiSelectionTransform();const groups=craftGroup.children.filter(child=>selectedIds.has(String(child.userData.partId))) as THREE.Group[];if(groups.length<2)return;craftGroup.updateMatrixWorld(true);const center=new THREE.Vector3();for(const group of groups)center.add(group.getWorldPosition(new THREE.Vector3()));center.divideScalar(groups.length);multiSelectionPivot.position.copy(center);multiSelectionPivot.rotation.set(0,0,0);multiSelectionPivot.scale.set(1,1,1);multiSelectionPivot.updateMatrixWorld(true);for(const group of groups)multiSelectionPivot.attach(group);multiSelectionActive=true;transform.setMode(tool==="rotate"?"rotate":"translate");transform.attach(multiSelectionPivot);}
 function record(){history.splice(historyIndex+1);history.push(clone(craft));if(history.length>60)history.shift();historyIndex=history.length-1;changed(clone(craft));}
 function inspect(){
  const box=host.querySelector<HTMLElement>("#vab-inspector")!;
  const p=craft.find(v=>v.id===selectedId);
  if(!p){box.innerHTML="<b>NO PART SELECTED</b><small>Click a component in the 3D view to move, rotate or delete it.</small>";return;}
  const specPart=spec(p.kind),engine=p.kind==="engine"?engineVariants.find(e=>e.id===(p.engineType??"liquid")):undefined;
  const stageControl=isActivationCapable(p)?"<small class=\"engine-stage-hint\">"+(partActivationGroup(p)!==undefined?"ASSIGNED TO ACTIVATION GROUP "+partActivationGroup(p):"NOT ASSIGNED TO AN ACTIVATION GROUP")+". Manage this part in the Activation List.</small>":"";
  const profileControl=(key:string,label:string,value:number,min:number,max:number,step=.01)=>"<label><span>"+label+"</span><input type='range' min='"+min+"' max='"+max+"' step='"+step+"' value='"+value+"' data-profile-range='"+key+"'><input type='number' min='"+min+"' max='"+max+"' step='"+step+"' value='"+value.toFixed(2)+"' data-profile-number='"+key+"'></label>";
  const tankControls=p.kind==="tank"?"<div class='tank-profile-controls'>"+profileControl("topRadius","TOP RADIUS",p.topRadius??.44,.08,.9)+profileControl("bottomRadius","BOTTOM RADIUS",p.bottomRadius??.44,.08,.9)+profileControl("height","HEIGHT",p.height??.96,.25,3)+"<small data-tank-capacity>FUEL CAPACITY "+tankFuelCapacity(p).toFixed(1)+" U</small></div>":"";
  const controllerDiameterControls=p.kind==="remote-control"||p.kind==="reaction-wheel"?"<div class='tank-profile-controls'>"+profileControl("topRadius","TOP RADIUS",p.topRadius??.28,.08,.9)+profileControl("bottomRadius","BOTTOM RADIUS",p.bottomRadius??.28,.08,.9)+"<small>Short fixed-height cylinder. Adjust either end diameter independently.</small></div>":"";
  const coneControls=p.kind==="nose-cone"||isFairingKind(p.kind)?"<div class='tank-profile-controls'>"+profileControl("bottomRadius","BASE RADIUS",p.bottomRadius??.44,.08,.9)+profileControl("height","HEIGHT",p.height??defaultFairingHeight(p.kind),.25,3)+"</div>":"";
  const landingControls=p.kind==="landing-leg"?"<button type='button' data-toggle-retract>"+(p.retracted?"EXTEND LANDING LEGS":"RETRACT LANDING LEGS")+"</button><small>Toggle between deployed and stowed positions.</small>":"";
  const shieldControls=p.kind==="heat-shield"?"<div class='tank-profile-controls'>"+profileControl("radius","SHIELD RADIUS",p.radius??.62,.2,1.8)+profileControl("thickness","SHIELD THICKNESS",p.thickness??.16,.04,.5)+"</div>":"";
  const roverControls=p.kind==="rover-wheel"?"<div class='tank-profile-controls'>"+profileControl("radius","WHEEL RADIUS",p.radius??.24,.1,.65)+"</div>":"";
  const structuralControls=p.kind==="structural-beam"?"<div class='tank-profile-controls'>"+profileControl("structuralLength","BRACE BAYS",p.structuralLength??3,1,12,1)+"<small>Each bay adds one fixed-length braced section. Members keep their proportions; length changes by adding or removing complete bays.</small></div>":"";
  const solarControls=p.kind==="solar"?"<div class='tank-profile-controls'>"+profileControl("solarLength","ARRAY LENGTH",p.solarLength??2.4,.8,8)+"<button type='button' data-toggle-solar>"+(p.solarDeployed===true?"RETRACT SOLAR ARRAY":"DEPLOY SOLAR ARRAY")+"</button><small>One folding solar panel. Assign it through the Activation List.</small></div>":"";
  box.innerHTML="<b>"+(engine?.name.toUpperCase()??specPart.name.toUpperCase())+"</b><small>"+specPart.category+" / "+specPart.mass.toFixed(2)+" t / X "+(p.x??0).toFixed(2)+" · Y "+(p.y??0).toFixed(2)+" · Z "+(p.z??0).toFixed(2)+"</small><div class='vab-inspector-actions'><button type='button' data-inspector-tool='translate' class='"+(tool==="translate"?"active":"")+"'>MOVE</button><button type='button' data-inspector-tool='rotate' class='"+(tool==="rotate"?"active":"")+"'>ROTATE</button><button type='button' data-inspector-delete>DELETE PART</button></div>"+tankControls+controllerDiameterControls+coneControls+landingControls+shieldControls+roverControls+structuralControls+solarControls+stageControl;
  box.querySelectorAll<HTMLButtonElement>("[data-inspector-tool]").forEach(button=>button.onclick=()=>setTool(button.dataset.inspectorTool!));
  box.querySelector<HTMLButtonElement>("[data-inspector-delete]")!.onclick=()=>removePart(p.id!);
  const retractButton=box.querySelector<HTMLButtonElement>("[data-toggle-retract]");if(retractButton)retractButton.onclick=()=>{p.retracted=!p.retracted;redraw();record();};
  const rebuildProfile=(key:string,value:number)=>{const group=craftGroup.children.find(g=>g.userData.partId===p.id) as THREE.Group|undefined;if(!group)return;const replacement=makeMesh(p);group.clear();for(const child of [...replacement.children])group.add(child);const range=box.querySelector<HTMLInputElement>("[data-profile-range='"+key+"']"),number=box.querySelector<HTMLInputElement>("[data-profile-number='"+key+"']");if(range)range.value=String(value);if(number)number.value=value.toFixed(2);const capacity=box.querySelector<HTMLElement>("[data-tank-capacity]");if(capacity)capacity.textContent="FUEL CAPACITY "+tankFuelCapacity(p).toFixed(1)+" U";};
  box.querySelectorAll<HTMLInputElement>("[data-profile-range]").forEach(input=>{const key=input.dataset.profileRange!,min=Number(input.min),max=Number(input.max);input.oninput=()=>{const raw=Number(input.value);if(!Number.isFinite(raw))return;const value=Math.min(max,Math.max(min,raw));(p as unknown as Record<string,number>)[key]=value;rebuildProfile(key,value);record();};});
  box.querySelectorAll<HTMLInputElement>("[data-profile-number]").forEach(input=>{const key=input.dataset.profileNumber!,min=Number(input.min),max=Number(input.max);input.onchange=()=>{const raw=Number(input.value);if(!Number.isFinite(raw))return;const value=Math.min(max,Math.max(min,raw));(p as unknown as Record<string,number>)[key]=value;rebuildProfile(key,value);record();};});
  const solarToggle=box.querySelector<HTMLButtonElement>("[data-toggle-solar]");if(solarToggle)solarToggle.onclick=()=>{p.solarDeployed=p.solarDeployed!==true;redraw();record();};

 }
 function groundMinYForPart(part:BuildPart){
  const group=makeMesh(part);
  group.position.set(part.x??0,part.y??0,part.z??0);
  group.rotation.set(part.rx??0,part.ry??0,part.rz??0);
  group.updateMatrixWorld(true);
  const minY=new THREE.Box3().setFromObject(group).min.y;
  group.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});
  return minY;
 }
 function rememberSafePose(g:THREE.Group,p:BuildPart){g.userData.safePose={position:g.position.clone(),rotation:g.rotation.clone(),parentId:p.parentId,parentNode:p.parentNode,childNode:p.childNode};}

 function hasCollision(g:THREE.Group,p:BuildPart){craftGroup.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);for(const other of craftGroup.children){if(other===g)continue;const otherPart=craft.find(candidate=>candidate.id===other.userData.partId);if(!otherPart)continue;if(p.parentId===otherPart.id||otherPart.parentId===p.id)continue;if(bounds.intersectsBox(new THREE.Box3().setFromObject(other)))return true;}return false;}
 function refreshMultiSelection(){host.querySelectorAll<HTMLElement>(".vab-stack-row").forEach(row=>row.classList.toggle("selected",selectedIds.has(row.dataset.id??"")));if(selectedIds.size>1){selected=null;selectedId=null;tool=tool==="rotate"?"rotate":"translate";activateMultiSelectionTransform();host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));host.querySelector<HTMLElement>("#vab-inspector")!.innerHTML="<b>"+selectedIds.size+" PARTS SELECTED</b><small>Individual shape controls are unavailable for multi-selection. Use MOVE or ROTATE to transform all selected parts together.</small>";status.textContent=selectedIds.size+" PARTS SELECTED / "+tool.toUpperCase()+" GROUP GIZMO ACTIVE";}else{releaseMultiSelectionTransform();const id=[...selectedIds][0];const group=id?craftGroup.children.find(g=>g.userData.partId===id) as THREE.Group|undefined:null;select(group??null);}}
 function togglePartSelection(id:string){if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);selectionAnchorId=id;refreshMultiSelection();}
 function selectPartRange(id:string){const anchor=craft.findIndex(p=>p.id===selectionAnchorId),target=craft.findIndex(p=>p.id===id);if(anchor<0||target<0){togglePartSelection(id);return;}const [start,end]=[Math.min(anchor,target),Math.max(anchor,target)];selectedIds=new Set(craft.slice(start,end+1).map(p=>p.id!).filter(Boolean));refreshMultiSelection();}
 function select(g:THREE.Group|null){if(multiSelectionActive)releaseMultiSelectionTransform();selected=g;selectedId=g?.userData.partId??null;selectedIds.clear();if(selectedId){selectedIds.add(selectedId);selectionAnchorId=selectedId;}if(g){tool="translate";transform.setMode("translate");transform.attach(g);const p=craft.find(part=>part.id===selectedId);if(p)rememberSafePose(g,p);}else{tool="select";transform.detach();}host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));host.querySelectorAll<HTMLElement>(".stack-row").forEach(r=>r.classList.toggle("selected",selectedIds.has(r.dataset.id??"")));inspect();status.textContent=g?"PART SELECTED / MOVE GIZMO ACTIVE · ROTATE AVAILABLE":"SELECT A PART OR ADD FROM THE CATALOG";}
 function renderCatalog(category:string){const target=host.querySelector<HTMLElement>("#vab-catalog-items")!;const chosen=parts.filter(p=>p.category===category);const cards=chosen.filter(p=>p.kind!=="engine").map(catalogCard).join("")+(category==="Engines"?engineVariants.map(e=>`<button type="button" class="vab-part-card" data-add-engine="${e.id}">${previewSvg("engine",e.accent)}<span><b>${e.name}</b><small>${e.description}<br>34 kN · ISP 285 s<br><strong>${e.cost.toLocaleString()} cr</strong></small></span></button>`).join(""):"");target.innerHTML=cards||"<small class=\"vab-empty-category\">NO PARTS IN THIS CATEGORY</small>";target.querySelectorAll<HTMLButtonElement>("[data-add]").forEach(button=>button.onclick=()=>addPart(button.dataset.add as PartKind));target.querySelectorAll<HTMLButtonElement>("[data-add-engine]").forEach(button=>button.onclick=()=>addPart("engine",button.dataset.addEngine as EngineType));}
 function syncActivationOrder(){const present=listActivationGroups(craft);activationOrder=activationOrder.filter(id=>present.includes(id)||id===activationEditGroup);for(const id of present)if(!activationOrder.includes(id))activationOrder.push(id);}
 function renderActivationPanel(){
  const panel=host.querySelector<HTMLElement>("#vab-activation-panel")!,groups=host.querySelector<HTMLElement>("#vab-activation-groups")!,editor=host.querySelector<HTMLElement>("#vab-activation-editor")!;
  syncActivationOrder();
  groups.innerHTML=activationOrder.map(id=>{const members=craft.filter(part=>partActivationGroup(part)===id&&isActivationCapable(part));return "<div class='vab-activation-group "+(activationEditGroup===id?"editing":"")+"' data-group-row='"+id+"'><button type='button' class='vab-activation-group-select' data-group-select='"+id+"'><b>GROUP "+id+"</b><small>"+members.length+" PART"+(members.length===1?"":"S")+" · "+members.map(part=>spec(part.kind).name).join(", ")+"</small></button><button type='button' class='vab-activation-delete' data-group-delete='"+id+"' aria-label='Delete activation group "+id+"' title='Delete group'>⌫</button><button type='button' class='vab-activation-drag' draggable='true' data-group-drag='"+id+"' aria-label='Drag to reorder group "+id+"' title='Drag to change activation order'>☰</button></div>";}).join("")||"<div class='vab-activation-empty'>No activation groups yet. Press ＋ to create one.</div>";
  editor.hidden=activationEditGroup===null;
  if(activationEditGroup!==null){
   const id=activationEditGroup;
   editor.innerHTML="<div class='vab-activation-editor-head'><b>EDIT GROUP "+id+"</b><button type='button' data-activation-done>DONE</button></div><small>Choose parts below or click parts directly in the 3D view. Checked parts activate together.</small><div class='vab-activation-part-list'>"+craft.filter(isActivationCapable).map(part=>{const group=partActivationGroup(part),checked=group===id;return "<label class='vab-activation-part "+(checked?"assigned":"")+"' data-activation-part-row='"+part.id+"'><input type='checkbox' data-activation-part='"+part.id+"' "+(checked?"checked":"")+"><span><b>"+(part.kind==="engine"?"ENGINE · "+engineDisplayName(part).toUpperCase():spec(part.kind).name)+"</b><small>"+(group!==undefined&&group!==id?"CURRENTLY IN GROUP "+group:checked?"ASSIGNED TO THIS GROUP":"UNASSIGNED")+"</small></span></label>";}).join("")+"</div>";
   editor.querySelector<HTMLButtonElement>("[data-activation-done]")!.onclick=()=>{if(!craft.some(part=>partActivationGroup(part)===id))activationOrder=activationOrder.filter(group=>group!==id);activationEditGroup=null;renderActivationPanel();redraw();};
   editor.querySelectorAll<HTMLInputElement>("[data-activation-part]").forEach(input=>input.onchange=()=>toggleActivationPart(input.dataset.activationPart!,input.checked));
  }
  groups.querySelectorAll<HTMLButtonElement>("[data-group-delete]").forEach(button=>button.onclick=event=>{event.stopPropagation();const removed=Number(button.dataset.groupDelete);const remaining=activationOrder.filter(group=>group!==removed);const memberIds=new Set(craft.filter(part=>partActivationGroup(part)===removed).map(part=>part.id!).filter(Boolean));craft=assignActivationGroup(craft,memberIds,null);const nextEditing=activationEditGroup===removed?null:activationEditGroup===null?null:remaining.indexOf(activationEditGroup)+1;craft=reorderActivationGroups(craft,remaining);activationOrder=remaining.map((_,index)=>index+1);activationEditGroup=nextEditing!==null&&nextEditing>0?nextEditing:null;redraw();record();status.textContent="ACTIVATION GROUP "+removed+" DELETED / REMAINING GROUPS RENUMBERED";});
  groups.querySelectorAll<HTMLButtonElement>("[data-group-select]").forEach(button=>button.onclick=()=>{activationEditGroup=Number(button.dataset.groupSelect);selected=null;selectedId=null;selectedIds.clear();transform.detach();redraw();renderActivationPanel();});
  let dragGroup:number|null=null;
  groups.querySelectorAll<HTMLButtonElement>("[data-group-drag]").forEach(handle=>{handle.ondragstart=event=>{dragGroup=Number(handle.dataset.groupDrag);event.dataTransfer?.setData("text/plain",String(dragGroup));if(event.dataTransfer)event.dataTransfer.effectAllowed="move";};handle.ondragend=()=>{dragGroup=null;};});
  groups.querySelectorAll<HTMLElement>("[data-group-row]").forEach(row=>{row.ondragover=event=>{if(dragGroup!==null){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect="move";}};row.ondrop=event=>{event.preventDefault();const from=dragGroup??Number(event.dataTransfer?.getData("text/plain")),to=Number(row.dataset.groupRow);dragGroup=null;if(!Number.isFinite(from)||!Number.isFinite(to)||from===to)return;const ordered=[...activationOrder],fromIndex=ordered.indexOf(from),toIndex=ordered.indexOf(to);if(fromIndex<0||toIndex<0)return;ordered.splice(fromIndex,1);ordered.splice(toIndex,0,from);const editingIndex=activationEditGroup===null?-1:ordered.indexOf(activationEditGroup);craft=reorderActivationGroups(craft,ordered);activationOrder=ordered.map((_,index)=>index+1);if(editingIndex>=0)activationEditGroup=editingIndex+1;redraw();record();};});
  const toggle=host.querySelector<HTMLButtonElement>("#vab-activation-toggle")!;toggle.setAttribute("aria-expanded",String(!panel.hidden));
 }
 function toggleActivationPart(partId:string,checked:boolean){if(activationEditGroup===null)return;const part=craft.find(item=>item.id===partId);if(!part||!isActivationCapable(part))return;craft=assignActivationGroup(craft,new Set([partId]),checked?activationEditGroup:null);redraw();record();renderActivationPanel();}
 function redraw(){
  releaseMultiSelectionTransform();craftGroup.clear();craft.forEach(p=>{if(!p.id)p.id=uid();craftGroup.add(makeMesh(p));});
  host.querySelector<HTMLElement>("#builder-stack")!.innerHTML=craft.map((p,i)=>{const group=partActivationGroup(p),label=p.kind==="engine"?"ENGINE · "+engineDisplayName(p).toUpperCase()+(group!==undefined?" · GROUP "+group:" · LAUNCH"):spec(p.kind).name+(group!==undefined?" · GROUP "+group:"");return "<div class='stack-row vab-stack-row "+(p.id===selectedId||selectedIds.has(p.id!)?"selected ":"")+(activationEditGroup!==null&&group===activationEditGroup?"activation-member":"")+"' data-id='"+p.id+"'><span>"+String(i+1).padStart(2,"0")+"</span><b>"+label+"</b><small>"+(p.x??0).toFixed(1)+", "+(p.y??0).toFixed(1)+", "+(p.z??0).toFixed(1)+"</small><button data-remove='"+p.id+"' aria-label='Remove part'>×</button></div>";}).join("");
  host.querySelector("#vab-part-count")!.textContent=craft.length+" PARTS";const groups=listActivationGroups(craft);host.querySelector<HTMLElement>("#vab-stage-summary")!.textContent=groups.length?groups.map(id=>"GROUP "+id+": "+craft.filter(part=>partActivationGroup(part)===id).length+" ACTION(S)").join(" / "):"NO ACTIVATION GROUPS / OPEN ACTIVATION LIST TO ADD";
  host.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b=>b.onclick=e=>{e.stopPropagation();removePart(b.dataset.remove!);});
  host.querySelectorAll<HTMLElement>(".vab-stack-row").forEach(row=>row.onclick=e=>{const event=e as MouseEvent,id=row.dataset.id!;if(activationEditGroup!==null){const part=craft.find(item=>item.id===id);if(part)toggleActivationPart(id,partActivationGroup(part)!==activationEditGroup);return;}if(event.shiftKey)selectPartRange(id);else if(event.ctrlKey||event.metaKey)togglePartSelection(id);else{releaseMultiSelectionTransform();select(craftGroup.children.find(g=>g.userData.partId===id) as THREE.Group??null);}});
  if(selectedIds.size>1)refreshMultiSelection();else select(craftGroup.children.find(g=>g.userData.partId===selectedId) as THREE.Group??null);renderActivationPanel();changed(clone(craft));
 }
 function removePart(id:string){craft=craft.filter(p=>p.id!==id&&!(p.kind==="fuel-line"&&(p.fuelLineStartId===id||p.fuelLineEndId===id)));selectedIds.delete(id);if(selectedId===id){selectedId=null;selected=null;transform.detach();}redraw();record();}
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
    const part:BuildPart={kind,id:uid(),...(kind==="tank"?{topRadius:.44,bottomRadius:.44,height:.96}:{}),...((kind==="remote-control"||kind==="reaction-wheel")?{topRadius:.28,bottomRadius:.28}:{}),...(kind==="heat-shield"?{radius:.62,thickness:.16}:{}),...(kind==="rover-wheel"?{radius:.24}:{}),...(kind==="solar"?{solarLength:2.4,solarDeployed:false}:{}),...(kind==="structural-beam"?{structuralLength:3}:{}),...((kind==="nose-cone"||isFairingKind(kind))?{bottomRadius:.44,height:defaultFairingHeight(kind)}:{}),...(kind==="engine"?{engineType,engineStage:0}:{}),x:placement.x,y:placement.y,z:placement.z,ry:0,parentId:placement.parentId,parentNode:placement.parentNode,childNode:placement.childNode};
    additions.push(part);working.push(part);
   }
  }
  if(!additions.length){
   const maxX=craft.reduce((n,p)=>Math.max(n,(p.x??0)+spec(p.kind).size.x/2),0);
   const topY=craft.reduce((n,p)=>Math.max(n,(p.y??0)+spec(p.kind).size.y/2),0);
   const partSize=spec(kind).size;
   const part:BuildPart={kind,id:uid(),...(kind==="tank"?{topRadius:.44,bottomRadius:.44,height:.96}:{}),...((kind==="remote-control"||kind==="reaction-wheel")?{topRadius:.28,bottomRadius:.28}:{}),...(kind==="heat-shield"?{radius:.62,thickness:.16}:{}),...(kind==="rover-wheel"?{radius:.24}:{}),...((kind==="nose-cone"||isFairingKind(kind))?{bottomRadius:.44,height:defaultFairingHeight(kind)}:{}),...(kind==="engine"?{engineType,engineStage:0}:{}),x:craft.length?maxX+partSize.x/2+.35:0,y:craft.length?Math.max(partSize.y/2,topY):0,z:0};
    if(craft.length){
     scene.updateMatrixWorld(true);
     const grounded=craftGroup.children.some(group=>{const bounds=new THREE.Box3().setFromObject(group);return !bounds.isEmpty()&&Math.abs(bounds.min.y)<=.08;});
     if(grounded){
      const rightEdge=craftGroup.children.reduce((edge,group)=>{const bounds=new THREE.Box3().setFromObject(group);return bounds.isEmpty()?edge:Math.max(edge,bounds.max.x);},-Infinity);
      const preview=makeMesh(part);preview.position.set(0,0,0);preview.rotation.set(part.rx??0,part.ry??0,part.rz??0);preview.updateMatrixWorld(true);
      const localBounds=new THREE.Box3().setFromObject(preview);
      const position=sideSpawnPosition(rightEdge,localBounds.min.x,localBounds.min.y,.35);part.x=position.x;part.y=position.y;
      preview.position.set(part.x,part.y,part.z??0);preview.updateMatrixWorld(true);
      const candidateBounds=new THREE.Box3().setFromObject(preview);
      const obstacleBounds=craftGroup.children.map(group=>new THREE.Box3().setFromObject(group)).filter(bounds=>!bounds.isEmpty());
      const shiftLeft=leftwardClearanceOffset(
       {minX:candidateBounds.min.x,maxX:candidateBounds.max.x,minY:candidateBounds.min.y,maxY:candidateBounds.max.y,minZ:candidateBounds.min.z,maxZ:candidateBounds.max.z},
       obstacleBounds.map(bounds=>({minX:bounds.min.x,maxX:bounds.max.x,minY:bounds.min.y,maxY:bounds.max.y,minZ:bounds.min.z,maxZ:bounds.max.z}))
      );
      part.x+=shiftLeft;
      preview.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});
     }
    }
   additions.push(part);count=1;
  }
  if(craft.length+additions.length>120){status.textContent="PART LIMIT / 120";return;}
  // Measure each newly-created mesh at its proposed transform, then move it
  // vertically until its actual lowest point rests exactly on the y=0 ground.
  // Do this in both directions: new parts may otherwise remain floating.
  for(const part of additions){
   const minY=groundMinYForPart(part);
   const correction=groundSnapOffset(minY);
   if(Math.abs(correction)>1e-7)part.y=(part.y??0)+correction;
  }
  if(!purchaseParts(additions))return;
  craft.push(...additions);selectedId=additions[0]?.id??null;redraw();record();
  const issues=validateAssembly(craft);
  status.textContent=issues.length?"ASSEMBLY WARNING / CHECK CONNECTIONS":`${(kind==="engine"?engineDisplayName(additions[0]!):spec(kind).name).toUpperCase()} PLACED / AUTO-SNAPPED · ${additions.length}×`;
 }
 function snapMovedPartToNearbyNode(part:BuildPart,g:THREE.Group,axis?:string){
  const previous={x:part.x,y:part.y,z:part.z,rx:part.rx,ry:part.ry,rz:part.rz,parentId:part.parentId,parentNode:part.parentNode,childNode:part.childNode};
  let placement=findNearestAttachmentPlacement(craft.filter(candidate=>candidate.id!==part.id),part.kind,[part.x??0,part.y??0,part.z??0],.16,part,axis);
  if(placement&&axis&&/^[XYZ]$/.test(axis)){
   const key=axis.toLowerCase() as "x"|"y"|"z";
   part[key]=placement[key];
  }else if(placement){part.x=placement.x;part.y=placement.y;part.z=placement.z;}
  if(placement){part.parentId=placement.parentId;part.parentNode=placement.parentNode;part.childNode=placement.childNode;}
  else{delete part.parentId;delete part.parentNode;delete part.childNode;}
  g.position.set(part.x??0,part.y??0,part.z??0);g.rotation.set(part.rx??0,part.ry??0,part.rz??0);
  if(hasCollision(g,part)){Object.assign(part,previous);g.position.set(part.x??0,part.y??0,part.z??0);g.rotation.set(part.rx??0,part.ry??0,part.rz??0);return false;}
  rememberSafePose(g,part);return Boolean(placement);
 }
 function setTool(next:string){if(next==="delete"){if(selectedIds.size>1){for(const id of [...selectedIds])craft=craft.filter(p=>p.id!==id&&!(p.kind==="fuel-line"&&(p.fuelLineStartId===id||p.fuelLineEndId===id)));selectedIds.clear();selectedId=null;selected=null;releaseMultiSelectionTransform();redraw();record();}else if(selectedId)removePart(selectedId);else status.textContent="SELECT A PART TO DELETE";return;}tool=next;host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===next));if(next==="translate"||next==="rotate"){transform.setMode(next);if(selectedIds.size>1){if(!multiSelectionActive)activateMultiSelectionTransform();transform.attach(multiSelectionPivot);}else if(selected)transform.attach(selected);}else{if(next==="select"&&multiSelectionActive)releaseMultiSelectionTransform();transform.detach();}orbit.enabled=true;if(selectedIds.size>1){host.querySelector<HTMLElement>("#vab-inspector")!.innerHTML="<b>"+selectedIds.size+" PARTS SELECTED</b><small>Individual shape controls are unavailable for multi-selection. Use MOVE or ROTATE to transform all selected parts together.</small>";status.textContent=selectedIds.size+" PARTS SELECTED / "+next.toUpperCase()+" GROUP GIZMO ACTIVE";}else{inspect();status.textContent=next.toUpperCase()+" TOOL";}}
 host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool!));
 host.querySelector<HTMLSelectElement>("#vab-category-select")!.addEventListener("change",event=>renderCatalog((event.currentTarget as HTMLSelectElement).value));
 renderCatalog("Power");
 let activeDragAxis:string|undefined;
 transform.addEventListener("dragging-changed",e=>{orbit.enabled=!(e.value as boolean);dragged=Boolean(e.value);if(dragged)activeDragAxis=undefined;if(!dragged&&multiSelectionActive){syncMultiSelectionParts();releaseMultiSelectionTransform();record();redraw();status.textContent=selectedIds.size+" PARTS TRANSFORMED TOGETHER";}else if(!dragged&&selected){syncPartFromGroup(selected);const part=craft.find(v=>v.id===selectedId);if(part){const snapped=snapMovedPartToNearbyNode(part,selected,activeDragAxis);status.textContent=snapped?"PART SNAPPED TO NEAREST FREE ATTACHMENT":"PART MOVED / FREE PLACEMENT";}activeDragAxis=undefined;record();redraw();}});
 // Keep pointer-move work cheap: only mirror the transform into the data model here.
 // Magnetic candidate search and collision validation run once, when the drag ends.
 transform.addEventListener("objectChange",()=>{if(multiSelectionActive){syncMultiSelectionParts();return;}if(selected)syncPartFromGroup(selected);});
 canvas.addEventListener("pointermove",e=>{if(!fuelLineDrawing)return;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(craftGroup.children,true);let root:THREE.Object3D|null=hits[0]?.object??null;if(root)while(root.parent&&root.parent!==craftGroup)root=root.parent;const targetId=root?.userData.partId as string|undefined;const target=targetId?craft.find(p=>p.id===targetId):undefined;updateFuelLinePreview(root,target?.kind==="tank"&&target.id!==fuelLineStartId);if(root&&target?.kind!=="tank"){fuelLinePreview.children.forEach(o=>{const m=o as THREE.Mesh;m.material=fuelLineInvalidMaterial;});}});
 let boxSelecting=false,boxStartX=0,boxStartY=0,boxPointerId:number|null=null;
 const selectionBox=document.createElement("div");selectionBox.className="vab-selection-marquee";selectionBox.hidden=true;
 canvas.parentElement?.appendChild(selectionBox);
 let cameraGesturePointerId:number|null=null;
 const restoreCameraGesture=()=>{cameraGesturePointerId=null;orbit.mouseButtons.LEFT=THREE.MOUSE.ROTATE;};
 canvas.addEventListener("pointerdown",e=>{if(e.button!==0||fuelLineDrawing||(!e.shiftKey&&!e.ctrlKey&&!e.metaKey))return;cameraGesturePointerId=e.pointerId;orbit.mouseButtons.LEFT=e.ctrlKey||e.metaKey?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;},true);
 canvas.addEventListener("pointerup",e=>{if(cameraGesturePointerId===e.pointerId)restoreCameraGesture();},true);
 canvas.addEventListener("pointercancel",e=>{if(cameraGesturePointerId===e.pointerId)restoreCameraGesture();},true);
 const beginBoxSelection=(e:PointerEvent)=>{if(e.button!==0||e.shiftKey||e.ctrlKey||e.metaKey||fuelLineDrawing||activationEditGroup!==null||dragged||transform.dragging||transform.axis)return;const rect=canvas.getBoundingClientRect();boxSelecting=true;boxPointerId=e.pointerId;boxStartX=e.clientX-rect.left;boxStartY=e.clientY-rect.top;selectionBox.hidden=false;selectionBox.style.left=boxStartX+"px";selectionBox.style.top=boxStartY+"px";selectionBox.style.width="0px";selectionBox.style.height="0px";orbit.enableRotate=false;orbit.enablePan=false;canvas.setPointerCapture(e.pointerId);e.preventDefault();};
 const finishBoxSelection=(e:PointerEvent)=>{if(!boxSelecting||boxPointerId!==e.pointerId)return;const rect=canvas.getBoundingClientRect(),endX=e.clientX-rect.left,endY=e.clientY-rect.top;const left=Math.min(boxStartX,endX),right=Math.max(boxStartX,endX),top=Math.min(boxStartY,endY),bottom=Math.max(boxStartY,endY);const moved=Math.hypot(endX-boxStartX,endY-boxStartY)>5;boxSelecting=false;boxPointerId=null;selectionBox.hidden=true;orbit.enableRotate=true;orbit.enablePan=true;if(!moved)return;const next=new Set<string>(e.ctrlKey||e.metaKey?selectedIds:[]);scene.updateMatrixWorld(true);const corners=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];const selectableGroups=[...craftGroup.children,...multiSelectionPivot.children] as THREE.Group[];for(const group of selectableGroups){const id=String(group.userData.partId??"");if(!id)continue;const bounds=new THREE.Box3().setFromObject(group);if(bounds.isEmpty())continue;const min=bounds.min,max=bounds.max;corners[0]!.set(min.x,min.y,min.z);corners[1]!.set(min.x,min.y,max.z);corners[2]!.set(min.x,max.y,min.z);corners[3]!.set(min.x,max.y,max.z);corners[4]!.set(max.x,min.y,min.z);corners[5]!.set(max.x,min.y,max.z);corners[6]!.set(max.x,max.y,min.z);corners[7]!.set(max.x,max.y,max.z);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,visible=false;for(const corner of corners){const projected=corner.clone().project(camera);if(projected.z< -1||projected.z>1)continue;visible=true;const x=(projected.x+1)*.5*rect.width,y=(1-projected.y)*.5*rect.height;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(visible&&maxX>=left&&minX<=right&&maxY>=top&&minY<=bottom)next.add(id);}selectedIds=next;selectionAnchorId=[...next][0]??null;if(next.size>1)refreshMultiSelection();else if(next.size===1){const id=[...next][0]!;select(selectableGroups.find(g=>g.userData.partId===id)??null);}else select(null);status.textContent=next.size?next.size+" PARTS SELECTED / CTRL OR CMD TO ADD":"NO PARTS IN SELECTION AREA";};
 canvas.addEventListener("pointermove",e=>{if(!boxSelecting||boxPointerId!==e.pointerId)return;const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;selectionBox.style.left=Math.min(boxStartX,x)+"px";selectionBox.style.top=Math.min(boxStartY,y)+"px";selectionBox.style.width=Math.abs(x-boxStartX)+"px";selectionBox.style.height=Math.abs(y-boxStartY)+"px";e.preventDefault();});
 canvas.addEventListener("pointerup",finishBoxSelection);
 canvas.addEventListener("pointercancel",finishBoxSelection);
 canvas.addEventListener("pointerdown",e=>{if(e.button===0&&(e.shiftKey||e.ctrlKey||e.metaKey))return;if(dragged||transform.dragging||transform.axis)return;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(craftGroup.children,true);if(activationEditGroup!==null){if(hits.length){let root:THREE.Object3D=hits[0]!.object;while(root.parent&&root.parent!==craftGroup)root=root.parent;const id=root.userData.partId as string|undefined;const part=craft.find(item=>item.id===id);if(id&&part)toggleActivationPart(id,partActivationGroup(part)!==activationEditGroup);}return;}if(fuelLineDrawing){let root:THREE.Object3D|null=hits[0]?.object??null;if(root)while(root.parent&&root.parent!==craftGroup)root=root.parent;const targetId=root?.userData.partId as string|undefined;const target=tankPart(targetId??null);if(!fuelLineStartId){if(!target){status.textContent="INVALID START / FUEL PIPES CAN ONLY START ON FUEL TANKS";return;}fuelLineStartId=target.id!;status.textContent="START TANK LOCKED / CLICK A SECOND FUEL TANK";return;}if(!target||target.id===fuelLineStartId){status.textContent="INVALID TARGET / FUEL PIPES ONLY CONNECT TWO DIFFERENT FUEL TANKS";fuelLinePreview.children.forEach(o=>{(o as THREE.Mesh).material=fuelLineInvalidMaterial;});return;}const start=tankPart(fuelLineStartId)!;const a=tankWorldPosition(start),b=tankWorldPosition(target),route=pipeGeometry(a,b,start.id!,target.id!);if(!route.clear){status.textContent="NO CLEAR PIPE ROUTE / MOVE COMPONENTS OR CHOOSE ANOTHER TANK";return;}const mid=route.midpoint;const line:BuildPart={kind:"fuel-line",id:uid(),x:mid.x,y:mid.y,z:mid.z,fuelLineStartId:start.id,fuelLineEndId:target.id};if(!purchaseParts([line]))return;craft.push(line);fuelLineStartId=null;fuelLineDrawing=false;fuelLinePreview.visible=false;redraw();record();status.textContent="FUEL PIPE CONNECTED / TANK TO TANK";return;}beginBoxSelection(e);if(!hits.length){select(null);return;}if(hits.length){let o=hits[0].object;while(o.parent&&o.parent!==craftGroup)o=o.parent;if(o instanceof THREE.Group){if(tool==="fuel-line-draw")return;const id=o.userData.partId as string|undefined;if(id&&(e.ctrlKey||e.metaKey))togglePartSelection(id);else if(id&&e.shiftKey)selectPartRange(id);else select(o);return;}}select(null);});
 host.querySelector("#vab-undo")!.addEventListener("click",()=>{if(historyIndex<=0)return;historyIndex--;craft=clone(history[historyIndex]);selectedId=null;redraw();});
 host.querySelector("#vab-redo")!.addEventListener("click",()=>{if(historyIndex>=history.length-1)return;historyIndex++;craft=clone(history[historyIndex]);selectedId=null;redraw();});
 host.querySelector("#vab-reset")!.addEventListener("click",()=>{camera.position.set(8,6,10);orbit.target.set(0,1,0);orbit.update();});
 host.querySelector<HTMLButtonElement>("#vab-activation-toggle")!.onclick=()=>{const panel=host.querySelector<HTMLElement>("#vab-activation-panel")!;panel.hidden=!panel.hidden;if(panel.hidden){activationEditGroup=null;selected=null;selectedId=null;selectedIds.clear();transform.detach();}host.querySelector<HTMLButtonElement>("#vab-activation-toggle")!.setAttribute("aria-expanded",String(!panel.hidden));renderActivationPanel();redraw();};
 host.querySelector<HTMLButtonElement>("#vab-activation-add")!.onclick=()=>{syncActivationOrder();const id=Math.max(0,...activationOrder)+1;activationOrder.push(id);activationEditGroup=id;selected=null;selectedId=null;selectedIds.clear();transform.detach();const panel=host.querySelector<HTMLElement>("#vab-activation-panel")!;panel.hidden=false;renderActivationPanel();redraw();status.textContent="ACTIVATION GROUP "+id+" / SELECT PARTS TO ADD";};
 function selectAllParts(){selected=null;selectedId=null;selectedIds=new Set(craft.map(p=>p.id!).filter(Boolean));selectionAnchorId=craft[0]?.id??null;if(selectedIds.size>1)refreshMultiSelection();else if(selectedIds.size===1){const id=[...selectedIds][0];select(craftGroup.children.find(g=>g.userData.partId===id) as THREE.Group??null);}else{releaseMultiSelectionTransform();transform.detach();}status.textContent=selectedIds.size+" PARTS SELECTED / CTRL+D TO DUPLICATE";}
 function duplicateSelection(){const ids=selectedIds.size?new Set(selectedIds):(selectedId?new Set([selectedId]):new Set<string>());if(!ids.size){status.textContent="SELECT PARTS BEFORE DUPLICATING";return;}const originals=craft.filter(p=>ids.has(p.id??"")&&p.kind!=="fuel-line");const lines=craft.filter(p=>ids.has(p.id??"")&&p.kind==="fuel-line"&&ids.has(p.fuelLineStartId??"")&&ids.has(p.fuelLineEndId??""));const count=originals.length+lines.length;if(!count){status.textContent="NO DUPLICATABLE PARTS SELECTED";return;}if(craft.length+count>120){status.textContent="PART LIMIT / 120";return;}const idMap=new Map<string,string>();for(const p of [...originals,...lines])idMap.set(p.id!,uid());const copies:BuildPart[]=[...originals,...lines].map(p=>{const copy:BuildPart={...p,id:idMap.get(p.id!)!,x:(p.x??0)+1.2};if(p.parentId){if(idMap.has(p.parentId))copy.parentId=idMap.get(p.parentId)!;else{delete copy.parentId;delete copy.parentNode;delete copy.childNode;}}if(p.kind==="fuel-line"){copy.fuelLineStartId=idMap.get(p.fuelLineStartId!)!;copy.fuelLineEndId=idMap.get(p.fuelLineEndId!)!;}return copy;});if(!purchaseParts(copies))return;craft.push(...copies);redraw();selectedIds=new Set(copies.map(p=>p.id!));selectedId=null;selected=null;transform.detach();host.querySelectorAll<HTMLElement>(".vab-stack-row").forEach(row=>row.classList.toggle("selected",selectedIds.has(row.dataset.id??"")));inspect();record();status.textContent="DUPLICATED "+copies.length+" PART(S) / OFFSET TO THE RIGHT";}
 function lowerSelectionToGround(){
  const ids=selectedIds.size?new Set(selectedIds):(selectedId?new Set([selectedId]):new Set<string>());
  if(!ids.size){status.textContent="SELECT PARTS BEFORE LOWERING TO GROUND";return;}
  releaseMultiSelectionTransform();
  scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3();
  for(const group of craftGroup.children){
   if(ids.has(String(group.userData.partId)))bounds.union(new THREE.Box3().setFromObject(group));
  }
  if(bounds.isEmpty()){status.textContent="SELECTED PARTS HAVE NO VISIBLE BOUNDS";return;}
  const drop=groundDropDistance(bounds.min.y);
  if(drop<=1e-6){status.textContent="SELECTION ALREADY TOUCHES THE GROUND";return;}
  craft=translatePartsY(craft,ids,-drop);
  redraw();
  record();
  status.textContent=ids.size+" PART"+(ids.size===1?"":"S")+" LOWERED TO GROUND / STRUCTURE PRESERVED";
 }
 host.addEventListener("keydown",e=>{const target=e.target as HTMLElement|null;const typing=!!target&&((target.closest("input,textarea,select,[contenteditable='true']"))!==null);const modifier=e.ctrlKey||e.metaKey;if(!typing&&!modifier&&e.key.toLowerCase()==="d"){e.preventDefault();e.stopPropagation();lowerSelectionToGround();return;}if(modifier&&!typing){const key=e.key.toLowerCase();if(key==="a"||key==="d"){e.preventDefault();e.stopPropagation();if(key==="a")selectAllParts();else duplicateSelection();return;}if(key==="z"){e.preventDefault();e.stopPropagation();host.querySelector<HTMLButtonElement>("#vab-undo")!.click();return;}}if((e.key==="Escape"||e.key==="Backspace")&&fuelLineDrawing){e.preventDefault();e.stopPropagation();fuelLineDrawing=false;fuelLineStartId=null;fuelLinePreview.visible=false;fuelLinePreview.children.forEach(child=>(child as THREE.Mesh).geometry.dispose());fuelLinePreview.clear();status.textContent="FUEL PIPE PLACEMENT CANCELLED";return;}if(e.key==="Delete"||e.key==="Backspace"){if(selectedIds.size){for(const id of [...selectedIds])craft=craft.filter(p=>p.id!==id&&!(p.kind==="fuel-line"&&(p.fuelLineStartId===id||p.fuelLineEndId===id)));selectedIds.clear();selectedId=null;selected=null;transform.detach();redraw();record();}else if(selectedId)removePart(selectedId);}if(e.key.toLowerCase()==="w")setTool("translate");if(e.key.toLowerCase()==="e")setTool("rotate");if(e.key.toLowerCase()==="q")setTool("select");});
 const updateRotationSnap=(e:KeyboardEvent)=>{if(e.key==="Shift"&&tool==="rotate")transform.setRotationSnap(rotationSnapForShift(e.type==="keydown"));};
 window.addEventListener("keydown",updateRotationSnap);window.addEventListener("keyup",updateRotationSnap);
 const clearRotationSnap=()=>transform.setRotationSnap(null);window.addEventListener("blur",clearRotationSnap);
 const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 const render=()=>{if(!alive)return;orbit.update();camera.position.x=THREE.MathUtils.clamp(camera.position.x,-10.25,10.25);camera.position.y=THREE.MathUtils.clamp(camera.position.y,.35,15.2);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-20.4,18.4);camera.lookAt(orbit.target);renderer.render(scene,camera);requestAnimationFrame(render);};
 craft=craft.map((p,i)=>({...p,id:p.id??uid(),x:p.x??0,y:p.y??(craft.length===3&&craft[0]?.kind==="capsule"&&craft[1]?.kind==="tank"&&craft[2]?.kind==="engine"?([1.885,.96,0][i]??0):(craft.length-1-i)*.96),z:p.z??0}));activationOrder=listActivationGroups(craft);redraw();render();
 function replaceParts(next:BuildPart[]){const normalized=clone(next).map((p,i)=>({...p,id:p.id??uid(),x:p.x??0,y:p.y??(next.length===3&&next[0]?.kind==="capsule"&&next[1]?.kind==="tank"&&next[2]?.kind==="engine"?([1.885,.96,0][i]??0):(next.length-1-i)*.96),z:p.z??0}));if(!purchaseParts(normalized))return false;releaseMultiSelectionTransform();transform.detach();selectedId=null;selected=null;selectedIds.clear();craft=normalized;history.splice(0,history.length,clone(craft));historyIndex=0;redraw();changed(clone(craft));status.textContent="BLUEPRINT LOADED / EDITOR READY";return true;}
 return {replaceParts,dispose(){alive=false;observer.disconnect();window.removeEventListener("keydown",updateRotationSnap);window.removeEventListener("keyup",updateRotationSnap);window.removeEventListener("blur",clearRotationSnap);transform.setRotationSnap(null);transform.detach();orbit.dispose();renderer.dispose();}};
}
