import * as THREE from "three";
import type { WorldRecord } from "./worlds";
import { mountVehicleBuilder, partCatalog, type BuildPart } from "./vehicle-builder-3d";
import { FlightSimulator, type FlightState, type VehiclePhysics } from "./flight-physics";
const bodies=[["Earth","HOME WORLD",6371,9.81,"#4e9bd0",0,"Blue oceans, familiar atmosphere, and the launch site."],["Luna","MOON",1737,1.62,"#b8b9c2",384400,"A nearby airless world with low gravity and ancient craters."],["Mars","TERRESTRIAL",3389,3.71,"#c87855",225000000,"A cold desert world with a thin atmosphere."],["Phobos","MARTIAN MOON",11,.0057,"#9a806d",9376,"A small, irregular moon orbiting close to Mars."],["Jupiter","GAS GIANT",69911,24.79,"#d5ae83",778000000,"A giant world with immense storms."],["Europa","ICY MOON",1561,1.31,"#d9d4c2",628000000,"An ice-covered moon and a compelling science destination."],["Saturn","GAS GIANT",58232,10.44,"#d8bd86",1427000000,"A ringed giant surrounded by an extraordinary moon system."],["Titan","ICY MOON",2575,1.35,"#c58d53",1430000000,"A hazy moon with lakes of liquid hydrocarbons."]] as const;
type Craft={name:string;parts:BuildPart[]};
type SavedFlight={kind:"spacez-flight-save";craftName:string;state:FlightState;vehicle:VehiclePhysics;throttle:number;pitch:number;savedAt:string};
interface Host{getWorld:()=>WorldRecord|null;setWorld:(w:WorldRecord)=>void;toast:(m:string,k?:"success"|"error")=>void}
let host:Host,craft:Craft={name:"Pioneer I",parts:[{kind:"capsule"},{kind:"tank"},{kind:"engine"}]},target="Earth";
let builder:{dispose:()=>void}|null=null,sim:FlightSimulator|null=null,flightFrame=0,flightRenderer:THREE.WebGLRenderer|null=null,lastFrame=0;
const $=<T extends HTMLElement>(s:string,r:ParentNode=document)=>{const e=r.querySelector<T>(s);if(!e)throw Error("Missing game element "+s);return e};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const world=()=>host.getWorld();
const specs=()=>craft.parts.map(p=>partCatalog.find(s=>s.kind===p.kind)!).filter(Boolean);
function metrics(){const a=specs();return{mass:a.reduce((n,p)=>n+p.mass,0),fuel:a.reduce((n,p)=>n+p.fuel,0),thrust:a.reduce((n,p)=>n+p.thrust,0),cost:a.reduce((n,p)=>n+p.mass*950+ p.fuel*8+p.thrust*40,0)}}
function save(){const w=world();if(!w)return;const list=((w.state.craft??[]) as Craft[]).filter(c=>c.name!==craft.name);list.push(structuredClone(craft));w.state.craft=list;w.updatedAt=new Date().toISOString();host.setWorld(w)}
function persistFlight(throttle:number,pitch:number){const w=world();if(!w||!sim)return;const saves=(w.state.missions??[]).filter((entry)=>!(entry&&typeof entry==="object"&&(entry as {kind?:string}).kind==="spacez-flight-save"));saves.push({kind:"spacez-flight-save",craftName:craft.name,state:structuredClone(sim.state),vehicle:structuredClone(sim.vehicle),throttle,pitch,savedAt:new Date().toISOString()} satisfies SavedFlight);w.state.missions=saves;w.updatedAt=new Date().toISOString();host.setWorld(w)}
function clearFlightSave(){const w=world();if(!w)return;w.state.missions=(w.state.missions??[]).filter((entry)=>!(entry&&typeof entry==="object"&&(entry as {kind?:string}).kind==="spacez-flight-save"));w.updatedAt=new Date().toISOString();host.setWorld(w)}
function load(){const a=(world()?.state.craft??[]) as Craft[];craft=a.length?structuredClone(a[0]):{name:"Pioneer I",parts:[{kind:"capsule"},{kind:"tank"},{kind:"engine"}]};}
function nav(v:string){document.querySelector<HTMLElement>(`#world-screen [data-action="${v}"]`)?.click()}
export function renderGameScreen(name:string){if(name!=="hangar"){builder?.dispose();builder=null}if(name!=="flight")disposeFlightScene();if(name==="home"||name==="worlds"||name==="settings")return;if(!world()){host.toast("Create or load a world first.","error");return}if(name==="hangar"){load();hangar()}if(name==="flight"){load();launchpad()}if(name==="tracking")tracking()}
function hangar(){
 builder?.dispose();const root=$("#hangar-content"),m=metrics();
 root.innerHTML=`<div class="immersive-toolbar"><button class="text-button" data-action="leave-world">← WORLD SPACE CENTER</button><span class="panel-kicker">VEHICLE ASSEMBLY BUILDING / VAB-01</span><span class="live-tag">EDITOR READY</span></div>
 <section class="game-panel builder-panel vab-full-panel"><div class="game-panel-head"><div><span class="panel-kicker">CONSTRUCTION BAY / FULL-SCREEN EDITOR</span><h3>VEHICLE ASSEMBLY</h3></div><span class="live-tag">SNAP BUILD ACTIVE</span></div>
 <div class="vab-design-row"><label class="game-label">VEHICLE DESIGNATION<input id="craft-name" maxlength="32" value="${esc(craft.name)}"></label><div class="vehicle-readout vab-metrics"><div><small>WET MASS</small><b id="build-mass">${(m.mass+m.fuel*.001).toFixed(2)} t</b></div><div><small>PROPELLANT</small><b id="build-fuel">${m.fuel} u</b></div><div><small>MAX THRUST</small><b id="build-thrust">${m.thrust} kN</b></div><div><small>BUILD COST</small><b id="build-cost">${m.cost.toLocaleString()} cr</b></div></div></div>
 <div id="craft-3d-host"></div><div class="game-actions vab-save-row"><button class="primary-button compact" id="save-design">SAVE VEHICLE TO WORLD</button><span class="game-hint">Saved designs are available when you return to this world's space center.</span></div></section>`;
 builder=mountVehicleBuilder($("#craft-3d-host",root),craft.parts,parts=>{craft.parts=parts;const v=metrics();$("#build-mass",root).textContent=(v.mass+v.fuel*.001).toFixed(2)+" t";$("#build-fuel",root).textContent=v.fuel+" u";$("#build-thrust",root).textContent=v.thrust+" kN";$("#build-cost",root).textContent=v.cost.toLocaleString()+" cr";});
 $("#craft-name",root).onchange=e=>{craft.name=(e.currentTarget as HTMLInputElement).value.trim().slice(0,32)||"Untitled Vehicle"};
 $("#save-design",root).onclick=()=>{save();host.toast("Vehicle saved to this world.")};
}
function disposeFlightScene(){if(flightFrame)cancelAnimationFrame(flightFrame);flightFrame=0;flightRenderer?.dispose();flightRenderer=null;}
function makeRocket():THREE.Group{
 const g=new THREE.Group();
 const mat=(color:number,metalness=.25)=>new THREE.MeshStandardMaterial({color,roughness:.42,metalness,side:THREE.DoubleSide});
 const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh};
 craft.parts.forEach((p,i)=>{
  const y=p.y??(craft.parts.length-1-i)*1.05;
  if(p.kind==="capsule"){
   add(new THREE.CylinderGeometry(.43,.49,.62,32,3,false),mat(0xe1e9ef,.4),p.x??0,y-.08,p.z??0);
   add(new THREE.ConeGeometry(.43,.52,32,3,false),mat(0xc7d4de,.36),p.x??0,y+.49,p.z??0);
   add(new THREE.TorusGeometry(.445,.035,10,32),mat(0x455c6c,.7),p.x??0,y+.19,p.z??0);
   add(new THREE.SphereGeometry(.13,24,16),mat(0x45b6d5,.62),p.x??0,y+.02,(p.z??0)+.425);
  }else if(p.kind==="tank"){
   add(new THREE.CylinderGeometry(.44,.44,.96,40,4,false),mat(0xc5d0d8,.4),p.x??0,y,p.z??0);
   add(new THREE.SphereGeometry(.44,40,16,0,Math.PI*2,0,Math.PI/2),mat(0xc5d0d8,.4),p.x??0,y+.48,p.z??0);
   add(new THREE.SphereGeometry(.44,40,16,0,Math.PI*2,Math.PI/2,Math.PI/2),mat(0xc5d0d8,.4),p.x??0,y-.48,p.z??0);
   for(const band of [-.32,.32])add(new THREE.TorusGeometry(.445,.018,8,40),mat(0x536b7d,.72),p.x??0,y+band,p.z??0);
  }else if(p.kind==="engine"){
   add(new THREE.CylinderGeometry(.19,.43,.66,40,5,false),mat(0xd28a4f,.72),p.x??0,y-.02,p.z??0);
   add(new THREE.CylinderGeometry(.18,.2,.2,32,2,false),mat(0x8b9ba5,.8),p.x??0,y+.38,p.z??0);
   add(new THREE.TorusGeometry(.425,.035,10,40),mat(0x8b9ba5,.8),p.x??0,y-.35,p.z??0);
  }else if(p.kind==="separator"){
   add(new THREE.CylinderGeometry(.5,.5,.2,40,2,false),mat(0xd6b66d,.45),p.x??0,y,p.z??0);
   add(new THREE.TorusGeometry(.5,.032,10,40),mat(0xffd77c,.55),p.x??0,y+.09,p.z??0);
  }else if(p.kind==="fin"||p.kind==="wing"||p.kind==="control"){
   const size=p.kind==="wing"?[1.7,.12,1.1]:p.kind==="fin"?[.9,.7,.18]:[1,.1,.42];
   const surface=add(new THREE.BoxGeometry(size[0],size[1],size[2]),mat(p.kind==="control"?0xd1a66b:0x759bb7,.32),p.x??0,y,p.z??0);
   surface.rotation.y=p.ry??0;
  }else if(p.kind==="solar"){
   add(new THREE.BoxGeometry(.14,.08,.18),mat(0x8799a7,.6),p.x??0,y,p.z??0);
   for(const side of [-1,1])add(new THREE.BoxGeometry(.82,.035,.65),mat(0x2678a5,.62),(p.x??0)+side*.48,y,p.z??0);
  }else if(p.kind==="dock"){
   add(new THREE.CylinderGeometry(.22,.28,.22,32,2,false),mat(0xb9c7d0,.78),p.x??0,y,p.z??0);
   add(new THREE.TorusGeometry(.22,.04,10,32),mat(0x5b768b,.72),p.x??0,y+.13,p.z??0);
  }else if(p.kind==="wheel"){
   const leg=add(new THREE.CylinderGeometry(.055,.07,.72,16),mat(0x8999a5,.55),(p.x??0)+.12,y,(p.z??0));
   leg.rotation.z=-.22;
   const wheel=add(new THREE.CylinderGeometry(.2,.2,.12,24),mat(0x273542,.12),(p.x??0)+.3,y-.28,p.z??0);
   wheel.rotation.z=Math.PI/2;
  }else{
   add(new THREE.BoxGeometry(.5,.3,.5),mat(p.kind==="battery"?0x879b78:0x9caeba,.45),p.x??0,y,p.z??0);
  }
 });
 return g;
}
function launchpad(){
 disposeFlightScene();const root=$("#flight-content"),m=metrics();sim=null;
 root.innerHTML=`<div class="immersive-toolbar"><button class="text-button" data-action="leave-world">← WORLD SPACE CENTER</button><span class="panel-kicker">FLIGHT OPERATIONS / ACTIVE WORLD</span><span class="live-tag">MISSION VIEW</span></div><div class="game-grid flight-full-grid"><section class="game-panel"><div class="game-panel-head"><div><span class="panel-kicker">SPACEPORT / PAD 01</span><h3>3D LAUNCH COMPLEX</h3></div><span class="live-tag" id="flight-status">PAD READY</span></div><div class="flight-3d-viewport"><canvas id="flight-3d-canvas"></canvas><div class="pad-overlay"><span>MISSION ELAPSED<b id="mission-time">T+ 00:00</b></span><span>FLIGHT MODE<b id="flight-mode">STABILITY ASSIST</b></span></div></div><div class="launch-controls"><label>THROTTLE <b id="throttle-value">0%</b><input id="throttle" type="range" min="0" max="100" value="0"></label><label>PITCH <b id="pitch-value">0°</b><input id="pitch" type="range" min="-30" max="30" value="0"></label><label class="assist-toggle"><input id="stability-assist" type="checkbox" checked> STABILITY ASSIST</label><button class="primary-button compact" id="ignite">IGNITE / LAUNCH</button><button class="secondary-button compact" id="recover">RECOVER / RESET</button></div></section><section class="game-panel"><div class="game-panel-head"><div><span class="panel-kicker">FLIGHT DYNAMICS / 120 HZ SOLVER</span><h3>${esc(craft.name)}</h3></div></div><div class="telemetry-grid"><div><small>ALTITUDE</small><b id="altitude">0.00 km</b></div><div><small>VERTICAL SPEED</small><b id="velocity">0.0 m/s</b></div><div><small>HORIZONTAL SPEED</small><b id="horizontal-speed">0.0 m/s</b></div><div><small>PROPELLANT</small><b id="fuel"> ${m.fuel.toFixed(0)} u</b></div><div><small>DYNAMIC PRESSURE</small><b id="dynamic-pressure">0.0 kPa</b></div><div><small>MAX-Q</small><b id="max-q">0.0 kPa</b></div><div><small>ANGLE</small><b id="angle">0.0°</b></div><div><small>T/W RATIO</small><b>${m.mass>0?(m.thrust/((m.mass+m.fuel*.001)*9.81)).toFixed(2):"0.00"}</b></div></div><div class="mission-brief"><span class="panel-kicker">FLIGHT DIRECTOR NOTE</span><p id="flight-note">Atmospheric model active: inverse-square gravity, exponential air density, dynamic pressure, drag, lift, mass flow, and fixed-step integration.</p></div><div class="flight-shortcuts"><button class="secondary-button compact" id="open-map">OPEN TRACKING</button><button class="secondary-button compact" data-action="leave-world">RETURN TO WORLD</button></div></section></div>`;
 const canvas=$("#flight-3d-canvas",root) as HTMLCanvasElement,renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"low-power"});flightRenderer=renderer;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x8db8cf);scene.fog=new THREE.Fog(0x8db8cf,40,180);
 const camera=new THREE.PerspectiveCamera(42,canvas.clientWidth/canvas.clientHeight,.1,500);camera.position.set(10,9,18);
 scene.add(new THREE.HemisphereLight(0xd9efff,0x6a715d,2));const sun=new THREE.DirectionalLight(0xffefcf,2.8);sun.position.set(-8,18,10);scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(600,600,32,32),new THREE.MeshStandardMaterial({color:0x78956b,roughness:1,flatShading:true}));ground.rotation.x=-Math.PI/2;ground.position.y=-.3;scene.add(ground);
 const pad=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,.25,8),new THREE.MeshStandardMaterial({color:0x737f86,flatShading:true}));pad.position.y=-.05;scene.add(pad);
 for(let i=0;i<4;i++){const tower=new THREE.Mesh(new THREE.BoxGeometry(.18,5,.18),new THREE.MeshStandardMaterial({color:0xa6b5bd}));tower.position.set(Math.cos(i*Math.PI/2)*2.8,2.4,Math.sin(i*Math.PI/2)*2.8);scene.add(tower);}
 const group=makeRocket();scene.add(group);
 const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(canvas);
 const vehicle={dryMassTonnes:m.mass,fuelTonnes:m.fuel*.001,thrustKN:m.thrust,ispSeconds:285,referenceArea:.8,dragCoefficient:.48,liftSlope:2.1,inertia:1.6};
 const range=$("#throttle",root) as HTMLInputElement,pitch=$("#pitch",root) as HTMLInputElement,assist=$("#stability-assist",root) as HTMLInputElement;
 const updateLabels=()=>{$("#throttle-value",root).textContent=range.value+"%";$("#pitch-value",root).textContent=pitch.value+"°";};range.oninput=updateLabels;pitch.oninput=updateLabels;
 const savedFlight=(world()?.state.missions??[]).find((entry):entry is SavedFlight=>!!entry&&typeof entry==="object"&&(entry as {kind?:string}).kind==="spacez-flight-save"&&(entry as {craftName?:string}).craftName===craft.name);
 if(savedFlight){sim=new FlightSimulator(savedFlight.vehicle);Object.assign(sim.state,structuredClone(savedFlight.state));range.value=String(savedFlight.throttle*100);pitch.value=String(savedFlight.pitch);updateLabels();lastFrame=performance.now();$("#flight-status",root).textContent="FLIGHT RESTORED";$("#flight-note",root).textContent="Restored the most recently saved flight state from this world.";}
 let lastPersist=performance.now();
 $("#ignite",root).onclick=()=>{if(!craft.parts.some(p=>p.kind==="capsule")||!craft.parts.some(p=>p.kind==="engine")){host.toast("Add a command pod and engine before launch.","error");return}if(!sim){sim=new FlightSimulator(vehicle);sim.launch();lastFrame=performance.now();range.value=String(Math.max(70,Number(range.value)));updateLabels();persistFlight(Number(range.value)/100,Number(pitch.value));host.toast("Ignition. Fixed-step flight simulation started.");}};
 $("#recover",root).onclick=()=>{sim?.reset();sim=null;range.value="0";pitch.value="0";updateLabels();group.position.set(0,0,0);group.rotation.set(0,0,0);$("#flight-status",root).textContent="PAD READY";$("#flight-note",root).textContent="Vehicle recovered. Ready for another launch."};
 $("#open-map",root).onclick=()=>nav("tracking");
 let alive=true;const animate=(now:number)=>{if(!alive)return;const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;
  if(sim){const s=sim.state,stability=assist.checked;const desiredPitch=Number(pitch.value)*Math.PI/180;const command=stability?Math.max(-.25,Math.min(.25,-s.angle*.9-s.angularVelocity*.6+desiredPitch)):Number(pitch.value)/30*.7;sim.step(dt,{throttle:Number(range.value)/100,pitch:command});
   group.position.set(s.x/3000,Math.max(0,s.altitude/3000),0);group.rotation.z=-s.angle;camera.position.set(s.x/120+8,Math.max(8,s.altitude/120+7),17);camera.lookAt(s.x/120,Math.max(2,s.altitude/120),0);
   const rho=1.225*Math.exp(-Math.max(0,s.altitude)/8500),speed=Math.hypot(s.vx,s.vy),q=.5*rho*speed*speed;
   $("#altitude",root).textContent=(s.altitude/1000).toFixed(2)+" km";$("#velocity",root).textContent=s.vy.toFixed(1)+" m/s";$("#horizontal-speed",root).textContent=Math.abs(s.vx).toFixed(1)+" m/s";$("#fuel",root).textContent=(s.fuelTonnes*1000).toFixed(1)+" u";$("#dynamic-pressure",root).textContent=(q/1000).toFixed(1)+" kPa";$("#max-q",root).textContent=(s.maxQ/1000).toFixed(1)+" kPa";$("#angle",root).textContent=(s.angle*180/Math.PI).toFixed(1)+"°";$("#mission-time",root).textContent="T+ "+Math.floor(s.elapsed/60).toString().padStart(2,"0")+":"+Math.floor(s.elapsed%60).toString().padStart(2,"0");
   $("#flight-status",root).textContent=s.crashed?"VEHICLE LOST":s.landed?"LANDED":"IN FLIGHT";$("#flight-note",root).textContent=s.crashed?"Impact detected. Recover and redesign the vehicle.":s.landed?"Vehicle landed. Recover to reset the launchpad.":q>30000?"MAX-Q REGION: monitor dynamic pressure and throttle.":"Gravity turn and aerodynamic forces are active.";
   if(s.crashed||s.landed){range.value="0";updateLabels();clearFlightSave();if(s.crashed)host.toast("Vehicle impacted the surface.","error");else if(s.elapsed>1)host.toast("Vehicle returned to the surface.");sim=null;}
   if(sim&&now-lastPersist>2500){persistFlight(Number(range.value)/100,Number(pitch.value));lastPersist=now;}
  }
  renderer.render(scene,camera);flightFrame=requestAnimationFrame(animate);
 };flightFrame=requestAnimationFrame(animate);
 root.addEventListener("DOMNodeRemoved",()=>{alive=false;observer.disconnect();disposeFlightScene();},{once:true});
}
function tracking(){const root=$("#tracking-content");root.innerHTML=`<section class="game-panel tracking-panel"><div class="game-panel-head"><div><span class="panel-kicker">CELESTIAL NAVIGATION / SOL-01</span><h3>SOLAR SYSTEM ATLAS</h3></div><span class="live-tag">8 DESTINATIONS</span></div><div class="system-map"><canvas id="system-canvas"></canvas></div><div class="body-grid">${bodies.map(b=>`<button class="body-card ${target===b[0]?"selected":""}" data-body="${b[0]}"><i class="body-dot" style="--body-color:${b[4]}"></i><span><b>${b[0]}</b><small>${b[1]}</small></span><i>↗</i></button>`).join("")}</div><div id="body-detail" class="body-detail"></div></section>`;const c=$("#system-canvas") as HTMLCanvasElement,x=c.getContext("2d")!,d=devicePixelRatio||1;c.width=c.clientWidth*d;c.height=c.clientHeight*d;x.scale(d,d);const w=c.clientWidth,h=c.clientHeight,cx=w/2,cy=h/2;x.fillStyle="#06101c";x.fillRect(0,0,w,h);for(let i=0;i<120;i++){x.fillStyle="rgba(206,226,244,.5)";x.fillRect(i*67%w,i*31%h,1,1)}x.fillStyle="#f3bf72";x.beginPath();x.arc(cx,cy,13,0,7);x.fill();bodies.slice(1).forEach((b,i)=>{const r=30+i*22,a=i*.9+.4;x.strokeStyle="rgba(126,166,204,.25)";x.beginPath();x.ellipse(cx,cy,r,r*.43,0,0,7);x.stroke();x.fillStyle=b[4];x.beginPath();x.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.43,Math.max(3,8-i*.5),0,7);x.fill()});root.querySelectorAll<HTMLButtonElement>("[data-body]").forEach(b=>b.onclick=()=>{target=b.dataset.body!;tracking()});const b=bodies.find(v=>v[0]===target)!;$("#body-detail",root).innerHTML=`<div><span class="panel-kicker">${b[1]} / CELESTIAL BODY</span><h3>${b[0]}</h3><p>${b[6]}</p></div><div class="body-facts"><span>MEAN RADIUS<b>${b[2].toLocaleString()} km</b></span><span>SURFACE GRAVITY<b>${b[3]} m/s²</b></span><span>ORBITAL DISTANCE<b>${b[5].toLocaleString()} km</b></span></div><button class="secondary-button compact" id="set-target">SET AS TARGET</button>`;$("#set-target",root).onclick=()=>{const v=world();if(v){v.state.currentBody=b[0];v.updatedAt=new Date().toISOString();host.setWorld(v);host.toast(b[0]+" selected as navigation target.")}}}
export function mountGame(h:Host){host=h;load();}
