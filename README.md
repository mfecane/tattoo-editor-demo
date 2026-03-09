# 3D Tattoo Stamping Demo

Interactive 3D tattoo editor built with React and Three.js.
Place image stamps on a 3D arm mesh, manipulate them with in-scene controls, and render the result directly in texture space.

## Author

**All 3D modeling and all default tattoo images in this project were created by me as a modeller and tattoo artist.**
Instagram: **[@mfecanics](https://instagram.com/mfecanics)**

## Live Demo

`https://mfecane.github.io/tattoo-editor-demo/`

Open in a desktop browser with mouse input for the full interaction experience.

## What This Demo Showcases

- **3D interaction design**: mesh selection, image placement, transform tools
- **UV-space stamping**: converting 3D hit points into UV coordinates and compositing into texture space
- **Deformation tools**: custom lattice-based deformation driven by brush tools
- **Deterministic command history**: command-driven editing with undo/redo
- **React ↔ Three.js coordination**: shared state between React UI and a Three.js runtime

## Core Features

- **Stamp placement**: drag an image from the side panel and drop it on the arm mesh
- **Stamp manipulation**: move, rotate, and scale stamps using in-scene gizmos
- **Local deformation**: brush-based lattice editing for sculpting tattoos around anatomy
- **History-aware editing**: undo/redo support for all editing operations
- **Texture-space updates**: real-time texture updates so every edit is immediately visible on the model
- **Client-only demo**: runtime-only session with no backend persistence

## Tech Stack

- React + TypeScript
- Three.js
- Zustand
- Vite
- Tailwind CSS + shadcn/ui

## Getting Started

### Prerequisites

- Node.js (18+ recommended)
- npm or a compatible package manager

### Install & Run (Development)

```bash
npm install
npm run dev
```

The app runs on `http://localhost:5173` (or the next available Vite port).

### Build for Production

```bash
npm run build
```

## Project Layout (Essential)

```text
src/editor/components/   # React UI for editor panels and controls
src/editor/main/         # Core editor runtime (controller, project, commands)
src/editor/lib/lattice/  # Lattice geometry and projection logic
src/editor/services/     # Texture/stamp rendering services
src/editor/store/        # Zustand editor state
```

## Architecture Overview

- `src/editor/main` is the orchestration layer that connects interaction tools, command history, and project state.
- `src/editor/services` contains texture-related operations (stamping, compositing, and propagating updates to materials).
- `src/editor/lib/lattice` implements deformation math and brush-driven control point updates.
- Shared state lives in Zustand so React components stay focused on presentation and user interaction while the Three.js runtime manages the scene.

## Typical Editing Flow

1. Pick an image in **Project Images**.
2. Drag it onto the 3D arm model to place a stamp.
3. Choose a projection type.
4. Refine the placement using transform gizmos and/or brush-based lattice tools.
5. Use undo/redo to explore and validate editing operations.

## Deployment

See `docs/deploy.md` for GitHub Pages deployment details.

## License

Private project.

