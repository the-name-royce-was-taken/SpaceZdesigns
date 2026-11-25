import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export type PartKind = "capsule" | "tank" | "engine" | "separator" | "fin" | "solar" | "wing" | "control" | "wheel" | "dock" | "battery" | "rcs" | "strut";
export interface BuildPart {
  kind: PartKind;
  id?: string;
  x?: number; y?: number; z?: number;
  rx?: number; ry?: number; rz?: number;
  parentId?: string;
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
const snap=(v:number,step:number)=>Math.round(v/step)*step;
export function mountVehicleBuilder(host:HTMLElement,initial:BuildPart[],changed:(parts:BuildPart[])=>void){
 host.innerHTML=`<div class="builder-toolbar"><span>VEHICLE ASSEMBLY BUILDING / 3D EDITOR</span><span>SELECT · ATTACH · MOVE · ROTATE</span></div>
 <div class="vab-tools"><div class="vab-tool-group"><button data-tool="select" class="active">SELECT</button><button data-tool="translate">MOVE</button><button data-tool="rotate">ROTATE</button><button data-tool="delete">DELETE</button></div><div class="vab-tool-group"><label>SNAP <select id="vab-snap"><option value="0.25">0.25 m</option><option value="0.5" selected>0.5 m</option><option value="1">1 m</option><option value="0">OFF</option></select></label><label>SYMMETRY <select id="vab-symmetry"><option value="1">OFF</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label></div><div class="vab-tool-group"><button id="vab-undo">UNDO</button><button id="vab-redo">REDO</button><button id="vab-reset">RESET VIEW</button></div></div>
 <div class="builder-viewport vab-viewport"><canvas id="vehicle-3d-canvas"></canvas><div class="builder-hud" id="vab-status">SELECT A PART OR ADD FROM THE CATALOG</div><div class="vab-axis">X / Y / Z</div></div>
 <div class="vab-lower"><section><div class="vab-section-title">PART CATALOG <small>DRAG A DESIGN INTO 3D / CLICK TO ADD</small></div><div class="builder-palette">${parts.map(p=>`<button class="part-card" data-add="${p.kind}"><i class="part-swatch" style="--part-color:#${p.color.toString(16).padStart(6,"0")}"></i><span><b>${p.name}</b><small>${p.category} · ${p.mass.toFixed(2)} t</small></span><strong>＋</strong></button>`).join("")}</div></section><section><div class="vab-section-title">CRAFT HIERARCHY <small id="vab-part-count">0 PARTS</small></div><div class="builder-stack" id="builder-stack"></div><div class="vab-inspector" id="vab-inspector"><b>NO PART SELECTED</b><small>Select a component to inspect its placement.</small></div></section></div>`;
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
 let craft=clone(initial),selected:THREE.Group|null=null,selectedId:string|null=null,tool="select",snapStep=.5,alive=true;
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const history:BuildPart[][]=[clone(craft)];let historyIndex=0,dragged=false;
 const status=host.querySelector<HTMLElement>("#vab-status")!;
 const uid=()=>`part-${Math.random().toString(36).slice(2,10)}`;
 const spec=(kind:PartKind)=>parts.find(p=>p.kind===kind)!;
 function makeMesh(p:BuildPart){
  const s=spec(p.kind),mat=new THREE.MeshStandardMaterial({color:s.color,roughness:.68,metalness:.16,flatShading:true});
  const g=new THREE.Group();g.userData.partId=p.id;
  const add=(geo:THREE.BufferGeometry,m=mat,pos:THREE.Vector3=new THREE.Vector3())=>{const mesh=new THREE.Mesh(geo,m);mesh.position.copy(pos);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
  if(p.kind==="capsule"){add(new THREE.CylinderGeometry(.43,.5,.62,8),mat,new THREE.Vector3(0,-.08,0));add(new THREE.ConeGeometry(.43,.52,8),mat,new THREE.Vector3(0,.49,0));add(new THREE.SphereGeometry(.13,8,6),new THREE.MeshStandardMaterial({color:0x49b8d0,metalness:.45}),new THREE.Vector3(0,.05,.43));}
  else if(p.kind==="tank"){add(new THREE.CylinderGeometry(.44,.44,1.05,10));add(new THREE.TorusGeometry(.44,.035,5,10),new THREE.MeshStandardMaterial({color:0x64798b,metalness:.45}),new THREE.Vector3(0,.48,0));}
  else if(p.kind==="engine"){add(new THREE.CylinderGeometry(.2,.45,.65,9,1,true));add(new THREE.CylinderGeometry(.16,.2,.22,9),new THREE.MeshStandardMaterial({color:0x566b7b,metalness:.7}),new THREE.Vector3(0,-.4,0));}
  else if(p.kind==="separator"){add(new THREE.CylinderGeometry(.5,.5,.18,10));add(new THREE.TorusGeometry(.5,.035,5,12),new THREE.MeshStandardMaterial({color:0xffd77c}),new THREE.Vector3(0,.08,0));}
  else if(p.kind==="fin"||p.kind==="wing"||p.kind==="control"){const geo=new THREE.BoxGeometry(s.size.x,s.size.y,s.size.z);add(geo);if(p.kind==="fin"){const fin=add(new THREE.BoxGeometry(.12,.72,.55));fin.position.set(.42,-.18,0);fin.rotation.z=-.22;}if(p.kind==="wing"){const tip=add(new THREE.BoxGeometry(.22,.12,.22));tip.position.x=.84;}}
  else if(p.kind==="solar"){add(new THREE.BoxGeometry(.14,.08,.18));for(const side of [-1,1]){const panel=add(new THREE.BoxGeometry(.82,.035,.65),new THREE.MeshStandardMaterial({color:0x2678a5,metalness:.55,roughness:.35}));panel.position.set(side*.48,0,0);}}
  else if(p.kind==="wheel"){const leg=add(new THREE.CylinderGeometry(.055,.07,.72,6));leg.position.y=.12;leg.rotation.z=-.22;const wheel=add(new THREE.CylinderGeometry(.2,.2,.12,10),new THREE.MeshStandardMaterial({color:0x273542,roughness:.9}));wheel.position.set(.18,-.28,0);wheel.rotation.z=Math.PI/2;}
  else if(p.kind==="dock"){add(new THREE.CylinderGeometry(.22,.28,.22,10));add(new THREE.TorusGeometry(.22,.045,6,12),new THREE.MeshStandardMaterial({color:0x5b768b,metalness:.65}),new THREE.Vector3(0,.13,0));}
  else if(p.kind==="battery"){add(new THREE.BoxGeometry(.58,.32,.58));}
  else if(p.kind==="rcs"){add(new THREE.BoxGeometry(.3,.22,.3));for(let i=0;i<4;i++){const nozzle=add(new THREE.CylinderGeometry(.045,.09,.18,6),new THREE.MeshStandardMaterial({color:0x647b8b,metalness:.6}));nozzle.rotation.z=Math.PI/2;nozzle.position.set(i%2?-.19:.19,0,i<2?-.12:.12);}}
  else if(p.kind==="strut"){add(new THREE.BoxGeometry(.1,1,.1));}
  g.position.set(p.x??0,p.y??(craft.length*.6),p.z??0);g.rotation.set(p.rx??0,p.ry??0,p.rz??0);
  return g;
 }
 function syncPartFromGroup(g:THREE.Group){const p=craft.find(v=>v.id===g.userData.partId);if(!p)return;p.x=snapStep? snap(g.position.x,snapStep):g.position.x;p.y=snapStep?snap(g.position.y,snapStep):g.position.y;p.z=snapStep?snap(g.position.z,snapStep):g.position.z;p.rx=g.rotation.x;p.ry=g.rotation.y;p.rz=g.rotation.z;g.position.set(p.x,p.y,p.z);}
 function record(){history.splice(historyIndex+1);history.push(clone(craft));if(history.length>60)history.shift();historyIndex=history.length-1;changed(clone(craft));}
 function inspect(){const box=host.querySelector<HTMLElement>("#vab-inspector")!;const p=craft.find(v=>v.id===selectedId);if(!p){box.innerHTML="<b>NO PART SELECTED</b><small>Select a component to inspect its placement.</small>";return;}const s=spec(p.kind);box.innerHTML=`<b>${s.name.toUpperCase()}</b><small>${s.category} / ${s.mass.toFixed(2)} t / X ${(p.x??0).toFixed(2)} · Y ${(p.y??0).toFixed(2)} · Z ${(p.z??0).toFixed(2)}</small>`;}
 function select(g:THREE.Group|null){selected=g;selectedId=g?.userData.partId??null;if(g&&tool!=="select")transform.attach(g);else transform.detach();host.querySelectorAll<HTMLElement>(".stack-row").forEach(r=>r.classList.toggle("selected",r.dataset.id===selectedId));inspect();status.textContent=g?"PART SELECTED / USE MOVE OR ROTATE":"SELECT A PART OR CLICK THE CATALOG";}
 function redraw(){craftGroup.clear();craft.forEach(p=>{if(!p.id)p.id=uid();craftGroup.add(makeMesh(p));});host.querySelector<HTMLElement>("#builder-stack")!.innerHTML=craft.map((p,i)=>`<div class="stack-row vab-stack-row ${p.id===selectedId?"selected":""}" data-id="${p.id}"><span>${String(i+1).padStart(2,"0")}</span><b>${spec(p.kind).name}</b><small>${(p.x??0).toFixed(1)}, ${(p.y??0).toFixed(1)}, ${(p.z??0).toFixed(1)}</small><button data-remove="${p.id}" aria-label="Remove part">×</button></div>`).join("");host.querySelector("#vab-part-count")!.textContent=`${craft.length} PARTS`;host.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b=>b.onclick=e=>{e.stopPropagation();removePart(b.dataset.remove!);});host.querySelectorAll<HTMLElement>(".vab-stack-row").forEach(r=>r.onclick=()=>select(craftGroup.children.find(g=>g.userData.partId===r.dataset.id) as THREE.Group??null));select(craftGroup.children.find(g=>g.userData.partId===selectedId) as THREE.Group??null);changed(clone(craft));}
 function removePart(id:string){craft=craft.filter(p=>p.id!==id);if(selectedId===id){selectedId=null;selected=null;transform.detach();}redraw();record();}
 function addPart(kind:PartKind){if(craft.length>=120){status.textContent="PART LIMIT / 120";return;}const center=selected?.position.clone()??new THREE.Vector3(0,Math.max(0,craft.length*.55),0);const n=Number(host.querySelector<HTMLSelectElement>("#vab-symmetry")!.value);const p:BuildPart={kind,id:uid(),x:center.x+(selected?1.1:0),y:center.y,z:center.z};const additions:BuildPart[]=[];for(let i=0;i<n;i++){const a=i*Math.PI*2/n;additions.push({...p,id:uid(),x:snap(p.x!+Math.sin(a)*(.85),snapStep||.01),z:snap(p.z!+Math.cos(a)*(.85),snapStep||.01),ry:a});}craft.push(...additions);selectedId=additions[0].id;redraw();record();status.textContent=`${spec(kind).name.toUpperCase()} ADDED / ${n}× SYMMETRY`;}
 function setTool(next:string){tool=next;host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===next));if(next==="translate"||next==="rotate"){transform.setMode(next);if(selected)transform.attach(selected);orbit.enabled=false;}else{transform.detach();orbit.enabled=true;}if(next==="delete"&&selectedId)removePart(selectedId);status.textContent=next.toUpperCase()+" TOOL";}
 host.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool!));
 host.querySelectorAll<HTMLButtonElement>("[data-add]").forEach(b=>b.onclick=()=>addPart(b.dataset.add as PartKind));
 host.querySelector<HTMLSelectElement>("#vab-snap")!.onchange=e=>{snapStep=Number((e.currentTarget as HTMLSelectElement).value);};
 transform.addEventListener("dragging-changed",e=>{orbit.enabled=!(e.value as boolean);dragged=Boolean(e.value);if(!dragged&&selected){syncPartFromGroup(selected);record();redraw();}});
 transform.addEventListener("objectChange",()=>{if(selected){const p=craft.find(v=>v.id===selectedId);if(p){p.x=selected.position.x;p.y=selected.position.y;p.z=selected.position.z;p.rx=selected.rotation.x;p.ry=selected.rotation.y;p.rz=selected.rotation.z;inspect();}}});
 canvas.addEventListener("pointerdown",e=>{if(tool==="translate"||tool==="rotate"||dragged)return;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(craftGroup.children,true);if(hits.length){let o=hits[0].object;while(o.parent&&o.parent!==craftGroup)o=o.parent;if(o instanceof THREE.Group){select(o);return;}}if(tool==="select"){select(null);return;}});
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
