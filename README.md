# Project To Do

## Folder structure

- `src/`: TypeScript source code
- `dist/`: Compiled JavaScript output
- `src/state/`: App state and localStorage persistence
- `src/ui/`: DOM references and rendering
- `src/utils/`: Shared helpers

## Main modules

- `src/main.ts`: App entry point and form events
- `src/data/sampleProjects.ts`: Initial demo projects for an empty browser state
- `src/state/store.ts`: Project and todo state changes
- `src/ui/render.ts`: Project list and todo list rendering
- `src/ui/dom.ts`: Shared DOM element lookups
- `src/utils/date.ts`: Due date formatting
- `src/utils/id.ts`: ID generation
- `src/types.ts`: Shared TypeScript types

## Scripts

- `npm run dev`: Start the Vite development server
- `npm run build`: Build production assets with Vite
- `npm run preview`: Preview the production build
- `npm run typecheck`: Check TypeScript without emitting files

`src/` is the source of truth. Vite loads `src/main.ts` directly during development and emits optimized production files into `dist/` during build.
