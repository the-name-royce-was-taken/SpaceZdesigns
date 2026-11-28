import * as THREE from "three";
import type { WorldRecord } from "./worlds";
import { mountVehicleBuilder, partCatalog, partCost, engineVariants, isFairingKind, defaultFairingHeight, type BuildPart } from "./vehicle-builder-3d";
import { tankFuelCapacity } from "./vehicle-assembly";
import { deleteBlueprint, exportBuildz, listBlueprints, renameBlueprint, saveBlueprint } from "./blueprints";
import { EARTH_LAUNCH_ORIENTATION, FlightSimulator, type FlightState, type VehiclePhysics } from "./flight-physics";
import { listActivationGroups, normalizeActivationAssignments, partActivationGroup } from "./activation";
import { CAREER_ACHIEVEMENTS, getNewCareerAchievements, type CareerEvent } from "./career";
import { formatDuration } from "./orbital";
import { connectedPartComponents } from "./assembly-components";
import { AU, G, SOLAR_SYSTEM, ephemerisAt, hohmannTransferWindow, secondsUntilPhase } from "./celestial";
import { earthSurfaceCameraDistance, rocketTrackingCameraDistance, rocketTrackingMarkerSize } from "./tracking-camera";
const bodies=[["Mercury","TERRESTRIAL",2439.7,3.7,"#aaa59c",57900000,"The innermost rocky planet."],["Venus","TERRESTRIAL",6051.8,8.87,"#d6b58b",108200000,"A dense, hot atmosphere above a rocky surface."],["Earth","HOME WORLD",6371,9.81,"#4e9bd0",149597871,"Blue oceans, familiar atmosphere, and the launch site."],["Luna","MOON",1737.4,1.62,"#b8b9c2",384400,"Earth’s natural satellite."],["Mars","TERRESTRIAL",3389.5,3.71,"#c87855",227900000,"A cold desert world with a thin atmosphere."],["Phobos","MARTIAN MOON",11.267,.0057,"#9a806d",9376,"A small, irregular moon orbiting close to Mars."],["Jupiter","GAS GIANT",69911,24.79,"#d5ae83",778600000,"A giant world with immense storms."],["Europa","ICY MOON",1560.8,1.31,"#d9d4c2",671100,"An ice-covered moon orbiting Jupiter."],["Saturn","GAS GIANT",58232,10.44,"#d8bd86",1433500000,"A ringed giant surrounded by an extraordinary moon system."],["Titan","ICY MOON",2574.7,1.35,"#c58d53",1221870,"A hazy moon orbiting Saturn."],["Uranus","ICE GIANT",25362,8.69,"#8dcbd0",2871000000,"A distant ice giant with an extreme axial tilt."],["Neptune","ICE GIANT",24622,11.15,"#557fd5",4495000000,"A deep-blue ice giant at the edge of the planetary system."]] as const;
type Craft={name:string;parts:BuildPart[]};
type SavedFlight={kind:"spacez-flight-save";craftName:string;state:FlightState;vehicle:VehiclePhysics;throttle:number;pitch:number;savedAt:string};
interface Host{getWorld:()=>WorldRecord|null;setWorld:(w:WorldRecord)=>Promise<void>;toast:(m:string,k?:"success"|"error")=>void}
const starterParts=():BuildPart[]=>[{kind:"capsule",x:0,y:1.885,z:0},{kind:"tank",x:0,y:.96,z:0,topRadius:.44,bottomRadius:.44,height:.96},{kind:"engine",x:0,y:0,z:0}];
let host:Host,craft:Craft={name:"Pioneer I",parts:starterParts()},target="Earth";
let builder:{dispose:()=>void;replaceParts:(parts:BuildPart[])=>boolean}|null=null,sim:FlightSimulator|null=null,simWorldId:string|null=null,flightFrame=0,flightRenderer:THREE.WebGLRenderer|null=null,trackingFrame=0,trackingRenderer:THREE.WebGLRenderer|null=null,flightResizeObserver:ResizeObserver|null=null,trackingResizeObserver:ResizeObserver|null=null,flightInputCleanup:(()=>void)|null=null,lastFrame=0,currentThrottle=0,currentPitch=0;
const $=<T extends HTMLElement>(s:string,r:ParentNode=document)=>{const e=r.querySelector<T>(s);if(!e)throw Error("Missing game element "+s);return e};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const world=()=>host.getWorld();
const PLANET_TEXTURES:Record<string,string>={
 Earth:"https://spaceengine.solarsystemscope.com/textures/download/2k_earth_daymap.jpg",
 Luna:"https://spaceengine.solarsystemscope.com/textures/download/2k_moon.jpg",
 Mars:"https://spaceengine.solarsystemscope.com/textures/download/2k_mars.jpg",
 Jupiter:"https://spaceengine.solarsystemscope.com/textures/download/2k_jupiter.jpg",
 Saturn:"https://spaceengine.solarsystemscope.com/textures/download/2k_saturn.jpg"
};
function applyPlanetTexture(mesh:THREE.Mesh,name:string,loader:THREE.TextureLoader){
 const url=PLANET_TEXTURES[name];if(!url)return;
 loader.load(url,texture=>{texture.colorSpace=THREE.SRGBColorSpace;const material=mesh.material as THREE.MeshStandardMaterial;material.map=texture;material.color.set(0xffffff);material.needsUpdate=true;},undefined,()=>{/* Solid planet colour remains as an offline-safe fallback. */});
}
function metricsForParts(parts:readonly BuildPart[]){const entries=parts.map(part=>({part,spec:partCatalog.find(item=>item.kind===part.kind)!}));const mass=entries.reduce((n,e)=>n+e.spec.mass,0),fuel=entries.reduce((n,e)=>n+(e.part.kind==="tank"?tankFuelCapacity(e.part):e.spec.fuel),0),thrust=entries.reduce((n,e)=>n+e.spec.thrust,0),cost=entries.reduce((n,e)=>n+partCost(e.part.kind,e.part.engineType),0);return{mass,fuel,thrust,cost}}
function metrics(){return metricsForParts(craft.parts)}
async function save(){const w=world();if(!w)throw new Error("Select a world before saving a vehicle.");const list=((w.state.craft??[]) as Craft[]).filter(c=>c.name!==craft.name);const savedCraft=structuredClone(craft);savedCraft.parts=normalizeActivationAssignments(savedCraft.parts);list.unshift(savedCraft);w.state.craft=list;w.updatedAt=new Date().toISOString();await host.setWorld(w)}
function persistFlight(throttle:number,pitch:number){const w=world();if(!w||!sim||simWorldId!==w.id)return;const saves=(w.state.missions??[]).filter((entry)=>!(entry&&typeof entry==="object"&&(entry as {kind?:string;craftName?:string}).kind==="spacez-flight-save"&&(entry as {craftName?:string}).craftName===craft.name));saves.push({kind:"spacez-flight-save",craftName:craft.name,state:structuredClone(sim.state),vehicle:structuredClone(sim.vehicle),throttle,pitch,savedAt:new Date().toISOString()} satisfies SavedFlight);w.state.missions=saves;w.updatedAt=new Date().toISOString();void host.setWorld(w).catch(error=>host.toast(error instanceof Error?error.message:"Could not save flight progress.","error"))}
function clearFlightSave(){const w=world();if(!w)return;w.state.missions=(w.state.missions??[]).filter((entry)=>!(entry&&typeof entry==="object"&&(entry as {kind?:string;craftName?:string}).kind==="spacez-flight-save"&&(entry as {craftName?:string}).craftName===craft.name));w.updatedAt=new Date().toISOString();void host.setWorld(w).catch(error=>host.toast(error instanceof Error?error.message:"Could not update the flight save.","error"))}
function load(){const w=world(),a=(w?.state.craft??[]) as Craft[],activeName=(w?.state as {activeCraftName?:string}|undefined)?.activeCraftName,selected=a.find(item=>item.name===activeName)??a[0];craft=selected?structuredClone(selected):{name:"Pioneer I",parts:starterParts()};if(craft.parts.every(p=>p.y===undefined)){if(craft.parts.length===3&&craft.parts[0]?.kind==="capsule"&&craft.parts[1]?.kind==="tank"&&craft.parts[2]?.kind==="engine"){craft.parts[0]!.y=1.885;craft.parts[1]!.y=.96;craft.parts[2]!.y=0;}else craft.parts.forEach((p,i)=>p.y=(craft.parts.length-1-i)*.96);}const activeWorld=world();if(activeWorld?.mode==="career"){const owned=new Set(activeWorld.state.purchasedParts??[]);for(const part of craft.parts){if(!part.id)part.id=globalThis.crypto?.randomUUID?.()??("legacy-"+Math.random().toString(36).slice(2));owned.add(part.id);}activeWorld.state.purchasedParts=[...owned];}}
function careerAchievementMarkup(){const w=world();if(!w||w.mode!=="career")return "";const unlocked=new Set(w.state.achievements??[]);const earned=CAREER_ACHIEVEMENTS.filter(item=>unlocked.has(item.id)).length;return `<section class="career-achievements"><div class="career-achievements-head"><b>CAREER ACHIEVEMENTS</b><span>${earned} / ${CAREER_ACHIEVEMENTS.length} COMPLETE</span></div><div class="career-achievement-list">${CAREER_ACHIEVEMENTS.map(item=>`<div class="career-achievement ${unlocked.has(item.id)?"unlocked":"locked"}"><span><b>${esc(item.name)}</b><small>${esc(item.description)}</small></span><strong>${item.reward.toLocaleString()} cr</strong></div>`).join("")}</div></section>`;}
function refreshCareerPanel(root:ParentNode){const panel=root.querySelector<HTMLElement>(".career-achievements");if(!panel)return;const w=world();if(!w||w.mode!=="career")return;const unlocked=new Set(w.state.achievements??[]);const earned=CAREER_ACHIEVEMENTS.filter(item=>unlocked.has(item.id)).length;const count=panel.querySelector(".career-achievements-head span");if(count)count.textContent=earned+" / "+CAREER_ACHIEVEMENTS.length+" COMPLETE";panel.querySelector(".career-achievement-list")!.innerHTML=CAREER_ACHIEVEMENTS.map(item=>`<div class="career-achievement ${unlocked.has(item.id)?"unlocked":"locked"}"><span><b>${esc(item.name)}</b><small>${esc(item.description)}</small></span><strong>${item.reward.toLocaleString()} cr</strong></div>`).join("");}
function awardCareerAchievements(state:FlightState,event?:CareerEvent,root?:ParentNode){const w=world();if(!w||w.mode!=="career")return;const unlocked=w.state.achievements??[];const earned=getNewCareerAchievements(state,unlocked,event);if(!earned.length)return;w.state.achievements=[...unlocked,...earned.map(item=>item.id)];const reward=earned.reduce((sum,item)=>sum+item.reward,0);w.state.credits+=reward;w.updatedAt=new Date().toISOString();const balance=root?.querySelector<HTMLElement>("#career-credits");if(balance)balance.textContent=w.state.credits.toLocaleString()+" cr";void host.setWorld(w).catch(error=>host.toast(error instanceof Error?error.message:"Could not save career rewards.","error"));refreshCareerPanel(root??document);host.toast(earned.length===1?`Achievement unlocked: ${earned[0]!.name} (+${reward.toLocaleString()} cr)`:`${earned.length} achievements unlocked (+${reward.toLocaleString()} cr)`);}
function purchaseCareerParts(parts:BuildPart[],root:ParentNode){const w=world();if(!w||w.mode!=="career")return true;const owned=new Set(w.state.purchasedParts??[]);const newParts=parts.filter(part=>!!part.id&&!owned.has(part.id));const cost=newParts.reduce((sum,part)=>sum+partCost(part.kind,part.engineType),0);if(w.state.credits<cost){host.toast(`Insufficient funds. Need ${cost.toLocaleString()} cr; balance is ${w.state.credits.toLocaleString()} cr.`,"error");return false;}if(!newParts.length)return true;for(const part of newParts)owned.add(part.id!);w.state.purchasedParts=[...owned];w.state.credits-=cost;w.updatedAt=new Date().toISOString();const balance=root.querySelector<HTMLElement>("#career-credits");if(balance)balance.textContent=w.state.credits.toLocaleString()+" cr";void host.setWorld(w).catch(error=>host.toast(error instanceof Error?error.message:"Could not save part purchase.","error"));host.toast(`Purchased ${newParts.length} part${newParts.length===1?"":"s"} for ${cost.toLocaleString()} cr.`);return true;}
function nav(v:string){document.querySelector<HTMLElement>(`#world-screen [data-action="${v}"]`)?.click()}
export function renderGameScreen(name:string){if(name!=="hangar"){builder?.dispose();builder=null}if(name!=="flight"){if(simWorldId===world()?.id&&sim&&!sim.state.landed&&!sim.state.crashed)persistFlight(currentThrottle,currentPitch);else if(simWorldId!==world()?.id){sim=null;simWorldId=null;}disposeFlightScene();}if(name!=="tracking")disposeTrackingScene();if(name==="home"||name==="worlds"||name==="settings")return;if(!world()){host.toast("Create or load a world first.","error");return}if(name==="hangar"){load();hangar()}if(name==="flight"){load();launchpad()}if(name==="tracking")tracking()}
function hangar(){
 builder?.dispose();const root=$("#hangar-content"),m=metrics();
 root.innerHTML=`<div class="immersive-toolbar"><button class="text-button" data-action="return-world">← WORLD SPACE CENTER</button><span class="panel-kicker">VEHICLE ASSEMBLY BUILDING / VAB-01</span><span class="live-tag">EDITOR READY</span></div>
 <section class="game-panel builder-panel vab-full-panel"><div class="game-panel-head"><div><span class="panel-kicker">CONSTRUCTION BAY / FULL-SCREEN EDITOR</span><h3>VEHICLE ASSEMBLY</h3></div><span class="live-tag">SNAP BUILD ACTIVE</span></div>
 <div class="vab-design-row"><label class="game-label">VEHICLE DESIGNATION<input id="craft-name" maxlength="32" value="${esc(craft.name)}"></label><div class="vehicle-readout vab-metrics"><div><small>WET MASS</small><b id="build-mass">${(m.mass+m.fuel*.001).toFixed(2)} t</b></div><div><small>PROPELLANT</small><b id="build-fuel">${m.fuel} u</b></div><div><small>MAX THRUST</small><b id="build-thrust">${m.thrust} kN</b></div><div><small>BUILD COST</small><b id="build-cost">${m.cost.toLocaleString()} cr</b></div>${world()?.mode==="career"?`<div><small>CAREER FUNDS</small><b id="career-credits">${world()!.state.credits.toLocaleString()} cr</b></div>`:""}</div></div>
 <div id="craft-3d-host"></div><div class="game-actions vab-save-row"><div class="game-actions vab-launch-actions"><button class="secondary-button compact" id="save-design">SAVE VEHICLE</button><button class="primary-button compact" id="save-launch">SAVE &amp; LAUNCH ↗</button></div><span class="game-hint">Save your design or save and head straight to the launch pad.</span></div></section>`;
 builder=mountVehicleBuilder($("#craft-3d-host",root),craft.parts,parts=>{craft.parts=parts;const v=metrics();$("#build-mass",root).textContent=(v.mass+v.fuel*.001).toFixed(2)+" t";$("#build-fuel",root).textContent=v.fuel+" u";$("#build-thrust",root).textContent=v.thrust+" kN";$("#build-cost",root).textContent=v.cost.toLocaleString()+" cr";},{purchase:parts=>purchaseCareerParts(parts,root)});
 $("#craft-name",root).onchange=e=>{craft.name=(e.currentTarget as HTMLInputElement).value.trim().slice(0,32)||"Untitled Vehicle"};
 const saveCurrentDesign=async()=>{craft.name=($("#craft-name",root) as HTMLInputElement).value.trim().slice(0,32)||"Untitled Vehicle";await save();};
 $("#save-design",root).onclick=async()=>{try{await saveCurrentDesign();host.toast("Vehicle saved to this world.");}catch(error){host.toast(error instanceof Error?error.message:"Vehicle save failed.","error");}};
 $("#save-launch",root).onclick=async()=>{try{await saveCurrentDesign();host.toast("Vehicle saved. Preparing launch.");nav("continue");}catch(error){host.toast(error instanceof Error?error.message:"Vehicle save failed.","error");}};

 const blueprintPanel=$("#vab-blueprints-panel",root),blueprintList=$("#vab-blueprints-list",root),blueprintToggle=$("#vab-blueprints-toggle",root) as HTMLButtonElement;
 const refreshBlueprints=async()=>{
  const records=await listBlueprints();
  blueprintList.innerHTML=records.length?records.map(record=>`<article class="vab-blueprint-row" data-blueprint-id="${esc(record.id)}"><div class="vab-blueprint-name" data-blueprint-name title="Double-click to rename">${esc(record.name)}</div><div class="vab-blueprint-actions"><button type="button" data-blueprint-action="download">DOWNLOAD</button><button type="button" data-blueprint-action="load">LOAD</button><button type="button" data-blueprint-action="overwrite">OVERWRITE</button><button type="button" data-blueprint-action="delete" class="danger">DELETE</button></div></article>`).join(""):`<div class="vab-blueprints-empty"><b>NO BLUEPRINTS SAVED</b><span>Use “New blueprint” to save this craft in this browser.</span></div>`;
  blueprintList.querySelectorAll<HTMLElement>("[data-blueprint-name]").forEach(label=>label.addEventListener("dblclick",()=>{
   const row=label.closest<HTMLElement>("[data-blueprint-id]");const id=row?.dataset.blueprintId;if(!id)return;
   const input=document.createElement("input");input.className="vab-blueprint-rename";input.maxLength=48;input.value=label.textContent??"";label.replaceWith(input);input.focus();input.select();
   let finished=false;const finish=async(save:boolean)=>{if(finished)return;finished=true;try{if(save&&input.value.trim())await renameBlueprint(id,input.value);await refreshBlueprints();}catch(error){host.toast(error instanceof Error?error.message:"Could not rename blueprint.","error");await refreshBlueprints();}};
   input.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();void finish(true);}if(event.key==="Escape")void finish(false);});
   input.addEventListener("blur",()=>void finish(true));
  }));
  blueprintList.querySelectorAll<HTMLButtonElement>("[data-blueprint-action]").forEach(button=>button.addEventListener("click",async()=>{
   const row=button.closest<HTMLElement>("[data-blueprint-id]");const id=row?.dataset.blueprintId;if(!id)return;
   const record=records.find(item=>item.id===id);if(!record)return;
   const action=button.dataset.blueprintAction;
   try{
    if(action==="download"){
     const bytes=exportBuildz(record.name,record.parts),blob=new Blob([bytes.slice().buffer as ArrayBuffer],{type:"application/zip"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");
     anchor.href=url;anchor.download=`${record.name.replace(/[^a-z0-9-_ ]/gi,"").trim().replace(/\\s+/g,"-")||"SpaceZ-Blueprint"}.buildz`;document.body.append(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);host.toast(`Downloaded ${record.name}.buildz`);
    }else if(action==="load"){
     const loadedCraft:Craft={name:record.name,parts:structuredClone(record.parts)};if(builder&&!builder.replaceParts(loadedCraft.parts))return;craft=loadedCraft;($("#craft-name",root) as HTMLInputElement).value=craft.name;
     const v=metrics();$("#build-mass",root).textContent=(v.mass+v.fuel*.001).toFixed(2)+" t";$("#build-fuel",root).textContent=v.fuel+" u";$("#build-thrust",root).textContent=v.thrust+" kN";$("#build-cost",root).textContent=v.cost.toLocaleString()+" cr";
     blueprintPanel.hidden=true;blueprintToggle.setAttribute("aria-expanded","false");host.toast(`Loaded blueprint: ${record.name}`);
    }else if(action==="overwrite"){
     await saveBlueprint(record.name,craft.parts,record.id);await refreshBlueprints();host.toast(`Overwrote ${record.name}`);
    }else if(action==="delete"){
     if(!window.confirm(`Delete blueprint “${record.name}”? This cannot be undone.`))return;
     await deleteBlueprint(record.id);await refreshBlueprints();host.toast(`Deleted ${record.name}`);
    }
   }catch(error){host.toast(error instanceof Error?error.message:"Blueprint action failed.","error");}
  }));
 };
 blueprintToggle.onclick=()=>{blueprintPanel.hidden=!blueprintPanel.hidden;blueprintToggle.setAttribute("aria-expanded",String(!blueprintPanel.hidden));if(!blueprintPanel.hidden)void refreshBlueprints().catch(error=>host.toast(error instanceof Error?error.message:"Could not read blueprints.","error"));};
 $("#vab-blueprints-close",root).onclick=()=>{blueprintPanel.hidden=true;blueprintToggle.setAttribute("aria-expanded","false");};
 $("#vab-blueprint-add",root).onclick=async()=>{
  const name=window.prompt("Name this blueprint:",craft.name);if(name===null)return;
  try{const record=await saveBlueprint(name,craft.parts);await refreshBlueprints();host.toast(`Saved blueprint: ${record.name}`);}
  catch(error){host.toast(error instanceof Error?error.message:"Could not save blueprint.","error");}
 };
}
function disposeFlightScene(){if(flightFrame)cancelAnimationFrame(flightFrame);flightFrame=0;flightInputCleanup?.();flightInputCleanup=null;flightResizeObserver?.disconnect();flightResizeObserver=null;flightRenderer?.dispose();flightRenderer=null;}
function disposeTrackingScene(){if(trackingFrame)cancelAnimationFrame(trackingFrame);trackingFrame=0;trackingResizeObserver?.disconnect();trackingResizeObserver=null;trackingRenderer?.dispose();trackingRenderer=null;}
function makeRocket(parts:BuildPart[]=craft.parts):THREE.Group{
 const g=new THREE.Group();
 const enginePlumes:THREE.Mesh[]=[];
 const rcsPlumes:THREE.Mesh[]=[];
 const solarAssemblies:{group:number;partId:string;hinge:THREE.Group;deployed:boolean}[]=[];
 const activationParts:{group:number;kind:BuildPart["kind"];object:THREE.Group;plume?:THREE.Mesh;hinge?:THREE.Group}[]=[];
 const mat=(color:number,metalness=.25)=>new THREE.MeshStandardMaterial({color,roughness:.42,metalness,side:THREE.DoubleSide});
 const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh};
 parts.forEach((p,i)=>{
  const y=p.y??(parts.length===3&&parts[0]?.kind==="capsule"&&parts[1]?.kind==="tank"&&parts[2]?.kind==="engine"?([1.885,.96,0][i]??0):(parts.length-1-i)*.96);
  const partChildStart=g.children.length;
  if(p.kind==="capsule"){
   add(new THREE.CylinderGeometry(.43,.49,.62,32,3,false),mat(0xe1e9ef,.4),p.x??0,y-.08,p.z??0);
   add(new THREE.ConeGeometry(.43,.52,32,3,false),mat(0xc7d4de,.36),p.x??0,y+.49,p.z??0);
   add(new THREE.SphereGeometry(.13,24,16),mat(0x45b6d5,.62),p.x??0,y+.02,(p.z??0)+.425);
  }else if(p.kind==="tank"){
   const top=p.topRadius??.44,bottom=p.bottomRadius??.44,height=p.height??.96;
   add(new THREE.CylinderGeometry(top,bottom,height,40,8,false),mat(0xc5d0d8,.4),p.x??0,y,p.z??0);
  }else if(p.kind==="nose-cone"||isFairingKind(p.kind)){
    const base=p.bottomRadius??.44,height=p.height??defaultFairingHeight(p.kind),color=partCatalog.find(item=>item.kind===p.kind)?.color??0x9bb6c9;
    const shell=mat(color,.35);
    if(p.kind==="nose-cone")add(new THREE.ConeGeometry(base,height,40,10),shell,p.x??0,y,p.z??0);
    else if(p.kind==="conical-fairing")add(new THREE.CylinderGeometry(.018,base,height,40,10),shell,p.x??0,y,p.z??0);
    else if(p.kind==="interstage-fairing")add(new THREE.CylinderGeometry(base*.78,base,height,40,2,true),shell,p.x??0,y,p.z??0);
    else {const points=Array.from({length:25},(_,i)=>{const t=i/24;return new THREE.Vector2(base*Math.sqrt(Math.max(0,1-t*t)),-height/2+t*height);});add(new THREE.LatheGeometry(points,40),shell,p.x??0,y,p.z??0);}
   }else if(p.kind==="airbrake"){
   add(new THREE.BoxGeometry(.7,.08,.5),mat(0xb78b68,.55),p.x??0,y,p.z??0);
  }else if(p.kind==="strake"){
   add(new THREE.BoxGeometry(.12,.8,.42),mat(0x7898ad,.45),p.x??0,y,p.z??0);
  }else if(p.kind==="side-decoupler"){
   add(new THREE.BoxGeometry(.72,.24,.3),mat(0xe0bd70,.55),p.x??0,y,p.z??0);
   add(new THREE.BoxGeometry(.12,.34,.38),mat(0x5d7483,.65),(p.x??0)+.28,y,p.z??0);
   add(new THREE.BoxGeometry(.12,.34,.38),mat(0xe0bd70,.55),(p.x??0)-.28,y,p.z??0);
  }else if(p.kind==="separator-thruster"){
   add(new THREE.BoxGeometry(.32,.22,.3),mat(0xb6c3cb,.65),p.x??0,y,p.z??0);
   for(const side of [-1,1])add(new THREE.CylinderGeometry(.07,.11,.22,16),mat(0xd88b62,.55),(p.x??0)+side*.2,y,p.z??0);
  }else if(p.kind==="fuel-line"){
   const endpoint=(id:string|undefined)=>{if(!id)return null;const index=parts.findIndex(part=>part.id===id&&part.kind==="tank");if(index<0)return null;const tank=parts[index]!;return new THREE.Vector3(tank.x??0,tank.y??(parts.length-1-index)*1.05,tank.z??0);};
   const start=endpoint(p.fuelLineStartId),end=endpoint(p.fuelLineEndId);
   if(start&&end){const delta=end.clone().sub(start),direction=delta.clone().normalize();const a=start.clone().add(direction.clone().multiplyScalar(.46)),b=end.clone().sub(direction.clone().multiplyScalar(.46));const mid=a.clone().add(b).multiplyScalar(.5);mid.y-=Math.min(.65,Math.max(.22,delta.length()*.18));const curve=new THREE.CatmullRomCurve3([a,a.clone().lerp(mid,.55),mid,b.clone().lerp(mid,.55),b]);add(new THREE.TubeGeometry(curve,32,.045,8,false),mat(0x65aeb4,.7));}
  }else if(p.kind==="engine"){
   const engine=engineVariants.find(e=>e.id===(p.engineType??"liquid"))??engineVariants[0]!;
   const steel=mat(0x8c9ba4,.82),chamber=mat(engine.accent,.68),bell=mat(engine.accent,.72);
   add(new THREE.CylinderGeometry(.255,.255,.075,12),steel,p.x??0,y+.44,p.z??0);
   add(new THREE.CylinderGeometry(.17,.16,.19,12,2,false),chamber,p.x??0,y+.30,p.z??0);
   add(new THREE.CylinderGeometry(.145,.12,.13,12,2,false),steel,p.x??0,y+.045,p.z??0);
   // Bridge the throat and chamber transitions so no open seams show through.
   add(new THREE.CylinderGeometry(.12,.12,.16,12),steel,p.x??0,y-.08,p.z??0);
   add(new THREE.CylinderGeometry(.16,.145,.12,12),chamber,p.x??0,y+.16,p.z??0);
   const nozzleProfile=[
    new THREE.Vector2(.12,-.16),new THREE.Vector2(.135,-.23),new THREE.Vector2(.19,-.34),
    new THREE.Vector2(.27,-.49),new THREE.Vector2(.355,-.66),new THREE.Vector2(.375,-.68),
    new THREE.Vector2(.345,-.67),new THREE.Vector2(.26,-.48),new THREE.Vector2(.18,-.33),
    new THREE.Vector2(.115,-.22),new THREE.Vector2(.105,-.16)
   ];
   add(new THREE.LatheGeometry(nozzleProfile,12),bell,p.x??0,y,p.z??0);
   const throat=add(new THREE.TorusGeometry(.14,.018,6,12),steel,p.x??0,y-.19,p.z??0);throat.rotation.x=Math.PI/2;
   const exitLip=add(new THREE.TorusGeometry(.365,.018,6,12),steel,p.x??0,y-.67,p.z??0);exitLip.rotation.x=Math.PI/2;
   for(let i=0;i<4;i++){const angle=i*Math.PI/2,strut=add(new THREE.BoxGeometry(.035,.19,.035),steel,(p.x??0)+Math.cos(angle)*.205,y+.34,(p.z??0)+Math.sin(angle)*.205);strut.rotation.z=-Math.cos(angle)*.18;strut.rotation.x=Math.sin(angle)*.18;}
   add(new THREE.BoxGeometry(.11,.075,.13),mat(0x263744,.68),(p.x??0)+.19,y-.015,p.z??0);
   const plume=new THREE.Mesh(new THREE.ConeGeometry(.22,.95,12),new THREE.MeshBasicMaterial({color:0xffa34d,transparent:true,opacity:.78}));plume.position.set(p.x??0,y-.9,p.z??0);plume.rotation.x=Math.PI;plume.visible=false;plume.userData.stage=p.engineStage??0;g.add(plume);enginePlumes.push(plume);
  }else if(p.kind==="separator"){
   add(new THREE.CylinderGeometry(.5,.5,.2,40,2,false),mat(0xd6b66d,.45),p.x??0,y,p.z??0);
   const sepRing=add(new THREE.TorusGeometry(.5,.032,10,40),mat(0xffd77c,.55),p.x??0,y+.09,p.z??0);sepRing.rotation.x=Math.PI/2;
  }else if(p.kind==="fin"||p.kind==="wing"||p.kind==="control"){
   const size=p.kind==="wing"?[1.7,.12,1.1]:p.kind==="fin"?[.9,.7,.18]:[1,.1,.42];
   const surface=add(new THREE.BoxGeometry(size[0],size[1],size[2]),mat(p.kind==="control"?0xd1a66b:0x759bb7,.32),p.x??0,y,p.z??0);
   surface.rotation.y=p.ry??0;
  }else if(p.kind==="solar"){
   const length=Math.max(.8,Math.min(8,p.solarLength??2.4)),deployed=p.solarDeployed===true;
   add(new THREE.BoxGeometry(.2,.12,.22),mat(0x8799a7,.65),p.x??0,y,p.z??0);
   
   const hinge=new THREE.Group();hinge.position.set((p.x??0)+.1,y,p.z??0);hinge.rotation.z=deployed?0:-Math.PI/2;
   const panel=new THREE.Mesh(new THREE.BoxGeometry(length,.035,.72),mat(0x2678a5,.62));panel.position.x=length/2;panel.castShadow=true;panel.receiveShadow=true;hinge.add(panel);
   const gridMaterial=mat(0x9be4f4,.35);for(let i=1;i<8;i++){const x=length*i/8,z=-.36+.72*i/8;const vertical=new THREE.Mesh(new THREE.BoxGeometry(.012,.004,.72),gridMaterial);vertical.position.set(x,.0195,0);hinge.add(vertical);const horizontal=new THREE.Mesh(new THREE.BoxGeometry(length,.004,.012),gridMaterial);horizontal.position.set(length/2,.0195,z);hinge.add(horizontal);}g.add(hinge);solarAssemblies.push({group:p.activationGroup??1,partId:p.id??"",hinge,deployed});
  }else if(p.kind==="dock"){
   add(new THREE.CylinderGeometry(.22,.28,.22,32,2,false),mat(0xb9c7d0,.78),p.x??0,y,p.z??0);
   const dockRing=add(new THREE.TorusGeometry(.22,.04,10,32),mat(0x5b768b,.72),p.x??0,y+.13,p.z??0);dockRing.rotation.x=Math.PI/2;
  }else if(p.kind==="landing-leg"){
   const steel=mat(0x9aa9b2,.72),rubber=mat(0x273542,.12),retracted=!!p.retracted;
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3,dx=Math.cos(a),dz=Math.sin(a),pivot=new THREE.Vector3((p.x??0)+dx*.12,y+(retracted?.08:-.22),(p.z??0)+dz*.12),foot=new THREE.Vector3((p.x??0)+dx*(retracted?.2:.58),y+(retracted?-.08:-.78),(p.z??0)+dz*(retracted?.2:.58)),delta=foot.clone().sub(pivot),strut=add(new THREE.CylinderGeometry(.035,.045,delta.length(),8),steel,...pivot.clone().add(foot).multiplyScalar(.5).toArray());strut.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());const tire=add(new THREE.CylinderGeometry(.14,.14,.09,12),rubber,...foot.toArray());tire.rotation.z=Math.PI/2;}
   add(new THREE.CylinderGeometry(.09,.12,.12,10),steel,p.x??0,y+.28,p.z??0);
  }else if(p.kind==="heat-shield"){
   const radius=p.radius??.62,thickness=p.thickness??.16,ablative=mat(0x9a6548,.08),rim=mat(0xc2a18a,.35);
   add(new THREE.CylinderGeometry(radius*.96,radius,thickness,32,2,false),ablative,p.x??0,y-thickness/2,p.z??0);
   const edge=add(new THREE.TorusGeometry(radius*.97,.025,6,32),rim,p.x??0,y-thickness-.002,p.z??0);edge.rotation.x=Math.PI/2;
   add(new THREE.CylinderGeometry(radius*.58,radius*.7,.012,32),mat(0x493d38,.05),p.x??0,y+.006,p.z??0);
  }else if(p.kind==="rover-wheel"){
   const radius=p.radius??.24,rubber=mat(0x26343d,.02),hub=mat(0x9aa8ad,.7);
   const tire=add(new THREE.CylinderGeometry(radius,radius,.18,16,1),rubber,(p.x??0),y-.12,p.z??0);tire.rotation.z=Math.PI/2;
   const rim=add(new THREE.CylinderGeometry(radius*.58,radius*.58,.19,12),hub,(p.x??0),y-.12,p.z??0);rim.rotation.z=Math.PI/2;
   for(let i=0;i<16;i++){const a=i*Math.PI/8;const lug=add(new THREE.BoxGeometry(.2,.045,.045),rubber,p.x??0,y-.12+Math.cos(a)*(radius+.006),(p.z??0)+Math.sin(a)*(radius+.006));lug.rotation.x=a;}
  }else if(p.kind==="rcs"){
   add(new THREE.BoxGeometry(.34,.22,.34),mat(0x899ba8,.72),p.x??0,y,p.z??0);
   for(let i=0;i<4;i++){const a=i*Math.PI/2,dx=Math.cos(a),dz=Math.sin(a),nozzle=add(new THREE.CylinderGeometry(.055,.075,.13,10),mat(0xb5c3ca,.78),(p.x??0)+dx*.18,y,(p.z??0)+dz*.18);nozzle.rotation.z=dz*.55;nozzle.rotation.x=dx*.55;
    const plume=new THREE.Mesh(new THREE.ConeGeometry(.055,.3,8),new THREE.MeshBasicMaterial({color:0x7ed7e9,transparent:true,opacity:.72}));plume.position.set((p.x??0)+dx*.27,y,(p.z??0)+dz*.27);plume.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dx,0,dz));plume.visible=false;plume.userData.stage=partActivationGroup(p)??0;g.add(plume);rcsPlumes.push(plume);
   }
  }else if(p.kind==="remote-control"||p.kind==="reaction-wheel"){
   const top=p.topRadius??.28,bottom=p.bottomRadius??.28,height=.28,half=height/2;
   const shell=mat(p.kind==="remote-control"?0x718fa0:0x9baab4,.68),trim=mat(p.kind==="remote-control"?0x29495b:0x344d5e,.8),detail=mat(p.kind==="remote-control"?0x4bb6d4:0xcbd5db,.55);
   add(new THREE.CylinderGeometry(top,bottom,height,32,4,false),shell,p.x??0,y,p.z??0);
   for(const [offset,radius] of [[-half,bottom],[half,top]] as const){const rim=add(new THREE.TorusGeometry(radius,.014,8,32),trim,p.x??0,y+offset,p.z??0);rim.rotation.x=Math.PI/2;}
   if(p.kind==="remote-control"){add(new THREE.CylinderGeometry(top*.22,top*.22,.018,16),detail,p.x??0,y+half+.009,p.z??0);for(let i=0;i<3;i++)add(new THREE.SphereGeometry(.018,8,6),mat([0x58d6ad,0xe7bd62,0x70aee0][i],.7),(p.x??0)+(i-1)*top*.32,y,(p.z??0)+bottom+.008);}
   else{add(new THREE.CylinderGeometry(Math.min(top,bottom)*.34,Math.min(top,bottom)*.34,.035,20),detail,p.x??0,y+half+.018,p.z??0);const ring=add(new THREE.TorusGeometry(Math.min(top,bottom)*.58,.018,8,32),trim,p.x??0,y+half+.02,p.z??0);ring.rotation.x=Math.PI/2;}
  }else if(p.kind==="wheel"){
   const leg=add(new THREE.CylinderGeometry(.055,.07,.72,16),mat(0x8999a5,.55),(p.x??0)+.12,y,(p.z??0));
   leg.rotation.z=-.22;
   const wheel=add(new THREE.CylinderGeometry(.2,.2,.12,24),mat(0x273542,.12),(p.x??0)+.3,y-.28,p.z??0);
   wheel.rotation.z=Math.PI/2;
  }else{
   add(new THREE.BoxGeometry(.5,.3,.5),mat(p.kind==="battery"?0x879b78:0x9caeba,.45),p.x??0,y,p.z??0);
  }
  const partGroup=new THREE.Group();partGroup.userData.partId=p.id;
  const meshes=g.children.slice(partChildStart);meshes.forEach(mesh=>partGroup.add(mesh));g.add(partGroup);
  const assignedGroup=partActivationGroup(p);
  if(assignedGroup!==undefined){
   const action:{group:number;kind:BuildPart["kind"];object:THREE.Group;plume?:THREE.Mesh;hinge?:THREE.Group}={group:assignedGroup,kind:p.kind,object:partGroup};
   if(p.kind==="solar")action.hinge=solarAssemblies.find(panel=>panel.partId===p.id)?.hinge;
   if(p.kind==="separator-thruster"){
    const plume=new THREE.Mesh(new THREE.ConeGeometry(.13,.48,10),new THREE.MeshBasicMaterial({color:0xffa34d,transparent:true,opacity:.86}));
    plume.position.set(p.x??0,y-.36,p.z??0);plume.rotation.x=Math.PI;plume.visible=false;partGroup.add(plume);action.plume=plume;
   }
   activationParts.push(action);
  }
 });
 g.userData.enginePlumes=enginePlumes;
 g.userData.rcsPlumes=rcsPlumes;
 g.userData.solarAssemblies=solarAssemblies;
 g.userData.activationParts=activationParts;
 return g;
}
function launchpad(){
 disposeFlightScene();const root=$("#flight-content");const components=connectedPartComponents(craft.parts);const activeComponent=components.find(component=>component.commandable)??components.find(component=>component.parts.some(part=>part.kind==="engine"));const launchParts=activeComponent?.parts??craft.parts;const m=metricsForParts(launchParts);sim=null;simWorldId=null;
 const activationGroups=listActivationGroups(launchParts);
 root.innerHTML=`<div class="flight-sim-shell">
 <canvas id="flight-3d-canvas" aria-label="Live 3D vehicle flight view"></canvas>
 <div class="flight-topbar"><button class="flight-exit" data-action="return-world">← SPACE CENTER</button><span class="flight-title">FLIGHT OPERATIONS / ${esc(craft.name)}</span><span class="live-tag" id="flight-status">PAD READY</span></div>
 <div class="flight-hud-left"><div class="flight-hud-kicker">LIVE TELEMETRY</div><div class="flight-telemetry-grid">
 <div><small>ALTITUDE</small><b id="altitude">0.00 km</b></div><div><small>VERTICAL SPEED</small><b id="velocity">0.0 m/s</b></div>
 <div><small>HORIZONTAL SPEED</small><b id="horizontal-speed">0.0 m/s</b></div><div><small>PROPELLANT</small><b id="fuel">${m.fuel.toFixed(0)} u</b></div>
 <div><small>RCS PROPELLANT</small><b id="rcs-fuel">0.0 kg</b></div><div><small>DYNAMIC PRESSURE</small><b id="dynamic-pressure">0.0 kPa</b></div>
 <div><small>MAX-Q</small><b id="max-q">0.0 kPa</b></div><div><small>ATTITUDE</small><b id="angle">0.0°</b></div>
 </div><div class="flight-hud-note"><span>MISSION TIME</span><b id="mission-time">T+ 00:00</b><span>ENGINE GROUP</span><b id="engine-stage-readout">STAGE 0</b></div></div>
 <div class="flight-hud-right"><div class="flight-hud-kicker">VEHICLE SYSTEMS</div><div class="flight-system-line"><span>REACTION WHEELS</span><b>${craft.parts.some(p=>p.kind==="reaction-wheel")?"ONLINE":"NOT FITTED"}</b></div><div class="flight-system-line"><span>RCS THRUSTERS</span><b>${craft.parts.some(p=>p.kind==="rcs")?"ONLINE":"NOT FITTED"}</b></div><div class="flight-system-line"><span>CONTROL SURFACES</span><b>${craft.parts.some(p=>["wing","fin","control"].includes(p.kind))?"ONLINE":"NOT FITTED"}</b></div><div class="flight-system-line"><span>FLIGHT ASSIST</span><b id="flight-mode">STABILITY ASSIST</b></div>
 <div class="flight-hud-kicker flight-stage-heading">ACTIVATION GROUPS</div><div class="flight-activation-list" id="flight-activation-list">${activationGroups.length?activationGroups.map(group=>`<div class="flight-activation-row"><span><b>GROUP ${group}</b><small>${craft.parts.filter(part=>partActivationGroup(part)===group).map(part=>part.kind==="engine"?"ENGINE":partCatalog.find(spec=>spec.kind===part.kind)?.name??part.kind).join(" · ")}</small></span><button class="secondary-button compact" data-flight-activation="${group}">ACTIVATE</button></div>`).join(""):"<small>NO ACTIVATION GROUPS ASSIGNED</small>"}</div>${careerAchievementMarkup()}</div>
 <div class="flight-bottom-controls"><div class="flight-control-row"><label>MAIN ENGINE THROTTLE <b id="throttle-value">0%</b><input id="throttle" type="range" min="0" max="100" value="0"></label><label>ATTITUDE TRIM <b id="pitch-value">0°</b><input id="pitch" type="range" min="-30" max="30" value="0"></label>
 <label class="assist-toggle"><input id="stability-assist" type="checkbox" checked> STABILITY ASSIST</label><button class="secondary-button compact" id="next-stage" disabled>ACTIVATE NEXT STAGE</button><button class="primary-button compact" id="ignite">IGNITE / LAUNCH</button><button class="secondary-button compact" id="recover">RECOVER</button><button class="secondary-button compact" id="open-map">TRACKING MAP</button></div>
 <div class="flight-key-hints"><span><b>W / S</b> PITCH</span><span><b>A / D</b> YAW</span><span><b>↑ / ↓</b> THROTTLE</span><span><b>← / →</b> RCS TRANSLATION</span><span><b>Q / E</b> ROLL</span><span><b>SPACE</b> NEXT STAGE</span><span><b>DRAG</b> CAMERA ORBIT</span></div>
 <p id="flight-note">Gravity, atmosphere, aerodynamic drag/lift, engine mass flow, RCS propellant use, and attitude control are active.</p>
 </div></div>`;

 const canvas=$("#flight-3d-canvas",root) as HTMLCanvasElement,renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"low-power",logarithmicDepthBuffer:true});flightRenderer=renderer;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x050d18);
 const camera=new THREE.PerspectiveCamera(48,canvas.clientWidth/canvas.clientHeight,1e-9,80);camera.position.set(10,13,24);
 scene.add(new THREE.HemisphereLight(0xd9efff,0x26313b,1.5));const sun=new THREE.DirectionalLight(0xffefcf,2.6);sun.position.set(-18,28,22);scene.add(sun);
 const earthRadius=6.371,earth=new THREE.Mesh(new THREE.SphereGeometry(earthRadius,64,32),new THREE.MeshStandardMaterial({color:0x4e9bd0,roughness:.92,flatShading:true}));scene.add(earth);const planetTextureLoader=new THREE.TextureLoader();planetTextureLoader.setCrossOrigin("anonymous");applyPlanetTexture(earth,"Earth",planetTextureLoader);
 const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(earthRadius*1.025,48,24),new THREE.MeshBasicMaterial({color:0x68b9e8,transparent:true,opacity:.09,side:THREE.BackSide}));scene.add(atmosphere);
 const pad=new THREE.Mesh(new THREE.CylinderGeometry(12,12,1,8),new THREE.MeshStandardMaterial({color:0x737f86,flatShading:true}));pad.scale.setScalar(1e-6);pad.rotation.z=-Math.PI/2;pad.position.set(earthRadius+1e-7,0,0);scene.add(pad);
 for(let i=0;i<4;i++){const tower=new THREE.Mesh(new THREE.BoxGeometry(2,30,2),new THREE.MeshStandardMaterial({color:0xa6b5bd}));tower.scale.setScalar(1e-6);tower.rotation.z=-Math.PI/2;tower.position.set(earthRadius+.000015,Math.cos(i*Math.PI/2)*.000012,Math.sin(i*Math.PI/2)*.000012);scene.add(tower);}
 const launchMinY=Math.min(...launchParts.map(part=>{const spec=partCatalog.find(item=>item.kind===part.kind)!;const height=part.kind==="tank"?(part.height??.96):part.kind==="structural-beam"?Math.max(1,Math.min(12,Math.round(part.structuralLength??3)))*.4:spec.size.y;const offset=part.kind==="capsule"?.1525:part.kind==="engine"?-.1:0;return(part.y??0)+offset-height/2;})),spawnClearanceM=Math.max(.2,-launchMinY+.05);const group=makeRocket(launchParts);group.scale.setScalar(1e-6);scene.add(group);let debrisReleased=false;const looseGroups=components.filter(component=>component!==activeComponent).map(component=>{const object=makeRocket(component.parts);scene.add(object);const minY=Math.min(...component.parts.map(part=>{const spec=partCatalog.find(item=>item.kind===part.kind)!;const height=part.kind==="tank"?(part.height??.96):part.kind==="structural-beam"?Math.max(1,Math.min(12,Math.round(part.structuralLength??3)))*.4:spec.size.y;const offset=part.kind==="capsule"?.1525:part.kind==="engine"?-.1:0;return(part.y??0)+offset-height/2;}));object.scale.setScalar(1e-6);object.quaternion.set(EARTH_LAUNCH_ORIENTATION.x,EARTH_LAUNCH_ORIENTATION.y,EARTH_LAUNCH_ORIENTATION.z,EARTH_LAUNCH_ORIENTATION.w);object.position.x=earthRadius+Math.max(.2,-minY+.05)/1e6;return{object,velocity:0,landed:false,groundX:earthRadius+.00000005-minY*1e-6,initialX:earthRadius+Math.max(.2,-minY+.05)/1e6};});group.position.set(earthRadius+spawnClearanceM/1e6,0,0);const launchOrientation=new THREE.Quaternion(EARTH_LAUNCH_ORIENTATION.x,EARTH_LAUNCH_ORIENTATION.y,EARTH_LAUNCH_ORIENTATION.z,EARTH_LAUNCH_ORIENTATION.w);group.quaternion.copy(launchOrientation);let cameraDistance=8,cameraYaw=0,cameraPitch=.08,cameraDragging=false,cameraPointerX=0,cameraPointerY=0;const updateFlightCamera=()=>{const localOffset=new THREE.Vector3(Math.sin(cameraYaw)*Math.cos(cameraPitch)*cameraDistance,Math.sin(cameraPitch)*cameraDistance,Math.cos(cameraYaw)*Math.cos(cameraPitch)*cameraDistance);camera.position.copy(group.position).add(localOffset.applyQuaternion(group.quaternion));camera.up.set(0,1,0).applyQuaternion(group.quaternion);camera.lookAt(group.position);};updateFlightCamera();canvas.style.cursor="grab";canvas.addEventListener("pointerdown",event=>{cameraDragging=true;cameraPointerX=event.clientX;cameraPointerY=event.clientY;canvas.setPointerCapture(event.pointerId);canvas.style.cursor="grabbing";});canvas.addEventListener("pointermove",event=>{if(!cameraDragging)return;cameraYaw-=(event.clientX-cameraPointerX)*.006;cameraPitch=Math.max(-1.35,Math.min(1.35,cameraPitch+(event.clientY-cameraPointerY)*.006));cameraPointerX=event.clientX;cameraPointerY=event.clientY;updateFlightCamera();});const stopCameraDrag=()=>{cameraDragging=false;canvas.style.cursor="grab";};canvas.addEventListener("pointerup",stopCameraDrag);canvas.addEventListener("pointercancel",stopCameraDrag);canvas.addEventListener("wheel",event=>{event.preventDefault();cameraDistance=Math.max(3,Math.min(80,cameraDistance*Math.exp(event.deltaY*.001)));updateFlightCamera();},{passive:false});
 const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};flightResizeObserver=new ResizeObserver(resize);flightResizeObserver.observe(canvas);
 const engineManifest=launchParts.filter(p=>p.kind==="engine").map(p=>{const variant=engineVariants.find(e=>e.id===(p.engineType??"liquid"))??engineVariants[0]!;return{stage:partActivationGroup(p)??0,thrustKN:variant.thrustKN,ispSeconds:variant.ispSeconds};});
 const selectedEngine=launchParts.find(p=>p.kind==="engine");
 const enginePerformance=engineVariants.find(e=>e.id===(selectedEngine?.engineType??"liquid"))??engineVariants[0]!;
 const aeroCounts={cones:launchParts.filter(p=>p.kind==="nose-cone").length,fairings:launchParts.filter(p=>isFairingKind(p.kind)).length,wings:launchParts.filter(p=>p.kind==="wing").length,fins:launchParts.filter(p=>p.kind==="fin").length,controls:launchParts.filter(p=>p.kind==="control").length,airbrakes:launchParts.filter(p=>p.kind==="airbrake").length,strakes:launchParts.filter(p=>p.kind==="strake").length};
 const vehicle={epochSeconds:Date.now()/1000-946728000,spawnClearanceM,dryMassTonnes:m.mass,fuelTonnes:m.fuel*.001,thrustKN:engineManifest.reduce((sum,e)=>sum+e.thrustKN,0),ispSeconds:enginePerformance.ispSeconds,referenceArea:.8+aeroCounts.wings*.12+aeroCounts.airbrakes*.16,dragCoefficient:Math.max(.2,.48-aeroCounts.cones*.06-aeroCounts.fairings*.1+aeroCounts.airbrakes*.45+aeroCounts.strakes*.025),liftSlope:2.1+aeroCounts.wings*.45+aeroCounts.fins*.2+aeroCounts.controls*.3,inertia:1.6,reactionWheelTorque:launchParts.filter(p=>p.kind==="reaction-wheel").length*3.8,rcsTorque:launchParts.filter(p=>p.kind==="rcs").length*1.5,rcsThrustKN:launchParts.filter(p=>p.kind==="rcs").length*.35,rcsFuelTonnes:launchParts.filter(p=>p.kind==="rcs").length*.012,controlSurfaceAuthority:aeroCounts.controls+aeroCounts.wings*.45+aeroCounts.fins*.3,rcsStages:launchParts.filter(p=>p.kind==="rcs").map(p=>partActivationGroup(p)??0),reactionWheelStages:launchParts.filter(p=>p.kind==="reaction-wheel").map(p=>partActivationGroup(p)??0),controlSurfaceStages:launchParts.filter(p=>["wing","fin","control"].includes(p.kind)).map(p=>partActivationGroup(p)??0),engines:engineManifest,activationGroups};
 const range=$("#throttle",root) as HTMLInputElement,pitch=$("#pitch",root) as HTMLInputElement,assist=$("#stability-assist",root) as HTMLInputElement;
 const updateLabels=()=>{$("#throttle-value",root).textContent=range.value+"%";$("#pitch-value",root).textContent=pitch.value+"°";currentThrottle=Number(range.value)/100;currentPitch=Number(pitch.value);};range.oninput=updateLabels;pitch.oninput=updateLabels;
 const heldKeys=new Set<string>(),flightKeys=new Set(["KeyW","KeyS","KeyA","KeyD","KeyQ","KeyE","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"]);
 const onFlightKeyDown=(event:KeyboardEvent)=>{if(!flightKeys.has(event.code))return;const target=event.target as HTMLElement|null;if(target&&(/INPUT|TEXTAREA|SELECT/.test(target.tagName)||target.isContentEditable))return;event.preventDefault();heldKeys.add(event.code);if(event.code==="Space"&&!event.repeat)($("#next-stage",root) as HTMLButtonElement).click();};
 const onFlightKeyUp=(event:KeyboardEvent)=>{heldKeys.delete(event.code);};
 const onFlightBlur=()=>heldKeys.clear();window.addEventListener("keydown",onFlightKeyDown);window.addEventListener("keyup",onFlightKeyUp);window.addEventListener("blur",onFlightBlur);flightInputCleanup=()=>{window.removeEventListener("keydown",onFlightKeyDown);window.removeEventListener("keyup",onFlightKeyUp);window.removeEventListener("blur",onFlightBlur);};
 const savedFlight=(world()?.state.missions??[]).find((entry):entry is SavedFlight=>!!entry&&typeof entry==="object"&&(entry as {kind?:string}).kind==="spacez-flight-save"&&(entry as {craftName?:string}).craftName===craft.name);
 if(savedFlight){debrisReleased=true;sim=new FlightSimulator(savedFlight.vehicle);simWorldId=world()?.id??null;const restored=structuredClone(savedFlight.state) as FlightState&{position?:{x:number;y:number;z:number};velocity?:{x:number;y:number;z:number};orientation?:{x:number;y:number;z:number;w:number};angularVelocity?:{x:number;y:number;z:number}};if(!restored.position){restored.position={x:restored.x,y:6_371_000+restored.altitude,z:0};restored.velocity={x:restored.vx,y:restored.vy,z:0};restored.orientation={x:0,y:0,z:Math.sin(restored.angle/2),w:Math.cos(restored.angle/2)};restored.angularVelocity={x:0,y:0,z:restored.angularVelocityScalar??0};}Object.assign(sim.state,restored);range.value=String(savedFlight.throttle*100);pitch.value=String(savedFlight.pitch);updateLabels();lastFrame=performance.now();$("#flight-status",root).textContent="FLIGHT RESTORED";$("#flight-note",root).textContent="Restored the most recently saved flight state from this world.";}
 let lastPersist=performance.now();
 $("#ignite",root).onclick=()=>{if((!launchParts.some(p=>p.kind==="capsule")&&!launchParts.some(p=>p.kind==="remote-control"))||!launchParts.some(p=>p.kind==="engine")){host.toast("Add a command pod or remote control module, plus an engine, before launch.","error");return}if(!sim){const firstStage=activationGroups[0]??0,initialThrust=engineManifest.filter(engine=>engine.stage<=firstStage).reduce((sum,engine)=>sum+engine.thrustKN,0),wetMass=m.mass+m.fuel*.001,twr=initialThrust/(wetMass*9.80665);if(twr<1){host.toast("This connected launch vehicle cannot lift off: first-stage thrust-to-weight is "+twr.toFixed(2)+". Add engines or reduce mass.","error");return;}debrisReleased=true;const activeWorld=world();if(activeWorld){(activeWorld.state as {activeCraftName?:string}).activeCraftName=craft.name;void host.setWorld(activeWorld);}sim=new FlightSimulator(vehicle);simWorldId=world()?.id??null;sim.launch();awardCareerAchievements(sim.state,"launch",root);if(sim.state.currentStage>0){performGroupActions(sim.state.currentStage);awardCareerAchievements(sim.state,"stage",root);}lastFrame=performance.now();range.value="100";updateLabels();persistFlight(Number(range.value)/100,Number(pitch.value));host.toast("Ignition at full throttle. Liftoff thrust-to-weight "+twr.toFixed(2)+".");}};
 const activationParts=group.userData.activationParts as {group:number;kind:BuildPart["kind"];object:THREE.Group;plume?:THREE.Mesh;hinge?:THREE.Group}[];
 const solarAssemblies=group.userData.solarAssemblies as {group:number;partId:string;hinge:THREE.Group;deployed:boolean}[];
 const performGroupActions=(groupId:number)=>{
  const separationParts=launchParts.filter(part=>part.kind==="separator-thruster"&&partActivationGroup(part)===groupId);
  if(separationParts.length){const impulse=separationParts.reduce((sum,part)=>sum+Math.sign(part.x??1)*.65,0);sim?.applyImpulse(impulse||separationParts.length*.65,0);}
  activationParts.filter(part=>part.group===groupId).forEach(part=>{
   if(part.kind==="engine")return;
   if(part.kind==="solar"&&part.hinge){const deploy=Math.abs(part.hinge.rotation.z)>.1;part.hinge.rotation.z=deploy?0:-Math.PI/2;const panel=solarAssemblies.find(item=>item.partId===part.object.userData.partId);if(panel)panel.deployed=deploy;return;}
   if(part.kind==="separator-thruster"&&part.plume){part.plume.visible=true;window.setTimeout(()=>{part.plume!.visible=false;},450);return;}
   if(part.kind==="separator"||part.kind==="side-decoupler"||part.kind==="fairing"||part.kind==="conical-fairing"||part.kind==="interstage-fairing"||part.kind==="clam-shell-fairing"||part.kind==="heat-shield"){part.object.visible=false;return;}
   if(part.kind==="landing-leg"||part.kind==="wheel"||part.kind==="rover-wheel"||part.kind==="airbrake"||part.kind==="control"||part.kind==="rcs"||part.kind==="reaction-wheel"||part.kind==="dock"){part.object.visible=true;return;}
   part.object.visible=true;
  });
  $("#engine-stage-readout",root).textContent="STAGE "+groupId;
  host.toast("Activation group "+groupId+" activated.");
 };
 const activateFlightGroup=(groupId:number)=>{if(!sim){host.toast("Launch the vehicle before activating a group.","error");return;}if(!sim.activateStage(groupId)){host.toast("Activate groups in their listed order.","error");return;}awardCareerAchievements(sim.state,"stage",root);performGroupActions(groupId);};
 root.querySelectorAll<HTMLButtonElement>("[data-flight-activation]").forEach(button=>button.onclick=()=>activateFlightGroup(Number(button.dataset.flightActivation)));
 $("#next-stage",root).onclick=()=>{if(!sim){host.toast("Launch the vehicle before activating later groups.","error");return;}if(!sim.activateNextStage()){host.toast("No later activation groups are assigned.");return;}awardCareerAchievements(sim.state,"stage",root);performGroupActions(sim.state.currentStage);};
 $("#recover",root).onclick=()=>{sim?.reset();sim=null;simWorldId=null;debrisReleased=false;looseGroups.forEach(debris=>{debris.object.position.x=debris.initialX;debris.velocity=0;debris.landed=false;});range.value="0";pitch.value="0";updateLabels();group.position.set(earthRadius+spawnClearanceM/1e6,0,0);group.quaternion.copy(new THREE.Quaternion(EARTH_LAUNCH_ORIENTATION.x,EARTH_LAUNCH_ORIENTATION.y,EARTH_LAUNCH_ORIENTATION.z,EARTH_LAUNCH_ORIENTATION.w));cameraDistance=8;cameraYaw=0;cameraPitch=.08;updateFlightCamera();$("#flight-status",root).textContent="PAD READY";$("#flight-note",root).textContent="Vehicle recovered. Ready for another launch."};
 $("#open-map",root).onclick=()=>nav("tracking");
 let alive=true;const animate=(now:number)=>{if(!alive)return;const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;
  const throttleDelta=(heldKeys.has("ArrowUp")?1:0)-(heldKeys.has("ArrowDown")?1:0);if(throttleDelta)range.value=String(Math.max(0,Math.min(100,Number(range.value)+throttleDelta*45*dt)));updateLabels();
  if(debrisReleased)for(const debris of looseGroups){if(debris.landed)continue;debris.velocity-=9.81*dt;debris.object.position.x+=debris.velocity*dt/1e6;if(debris.object.position.x<=debris.groundX){debris.object.position.x=debris.groundX;debris.velocity=0;debris.landed=true;}}
  if(sim){const s=sim.state,stability=assist.checked,keyboardPitch=(heldKeys.has("KeyW")?1:0)-(heldKeys.has("KeyS")?1:0),keyboardYaw=(heldKeys.has("KeyA")?1:0)-(heldKeys.has("KeyD")?1:0),desiredPitch=Math.max(-1,Math.min(1,Number(pitch.value)/30+keyboardPitch)),command=stability?Math.max(-1,Math.min(1,-s.angle*.9-s.angularVelocityScalar*.6+desiredPitch)):desiredPitch;sim.step(dt,{throttle:Number(range.value)/100,pitch:command,yaw:keyboardYaw,roll:(heldKeys.has("KeyE")?1:0)-(heldKeys.has("KeyQ")?1:0),translateZ:(heldKeys.has("ArrowRight")?1:0)-(heldKeys.has("ArrowLeft")?1:0)});awardCareerAchievements(s,undefined,root);
   group.position.set(s.position.x/1e6,s.position.y/1e6,s.position.z/1e6);group.quaternion.set(s.orientation.x,s.orientation.y,s.orientation.z,s.orientation.w);updateFlightCamera();
   const rho=1.225*Math.exp(-Math.max(0,s.altitude)/8500),speed=Math.hypot(s.velocity.x,s.velocity.y,s.velocity.z),q=.5*rho*speed*speed;
   $("#altitude",root).textContent=(s.altitude/1000).toFixed(2)+" km";$("#velocity",root).textContent=s.vy.toFixed(1)+" m/s";$("#horizontal-speed",root).textContent=Math.abs(s.vx).toFixed(1)+" m/s";$("#fuel",root).textContent=(s.fuelTonnes*1000).toFixed(1)+" u";$("#rcs-fuel",root).textContent=(s.rcsFuelTonnes*1000).toFixed(1)+" kg";$("#dynamic-pressure",root).textContent=(q/1000).toFixed(1)+" kPa";$("#max-q",root).textContent=(s.maxQ/1000).toFixed(1)+" kPa";$("#angle",root).textContent=(s.angle*180/Math.PI).toFixed(1)+"°";$("#mission-time",root).textContent="T+ "+Math.floor(s.elapsed/60).toString().padStart(2,"0")+":"+Math.floor(s.elapsed%60).toString().padStart(2,"0");
   $("#engine-stage-readout",root).textContent="STAGE "+s.currentStage;
   const plumes=group.userData.enginePlumes as THREE.Mesh[];plumes.forEach(plume=>{plume.visible=!s.landed&&!s.crashed&&Number(plume.userData.stage??0)<=s.currentStage&&Number(range.value)>0&&s.fuelTonnes>0;});
   const rcsJets=group.userData.rcsPlumes as THREE.Mesh[];const rcsCommand=heldKeys.has("KeyA")||heldKeys.has("KeyD")||heldKeys.has("ArrowLeft")||heldKeys.has("ArrowRight");rcsJets.forEach(jet=>{jet.visible=!s.landed&&!s.crashed&&rcsCommand&&Number(jet.userData.stage??0)<=s.currentStage&&s.rcsFuelTonnes>0;});
   const nextStageButton=$("#next-stage",root) as HTMLButtonElement;nextStageButton.disabled=!vehicle.activationGroups?.some(stage=>stage>s.currentStage);nextStageButton.textContent=nextStageButton.disabled?"NO LATER STAGES":"ACTIVATE NEXT STAGE";
   $("#flight-status",root).textContent=s.crashed?"VEHICLE LOST":s.landed?"LANDED":"IN FLIGHT";$("#flight-note",root).textContent=s.crashed?"Impact detected. Recover and redesign the vehicle.":s.landed?"Vehicle landed. Recover to reset the launchpad.":q>30000?"MAX-Q REGION: monitor dynamic pressure and throttle.":"Gravity turn and aerodynamic forces are active.";
   if(s.crashed||s.landed){range.value="0";updateLabels();clearFlightSave();if(s.crashed)host.toast("Vehicle impacted the surface.","error");else if(s.elapsed>1){awardCareerAchievements(s,"landing",root);host.toast("Vehicle returned to the surface.");}sim=null;simWorldId=null;}
   if(sim&&now-lastPersist>2500){persistFlight(Number(range.value)/100,Number(pitch.value));lastPersist=now;}
  }
  renderer.render(scene,camera);flightFrame=requestAnimationFrame(animate);
 };flightFrame=requestAnimationFrame(animate);
 root.addEventListener("DOMNodeRemoved",()=>{alive=false;flightResizeObserver?.disconnect();disposeFlightScene();},{once:true});
}
function tracking(){
 disposeTrackingScene();const root=$("#tracking-content"),w=world();
 const missions=(w?.state.missions??[]).filter((entry):entry is SavedFlight=>!!entry&&typeof entry==="object"&&(entry as {kind?:string}).kind==="spacez-flight-save");if(sim&&simWorldId===w?.id&&!sim.state.landed&&!sim.state.crashed&&!missions.some(m=>m.craftName===craft.name)){missions.push({kind:"spacez-flight-save",craftName:craft.name,state:structuredClone(sim.state),vehicle:structuredClone(sim.vehicle),throttle:currentThrottle,pitch:currentPitch,savedAt:new Date().toISOString()});}
 const activeName=(w?.state as {activeCraftName?:string}|undefined)?.activeCraftName??craft.name;
 const epochSeconds=Date.now()/1000-946728000,ephemeris=ephemerisAt(epochSeconds),byId=new Map(ephemeris.map(body=>[body.id,body]));
 const SCALE=1e-9,bodyIds:Record<string,string>={Mercury:"mercury",Venus:"venus",Earth:"earth",Luna:"moon",Mars:"mars",Phobos:"phobos",Jupiter:"jupiter",Europa:"europa",Saturn:"saturn",Titan:"titan",Uranus:"uranus",Neptune:"neptune"};
 const textureLoader=new THREE.TextureLoader();textureLoader.setCrossOrigin("anonymous");
 root.innerHTML=`<div class="tracking-3d-shell"><div class="tracking-3d-top"><button class="text-button" data-action="return-world">← WORLD SPACE CENTER</button><span class="panel-kicker">TRACKING STATION / TRUE-SCALE SOLAR SYSTEM</span><span class="live-tag">REAL RADII & ORBITAL DISTANCES</span></div><div class="tracking-3d-stage"><canvas id="system-canvas" aria-label="True scale interactive three dimensional solar system map"></canvas><div class="tracking-map-label">TRUE SCALE · 1 SCENE UNIT = 1,000,000 KM</div><div class="tracking-map-help">DRAG TO ROTATE · SCROLL TO ZOOM · SELECT A BODY OR ROCKET · SYMBOLS ARE SCREEN-SIZED</div></div><aside class="tracking-3d-sidebar"><div class="tracking-sidebar-head"><span class="panel-kicker">CELESTIAL BODIES</span><b>12 OBJECTS</b></div><div class="body-grid">${bodies.map(b=>`<button class="body-card" data-body="${b[0]}"><i class="body-dot" style="--body-color:${b[4]}"></i><span><b>${b[0]}</b><small>${b[1]}</small></span><i>↗</i></button>`).join("")}</div><div id="rocket-list" class="rocket-list"><span class="panel-kicker">ACTIVE VEHICLES</span>${missions.length?missions.map(m=>`<button class="body-card rocket-card" data-rocket="${esc(m.craftName)}"><i class="body-dot"></i><span><b>${esc(m.craftName)}</b><small>${m.state.landed?"LANDED":m.state.crashed?"LOST":"IN FLIGHT"}</small></span><i>•</i></button>`).join(""):'<p>No saved flight vehicles in this world. Launch a vehicle to add its marker.</p>'}</div><div id="body-detail" class="body-detail"></div><div class="orbit-prediction" id="orbit-prediction"></div></aside></div>`;
 const canvas=$("#system-canvas",root) as HTMLCanvasElement,renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,logarithmicDepthBuffer:true});trackingRenderer=renderer;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x030a13);
 const camera=new THREE.PerspectiveCamera(48,canvas.clientWidth/canvas.clientHeight,1e-12,10000);let distance=6500,rotX=.42,rotY=.32,targetPoint=new THREE.Vector3();
 scene.add(new THREE.AmbientLight(0xffffff,.85));const sunLight=new THREE.DirectionalLight(0xffe0a2,2.5);sunLight.position.set(1,.6,1);scene.add(sunLight);
 const sunBody=byId.get("sun")!;const sunMesh=new THREE.Mesh(new THREE.SphereGeometry(sunBody.radiusM*SCALE,64,32),new THREE.MeshBasicMaterial({color:0xffc56e}));scene.add(sunMesh);
 const system=new THREE.Group();scene.add(system);const rocketLayer=new THREE.Group();scene.add(rocketLayer);const planetMeshes=new Map<string,THREE.Mesh>(),markerObjects=new Map<string,THREE.Sprite>();
 const planetTextures:Record<string,string>={Earth:"https://spaceengine.solarsystemscope.com/textures/download/2k_earth_daymap.jpg",Luna:"https://spaceengine.solarsystemscope.com/textures/download/2k_moon.jpg",Mars:"https://spaceengine.solarsystemscope.com/textures/download/2k_mars.jpg",Jupiter:"https://spaceengine.solarsystemscope.com/textures/download/2k_jupiter.jpg",Saturn:"https://spaceengine.solarsystemscope.com/textures/download/2k_saturn.jpg"};
 const positions=new Map<string,THREE.Vector3>();
 for(const body of ephemeris){const pos=new THREE.Vector3(body.position.x*SCALE,body.position.y*SCALE,body.position.z*SCALE);positions.set(body.id,pos);if(body.id==="sun")continue;
  const meta=bodies.find(b=>bodyIds[b[0]]===body.id)!;const mesh=new THREE.Mesh(new THREE.SphereGeometry(body.radiusM*SCALE,48,32),new THREE.MeshStandardMaterial({color:new THREE.Color(meta[4]),roughness:.92}));mesh.position.copy(pos);mesh.userData.bodyName=body.name;system.add(mesh);planetMeshes.set(body.id,mesh);
  const texture=planetTextures[body.name];if(texture)textureLoader.load(texture,map=>{map.colorSpace=THREE.SRGBColorSpace;(mesh.material as THREE.MeshStandardMaterial).map=map;(mesh.material as THREE.MeshStandardMaterial).color.set(0xffffff);(mesh.material as THREE.MeshStandardMaterial).needsUpdate=true;},undefined,()=>{});
  if(body.parentId){const parentId=body.parentId,parent=byId.get(parentId)!,points=Array.from({length:240},(_,i)=>{const sample=ephemerisAt(body.periodSeconds*i/240),moving=sample.find(item=>item.id===body.id)!,parentAt=sample.find(item=>item.id===parentId)!,relative=new THREE.Vector3(moving.position.x-parentAt.position.x,moving.position.y-parentAt.position.y,moving.position.z-parentAt.position.z);return relative.multiplyScalar(SCALE).add(new THREE.Vector3(parent.position.x*SCALE,parent.position.y*SCALE,parent.position.z*SCALE));});system.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x29445b,transparent:true,opacity:.35})));}
 }
 const saturn=planetMeshes.get("saturn");if(saturn){const radius=SOLAR_SYSTEM.find(b=>b.id==="saturn")!.radiusM*SCALE;const rings=new THREE.Mesh(new THREE.RingGeometry(radius*1.2,radius*2.1,72),new THREE.MeshStandardMaterial({color:0xc8b58b,side:THREE.DoubleSide,transparent:true,opacity:.72,roughness:1}));rings.rotation.x=-Math.PI/2;rings.position.copy(saturn.position);system.add(rings);}
 const markerTexture=(triangle:boolean,color:string)=>{const c=document.createElement("canvas");c.width=64;c.height=64;const ctx=c.getContext("2d")!;ctx.fillStyle=color;ctx.strokeStyle="#e7f7ff";ctx.lineWidth=4;ctx.beginPath();if(triangle){ctx.moveTo(32,5);ctx.lineTo(59,57);ctx.lineTo(5,57);}else ctx.arc(32,32,22,0,Math.PI*2);ctx.closePath();ctx.fill();ctx.stroke();return new THREE.CanvasTexture(c);};
 const markerSize=()=>Math.max(1e-12,distance*.0055),rockets=new Map<string,{sprite:THREE.Sprite;mission:SavedFlight}>(),vehicleMeshes=new Map<string,THREE.Group>(),vehicleBounds=new Map<string,number>(),bodyMarkers=new Map<string,THREE.Sprite>();
 for(const [id,mesh] of planetMeshes){const bodyName=mesh.userData.bodyName as string,meta=bodies.find(item=>item[0]===bodyName);if(!meta)continue;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:markerTexture(false,meta[4]),transparent:true,depthTest:false,depthWrite:false}));sprite.position.copy(mesh.position);sprite.scale.setScalar(markerSize());sprite.userData.bodyName=bodyName;system.add(sprite);bodyMarkers.set(id,sprite);markerObjects.set("body:"+bodyName,sprite);}
 const earthPosition=positions.get("earth")!;
 const rocketPosition=(state:FlightState)=>{const p=(state as FlightState&{position?:{x:number;y:number;z:number}}).position;if(p)return earthPosition.clone().add(new THREE.Vector3(p.x,p.y,p.z).multiplyScalar(SCALE));const radial=new THREE.Vector3(earthPosition.x,0,earthPosition.z).normalize(),tangent=new THREE.Vector3(-radial.z,0,radial.x);return earthPosition.clone().add(radial.multiplyScalar((6_371_000+Math.max(0,state.altitude))*SCALE)).add(tangent.multiplyScalar(state.x*SCALE));};
 const savedCrafts=(w?.state.craft??[]) as Craft[];
 for(const mission of missions){const current=mission.craftName===activeName,sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:markerTexture(true,"#"+(current?"65e2ff":"e5ad63")),transparent:true,depthTest:false,depthWrite:false}));sprite.position.copy(rocketPosition(mission.state));sprite.scale.setScalar(markerSize());sprite.userData.rocketName=mission.craftName;system.add(sprite);rockets.set(mission.craftName,{sprite,mission});markerObjects.set("rocket:"+mission.craftName,sprite);const savedCraft=savedCrafts.find(item=>item.name===mission.craftName),parts=savedCraft?.parts??(current?craft.parts:undefined);if(parts?.length){const vehicle=makeRocket(parts);vehicle.scale.setScalar(SCALE);vehicle.position.set(0,0,0);vehicle.visible=false;const q=mission.state.orientation;if(q)vehicle.quaternion.set(q.x,q.y,q.z,q.w);vehicle.traverse(object=>{object.frustumCulled=false;object.renderOrder=2;});rocketLayer.add(vehicle);vehicle.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(vehicle).getBoundingSphere(new THREE.Sphere());vehicleMeshes.set(mission.craftName,vehicle);vehicleBounds.set(mission.craftName,bounds.radius);}}
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let dragging=false,lastX=0,lastY=0;
 const updateCamera=()=>{camera.position.set(targetPoint.x+Math.sin(rotY)*Math.cos(rotX)*distance,targetPoint.y+Math.sin(rotX)*distance,targetPoint.z+Math.cos(rotY)*Math.cos(rotX)*distance);camera.lookAt(targetPoint);};updateCamera();
 const formatKm=(metres:number)=>Math.round(metres/1000).toLocaleString()+" km";
 const showTransfer=(bodyName:string)=>{const id=bodyIds[bodyName],dest=id?byId.get(id):undefined,sun=byId.get("sun")!;if(!dest)return "No transfer model is available for this body.";if(id==="earth")return '<span class="panel-kicker">MISSION TARGET</span><p>Earth is the current launch body. Select another celestial body to calculate a transfer window.</p>';
  const parent=dest.parentId?byId.get(dest.parentId):undefined,isMoon=!!parent&&dest.parentId!=="sun";const originRadius=isMoon?parent.radiusM+400_000:AU,targetRadius=dest.orbitRadiusM,mu=G*(isMoon?parent.massKg:sun.massKg),targetMotion=2*Math.PI/dest.periodSeconds;
  const transfer=hohmannTransferWindow(originRadius,targetRadius,mu,targetMotion),origin=byId.get(isMoon?parent.id:"earth")!,center=isMoon?parent.position:sun.position,originAngle=isMoon?0:Math.atan2(origin.position.z-center.z,origin.position.x-center.x),targetAngle=Math.atan2(dest.position.z-center.z,dest.position.x-center.x),originMotion=Math.sqrt(mu/(originRadius**3)),nextWindow=secondsUntilPhase(targetAngle-originAngle,transfer.departurePhaseRadians,targetMotion-originMotion);
  return `<span class="panel-kicker">HOHMANN TRANSFER WINDOW</span><div class="orbit-facts"><span>NEXT WINDOW IN<b>${formatDuration(nextWindow)}</b></span><span>TRANSFER TIME<b>${formatDuration(transfer.transferSeconds)}</b></span><span>DEPARTURE PHASE<b>${(transfer.departurePhaseRadians*180/Math.PI).toFixed(1)}°</b></span><span>DEPARTURE ΔV<b>${transfer.deltaVDepartureMps.toFixed(0)} m/s</b></span><span>ARRIVAL ΔV<b>${transfer.deltaVArrivalMps.toFixed(0)} m/s</b></span><span>WINDOW RECURRENCE<b>${formatDuration(transfer.departureWindowSeconds)}</b></span></div><small>Ideal coplanar, circular-orbit estimate. Launch vehicle limits, inclination, and planetary perturbations are not included.</small>`;
 };
 const selectBody=(name:string)=>{target=name;for(const vehicle of vehicleMeshes.values())vehicle.visible=false;system.position.set(0,0,0);sunMesh.position.set(0,0,0);camera.up.set(0,1,0);const body=bodies.find(item=>item[0]===name)!;const id=bodyIds[name],mesh=id?planetMeshes.get(id):undefined;if(mesh){const radius=SOLAR_SYSTEM.find(b=>b.id===id)!.radiusM*SCALE;if(id==="earth"){const launchRadial=new THREE.Vector3(1,0,0);targetPoint.copy(mesh.position).addScaledVector(launchRadial,radius);rotX=0;rotY=Math.PI/2;distance=earthSurfaceCameraDistance();}else{targetPoint.copy(mesh.position);distance=Math.max(radius*18,.00008);}updateCamera();}
  root.querySelectorAll<HTMLButtonElement>("[data-body]").forEach(button=>button.classList.toggle("selected",button.dataset.body===name));const physical=SOLAR_SYSTEM.find(b=>b.id===id)!;
  $("#body-detail",root).innerHTML=`<div><span class="panel-kicker">${body[1]} / CELESTIAL BODY</span><h3>${body[0]}</h3><p>${body[6]}</p></div><div class="body-facts"><span>MEAN RADIUS<b>${formatKm(physical.radiusM)}</b></span><span>MASS<b>${physical.massKg.toExponential(3)} kg</b></span><span>ORBIT RADIUS<b>${formatKm(physical.orbitRadiusM)}</b></span></div><button class="secondary-button compact" id="set-target">SET AS MISSION TARGET</button>`;
  $("#set-target",root).onclick=()=>{const active=world();if(active){active.state.currentBody=body[0];active.updatedAt=new Date().toISOString();void host.setWorld(active);host.toast(body[0]+" selected as navigation target.");}};
  $("#orbit-prediction",root).innerHTML=showTransfer(name);
 };
 const selectRocket=(name:string)=>{const entry=rockets.get(name);if(!entry)return;for(const vehicle of vehicleMeshes.values())vehicle.visible=false;const selectedVehicle=vehicleMeshes.get(name);if(selectedVehicle)selectedVehicle.visible=true;system.position.copy(entry.sprite.position).negate();sunMesh.position.copy(system.position);targetPoint.set(0,0,0);const q=entry.mission.state.orientation;if(q){const orientation=new THREE.Quaternion(q.x,q.y,q.z,q.w),forward=new THREE.Vector3(0,1,0).applyQuaternion(orientation).normalize(),cameraOffset=new THREE.Vector3(0,0,1).applyQuaternion(orientation).normalize();camera.up.copy(forward);rotX=Math.asin(Math.max(-1,Math.min(1,cameraOffset.y)));rotY=Math.atan2(cameraOffset.x,cameraOffset.z);}else{camera.up.set(0,1,0);rotX=.08;rotY=.35;}distance=rocketTrackingCameraDistance(vehicleBounds.get(name)??0);updateCamera();root.querySelectorAll<HTMLButtonElement>("[data-rocket]").forEach(button=>button.classList.toggle("selected",button.dataset.rocket===name));
  const state=entry.mission.state,active=name===activeName;$("#body-detail",root).innerHTML=`<div><span class="panel-kicker">FLIGHT VEHICLE / ${active?"CURRENTLY CONTROLLED":"OTHER VEHICLE"}</span><h3>${esc(name)}</h3><p>${state.landed?"Landed":state.crashed?"Vehicle lost":"Vehicle in flight"} · Mission time ${formatDuration(state.elapsed)}</p></div><div class="body-facts"><span>ALTITUDE<b>${(state.altitude/1000).toFixed(2)} km</b></span><span>SPEED<b>${Math.hypot(state.vx,state.vy).toFixed(1)} m/s</b></span></div>${active?"":'<button class="primary-button compact" id="switch-rocket">SWITCH TO THIS ROCKET</button>'}`;
  if(!active)$("#switch-rocket",root).onclick=()=>{const activeWorld=world();if(!activeWorld)return;(activeWorld.state as {activeCraftName?:string}).activeCraftName=name;void host.setWorld(activeWorld).then(()=>{host.toast("Control switched to "+name+".");nav("flight");}).catch(error=>host.toast(error instanceof Error?error.message:"Could not switch vehicles.","error"));};
  const controlled=rockets.get(activeName);if(controlled){const r1=6_371_000+Math.max(0,controlled.mission.state.altitude),r2=6_371_000+Math.max(0,state.altitude),mu=G*byId.get("earth")!.massKg,targetMotion=Math.sqrt(mu/(r2*r2*r2)),originMotion=Math.sqrt(mu/(r1*r1*r1)),transfer=hohmannTransferWindow(r1,r2,mu,targetMotion),phase=state.x/r2-controlled.mission.state.x/r1,nextWindow=secondsUntilPhase(phase,transfer.departurePhaseRadians,targetMotion-originMotion);$("#orbit-prediction",root).innerHTML=`<span class="panel-kicker">RENDEZVOUS / TRANSFER ESTIMATE</span><div class="orbit-facts"><span>RANGE<b>${(controlled.sprite.position.distanceTo(entry.sprite.position)/SCALE/1000).toFixed(1)} km</b></span><span>NEXT WINDOW IN<b>${formatDuration(nextWindow)}</b></span><span>TRANSFER TIME<b>${formatDuration(transfer.transferSeconds)}</b></span><span>DEPARTURE ΔV<b>${transfer.deltaVDepartureMps.toFixed(1)} m/s</b></span><span>ARRIVAL ΔV<b>${transfer.deltaVArrivalMps.toFixed(1)} m/s</b></span></div><small>Coplanar Hohmann estimate between current Earth-centred orbital radii; this is not a collision-avoidance solution.</small>`;}
 };
 root.querySelectorAll<HTMLButtonElement>("[data-body]").forEach(button=>button.onclick=()=>selectBody(button.dataset.body!));root.querySelectorAll<HTMLButtonElement>("[data-rocket]").forEach(button=>button.onclick=()=>selectRocket(button.dataset.rocket!));
 const resize=()=>{const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};trackingResizeObserver=new ResizeObserver(resize);trackingResizeObserver.observe(canvas);
 canvas.addEventListener("pointerdown",event=>{dragging=true;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);});
 canvas.addEventListener("pointermove",event=>{if(!dragging)return;rotY-=(event.clientX-lastX)*.006;rotX=Math.max(-1.4,Math.min(1.4,rotX+(event.clientY-lastY)*.006));lastX=event.clientX;lastY=event.clientY;updateCamera();});
 canvas.addEventListener("pointerup",event=>{if(!dragging)return;dragging=false;const rect=canvas.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...planetMeshes.values(),...markerObjects.values()]);const hit=hits[0]?.object;if(hit){const bodyName=hit.userData.bodyName as string|undefined,rocketName=hit.userData.rocketName as string|undefined;if(bodyName)selectBody(bodyName);else if(rocketName)selectRocket(rocketName);}});
 canvas.addEventListener("pointercancel",()=>{dragging=false;});canvas.addEventListener("wheel",event=>{distance=Math.max(1e-10,Math.min(10000,distance*Math.exp(event.deltaY*.001)));updateCamera();},{passive:true});
 const initialRocketName=rockets.has(activeName)?activeName:missions[0]?.craftName;if(initialRocketName)selectRocket(initialRocketName);else selectBody(target);
 let alive=true;const animate=()=>{if(!alive)return;for(const {sprite} of rockets.values())sprite.scale.setScalar(rocketTrackingMarkerSize(distance));for(const sprite of bodyMarkers.values())sprite.scale.setScalar(markerSize());renderer.render(scene,camera);trackingFrame=requestAnimationFrame(animate);};trackingFrame=requestAnimationFrame(animate);
 root.addEventListener("DOMNodeRemoved",()=>{alive=false;trackingResizeObserver?.disconnect();disposeTrackingScene();},{once:true});
}
export function mountGame(h:Host){host=h;load();}
