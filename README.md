# HIUS Todo

Vite + TypeScript + pure DOM 기반의 Electron 업무 관리 앱입니다.

프로젝트별 Task를 관리하고, Feed / Calendar / Weekly / Ledger View로 일정과 진행 현황을 확인하며, 데이터를 `.todo` workspace 파일로 저장합니다.

## Run

```powershell
npm.cmd run dev:electron
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dist:installer
```

## Scripts

- `npm run dev`: Vite development server
- `npm run dev:electron`: Vite + Electron development mode
- `npm run build`: build Vite web assets and Electron main process
- `npm run build:web`: build only Vite web assets
- `npm run build:electron`: build only Electron main process
- `npm run preview`: preview production build
- `npm run typecheck`: TypeScript check without emit
- `npm run mcp:server`: start the stdio MCP server for Claude Code/Codex
- `npm run mcp:bridge-test`: verify the running Electron app AI bridge
- `npm run prepare:logs`: create the ignored local `log/` folder
- `npm run clean:logs`: remove local runtime log files
- `npm run clean:dist`: remove all generated build/release output folders
- `npm run clean:release`: remove the local release output folder
- `npm run clean:release-extras`: remove non-upload installer build leftovers from the local release output folder
- `npm run dist:installer`: build the Windows NSIS installer

## Windows Installer

HIUS Todo is distributed as a Windows installer by default. The app release version is the `version` field in `package.json`.

```powershell
npm.cmd run dist:installer
```

The installer uses NSIS, installs per user by default, and allows changing the install directory. A shortcut-options page lets the user choose whether to create a Desktop shortcut and a Start Menu shortcut (both checked by default); silent installs create both. The custom installer behavior lives in `build/installer.nsh`.

The installer registers `.todo` files as `HIUS Todo Workspace` files. Double-clicking a `.todo` file launches HIUS Todo and opens that workspace.

HIUS Todo runs as a single app instance. If the app is already open and another `.todo` file is double-clicked, the existing main window is focused and opens the selected workspace after the usual unsaved-changes confirmation.

Every window cancels the current display's DPI scale through the renderer zoom factor (`zoom = 1 / displayScale`) and couples its minimum/initial window size to that zoom. This keeps the fixed-pixel layout at a constant CSS viewport and a constant physical size across display scales (for example 125% and 150%) and across `npm.cmd run dev:electron` and the packaged installer. Zoom and minimum size are recomputed when a window moves to a monitor with a different scale.

## Release Flow

Use `package.json` `version` as the release source of truth.

1. Update `package.json` `version`.
2. Run the release checks:

```powershell
npm.cmd run typecheck
npm.cmd run dist:installer
```

3. Create a Git tag that matches the app version, for example `v1.0.0` or `v1.0.1`.
4. Create a GitHub Release on `JongWoo-Woo1/todo-hius` using the matching tag.
5. Upload the files generated in `dist/release/`. The installer build removes local-only build leftovers, so `dist/release/` should contain only the uploadable installer/update artifacts.

Expected installer/update artifacts:

- `HIUS-Todo-Setup-<version>-x64.exe`
- `HIUS-Todo-Setup-<version>-x64.exe.blockmap`
- `latest.yml`

The electron-builder `publish` setting is prepared for GitHub Releases. This step does not add automatic update code yet; for now, users update by downloading the new installer and reinstalling. `.todo` workspace files are user data and remain separate from app installation/update files.

Manual release checks:

- App launches after install
- `.todo` double-click opens the workspace
- Legacy folder-style `.todo + projects/` workspace opens
- New `.todo` ZIP workspace saves and reopens
- Install and uninstall work as expected

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
|- docs/
|  `- MCP.md                       # MCP / AI bridge setup and operating notes
|
|- electron/
|  |- main.ts                      # Electron window, menu, dirty state, close prompt
|  |- aiBridge.ts                  # local HTTP bridge for MCP app-control tools
|  |- preload.ts                   # safe renderer bridge for file APIs
|  `- todoWorkspace.ts             # .todo workspace open/save handlers
|
|- src/
|  |- main.ts                      # renderer entry, DOM events, app wiring
|  |- styles.css                   # app-wide styles
|  |- types.ts                     # shared AppState, Project, Task, WorkLog, ProjectEvent types
|  |- vite-env.d.ts                # Vite and Electron bridge declarations
|  |
|  |- app/
|  |  |- aiActions.ts              # renderer AI bridge actions and live-state DTOs
|  |  `- uiState.ts                # temporary renderer UI state
|  |
|  |- platform/
|  |  `- todoFileClient.ts         # renderer wrapper around the Electron preload file API
|  |
|  |- state/
|  |  |- calendarPreferences.ts    # calendar range preference normalization
|  |  |- selectors.ts              # AppState-derived lookup helpers
|  |  `- store.ts                  # AppState schema migration and mutations
|  |
|  |- ui/
|  |  |- render.ts                 # render orchestration: wires state, UI actions, and view modules
|  |  |- dom.ts                    # DOM element references
|  |  |- navView.ts                # view (Projects/Feed/Calendar/Weekly/Ledger) visibility switching
|  |  |- projectListView.ts        # sidebar project list rendering and reordering
|  |  |- projectView.ts            # Project header and project info rendering
|  |  |- projectDetailView.ts      # Project detail shell / empty-state rendering
|  |  |- taskListView.ts           # Task list rendering within a project
|  |  |- taskView.ts               # Task detail card and Task edit form
|  |  |- taskTrashView.ts          # Disabled Task restore/permanent-delete UI
|  |  |- calendarView.ts           # Calendar filters, range controls, and Task/Event range-card grid
|  |  |- calendarAddView.ts        # shared +Task modal rendering for Calendar and Project
|  |  |- feedView.ts               # global Feed rendering for Event, Weekly, and Task cards
|  |  |- feedShared.ts             # shared Feed sorting, preview, and date-window helpers
|  |  |- projectMemoView.ts        # Project Feed rendering for Event, Weekly, and Task cards
|  |  |- eventDetailView.ts        # Event detail/create/edit modal rendering
|  |  |- ledgerView.ts             # Ledger filters and table rendering
|  |  |- weeklyView.ts             # Weekly report view rendering
|  |  |- modalView.ts              # Calendar/Ledger task & project detail modal rendering
|  |  |- workLogView.ts            # WorkLog DOM rendering
|  |  |- workLogSectionView.ts     # project/task linked WorkLog summary sections
|  |  |- workLogDetailView.ts      # WorkLog detail/create modal rendering
|  |  |- detailView.ts             # shared detail-row (dl/dt/dd) helpers
|  |  |- confirmDialog.ts          # async confirm dialog
|  |  |- startupDialog.ts          # startup workspace chooser dialog
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
|  |- mcp/
|  |  |- server.ts                 # stdio MCP server for workspace reads and app bridge tools
|  |  |- smokeTest.ts              # read-only MCP smoke test
|  |  `- bridgeSmokeTest.ts        # Electron bridge smoke test
|  |
|  `- data/
|     `- sampleProjects.ts         # initial/sample project data
|
|- public/
|  `- templates/
|     |- weekly-report-template.xlsx
|     |- empty-workspace.todo
|     `- empty-project-workspace.todo
|
|- dist/
|  |- renderer/                    # Vite build output: index.html and browser assets
|  |- electron/                    # compiled Electron main/preload files
|  `- release/                     # installer and update metadata artifacts
|
|- log/                            # ignored local runtime logs
|
`- hius-dt-jw-todo/
   `- hius-dt-jw.todo              # development default workspace file
```

