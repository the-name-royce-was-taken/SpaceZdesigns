/**
 * Translate a SpaceZ build into an Orbitlab vehicle and build-specific aero tables.
 * Orbitlab's aerodynamic method is a low-order slender-body/crossflow estimate,
 * not a wind-tunnel result. SpaceZ builder surfaces are added explicitly below.
 */
import { atMach, ascentAeroTable, type AeroTable, type AttachedStack } from "./aero-tables";
import { stackLayout } from "./stack-layout";
import type { EngineSpec, FairingSpec, StageSpec, VehicleSpec } from "./types";
import { partActivationGroup } from "../activation";
import { engineVariants, isFairingKind, partCatalog, type BuildPart } from "../vehicle-builder-3d";
import { tankFuelCapacity } from "../vehicle-assembly";
const G0=9.80665;
const surfaceKinds=new Set(["fin","wing","control","strake"]);
type PartDimensions={height:number;diameter:number;area:number;massKg:number};
function dimensions(part:BuildPart):PartDimensions{
 const catalog=partCatalog.find(item=>item.kind===part.kind);
 if(!catalog)throw new Error("Unsupported SpaceZ part in Orbitlab adapter: "+part.kind);
 const height=part.kind==="tank"?(part.height??catalog.size.y):part.kind==="structural-beam"?Math.max(1,Math.min(12,Math.round(part.structuralLength??3)))*.4:isFairingKind(part.kind)?(part.height??1.15):catalog.size.y;
 const radius=part.kind==="tank"?Math.max(part.topRadius??.44,part.bottomRadius??.44):part.radius??0;
 return{height:Math.max(.05,height),diameter:Math.max(catalog.size.x,catalog.size.z,radius*2),area:catalog.size.x*catalog.size.z,massKg:catalog.mass*1000};
}
function engineGroup(part:BuildPart):number{return Math.max(1,Math.floor(part.engineStage??partActivationGroup(part)??1));}
function engineSpec(parts:readonly BuildPart[]):EngineSpec{
 const engines=parts.filter(part=>part.kind==="engine");
 const totalThrust=engines.reduce((sum,part)=>{const v=engineVariants.find(item=>item.id===(part.engineType??"liquid"))??engineVariants[0]!;return sum+v.thrustKN*1000;},0);
 const totalFlow=engines.reduce((sum,part)=>{const v=engineVariants.find(item=>item.id===(part.engineType??"liquid"))??engineVariants[0]!;return sum+v.thrustKN*1000/(v.ispSeconds*G0);},0);
 const isp=totalFlow>0?totalThrust/(totalFlow*G0):285;
 return{name:engines.map(part=>engineVariants.find(item=>item.id===(part.engineType??"liquid"))?.name??"Liquid Fuel").join(" + ")||"No engine",count:1,thrustSL:totalThrust,thrustVac:totalThrust,ispSL:isp,ispVac:isp,solid:engines.length>0&&engines.every(part=>part.engineType==="solid")};
}
function partStage(part:BuildPart,stageKeys:readonly number[],engines:readonly BuildPart[]):number{
 const explicit=part.engineStage??partActivationGroup(part);
 if(explicit!==undefined){const key=Math.max(1,Math.floor(explicit));if(stageKeys.includes(key))return key;}
 let nearest=stageKeys[0]??1,best=Infinity;
 for(const engine of engines){const distance=Math.abs((engine.y??0)-(part.y??0));if(distance<best){best=distance;nearest=engineGroup(engine);}}
 return nearest;
}
export interface OrbitlabBuildAeroModel{vehicleSpec:VehicleSpec;table:AeroTable;referenceArea:number;dragCoefficient:number;liftSlope:number;surfaceArea:number;}
export function buildOrbitlabAeroModel(parts:readonly BuildPart[],craftName="SpaceZ custom vehicle"):OrbitlabBuildAeroModel{
 const engines=parts.filter(part=>part.kind==="engine");
 if(!engines.length)throw new Error("An Orbitlab vehicle needs at least one engine.");
 const stageKeys=[...new Set(engines.map(engineGroup))].sort((a,b)=>a-b);
 const fairingPart=parts.find(part=>isFairingKind(part.kind)),fd=fairingPart?dimensions(fairingPart):null;
 const fairing:FairingSpec|null=fairingPart&&fd?{mass:fd.massKg,diameter:fd.diameter,length:fd.height,sepAltitude:100000}:null;
 const structure=parts.filter(part=>!isFairingKind(part.kind));
 const stages:StageSpec[]=stageKeys.map((key,index)=>{
  const assigned=structure.filter(part=>partStage(part,stageKeys,engines)===key);
  const sized=assigned.map(part=>({part,dim:dimensions(part)}));
  const minY=Math.min(...sized.map(({part,dim})=>(part.y??0)-dim.height/2)),maxY=Math.max(...sized.map(({part,dim})=>(part.y??0)+dim.height/2));
  return{id:"spacez-stage-"+key,name:"Stage "+(index+1),dryMass:sized.reduce((sum,item)=>sum+item.dim.massKg,0),propellantMass:assigned.filter(part=>part.kind==="tank").reduce((sum,part)=>sum+tankFuelCapacity(part),0),engine:engineSpec(assigned),diameter:Math.max(.1,...sized.map(({dim})=>dim.diameter)),length:Math.max(.25,maxY-minY)};
 });
 const maxDiameter=Math.max(.1,...stages.map(stage=>stage.diameter),fairing?.diameter??0),height=stages.reduce((sum,stage)=>sum+stage.length,0)+(fairing?.length??0);
 const safeName=craftName.trim().replace(/[^a-z0-9-]+/gi,"-").replace(/^-|-$/g,"").slice(0,36)||"custom";
 const vehicleSpec:VehicleSpec={id:"spacez-"+safeName.toLowerCase(),name:craftName,country:"Custom",manufacturer:"SpaceZdesigns",height,payloadLEO:0,payloadGTO:0,fairing,stages,sites:["spacez-default"],maxQ:50000,maxAccel:60};
 const referenceArea=Math.PI*maxDiameter*maxDiameter/4;
 const attached:AttachedStack={activeIndex:0,stageAttached:stages.map(()=>true),fairingAttached:!!fairing,boosterGroups:[]};
 const layout=stackLayout(vehicleSpec),base=ascentAeroTable(vehicleSpec,attached,referenceArea,index=>layout.base[index]??0);
 const minY=Math.min(...structure.map(part=>(part.y??0)-dimensions(part).height/2));
 const surfaces=structure.filter(part=>surfaceKinds.has(part.kind)).map(part=>{const d=dimensions(part),factor=part.kind==="strake"?.45:part.kind==="control"?.85:1;return{area:d.area*factor,x:(part.y??0)-minY};});
 const surfaceArea=surfaces.reduce((sum,item)=>sum+item.area,0),surfaceMoment=surfaces.reduce((sum,item)=>sum+item.area*item.x,0),extraSlope=2*surfaceArea/referenceArea*.75;
 const normalSlope=base.normalSlope.map(value=>value+extraSlope);
 const cpX=base.cpX.map((value,index)=>{const old=base.normalSlope[index]??0,total=old+extraSlope;return total>0?(value*old+(surfaceArea>0?surfaceMoment/surfaceArea:0)*extraSlope)/total:value;});
 const airbrakeArea=structure.filter(part=>part.kind==="airbrake"&&part.retracted===false).reduce((sum,part)=>sum+dimensions(part).area,0),airbrakeCd=airbrakeArea/referenceArea*.85;
 const table:AeroTable={...base,axial:base.axial.map(value=>value+airbrakeCd),normalSlope,cpX,planformArea:base.planformArea+surfaceArea,planformX:surfaceArea>0?(base.planformX*base.planformArea+surfaceMoment)/(base.planformArea+surfaceArea):base.planformX};
 return{vehicleSpec,table,referenceArea,dragCoefficient:atMach(table,table.axial,0),liftSlope:atMach(table,table.normalSlope,0),surfaceArea};
}
