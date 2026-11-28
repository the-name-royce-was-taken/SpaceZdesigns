export interface NamedCraft { name: string; }

/** Select the explicitly active craft, falling back to the most recently saved entry. */
export function selectActiveCraft<T extends NamedCraft>(crafts: readonly T[], activeCraftName?: string): T | undefined {
  return crafts.find(craft => craft.name === activeCraftName) ?? crafts[0];
}
