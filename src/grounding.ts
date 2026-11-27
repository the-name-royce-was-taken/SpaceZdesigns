export interface GroundablePart {
  id?: string;
  y?: number;
  [key: string]: unknown;
}

/** Returns the upward correction needed to bring a world-space minimum onto y=0. */
export function groundClearanceOffset(minY: number): number {
  return Number.isFinite(minY) ? Math.max(0, -minY) : 0;
}

/** Applies one rigid vertical translation to the requested parts. */
export function translatePartsY<T extends GroundablePart>(parts: T[], ids: ReadonlySet<string>, offset: number): T[] {
  if (!Number.isFinite(offset) || offset === 0) return parts.map(part => ({ ...part }));
  return parts.map(part => ids.has(part.id ?? "") ? { ...part, y: (part.y ?? 0) + offset } : { ...part });
}
