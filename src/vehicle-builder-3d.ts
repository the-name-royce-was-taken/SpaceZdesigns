import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
export type PartKind="capsule"|"tank"|"engine"|"separator"|"fin"|"solar";
export interface BuildPart {kind:PartKind}
const parts:{kind:PartKind;name:string;mass:number;fuel:number;thrust:number;color:number}[]=[
 {kind:"capsule",name:"Command pod",mass:1.2,fuel:0,thrust:0,color:0xdce8ef},
 {kind:"tank",name:"Fuel tank",mass:.8,fuel:120,thrust:0,color:0xb7c8d5},
 {kind:"engine",name:"LV-1 engine",mass:.7,fuel:0,thrust:34,color:0xe6a65e},
 {kind:"separator",name:"Decoupler",mass:.15,fuel:0,thrust:0,color:0xe5c56d},
 {kind:"fin",name:"Stability fin",mass:.12,fuel:0,thrust:0,color:0x6c9db8},
 {kind:"solar",name:"Solar panel",mass:.08,fuel:0,thrust:0,color:0x4b91bb}
];
export const partCatalog=parts;
export function mountVehicleBuilder(host:HTMLElement,initial:BuildPart[],changed:(parts:BuildPart[])=>void){
 host.innerHTML=`<div class="builder-toolbar"><span>3D ASSEMBLY / SNAP GRID 0.5 M</span><span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div><div class="builder-viewport"><canvas id="vehicle-3d-canvas"></canvas><div class="builder-hud">ORTHOGRAPHIC / METRIC</div></div><div class="builder-palette">${parts.map(p=>`<button class="part-card" data-add="${p.kind}"><i class="part-swatch" style="--part-color:#${p.color.toString(16).padStart(6,"0")}"></i><span><b>${p.name}</b><small>${p.mass.toFixed(2)} t · ${p.fuel} fuel</small></span><strong>＋</strong></button>`).join("")}</div><div class="builder-stack" id="builder-stack"></div>`;
 const canvas=host.querySelector<HTMLCanvasElement>("#vehicle-3d-canvas")!;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"low-power"});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x081625);
 const camera=new THREE.PerspectiveCamera(38,canvas.clientWidth/canvas.clientHeight,.1,300);camera.position.set(7,6,9);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,2,0);controls.enableDamping=true;controls.dampingFactor=.07;
 scene.add(new THREE.HemisphereLight(0xc5e6ff,0x263448,2));
 const key=new THREE.DirectionalLight(0xffedcf,3);key.position.set(5,9,6);key.castShadow=true;scene.add(key);
 const grid=new THREE.GridHelper(20,40,0x3a718a,0x1b354b);grid.position.y=-.03;scene.add(grid);
 const craftGroup=new THREE.Group();scene.add(craftGroup);let craft=[...initial];
 function meshFor(p:BuildPart,i:number){
  const mat=new THREE.MeshStandardMaterial({color:parts.find(v=>v.kind===p.kind)!.color,roughness:.68,metalness:.18,flatShading:true});
  const group=new THREE.Group();const y=(craft.length-1-i)*1.15;
  if(p.kind==="capsule"){const body=new THREE.Mesh(new THREE.CylinderGeometry(.48,.56,.8,8),mat);body.position.y=y+.45;group.add(body);const nose=new THREE.Mesh(new THREE.ConeGeometry(.48,.65,8),mat);nose.position.y=y+1.17;group.add(nose);const window=new THREE.Mesh(new THREE.CircleGeometry(.16,8),new THREE.MeshStandardMaterial({color:0x49b8d0,metalness:.5}));window.position.set(0,y+.48,.49);group.add(window);}
  else if(p.kind==="engine"){const bell=new THREE.Mesh(new THREE.CylinderGeometry(.22,.48,.65,8,1,true),mat);bell.position.y=y+.25;group.add(bell);const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.19,.22,.28,8),new THREE.MeshStandardMaterial({color:0x586a78,metalness:.7}));nozzle.position.y=y-.2;group.add(nozzle);}
  else {const body=new THREE.Mesh(new THREE.CylinderGeometry(p.kind==="tank"?.47:.52,p.kind==="tank"?.47:.52,p.kind==="tank"?1.1:.3,8),mat);body.position.y=y+.55;group.add(body);
   if(p.kind==="fin"){for(const side of [-1,1]){const fin=new THREE.Mesh(new THREE.BoxGeometry(.08,.7,.5),mat);fin.position.set(side*.48,y+.28,0);fin.rotation.z=side*-.25;group.add(fin);}}
   if(p.kind==="solar"){for(const side of [-1,1]){const panel=new THREE.Mesh(new THREE.BoxGeometry(.85,.035,.48),new THREE.MeshStandardMaterial({color:0x2678a5,metalness:.55,roughness:.35}));panel.position.set(side*.88,y+.55,0);group.add(panel);}}
  }
  group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});return group;
 }
 function redraw(){craftGroup.clear();craft.forEach((p,i)=>craftGroup.add(meshFor(p,i)));const stack=host.querySelector<HTMLElement>("#builder-stack")!;stack.innerHTML=craft.map((p,i)=>`<div class="stack-row"><span>${String(i+1).padStart(2,"0")}</span><b>${parts.find(v=>v.kind===p.kind)!.name}</b><small>${i===0?"TOP":i===craft.length-1?"BOTTOM":"STACK"}</small><button data-remove="${i}">×</button></div>`).join("");stack.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b=>b.onclick=()=>{craft.splice(Number(b.dataset.remove),1);redraw();changed([...craft]);});changed([...craft]);}
 host.querySelectorAll<HTMLButtonElement>("[data-add]").forEach(b=>b.onclick=()=>{if(craft.length>=24)return;craft.push({kind:b.dataset.add as PartKind});redraw();});
 const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 let alive=true;const render=()=>{if(!alive)return;controls.update();renderer.render(scene,camera);requestAnimationFrame(render);};redraw();render();
 return {dispose(){alive=false;observer.disconnect();controls.dispose();renderer.dispose();}};
}
