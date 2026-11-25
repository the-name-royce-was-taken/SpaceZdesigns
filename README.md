# SpaceZdesigns

A browser-based stylized spaceflight and spacecraft-construction simulator. The project targets static hosting on GitHub Pages, with local worlds, portable `.spaze` world archives, vehicle construction, flight simulation, and a complete solar-system roadmap.

## Current implementation

The `feature/game-foundation` branch now contains an early playable vertical slice:

- Space-flight-simulator-inspired main menu and responsive navigation.
- Three.js animated space backdrop with a CSS fallback when WebGL is unavailable.
- Local world manager: create, load, rename, delete, and select independent sandbox or career worlds.
- IndexedDB persistence, with a browser-storage persistence request where supported.
- `.spaze` ZIP export/import with a manifest, schema checks, file allow-list, archive-size limits, and decompressed-size limits.
- Vehicle Assembly Building: interactive Three.js low-poly 3D craft assembly, orbit/zoom camera, part palette, stack removal, live mass/fuel/thrust metrics, and local craft saving.\n- Launch complex: low-poly 3D launch scene with a fixed-step 120 Hz flight solver, inverse-square gravity, exponential atmosphere, drag/lift, dynamic pressure and Max-Q telemetry, propellant mass flow, pitch input, and stability assist.\n- Solar-system atlas prototype: orbital overview and selectable planetary destinations with basic body data.\n- Vitest tests for world archive round trips and invalid archives.
- GitHub Actions CI and GitHub Pages deployment workflows.

This is a playable prototype, not a complete space simulator. The 3D vehicle builder uses low-poly Three.js parts, orbit/zoom camera controls, and axial stacking. It is an early construction system: radial symmetry, freeform attachment nodes, advanced staging, and spaceplane wing construction are still in progress. Flight uses a fixed 120 Hz simulation step with inverse-square gravity, exponential atmospheric density, dynamic pressure, aerodynamic drag/lift, thrust-vector orientation, propellant mass flow, and a simple attitude controller. It is a more physical atmospheric ascent model, not yet a complete orbital-mechanics solver: orbital insertion, maneuver nodes, rotating reference frames, re-entry heating, landing gear, docking, and interplanetary transfers remain future work. The launch and planetary environments are low-poly prototypes, and the atlas currently includes eight destinations rather than the full solar system.

## Development requirements

- Node.js 22.12 or later
- npm
- A modern browser with IndexedDB and WebGL support (the menu has a CSS fallback if WebGL is unavailable)

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

Dependencies are pinned to exact versions in `package.json`. Run `npm install` once to generate a local `package-lock.json`; keep that lockfile with future dependency changes and use `npm ci` for reproducible local installs.

## GitHub Pages setup

The Vite base path is configured for `/SpaceZdesigns/`. The deployment workflow builds the site and publishes `dist/`.

To enable publishing, open **Repository Settings → Pages** and set the build and deployment source to **GitHub Actions**. The workflow deploys from `main`; merge the tested feature branch into `main` when ready to publish.

## Worlds and .spaze files

Worlds are stored in this browser's IndexedDB. Export downloads a ZIP archive with the `.spaze` extension; importing validates the archive before saving it as a new local world. Imported worlds receive a new local ID and do not overwrite existing campaigns.

Browser storage is device- and browser-profile-specific. Export backups regularly if you care about a campaign. The first archive schema stores the world record and campaign state; later game systems will extend it through versioned migrations.

## Development status

Playable prototype / 0.2.0. See the source modules and CI workflow for the current implementation.
