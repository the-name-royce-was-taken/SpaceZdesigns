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

const STACK_TOP = node("stack-top", "stack", [0, 0.5, 0], [0, 1, 0]);
const STACK_BOTTOM = node("stack-bottom", "stack", [0, -0.5, 0], [0, -1, 0]);
const SURFACE_ROOT = node("surface-root", "surface", [0, 0, 0], [-1, 0, 0]);

export function attachmentNodes(kind: PartKind): AttachmentNode[] {
  switch (kind) {
    case "capsule":
      return [node("stack-top", "stack", [0, 0.75, 0], [0, 1, 0]), node("stack-bottom", "stack", [0, -0.5, 0], [0, -1, 0]), ...radialSurfaceNodes(0.42, 0)];
    case "tank":
      return [node("stack-top", "stack", [0, 0.55, 0], [0, 1, 0]), node("stack-bottom", "stack", [0, -0.55, 0], [0, -1, 0]), ...radialSurfaceNodes(0.46, 0)];
    case "engine":
      return [node("stack-top", "stack", [0, 0.4, 0], [0, 1, 0])];
    case "separator":
      return [node("stack-top", "stack", [0, 0.11, 0], [0, 1, 0]), node("stack-bottom", "stack", [0, -0.11, 0], [0, -1, 0])];
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
  }
}

function radialSurfaceNodes(radius: number, y: number): AttachmentNode[] {
  return [
    node("surface-east", "surface", [radius, y, 0], [1, 0, 0]),
    node("surface-west", "surface", [-radius, y, 0], [-1, 0, 0]),
    node("surface-north", "surface", [0, y, radius], [0, 0, 1]),
    node("surface-south", "surface", [0, y, -radius], [0, 0, -1])
  ];
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
  rotationY = 0
): AttachmentPlacement | null {
  const parent = parts.find(part => part.id === parentId);
  if (!parent) return null;
  const parentNodes = attachmentNodes(parent.kind);
  const childNodes = attachmentNodes(childKind);
  const candidates = parentNodes.flatMap(parentNode => childNodes
    .filter(childNode => parentNode.attachmentClass === childNode.attachmentClass)
    .map(childNode => ({ parentNode, childNode, priority: parentNode.attachmentClass === "stack" ? 0 : 1 })))
    .sort((a, b) => a.priority - b.priority || a.parentNode.id.localeCompare(b.parentNode.id));

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
