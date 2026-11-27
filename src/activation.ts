import type { BuildPart } from "./vehicle-builder-3d";

/** Parts with an action that can be triggered during flight. */
export const ACTIVATABLE_PART_KINDS = new Set<BuildPart["kind"]>([
  "engine", "separator", "side-decoupler", "separator-thruster",
  "solar", "landing-leg", "wheel", "rover-wheel", "rcs",
  "airbrake", "control", "fairing", "conical-fairing",
  "interstage-fairing", "clam-shell-fairing", "heat-shield", "dock"
]);

export function isActivationCapable(part: Pick<BuildPart, "kind">): boolean {
  return ACTIVATABLE_PART_KINDS.has(part.kind);
}

/** Generic activationGroup is canonical; positive legacy engineStage values remain readable. */
export function partActivationGroup(part: Pick<BuildPart, "kind" | "activationGroup" | "engineStage">): number | undefined {
  const group = part.activationGroup ?? (part.kind === "engine" ? part.engineStage : undefined);
  return Number.isInteger(group) && (group ?? 0) > 0 ? group : undefined;
}

export function listActivationGroups(parts: readonly BuildPart[]): number[] {
  return [...new Set(parts.filter(isActivationCapable).map(partActivationGroup).filter((id): id is number => id !== undefined))].sort((a, b) => a - b);
}

/** Assigns selected parts to one group; null removes them from all groups. */
export function assignActivationGroup<T extends BuildPart>(parts: readonly T[], partIds: ReadonlySet<string>, groupId: number | null): T[] {
  return parts.map(part => {
    if (!part.id || !partIds.has(part.id) || !isActivationCapable(part)) return { ...part };
    const next = { ...part };
    if (groupId === null) {
      delete next.activationGroup;
      if (next.kind === "engine") next.engineStage = 0;
    } else {
      next.activationGroup = groupId;
      if (next.kind === "engine") next.engineStage = groupId;
    }
    return next;
  });
}

/** Re-numbers group membership in the supplied drag-and-drop order (1..N). */
export function reorderActivationGroups<T extends BuildPart>(parts: readonly T[], orderedGroupIds: readonly number[]): T[] {
  const remap = new Map(orderedGroupIds.map((id, index) => [id, index + 1]));
  return parts.map(part => {
    const current = partActivationGroup(part);
    if (current === undefined || !remap.has(current)) return { ...part };
    const nextId = remap.get(current)!;
    const next = { ...part, activationGroup: nextId };
    if (next.kind === "engine") next.engineStage = nextId;
    return next;
  });
}
