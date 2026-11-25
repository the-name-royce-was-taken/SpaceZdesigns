# SpaceZdesigns

A browser-based stylized spaceflight and spacecraft-construction simulator. The project is designed for static hosting on GitHub Pages, with local worlds, portable `.spaze` world archives, vehicle construction, flight simulation, and a complete solar-system exploration roadmap.

## Current foundation

The initial implementation establishes the application shell, a Three.js scene, local multi-world storage, and `.spaze` import/export. Flight physics, the full vehicle editor, and the complete solar system are planned follow-on milestones; they are not represented as finished features yet.

## Development

Requirements: Node.js 22.12+ and npm.

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## GitHub Pages

The Vite base path is configured for `/SpaceZdesigns/`. The GitHub Actions workflow builds the static site and deploys `dist/` to GitHub Pages.

## World files

Worlds are stored in the browser's IndexedDB. Export creates a `.spaze` ZIP archive; importing validates the archive before saving it as a separate local world. Keep exported backups because browser storage is device- and browser-specific.

## Status

Early foundation / prototype. See the repository issues and source modules for the implementation sequence.