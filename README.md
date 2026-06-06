# HIUS Todo

Vite + TypeScript + pure DOM 기반의 Electron 업무 관리 앱입니다.

프로젝트별 Task를 관리하고, Calendar / Weekly / Ledger View로 일정과 진행 현황을 확인하며, 데이터를 `.todo` workspace 파일로 저장합니다.

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
|- AGENTS.md                       # coding-agent working rules
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
|  |- types.ts                     # shared AppState, Project, Task, WorkLog types
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
|  |  |- render.ts                 # render orchestration: wires state, UI actions, and view modules
|  |  |- dom.ts                    # DOM element references
|  |  |- navView.ts                # view (Projects/Calendar/Weekly/Ledger) visibility switching
|  |  |- projectListView.ts        # sidebar project list rendering and reordering
|  |  |- projectView.ts            # Project header and project info rendering
|  |  |- projectDetailView.ts      # Project detail shell / empty-state rendering
|  |  |- taskListView.ts           # Task list rendering within a project
|  |  |- taskView.ts               # Task detail card and Task edit form
|  |  |- calendarView.ts           # Calendar filters, range controls, and grid rendering
|  |  |- ledgerView.ts             # Ledger filters and table rendering
|  |  |- weeklyView.ts             # Weekly report view rendering
|  |  |- modalView.ts              # Calendar/Ledger task & project detail modal rendering
|  |  |- workLogView.ts            # WorkLog DOM rendering
|  |  |- workLogSectionView.ts     # project/task linked WorkLog summary sections
|  |  |- workLogDetailView.ts      # WorkLog detail/create modal rendering
|  |  |- detailView.ts             # shared detail-row (dl/dt/dd) helpers
|  |  |- confirmDialog.ts          # async confirm dialog
|  |  `- toast.ts                  # transient toast notifications
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
- `src/ui/render.ts` is the rendering-orchestration / UI-flow file: it calls each view module, wires their callbacks to store mutations and `uiState` transitions, and re-renders. It does little DOM drawing itself — feature-specific rendering lives in the `*View.ts` modules.
- `src/ui/*View.ts` files own feature-specific DOM rendering for the project list, project header/info/detail, task list and task cards, Calendar, Ledger, Weekly, WorkLog surfaces, and modals.
- `src/platform/todoFileClient.ts` wraps `window.hiusTodoFile` for renderer-side file API access.
- `src/excel/` owns Excel workbook generation and download helpers.
- `electron/` owns desktop shell behavior, menus, preload bridge, and filesystem-backed workspace persistence.

Renderer code should not access Node filesystem APIs directly. Electron filesystem work should go through the preload bridge and `electron/todoWorkspace.ts`.

## Electron Workspace Files

Data is stored through `.todo` workspace files.

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

## Design Notes

The app uses pure TypeScript and direct DOM rendering — no UI framework. Keep that direction unless a React migration is explicitly requested.

Rendering is split so that `render.ts` only orchestrates flow while each `*View.ts` module owns one surface's DOM. Prefer adding new view modules over growing `render.ts`, and refactor in small, typecheckable steps.
