import { validateBlueprintRecords, type BlueprintRecord } from "./blueprints";
import { CAREER_STARTING_CREDITS } from "./career";
import { strToU8, unzipSync, zipSync } from "fflate";

export type GameMode = "sandbox" | "career";

export interface WorldState {
  currentScene: "space-center";
  currentBody: string;
  credits: number;
  science: number;
  reputation: number;
  playTimeSeconds: number;
  craft: unknown[];
  missions: unknown[];
  research: string[];
  blueprints?: BlueprintRecord[];
  achievements?: string[];
  purchasedParts?: string[];
}

export interface WorldRecord {
  id: string;
  name: string;
  mode: GameMode;
  createdAt: string;
  updatedAt: string;
  gameVersion: string;
  schemaVersion: 1;
  state: WorldState;
}

interface WorldManifest {
  format: "spacez-world";
  formatVersion: 1;
  gameVersion: string;
  worldId: string;
  worldName: string;
  mode: GameMode;
  exportedAt: string;
  files: string[];
}

const DATABASE_NAME = "spacezdesigns-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "worlds";
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const ALLOWED_FILES = new Set(["world/manifest.json", "world/world.json", "world/blueprints.json"]);
const GAME_VERSION = "0.1.0";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `world-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultState(mode: GameMode): WorldState {
  return {
    currentScene: "space-center",
    currentBody: "Earth",
    credits: mode === "career" ? CAREER_STARTING_CREDITS : 100000,
    science: 0,
    reputation: 0,
    playTimeSeconds: 0,
    craft: [],
    missions: [],
    research: []
  };
}

function validateWorld(value: unknown): value is WorldRecord {
  if (!value || typeof value !== "object") return false;
  const world = value as Partial<WorldRecord>;
  const state = world.state;
  return typeof world.id === "string"
    && world.id.length > 0
    && typeof world.name === "string"
    && world.name.trim().length > 0
    && world.name.length <= 40
    && !/[\u0000-\u001f]/.test(world.name)
    && (world.mode === "sandbox" || world.mode === "career")
    && typeof world.createdAt === "string"
    && Number.isFinite(Date.parse(world.createdAt))
    && typeof world.updatedAt === "string"
    && Number.isFinite(Date.parse(world.updatedAt))
    && typeof world.gameVersion === "string"
    && world.schemaVersion === 1
    && !!state
    && typeof state === "object"
    && state.currentScene === "space-center"
    && typeof state.currentBody === "string"
    && Number.isFinite(state.credits)
    && Number.isFinite(state.science)
    && Number.isFinite(state.reputation)
    && Number.isFinite(state.playTimeSeconds)
    && Array.isArray(state.craft)
    && Array.isArray(state.missions)
    && Array.isArray(state.research)
    && state.research.every((item) => typeof item === "string")
    && (state.blueprints === undefined || Array.isArray(state.blueprints))\n    && (state.achievements === undefined || (Array.isArray(state.achievements) && state.achievements.every((item) => typeof item === "string")))\n    && (state.purchasedParts === undefined || (Array.isArray(state.purchasedParts) && state.purchasedParts.every((item) => typeof item === "string")));
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not support IndexedDB. Use a current desktop browser."));
  }
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open local world storage."));
      request.onblocked = () => reject(new Error("World storage is blocked by another open SpaceZdesigns tab."));
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise!;
}

export async function listWorlds(): Promise<WorldRecord[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, "readonly");
  const records = await requestToPromise(tx.objectStore(STORE_NAME).getAll()) as WorldRecord[];
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveWorld(world: WorldRecord): Promise<void> {
  if (!validateWorld(world)) throw new Error("World data failed validation and was not saved.");
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(world);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save this world."));
    tx.onabort = () => reject(tx.error ?? new Error("World save was interrupted."));
  });
}

export async function createWorld(name: string, mode: GameMode): Promise<WorldRecord> {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 40) throw new Error("Enter a world name between 1 and 40 characters.");
  if (mode !== "sandbox" && mode !== "career") throw new Error("Choose a valid game mode.");
  const now = new Date().toISOString();
  const world: WorldRecord = {
    id: makeId(),
    name: cleanName,
    mode,
    createdAt: now,
    updatedAt: now,
    gameVersion: GAME_VERSION,
    schemaVersion: 1,
    state: defaultState(mode)
  };
  await saveWorld(world);
  return world;
}

export async function deleteWorld(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete this world."));
    tx.onabort = () => reject(tx.error ?? new Error("World deletion was interrupted."));
  });
}

export async function renameWorld(id: string, name: string): Promise<WorldRecord> {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 40) throw new Error("Enter a world name between 1 and 40 characters.");
  const worlds = await listWorlds();
  const world = worlds.find((item) => item.id === id);
  if (!world) throw new Error("That world no longer exists.");
  world.name = cleanName;
  world.updatedAt = new Date().toISOString();
  await saveWorld(world);
  return world;
}

export function exportWorld(world: WorldRecord): Uint8Array {
  if (!validateWorld(world)) throw new Error("Cannot export invalid world data.");
  const blueprints = validateBlueprintRecords(world.state.blueprints ?? []);
  const worldData: WorldRecord = { ...world, state: { ...world.state, blueprints } };
  const files = ["world/world.json", "world/blueprints.json"];
  const manifest: WorldManifest = {
    format: "spacez-world",
    formatVersion: 1,
    gameVersion: world.gameVersion,
    worldId: world.id,
    worldName: world.name,
    mode: world.mode,
    exportedAt: new Date().toISOString(),
    files
  };
  return zipSync({
    "world/manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "world/world.json": strToU8(JSON.stringify(worldData, null, 2)),
    "world/blueprints.json": strToU8(JSON.stringify(blueprints, null, 2))
  }, { level: 6 });
}

export function importWorld(archive: Uint8Array): WorldRecord {
  if (archive.byteLength === 0 || archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error("The .spaze file is empty or exceeds the 25 MB import limit.");
  }

  let expandedBytes = 0;
  let entryCount = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(archive, {
      filter: (file) => {
        entryCount += 1;
        if (entryCount > 64) throw new Error("The archive contains too many entries.");
        if (!ALLOWED_FILES.has(file.name)) return false;
        if (!Number.isFinite(file.originalSize) || file.originalSize > MAX_UNCOMPRESSED_BYTES) {
          throw new Error("The expanded world data exceeds the 80 MB safety limit.");
        }
        expandedBytes += file.originalSize;
        if (expandedBytes > MAX_UNCOMPRESSED_BYTES) {
          throw new Error("The expanded world data exceeds the 80 MB safety limit.");
        }
        return true;
      }
    });
  } catch (error) {
    if (error instanceof Error && /safety limit|too many entries/.test(error.message)) throw error;
    throw new Error("This file is not a valid ZIP-based .spaze world.");
  }

  const paths = Object.keys(entries);
  if (entryCount < 2 || entryCount > 3 || paths.length !== entryCount || paths.some((path) => !ALLOWED_FILES.has(path))
    || !paths.includes("world/manifest.json") || !paths.includes("world/world.json")) {
    throw new Error("The archive contains unexpected or missing files. Import was cancelled.");
  }

  let manifest: WorldManifest;
  let world: unknown;
  try {
    manifest = JSON.parse(new TextDecoder().decode(entries["world/manifest.json"])) as WorldManifest;
    world = JSON.parse(new TextDecoder().decode(entries["world/world.json"])) as unknown;
  } catch {
    throw new Error("The world archive contains invalid JSON.");
  }

  if (!manifest || typeof manifest !== "object"
    || manifest.format !== "spacez-world" || manifest.formatVersion !== 1
    || typeof manifest.worldId !== "string"
    || typeof manifest.worldName !== "string"
    || typeof manifest.gameVersion !== "string"
    || !Number.isFinite(Date.parse(manifest.exportedAt))) {
    throw new Error("This .spaze format version is not supported by this game build.");
  }
  const expectedFiles = paths.filter(path => path !== "world/manifest.json").sort();
  if (!Array.isArray(manifest.files) || manifest.files.length !== expectedFiles.length
    || [...manifest.files].sort().some((path, index) => path !== expectedFiles[index])) {
    throw new Error("The archive manifest is incomplete or contains unexpected files.");
  }
  if (!validateWorld(world)) {
    throw new Error("The world data is incomplete or incompatible with this game build.");
  }
  if (manifest.worldId !== world.id || world.name !== manifest.worldName || world.mode !== manifest.mode) {
    throw new Error("The archive manifest does not match its world data.");
  }
  if ("world/blueprints.json" in entries) {
    let blueprints: unknown;
    try {
      blueprints = JSON.parse(new TextDecoder().decode(entries["world/blueprints.json"]));
    } catch {
      throw new Error("The world archive contains invalid blueprint JSON.");
    }
    world.state.blueprints = validateBlueprintRecords(blueprints);
  }

  return {
    ...world,
    id: makeId(),
    updatedAt: new Date().toISOString()
  };
}

export function getActiveWorldId(): string | null {
  try {
    return localStorage.getItem("spacez.activeWorldId");
  } catch {
    return null;
  }
}

export function setActiveWorldId(id: string | null): void {
  try {
    if (id) localStorage.setItem("spacez.activeWorldId", id);
    else localStorage.removeItem("spacez.activeWorldId");
  } catch {
    // Active-world convenience is optional; IndexedDB remains authoritative.
  }
}