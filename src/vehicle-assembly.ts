import type { BuildPart, PartKind } from "./vehicle-builder-3d";

export type AttachmentClass = "stack" | "surface";
export interface AttachmentNode {
  id: string;
  attachmentClass: AttachmentClass;
  position: readonly [number, number, number];
  direction: readonly [number, number, number];
}
export interface AttachmentPlacement {
  x: number;
  y: number;
  z: number;
  parentId: string;
  parentNode: string;
  childNode: string;
  rotationY: number;
}
export interface AssemblyIssue {
  code: "duplicate-id" | "missing-parent" | "self-parent" | "cycle" | "missing-node" | "incompatible-node";
  partId: string;
  message: string;
}

const node = (id: string, attachmentClass: AttachmentClass, position: readonly [number, number, number], direction: readonly [number, number, number]): AttachmentNode =>
  ({ id, attachmentClass, position, direction });

const SURFACE_ROOT = node("surface-root", "surface", [0, 0, 0], [-1, 0, 0]);

export function attachmentNodes(kind: PartKind): AttachmentNode[] {
  switch (kind) {
    case "capsule":
      return [node("stack-top", "stack", [0, 0.75, 0], [0, 1, 0]), node("stack-bottom", "stack", [0, -0.5, 0], [0, -1, 0]), ...radialSurfaceNodes(0.42, 0.5)];
    case "tank":
      return [node("stack-top", "stack", [0, 0.55, 0], [0, 1, 0]), node("stack-bottom", "stack", [0, -0.55, 0], [0, -1, 0]), node("engine-mount-east", "stack", [0.9, -0.55, 0], [0, -1, 0]), node("engine-mount-west", "stack", [-0.9, -0.55, 0], [0, -1, 0]), node("engine-mount-north", "stack", [0, -0.55, 0.9], [0, -1, 0]), node("engine-mount-south", "stack", [0, -0.55, -0.9], [0, -1, 0]), ...radialSurfaceNodes(0.46, 0.55)];
    case "engine":
      return [node("stack-top", "stack", [0, 0.4, 0], [0, 1, 0])];
    case "separator":
      return [node("stack-top", "stack", [0, 0.11, 0], [0, 1, 0]), node("stack-bottom", "stack", [0, -0.11, 0], [0, -1, 0])];
    case "side-decoupler":
    case "separator-thruster":
      return [SURFACE_ROOT];
    case "fuel-line":
      return [];
    case "strut":
      return [node("stack-top", "stack", [0, 0.5, 0], [0, 1, 0]), node("stack-bottom", "stack", [0, -0.5, 0], [0, -1, 0])];
    case "wing":
    case "fin":
    case "control":
    case "wheel":
    case "solar":
    case "battery":
    case "dock":
    case "rcs":
      return [SURFACE_ROOT];
    default:
      return [];
  }
}

function radialSurfaceNodes(radius: number, halfHeight: number): AttachmentNode[] {
  // Nine snap points per radial face: the centres of a 3×3 set of equal
  // surface sections. Keep the original centre IDs so existing saved builds
  // with surface attachments continue to resolve.
  const thirds = [-2 / 3, 0, 2 / 3];
  const faces = [
    { id: "east", direction: [1, 0, 0] as const, point: (y: number, tangent: number): readonly [number, number, number] => [radius, y, tangent] },
    { id: "west", direction: [-1, 0, 0] as const, point: (y: number, tangent: number): readonly [number, number, number] => [-radius, y, tangent] },
    { id: "north", direction: [0, 0, 1] as const, point: (y: number, tangent: number): readonly [number, number, number] => [tangent, y, radius] },
    { id: "south", direction: [0, 0, -1] as const, point: (y: number, tangent: number): readonly [number, number, number] => [tangent, y, -radius] }
  ];
  return faces.flatMap(face => thirds.flatMap((vertical, row) => thirds.map((across, column) => {
    const id = row === 1 && column === 1 ? `surface-${face.id}` : `surface-${face.id}-y${row}-t${column}`;
    return node(id, "surface", face.point(vertical * halfHeight, across * radius), face.direction);
  })));
}

