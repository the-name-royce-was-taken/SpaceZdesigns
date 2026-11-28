export interface FlightRenderVector { x:number; y:number; z:number; }

/** Converts Earth-centred scene coordinates into a launch-site-relative render frame. */
export function flightRenderPosition(position:FlightRenderVector,origin:FlightRenderVector):FlightRenderVector {
  return {x:position.x-origin.x,y:position.y-origin.y,z:position.z-origin.z};
}

/** Offset for the Earth-centred visual frame in launch-site-relative coordinates. */
export function flightRenderOriginOffset(origin:FlightRenderVector):FlightRenderVector {
  return {x:-origin.x,y:-origin.y,z:-origin.z};
}
