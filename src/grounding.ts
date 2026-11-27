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
