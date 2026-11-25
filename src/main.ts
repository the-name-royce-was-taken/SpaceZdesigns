import * as THREE from "three";
import {
  createWorld,
  deleteWorld,
  exportWorld,
  getActiveWorldId,
  importWorld,
  listWorlds,
  renameWorld,
  saveWorld,
  setActiveWorldId,
  type GameMode,
  type WorldRecord
} from "./worlds";
import "./style.css";
import { mountGame, renderGameScreen } from "./game";

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required interface element: ${selector}`);
  return element;
};

const toastRegion = $("#toast-region");
let activeWorld: WorldRecord | null = null;
let toastTimer = 0;
let activeRenderer: THREE.WebGLRenderer | null = null;

function toast(message: string, kind: "success" | "error" = "success"): void {
  toastRegion.textContent = message;
  toastRegion.className = `toast-region visible ${kind}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastRegion.classList.remove("visible"), 3400);
}

function showScreen(name: string): void {
  document.querySelectorAll<HTMLElement>(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === `${name}-screen`);
  });
  document.querySelectorAll<HTMLElement>(".nav-item").forEach((button) => {
    button.classList.toggle("selected", button.dataset.view === name);
  });
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function safeText(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, (char) => entities[char] ?? char);
}

async function refreshWorlds(): Promise<void> {
  const list = $("#world-list");
  list.innerHTML = '<div class="empty-state"><span class="empty-orbit">◎</span><strong>SCANNING LOCAL ARCHIVE</strong><span>Reading world database…</span></div>';
  try {
    const worlds = await listWorlds();
    $("#world-count").textContent = `${worlds.length} WORLD${worlds.length === 1 ? "" : "S"}`;
    if (worlds.length === 0) {
      list.innerHTML = '<div class="empty-state"><span class="empty-orbit">◎</span><strong>NO WORLDS FOUND</strong><span>Create a new campaign or import a .spaze world archive.</span><button class="primary-button compact" data-action="new-world">＋ CREATE FIRST WORLD</button></div>';
    } else {
      list.innerHTML = worlds.map((world) => {
        const selected = activeWorld?.id === world.id;
        const modeLabel = world.mode === "career" ? "CAREER PROGRAM" : "SANDBOX";
        return `<article class="world-card ${selected ? "is-active" : ""}">
          <div class="world-card-orbit"><span></span><i></i></div>
          <div class="world-card-main">
            <div class="world-card-top"><span class="world-mode">${modeLabel}</span>${selected ? '<span class="active-tag">ACTIVE</span>' : ""}</div>
            <h3>${safeText(world.name)}</h3>
            <p>LAST UPDATED / ${formatDate(world.updatedAt)}</p>
            <div class="world-stats"><span>LOCATION <b>${safeText(world.state.currentBody)}</b></span><span>SCIENCE <b>${world.state.science.toLocaleString()}</b></span><span>CREDITS <b>${world.state.credits.toLocaleString()}</b></span></div>
          </div>
          <div class="world-card-actions">
            <button class="primary-button compact" data-action="load-world" data-id="${world.id}">LOAD WORLD</button>
            <button class="mini-button" data-action="export-world" data-id="${world.id}" title="Export world">⇩</button>
            <button class="mini-button" data-action="rename-world" data-id="${world.id}" title="Rename world">✎</button>
            <button class="mini-button danger-text" data-action="delete-world" data-id="${world.id}" title="Delete world">×</button>
          </div>
        </article>`;
      }).join("");
    }
    updateActiveWorldCard();
  } catch (error) {
    list.innerHTML = '<div class="empty-state error-state"><strong>WORLD DATABASE UNAVAILABLE</strong><span>Check browser storage permissions and reload.</span></div>';
    toast(error instanceof Error ? error.message : "Could not read local worlds.", "error");
    $("#storage-status").textContent = "UNAVAILABLE";
  }
}

function updateActiveWorldCard(): void {
  const card = $("#active-world-card");
  if (!activeWorld) {
    card.innerHTML = '<span class="muted">NO WORLD SELECTED</span><strong>Create or import a world to begin.</strong>';
    return;
  }
  card.innerHTML = `<span class="muted">${activeWorld.mode.toUpperCase()} / ACTIVE CAMPAIGN</span><strong>${safeText(activeWorld.name)}</strong><small>LAST KNOWN LOCATION / ${safeText(activeWorld.state.currentBody)}</small>`;
}

async function activateWorld(id: string): Promise<void> {
  const worlds = await listWorlds();
  const selected = worlds.find((world) => world.id === id);
  if (!selected) throw new Error("This world could not be found in local storage.");
  activeWorld = selected;
  setActiveWorldId(selected.id);
  updateActiveWorldCard();
  await refreshWorlds();
  showScreen("home");
  toast(`Loaded world: ${selected.name}`);
}