## Architecture

- `src/main.ts` connects DOM events, state changes, rendering, Excel export, and Electron file APIs.
- `src/state/store.ts` owns application data, migration, and mutations.
- `src/state/selectors.ts` owns AppState-derived lookup helpers.
- `src/app/uiState.ts` owns temporary renderer-only UI state.
- `src/app/aiActions.ts` owns renderer-side AI bridge actions, including compact live-state reads and create/navigation actions.
- `src/ui/dom.ts` owns DOM references.
- `src/ui/render.ts` is the rendering-orchestration / UI-flow file: it calls each view module, wires their callbacks to store mutations and `uiState` transitions, and re-renders. It does little DOM drawing itself — feature-specific rendering lives in the `*View.ts` modules.
- `src/ui/*View.ts` files own feature-specific DOM rendering for the project list, project header/info/detail, task list and task cards, Calendar, Ledger, Weekly, WorkLog surfaces, and modals.
- `src/platform/todoFileClient.ts` wraps `window.hiusTodoFile` for renderer-side file API access.
- `src/excel/` owns Excel workbook generation and download helpers.
- `src/mcp/` owns the stdio MCP server, read-only workspace queries, and app-control bridge tools.
- `electron/` owns desktop shell behavior, menus, preload bridge, and filesystem-backed workspace persistence.
- `electron/aiBridge.ts` exposes a localhost-only development bridge that lets MCP tools drive the running app.

Renderer code should not access Node filesystem APIs directly. Electron filesystem work should go through the preload bridge and `electron/todoWorkspace.ts`.

## MCP / AI Bridge

Claude Code / Codex can use the stdio MCP server to read the running app's live state and drive selected app actions through the local AI bridge.

See `docs/MCP.md` for process roles, tool groups, safe testing, and setup commands.

## Electron Workspace Files

Data is stored through `.todo` workspace files. New saves use a single-file ZIP container so copying the `.todo` file moves the full workspace.

```txt
hius-dt-jw.todo
|- manifest.json
`- projects/
   |- <projectId>.json
   `- ...
```

- `manifest.json` stores the `.todo` container `formatVersion`, app version, AppState `schemaVersion`, project order, active project id, and created/updated timestamps.
- `projects/<projectId>.json` stores each project with its related WorkLogs and Events.
- `File > Open` opens both new ZIP `.todo` files and legacy folder-style `.todo + projects/` workspaces.
- `File > Save` or `Ctrl+S` saves the current workspace as the single `.todo` ZIP format.
- `File > Save As` chooses a new workspace path and writes the single `.todo` ZIP format.
- Unsaved changes trigger a save prompt on close.
- On startup, the app shows a workspace chooser with recent `.todo` workspaces, an option to open another `.todo` file, and an option to start a new unsaved project.
- Recent workspaces are stored by Electron and missing/unreadable entries can be removed from the startup chooser.

## Data Model Notes

- AppState uses an explicit `schemaVersion`. Missing versions are treated as v1 and migrated to the current schema.
- Project Events are stored in AppState and persisted in each project's JSON file, following the same workspace style as WorkLogs.
- Calendar renders Tasks as one-day cards and Events as date-range cards.
- Calendar limits crowded day cells with a `+N more` card after the visible card lanes.
- Feed and Project Feed combine Events, Weekly entries, and Tasks, sort by feed date, and use business-day windows with separate latest/past more controls.
- Project Task uses the shared +Task modal and keeps disabled Tasks in a lightweight restore/permanent-delete section.

## Design Notes

The app uses pure TypeScript and direct DOM rendering — no UI framework. Keep that direction unless a React migration is explicitly requested.

Rendering is split so that `render.ts` only orchestrates flow while each `*View.ts` module owns one surface's DOM. Prefer adding new view modules over growing `render.ts`, and refactor in small, typecheckable steps.