function rotateY(v: readonly [number, number, number], angle: number): [number, number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

function opposite(a: readonly number[], b: readonly number[]): boolean {
  return a.length === 3 && b.length === 3
    && Math.abs(a[0]! + b[0]!) < 1e-6
    && Math.abs(a[1]! + b[1]!) < 1e-6
    && Math.abs(a[2]! + b[2]!) < 1e-6;
}

export function findAttachmentPlacement(
  parts: readonly BuildPart[],
  parentId: string,
  childKind: PartKind,
  rotationY = 0,
  reservedParentNodes: readonly string[] = []
): AttachmentPlacement | null {
  const parent = parts.find(part => part.id === parentId);
  if (!parent) return null;
  const parentNodes = attachmentNodes(parent.kind);
  const childNodes = attachmentNodes(childKind);
  const candidates = parentNodes.flatMap(parentNode => childNodes
    .filter(childNode => parentNode.attachmentClass === childNode.attachmentClass && !reservedParentNodes.includes(parentNode.id))
    .map(childNode => ({ parentNode, childNode, priority: parentNode.attachmentClass === "stack" ? 0 : 1 })))
    .sort((a, b) => a.priority - b.priority || (a.parentNode.id === "stack-top" ? 0 : a.parentNode.id === "stack-bottom" ? 1 : 2) - (b.parentNode.id === "stack-top" ? 0 : b.parentNode.id === "stack-bottom" ? 1 : 2) || a.parentNode.id.localeCompare(b.parentNode.id));

  for (const candidate of candidates) {
    const parentDirection = rotateY(candidate.parentNode.direction, parent.ry ?? 0);
    const childDirection = rotateY(candidate.childNode.direction, rotationY);
    if (!opposite(parentDirection, childDirection)) continue;
    const parentOffset = rotateY(candidate.parentNode.position, parent.ry ?? 0);
    const childOffset = rotateY(candidate.childNode.position, rotationY);
    return {
      x: (parent.x ?? 0) + parentOffset[0] - childOffset[0],
      y: (parent.y ?? 0) + parentOffset[1] - childOffset[1],
      z: (parent.z ?? 0) + parentOffset[2] - childOffset[2],
      parentId,
      parentNode: candidate.parentNode.id,
      childNode: candidate.childNode.id,
      rotationY
    };
  }
  return null;
}

export function findAvailableAttachmentPlacement(
  parts: readonly BuildPart[],
  childKind: PartKind,
  preferredParentId?: string,
  anchor?: readonly [number, number, number]
): AttachmentPlacement | null {
  const occupied = new Map<string, string[]>();
  for (const part of parts) {
    if (!part.parentId || !part.parentNode) continue;
    const list = occupied.get(part.parentId) ?? [];
    list.push(part.parentNode);
    occupied.set(part.parentId, list);
  }
  const parents = [...parts].filter(part => part.id).sort((a, b) => {
    if (a.id === preferredParentId) return -1;
    if (b.id === preferredParentId) return 1;
    if (!anchor) return (b.y ?? 0) - (a.y ?? 0);
    const da = Math.hypot((a.x ?? 0) - anchor[0], (a.y ?? 0) - anchor[1], (a.z ?? 0) - anchor[2]);
    const db = Math.hypot((b.x ?? 0) - anchor[0], (b.y ?? 0) - anchor[1], (b.z ?? 0) - anchor[2]);
    return da - db;
  });
  const rotations = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  for (const parent of parents) {
    for (const rotation of rotations) {
      const placement = findAttachmentPlacement(parts, parent.id!, childKind, rotation, occupied.get(parent.id!) ?? []);
      if (placement) return placement;
    }
  }
  return null;
}

export function findNearestAttachmentPlacement(
  parts: readonly BuildPart[],
  childKind: PartKind,
  position: readonly [number, number, number],
  maxDistance = 0.8
): AttachmentPlacement | null {
  const occupied = new Map<string, string[]>();
  for (const part of parts) {
    if (!part.parentId || !part.parentNode) continue;
    const list = occupied.get(part.parentId) ?? [];
    list.push(part.parentNode);
    occupied.set(part.parentId, list);
  }
  let best: AttachmentPlacement | null = null;
  let bestDistance = maxDistance;
  for (const parent of parts) {
    if (!parent.id) continue;
    for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const placement = findAttachmentPlacement(parts, parent.id, childKind, rotation, occupied.get(parent.id) ?? []);
      if (!placement) continue;
      const distance = Math.hypot(placement.x - position[0], placement.y - position[1], placement.z - position[2]);
      if (distance < bestDistance) { best = placement; bestDistance = distance; }
    }
  }
  return best;
}

export function validateAssembly(parts: readonly BuildPart[]): AssemblyIssue[] {
  const issues: AssemblyIssue[] = [];
  const byId = new Map<string, BuildPart>();
  for (const part of parts) {
    if (!part.id) continue;
    if (byId.has(part.id)) issues.push({ code: "duplicate-id", partId: part.id, message: "Part IDs must be unique." });
    else byId.set(part.id, part);
  }
  for (const part of parts) {
    if (!part.parentId) continue;
    if (part.parentId === part.id) {
      issues.push({ code: "self-parent", partId: part.id ?? "", message: "A part cannot be attached to itself." });
      continue;
    }
    const parent = byId.get(part.parentId);
    if (!parent) {
      issues.push({ code: "missing-parent", partId: part.id ?? "", message: "The parent part does not exist." });
      continue;
    }
    if (part.parentNode && part.childNode) {
      const parentNode = attachmentNodes(parent.kind).find(n => n.id === part.parentNode);
      const childNode = attachmentNodes(part.kind).find(n => n.id === part.childNode);
      if (!parentNode || !childNode) {
        issues.push({ code: "missing-node", partId: part.id ?? "", message: "The saved attachment node no longer exists." });
      } else if (parentNode.attachmentClass !== childNode.attachmentClass) {
        issues.push({ code: "incompatible-node", partId: part.id ?? "", message: "The saved attachment nodes are incompatible." });
      }
    }
  }
  for (const part of parts) {
    const seen = new Set<string>();
    let current: BuildPart | undefined = part;
    while (current?.parentId) {
      if (seen.has(current.parentId)) {
        issues.push({ code: "cycle", partId: part.id ?? "", message: "Attachment hierarchy contains a cycle." });
        break;
      }
      seen.add(current.parentId);
      current = byId.get(current.parentId);
      if (!current) break;
    }
  }
  return issues;
}

export function canAttach(parts: readonly BuildPart[], parentId: string, childKind: PartKind): boolean {
  return findAttachmentPlacement(parts, parentId, childKind) !== null;
}