function downloadArchive(world: WorldRecord): void {
  const bytes = exportWorld(world);
  const archiveBuffer = bytes.slice().buffer as ArrayBuffer;
  const blob = new Blob([archiveBuffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${world.name.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") || "SpaceZ-World"}.spaze`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${world.name}.spaze`);
}

async function askConfirmation(title: string, message: string, confirmLabel: string): Promise<boolean> {
  const dialog = $("#confirm-dialog") as HTMLDialogElement;
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-accept").textContent = confirmLabel;
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue === "default");
    };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

async function handleAction(action: string, id?: string): Promise<void> {
  switch (action) {
    case "home": showScreen("home"); renderGameScreen("home"); break;
    case "worlds": showScreen("worlds"); renderGameScreen("worlds"); await refreshWorlds(); break;
    case "hangar": showScreen("hangar"); renderGameScreen("hangar"); break;
    case "flight": showScreen("flight"); renderGameScreen("flight"); break;
    case "tracking": showScreen("tracking"); renderGameScreen("tracking"); break;
    case "settings": showScreen("settings"); renderGameScreen("settings"); break;
    case "new-world": {
      const dialog = $("#new-world-dialog") as HTMLDialogElement;
      ($("#world-name") as HTMLInputElement).value = "";
      dialog.showModal();
      break;
    }
    case "continue":
      if (activeWorld) { showScreen("flight"); renderGameScreen("flight"); }
      else { showScreen("worlds"); await refreshWorlds(); toast("Create or load a world before continuing.", "error"); }
      break;
    case "import-world":
      ($("#world-file-input") as HTMLInputElement).click();
      break;
    case "load-world":
      if (id) await activateWorld(id);
      break;
    case "export-world": {
      const world = (await listWorlds()).find((item) => item.id === id);
      if (world) downloadArchive(world);
      break;
    }
    case "rename-world": {
      if (!id) break;
      const world = (await listWorlds()).find((item) => item.id === id);
      if (!world) throw new Error("World not found.");
      const name = window.prompt("Enter a new name for this world:", world.name);
      if (name === null) break;
      const updated = await renameWorld(id, name);
      if (activeWorld?.id === id) activeWorld = updated;
      await refreshWorlds();
      toast("World renamed.");
      break;
    }
    case "delete-world": {
      if (!id) break;
      const world = (await listWorlds()).find((item) => item.id === id);
      if (!world) break;
      const accepted = await askConfirmation("DELETE WORLD?", `This permanently deletes “${world.name}” from this browser. Export a .spaze backup first if you want to keep it.`, "DELETE WORLD");
      if (!accepted) break;
      await deleteWorld(id);
      if (activeWorld?.id === id) {
        activeWorld = null;
        setActiveWorldId(null);
      }
      await refreshWorlds();
      toast("World deleted.");
      break;
    }
  }
}

document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action], [data-view]");
  if (!target) return;
  const action = target.dataset.action;
  const view = target.dataset.view;
  const task = action ? handleAction(action, target.dataset.id) : view ? handleAction(view) : Promise.resolve();
  void task.catch((error: unknown) => toast(error instanceof Error ? error.message : "An unexpected error occurred.", "error"));
});

$("#new-world-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = ($("#world-name") as HTMLInputElement).value;
  const mode = ($("#world-mode") as HTMLSelectElement).value as GameMode;
  const dialog = $("#new-world-dialog") as HTMLDialogElement;
  void createWorld(name, mode).then(async (world) => {
    activeWorld = world;
    setActiveWorldId(world.id);
    dialog.close();
    await refreshWorlds();
    showScreen("home");
    toast(`World created: ${world.name}`);
  }).catch((error: unknown) => toast(error instanceof Error ? error.message : "Could not create world.", "error"));
});

$("#world-file-input").addEventListener("change", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) {
    toast("The .spaze file exceeds the 25 MB import limit.", "error");
    input.value = "";
    return;
  }
  void file.arrayBuffer().then(async (buffer) => {
    const imported = importWorld(new Uint8Array(buffer));
    const existing = await listWorlds();
    const nameTaken = existing.some((world) => world.name.toLowerCase() === imported.name.toLowerCase());
    if (nameTaken) imported.name = `${imported.name} (Imported)`.slice(0, 40);
    await saveWorld(imported);
    await refreshWorlds();
    showScreen("worlds");
    toast(`Imported world: ${imported.name}`);
  }).catch((error: unknown) => toast(error instanceof Error ? error.message : "World import failed.", "error"))
    .finally(() => { input.value = ""; });
});

async function initialize(): Promise<void> {
  try {
    const worlds = await listWorlds();
    $("#storage-status").textContent = "ONLINE";
    const savedId = getActiveWorldId();
    activeWorld = worlds.find((world) => world.id === savedId) ?? null;
    updateActiveWorldCard();
    await refreshWorlds();
    if (navigator.storage?.persist) {
      void navigator.storage.persist().then((granted) => {
        $("#storage-status").textContent = granted ? "PERSISTENT" : "BEST EFFORT";
      }).catch(() => undefined);
    }
  } catch {
    $("#storage-status").textContent = "UNAVAILABLE";
    toast("Local world storage could not be initialized. Check browser settings.", "error");
  }
  mountGame({ getWorld: () => activeWorld, setWorld: (world) => { activeWorld = world; setActiveWorldId(world.id); updateActiveWorldCard(); void refreshWorlds(); }, toast });
  initializeScene();
}

