# SpaceZdesigns

A browser-based stylized spaceflight and spacecraft-construction simulator. The project targets static hosting on GitHub Pages, with local worlds, portable `.spaze` world archives, vehicle construction, flight simulation, and a complete solar-system roadmap.

## Current implementation

The `feature/game-foundation` branch contains the first application foundation:

- Space-flight-simulator-inspired main menu and responsive navigation.
- Three.js animated space backdrop with a CSS fallback when WebGL is unavailable.
- Local world manager: create, load, rename, delete, and select independent sandbox or career worlds.
- IndexedDB persistence, with a browser-storage persistence request where supported.
- `.spaze` ZIP export/import with a manifest, schema checks, file allow-list, archive-size limits, and decompressed-size limits.
- Vitest tests for world archive round trips and invalid archives.
- GitHub Actions CI and GitHub Pages deployment workflows.

The vehicle editor, propulsion and orbital simulation, full planetary database, and career progression systems are later milestones. The current Flight, Hangar, and Tracking screens are honest placeholders, not finished game features.

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

Early foundation / prototype. See the source modules and CI workflow for the current implementation.
