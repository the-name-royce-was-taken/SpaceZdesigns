export interface GroundablePart {
  id?: string;
  y?: number;
  [key: string]: unknown;
}

/** Returns the upward correction needed to bring a world-space minimum onto y=0. */
export function groundClearanceOffset(minY: number): number {
  return Number.isFinite(minY) ? Math.max(0, -minY) : 0;
}

/** Returns how far a selection above y=0 must move down to touch the ground. */
export function groundDropDistance(minY: number): number {
  return Number.isFinite(minY) ? Math.max(0, minY) : 0;
}

/** Applies one rigid vertical translation to the requested parts. */
export function translatePartsY<T extends GroundablePart>(parts: T[], ids: ReadonlySet<string>, offset: number): T[] {
  if (!Number.isFinite(offset) || offset === 0) return parts.map(part => ({ ...part }));
  return parts.map(part => ids.has(part.id ?? "") ? { ...part, y: (part.y ?? 0) + offset } : { ...part });
}

/** Places a part just beyond the right edge of the existing craft, with its bottom on y=0. */
export function sideSpawnPosition(rightEdge: number, localMinX: number, localMinY: number, gap = 0.35): { x: number; y: number } {
  if (![rightEdge, localMinX, localMinY, gap].every(Number.isFinite)) return { x: 0, y: 0 };
  return { x: rightEdge + Math.max(0, gap) - localMinX, y: -localMinY };
}

export interface SpawnBounds {
  minX:number; maxX:number; minY:number; maxY:number; minZ:number; maxZ:number;
}

/**
 * If the grounded spawn overlaps anything, move it left in 1.5-unit steps
 * until clear. Then move one more 1.5-unit step and check again; if that
 * lands in another part, keep stepping left until the final position is clear.
 * Touching faces count as overlap.
 */
export function leftwardClearanceOffset(candidate:SpawnBounds, obstacles:SpawnBounds[], step=1.5, extraGap=1.5):number {
  if (![candidate.minX,candidate.maxX,candidate.minY,candidate.maxY,candidate.minZ,candidate.maxZ,step,extraGap].every(Number.isFinite) || step<=0 || extraGap<0) return 0;
  const overlaps=(a:SpawnBounds,b:SpawnBounds)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minY<=b.maxY&&a.maxY>=b.minY&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
  let offset=0,iterations=0;
  const collides=()=>obstacles.some(obstacle=>overlaps({...candidate,minX:candidate.minX+offset,maxX:candidate.maxX+offset},obstacle));
  if(!collides()) return 0;
  while(collides()&&iterations<10000){offset-=step;iterations++;}
  if(iterations>=10000)return 0;
  // Deliberately add the requested clearance, then re-check: another part
  // may be sitting at that next 1.5-unit position.
  offset-=extraGap;
  while(collides()&&iterations<10000){offset-=step;iterations++;}
  if(iterations>=10000)return 0;
  return offset;
}

/** Exact vertical correction that places a part's measured lowest point on y=0. */
export function groundSnapOffset(minY:number):number {
  return Number.isFinite(minY) && minY !== 0 ? -minY : 0;
}