function initializeScene(): void {
  const host = $("#scene-backdrop");
  try {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    activeRenderer = renderer;
    const getPixelRatio = () => {
      const value = quality.value;
      const factor = value === "high" ? 1.6 : value === "low" ? 0.85 : 1.2;
      return Math.min((window.devicePixelRatio || 1) * factor, 1.75);
    };
    renderer.setPixelRatio(getPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(renderer.domElement);
    $("#renderer-status").textContent = "ONLINE";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, 5, 27);
    scene.add(new THREE.AmbientLight(0x9bb9df, 1.1));
    const sunLight = new THREE.PointLight(0x8ebcff, 130, 180);
    sunLight.position.set(7, 4, 0);
    scene.add(sunLight);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i += 1) {
      starPositions[i * 3] = (Math.random() - 0.5) * 180;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 110;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 130 - 35;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xa8c8ff, size: 0.12, transparent: true, opacity: 0.8 }));
    scene.add(stars);

    const sun = new THREE.Mesh(new THREE.SphereGeometry(4.8, 48, 32), new THREE.MeshBasicMaterial({ color: 0xf5b75f }));
    sun.position.set(9, 1.5, -16);
    scene.add(sun);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(6.2, 32, 24), new THREE.MeshBasicMaterial({ color: 0xe99c45, transparent: true, opacity: 0.09, side: THREE.BackSide }));
    halo.position.copy(sun.position);
    scene.add(halo);

    const planetGroup = new THREE.Group();
    planetGroup.position.set(8, 1.5, -16);
    scene.add(planetGroup);
    const planetSpecs = [
      { radius: 0.72, distance: 8.2, color: 0x4c9cce, speed: 0.11 },
      { radius: 1.05, distance: 12.4, color: 0xc58c66, speed: 0.065 },
      { radius: 0.48, distance: 5.9, color: 0xd6b18a, speed: 0.16 },
      { radius: 1.45, distance: 17.4, color: 0xd9ad72, speed: 0.035 }
    ];
    const orbitMaterials = new THREE.LineBasicMaterial({ color: 0x6d91bd, transparent: true, opacity: 0.24 });
    planetSpecs.forEach((spec, index) => {
      const points: THREE.Vector3[] = [];
      for (let step = 0; step <= 100; step += 1) {
        const angle = (step / 100) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * spec.distance, 0, Math.sin(angle) * spec.distance));
      }
      planetGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), orbitMaterials));
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.radius, 32, 24), new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.92, metalness: 0.02 }));
      mesh.position.set(Math.cos(index * 1.4) * spec.distance, 0, Math.sin(index * 1.4) * spec.distance);
      mesh.userData.orbitSpeed = spec.speed;
      mesh.userData.orbitRadius = spec.distance;
      mesh.userData.phase = index * 1.4;
      planetGroup.add(mesh);
    });

    const clock = new THREE.Clock();
    const reduceMotion = $("#reduce-motion") as HTMLInputElement;
    let animationFrame = 0;
    const render = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      if (!reduceMotion.checked) {
        stars.rotation.y += delta * 0.002;
        planetGroup.children.forEach((child) => {
          if (child instanceof THREE.Mesh && typeof child.userData.orbitSpeed === "number") {
            child.userData.phase += delta * child.userData.orbitSpeed;
            const radius = child.userData.orbitRadius as number;
            child.position.x = Math.cos(child.userData.phase as number) * radius;
            child.position.z = Math.sin(child.userData.phase as number) * radius;
            child.rotation.y += delta * 0.2;
          }
        });
      }
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(getPixelRatio());
    };
    window.addEventListener("resize", resize);
    window.addEventListener("beforeunload", () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      activeRenderer = null;
      starGeometry.dispose();
    }, { once: true });
  } catch (error) {
    $("#renderer-status").textContent = "FALLBACK";
    host.classList.add("renderer-fallback");
    console.warn("WebGL background unavailable; continuing with CSS fallback.", error);
  }
}

const quality = $("#graphics-quality") as HTMLSelectElement;
try {
  quality.value = localStorage.getItem("spacez.graphicsQuality") ?? "balanced";
  ($("#reduce-motion") as HTMLInputElement).checked = localStorage.getItem("spacez.reduceMotion") === "true";
} catch {
  // Settings are optional; the defaults remain usable.
}
quality.addEventListener("change", () => {
  try { localStorage.setItem("spacez.graphicsQuality", quality.value); } catch { /* optional */ }
  if (activeRenderer) activeRenderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * (quality.value === "high" ? 1.6 : quality.value === "low" ? 0.85 : 1.2), 1.75));
  toast("Graphics preference saved.");
});
($("#reduce-motion") as HTMLInputElement).addEventListener("change", (event) => {
  try { localStorage.setItem("spacez.reduceMotion", String((event.currentTarget as HTMLInputElement).checked)); } catch { /* optional */ }
});

void initialize();