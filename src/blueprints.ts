import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { BuildPart, PartKind } from "./vehicle-builder-3d";

export interface BlueprintRecord {
  id: string;
  name: string;
  parts: BuildPart[];
  createdAt: string;
  updatedAt: string;
}

interface BuildzArchive {
  format: "spacez-buildz";
  version: 1;
  name: string;
  exportedAt: string;
  parts: BuildPart[];
}

const DATABASE = "spacez-blueprints";
const STORE = "blueprints";
const VALID_KINDS = new Set<PartKind>([
  "capsule", "tank", "engine", "separator", "side-decoupler", "separator-thruster", "fuel-line",
  "fin", "solar", "wing", "control", "wheel", "dock", "battery", "remote-control", "reaction-wheel",
  "rcs", "strut", "nose-cone", "fairing", "conical-fairing", "interstage-fairing", "clam-shell-fairing",
  "airbrake", "strake", "landing-leg", "heat-shield", "rover-wheel", "structural-beam",
  "structural-angle", "structural-hub"
]);
const MAX_PARTS = 120;
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_JSON_BYTES = 5 * 1024 * 1024;

function database(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the blueprint database."));
    request.onblocked = () => reject(new Error("Blueprint database upgrade is blocked by another open tab."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Blueprint database request failed."));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Blueprint database transaction was aborted."));
    tx.onerror = () => reject(tx.error ?? new Error("Blueprint database transaction failed."));
  });
}

function cleanName(name: string): string {
  const value = name.trim().slice(0, 48);
  if (!value) throw new Error("Blueprint name cannot be empty.");
  return value;
}

export function validateBlueprintParts(value: unknown): BuildPart[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PARTS) {
    throw new Error(`Blueprint must contain between 1 and ${MAX_PARTS} parts.`);
  }
  const parts = value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Part ${index + 1} is invalid.`);
    const part = item as Record<string, unknown>;
    if (typeof part.kind !== "string" || !VALID_KINDS.has(part.kind as PartKind)) {
      throw new Error(`Part ${index + 1} has an unsupported component type.`);
    }
    for (const key of ["x", "y", "z", "rx", "ry", "rz", "topRadius", "bottomRadius", "height", "radius", "thickness", "solarLength", "structuralLength", "engineStage", "activationGroup"]) {
      const field = part[key];
      if (field !== undefined && (typeof field !== "number" || !Number.isFinite(field) || Math.abs(field) > 10000)) {
        throw new Error(`Part ${index + 1} contains an invalid ${key} value.`);
      }
    }
    if (part.id !== undefined && typeof part.id !== "string") throw new Error(`Part ${index + 1} has an invalid ID.`);
    if (part.parentId !== undefined && typeof part.parentId !== "string") throw new Error(`Part ${index + 1} has an invalid parent reference.`);
    return structuredClone(part) as unknown as BuildPart;
  });
  const ids = parts.map(part => part.id).filter((id): id is string => Boolean(id));
  if (new Set(ids).size !== ids.length) throw new Error("Blueprint contains duplicate part IDs.");
  return parts;
}

export async function listBlueprints(): Promise<BlueprintRecord[]> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, "readonly");
    const done = transactionDone(tx);
    const records = await requestResult(tx.objectStore(STORE).getAll()) as BlueprintRecord[];
    await done;
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    db.close();
  }
}

export async function saveBlueprint(name: string, parts: BuildPart[], id?: string): Promise<BlueprintRecord> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    const existing = id ? await requestResult(store.get(id)) as BlueprintRecord | undefined : undefined;
    const now = new Date().toISOString();
    const record: BlueprintRecord = {
      id: id ?? `blueprint-${crypto.randomUUID()}`,
      name: cleanName(name),
      parts: validateBlueprintParts(parts),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    await requestResult(store.put(record));
    await done;
    return record;
  } finally {
    db.close();
  }
}

export async function renameBlueprint(id: string, name: string): Promise<BlueprintRecord> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    const record = await requestResult(store.get(id)) as BlueprintRecord | undefined;
    if (!record) throw new Error("Blueprint not found.");
    record.name = cleanName(name);
    record.updatedAt = new Date().toISOString();
    await requestResult(store.put(record));
    await done;
    return record;
  } finally {
    db.close();
  }
}

export async function deleteBlueprint(id: string): Promise<void> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    await requestResult(tx.objectStore(STORE).delete(id));
    await done;
  } finally {
    db.close();
  }
}

export function exportBuildz(name: string, parts: BuildPart[]): Uint8Array {
  const archive: BuildzArchive = {
    format: "spacez-buildz",
    version: 1,
    name: cleanName(name),
    exportedAt: new Date().toISOString(),
    parts: validateBlueprintParts(parts)
  };
  const json = strToU8(JSON.stringify(archive, null, 2));
  return zipSync({ "blueprint.json": json }, { level: 6 });
}

export function importBuildz(bytes: Uint8Array): { name: string; parts: BuildPart[] } {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error("The .buildz archive is empty or exceeds the 25 MB limit.");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("This is not a valid .buildz ZIP archive.");
  }
  const entries = Object.keys(files);
  if (entries.length === 0) throw new Error("This is not a valid .buildz ZIP archive.");
  if (entries.length !== 1 || entries[0] !== "blueprint.json") throw new Error("The .buildz archive must contain one blueprint.json file.");
  const payload = files["blueprint.json"]!;
  if (payload.byteLength > MAX_JSON_BYTES) throw new Error("The blueprint data is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(payload));
  } catch {
    throw new Error("The blueprint data is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("The blueprint archive has an invalid format.");
  const archive = parsed as Partial<BuildzArchive>;
  if (archive.format !== "spacez-buildz" || archive.version !== 1 || typeof archive.name !== "string") {
    throw new Error("This .buildz version is not supported.");
  }
  return { name: cleanName(archive.name), parts: validateBlueprintParts(archive.parts) };
}
