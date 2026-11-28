/**
 * SpaceZ-isolated stack layout helper, adapted from Orbitlab's physics/frame.ts.
 * Copyright 2026 Royin (ROYIN001). Apache-2.0.
 */
import type { VehicleSpec } from "./types";
export interface StackLayout { height:number[]; base:number[]; topDiameter:(number|null)[]; total:number; }
export function interstageHeight(lowerDiameter:number,upperDiameter:number|null):number {
  if(upperDiameter===null)return 0;
  const d=Math.abs(upperDiameter-lowerDiameter);
  return d>.05?d*1.1+.6:0;
}
const cache=new WeakMap<VehicleSpec,StackLayout>();
export function stackLayout(spec:VehicleSpec):StackLayout {
  const hit=cache.get(spec);if(hit)return hit;
  const height:number[]=[],base:number[]=[],topDiameter:(number|null)[]=[];let total=0;
  for(let i=0;i<spec.stages.length;i++){
    const stage=spec.stages[i]!;base.push(total);
    if(stage.isSpacecraft){height.push(0);topDiameter.push(null);continue;}
    const next=spec.stages.slice(i+1).find(candidate=>!candidate.isSpacecraft);
    const ownAdapter=!next&&!!spec.fairing?.adapter;
    const top=next?next.diameter:spec.fairing?(ownAdapter?stage.diameter:spec.fairing.diameter):null;
    topDiameter.push(top);
    const h=stage.length+interstageHeight(stage.diameter,top);height.push(h);total+=h;
  }
  const layout={height,base,topDiameter,total};cache.set(spec,layout);return layout;
}
