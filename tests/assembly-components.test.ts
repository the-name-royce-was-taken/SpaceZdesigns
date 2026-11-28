import {describe,expect,it} from "vitest";
import {connectedPartComponents} from "../src/assembly-components";
import type {BuildPart} from "../src/vehicle-builder-3d";
describe("launch vehicle physical connectivity",()=>{
 it("recognizes the default capsule, tank, and engine stack as one launch vehicle",()=>{const parts:BuildPart[]=[{kind:"capsule",x:0,y:1.885,z:0},{kind:"tank",x:0,y:.96,z:0,topRadius:.44,bottomRadius:.44,height:.96},{kind:"engine",x:0,y:0,z:0}];const groups=connectedPartComponents(parts);expect(groups).toHaveLength(1);expect(groups[0]!.commandable).toBe(true);expect(groups[0]!.parts.some(part=>part.kind==="engine")).toBe(true);});
 it("keeps attachment-linked parts in one component",()=>{const parts:BuildPart[]=[{id:"pod",kind:"capsule",x:0,y:2},{id:"tank",kind:"tank",x:0,y:.96,parentId:"pod"},{id:"engine",kind:"engine",x:0,y:0,parentId:"tank"}];expect(connectedPartComponents(parts)).toHaveLength(1);});
 it("separates non-touching loose parts into independent components",()=>{const parts:BuildPart[]=[{id:"pod",kind:"capsule",x:0,y:0},{id:"engine",kind:"engine",x:0,y:-5},{id:"tank",kind:"tank",x:8,y:0}];const groups=connectedPartComponents(parts);expect(groups).toHaveLength(3);expect(groups.filter(g=>g.commandable)).toHaveLength(1);});
 it("joins parts whose physical bounds touch even without hierarchy metadata",()=>{const parts:BuildPart[]=[{id:"pod",kind:"capsule",x:0,y:0},{id:"tank",kind:"tank",x:0,y:-.925}];expect(connectedPartComponents(parts)).toHaveLength(1);});
 it("does not treat a distant fuel line as a structural connection",()=>{const parts:BuildPart[]=[{id:"pod",kind:"capsule",x:0,y:0},{id:"line",kind:"fuel-line",x:0,y:-10}];expect(connectedPartComponents(parts)).toHaveLength(2);});
});
