# HIUS Todo

Vite + TypeScript + pure DOM 기반의 Electron 프로젝트 Todo 관리 앱입니다.

프로젝트별 Todo, Calendar, Weekly, Ledger View를 관리하고, Electron 브랜치에서는 데이터를 `.todo` workspace 파일로 저장합니다.

## Run

```powershell
npm.cmd run dev:electron
npm.cmd run typecheck
npm.cmd run build
```

## Scripts

- `npm run dev`: Vite development server
- `npm run dev:electron`: Vite + Electron development mode
- `npm run build`: build Vite web assets and Electron main process
- `npm run build:web`: build only Vite web assets
- `npm run build:electron`: build only Electron main process
- `npm run preview`: preview production build
- `npm run typecheck`: TypeScript check without emit

## Project Structure

```txt
.
|- index.html                      # DOM layout loaded by Vite
|- package.json                    # scripts and dependencies
|- tsconfig.json                   # renderer TypeScript config
|- tsconfig.electron.json          # Electron main-process TypeScript config
|- vite.config.ts                  # Vite config
|- AGENTS.md                       # Codex working rules
|- README.md                       # project map and usage
|
|- electron/
|  |- main.ts                      # Electron window, menu, dirty state, close prompt
|  |- preload.ts                   # safe renderer bridge for file APIs
|  `- todoWorkspace.ts             # .todo workspace open/save handlers
|
|- src/
|  |- main.ts                      # renderer entry, DOM events, app wiring
|  |- styles.css                   # app-wide styles
|  |- types.ts                     # shared AppState, Project, Todo, WorkLog types
|  |- vite-env.d.ts                # Vite and Electron bridge declarations
|  |
|  |- app/
|  |  `- uiState.ts                # temporary renderer UI state
|  |
|  |- platform/
|  |  `- todoFileClient.ts         # renderer wrapper around the Electron preload file API
|  |
|  |- state/
|  |  |- calendarPreferences.ts    # calendar range preference normalization
|  |  |- selectors.ts              # AppState-derived lookup helpers
|  |  `- store.ts                  # AppState migration and mutations
|  |
|  |- ui/
|  |  |- calendarView.ts           # Calendar filters, range controls, and grid rendering
|  |  |- dom.ts                    # DOM element references
|  |  |- ledgerView.ts             # Ledger filters and table rendering
|  |  |- modalView.ts              # Calendar/Ledger popup and Todo modal rendering
|  |  |- projectView.ts            # Project header and project info rendering
|  |  |- render.ts                 # render orchestration, Project/Todo list flow, and UI actions
|  |  |- weeklyView.ts             # Weekly report view rendering
|  |  `- workLogView.ts            # WorkLog DOM rendering
|  |
|  |- excel/
|  |  |- projectLedgerReport.ts    # Ledger workbook creation
|  |  |- weeklyReport.ts           # Weekly report workbook creation
|  |  `- downloadWorkbook.ts       # browser workbook download helper
|  |
|  |- utils/
|  |  |- calendar.ts               # date grid helpers
|  |  |- date.ts                   # date formatting helpers
|  |  |- id.ts                     # id creation helper
|  |  |- ledger.ts                 # Ledger row derivation
|  |  |- project.ts                # project display helpers
|  |  |- projectColor.ts           # project color assignment
|  |  |- task.ts                   # task status/progress/overdue helpers
|  |  `- week.ts                   # Monday-Friday week helpers
|  |
|  `- data/
|     `- sampleProjects.ts         # initial/sample project data
|
|- public/
|  `- templates/
|     `- weekly-report-template.xlsx
|
`- hius-dt-jw-todo/
   |- hius-dt-jw.todo              # development default workspace manifest
   `- projects/                    # project JSON files for the workspace
```

## Architecture

- `src/main.ts` connects DOM events, state changes, rendering, Excel export, and Electron file APIs.
- `src/state/store.ts` owns application data, migration, and mutations.
- `src/state/selectors.ts` owns AppState-derived lookup helpers.
- `src/app/uiState.ts` owns temporary renderer-only UI state.
- `src/ui/dom.ts` owns DOM references.
- `src/ui/render.ts` coordinates rendering, UI-state transitions, and remaining Project/Todo list behavior.
- `src/ui/*View.ts` files own feature-specific DOM rendering for Calendar, Ledger, Weekly, WorkLog, modal, and Project header/info surfaces.
- `src/platform/todoFileClient.ts` wraps `window.hiusTodoFile` for renderer-side file API access.
- `src/excel/` owns Excel workbook generation and download helpers.
- `electron/` owns desktop shell behavior, menus, preload bridge, and filesystem-backed workspace persistence.

Renderer code should not access Node filesystem APIs directly. Electron filesystem work should go through the preload bridge and `electron/todoWorkspace.ts`.

## Electron Workspace Files

The Electron branch stores data through `.todo` workspace files.

```txt
hius-dt-jw-todo/
|- hius-dt-jw.todo        # workspace manifest
`- projects/
   |- <project>.json      # one JSON file per project
   `- ...
```

- `File > Open` opens a workspace manifest.
- `File > Save` or `Ctrl+S` saves the current workspace.
- `File > Save As` chooses a new workspace path.
- Unsaved changes trigger a save prompt on close.
- During development, `hius-dt-jw-todo/hius-dt-jw.todo` opens automatically as the default workspace.

## Current Refactor Direction

The app currently uses pure TypeScript and direct DOM rendering. Keep that direction unless a React migration is explicitly requested.

Near-term structure goals:

```txt
src/app/uiState.ts          # temporary UI state
src/app/renderApp.ts        # top-level render orchestration
src/state/selectors.ts      # derived AppState queries
src/ui/projectView.ts       # Project header and project info rendering
src/ui/ledgerView.ts        # Ledger rendering
src/ui/weeklyView.ts        # Weekly rendering
src/ui/calendarView.ts      # Calendar rendering
src/ui/workLogView.ts       # WorkLog rendering
src/ui/modalView.ts         # shared modal rendering
src/platform/todoFileClient.ts
```

Refactor gradually with small, typecheckable steps.