# AGENTS.md

## Project

HIUS Todo is a Vite + TypeScript + pure DOM project management Todo app.

The `electron` branch wraps the app in Electron and persists data with `.todo` workspace files. Do not migrate the app to React unless the user explicitly asks. Do not reintroduce localStorage persistence on the Electron branch.

## Efficient Context Rules

Read `AGENTS.md` first.

`README.md` and `HISTORY.md` are passive documentation by default. Do not automatically read them at the start of every task.

Read `README.md` only when the task needs user-facing behavior, feature descriptions, scripts, or documentation context.

Read `HISTORY.md` only when continuing prior work, updating history, preparing a release note, or answering questions about past changes.

Prefer focused search over broad file reading. Inspect the smallest relevant file set first.

Do not scan the whole repository by default. For button or event changes, search the visible label, DOM id, and TypeScript variable name first.

## File Access Rules

Respect `.gitignore`.

Do not inspect or edit generated, dependency, or build-output folders unless explicitly requested:

- `node_modules/`
- `dist/`
- `dist-electron/`
- `build/`

Do not read ignored environment or log files unless explicitly requested.

On Windows/PowerShell, avoid read-only pipelines such as `Get-Content ... | Select-Object ...` if they trigger repeated approvals. Prefer `rg`, `Select-String`, or focused file reads.

## Task Routing

Use this map before broad searching:

- App entry and event wiring: `src/main.ts`
- App data state and mutations: `src/state/store.ts`
- Calendar range preferences: `src/state/calendarPreferences.ts`
- Shared app types: `src/types.ts`
- DOM references: `src/ui/dom.ts`
- Current rendering and UI state: `src/ui/render.ts`
- Calendar UI: search `renderCalendar` in `src/ui/render.ts`
- Weekly UI: search `renderWeekly` in `src/ui/render.ts`
- Ledger UI: search `renderLedger` in `src/ui/render.ts`
- Project/Todo UI: search `renderProjects`, `renderTodo`, or Todo-related helpers in `src/ui/render.ts`
- WorkLog UI: search `WorkLog`, `workLog`, or `createWorkLogEntry` in `src/ui/render.ts`
- Excel export: `src/excel/`
- Date/week helpers: `src/utils/calendar.ts`, `src/utils/week.ts`, `src/utils/date.ts`
- Electron app shell/menu: `electron/main.ts`
- Renderer bridge: `electron/preload.ts`
- Workspace open/save: `electron/todoWorkspace.ts`
- Sample/default data: `src/data/sampleProjects.ts`
- User-facing docs: `README.md` only when needed
- Change history: `HISTORY.md` only when needed

## Button and Event Search Strategy

For a specific button, menu, form, or event request:

1. Search the visible UI label, DOM id, and TypeScript variable name.
2. Check `src/ui/dom.ts` for the DOM reference.
3. Check `src/main.ts` or the relevant view/controller file for event listeners.
4. Follow the event path to state, rendering, Excel, or Electron modules only as needed.
5. Avoid unrelated broad reads.

## Architecture Rules

Keep responsibilities separate:

- `electron/` owns Electron main process, preload bridge, and filesystem access.
- `src/state/` owns AppState migration and mutation.
- `src/ui/` owns DOM references and rendering.
- `src/excel/` owns workbook creation and download helpers.
- `src/utils/` owns reusable date/task/week helpers.

View/rendering code should not call Electron IPC directly. Use the preload-exposed API through existing renderer wiring.

State mutation should stay in `src/state/store.ts`. Avoid mutating AppState directly inside unrelated view helpers.

On the Electron branch, persist with `.todo` workspace files, not localStorage.

## Future Refactor Direction

Prefer pure TypeScript with a clear feature-oriented structure rather than a React migration.

When refactoring UI code, move toward this structure gradually:

- `src/app/uiState.ts`: temporary UI state such as current view, selected Todo, modal state, and visible week.
- `src/app/renderApp.ts`: top-level render orchestration.
- `src/state/selectors.ts`: AppState-derived queries.
- `src/ui/projectView.ts`: Project and Todo screen rendering.
- `src/ui/ledgerView.ts`: Ledger filters, table, and popups.
- `src/ui/weeklyView.ts`: Weekly report view.
- `src/ui/calendarView.ts`: Calendar grid and controls.
- `src/ui/workLogView.ts`: WorkLog display and actions.
- `src/ui/modalView.ts`: shared modal rendering.
- `src/platform/todoFileClient.ts`: renderer wrapper around `window.hiusTodoFile`.

Do not perform a large architecture rewrite unless explicitly requested. Prefer small, focused refactors with typecheck after each meaningful step.

## Data Compatibility

Legacy project and Todo data should continue to load through migration in `src/state/store.ts`.

Todo completion fields must stay synchronized:

- `status === "완료"` means `completed = true`
- `progress === 1` means completed and status `"완료"`
- non-complete statuses should keep `completed = false`

## Validation

For small TypeScript changes, run:

```powershell
npm.cmd run typecheck
```

Run build only after feature-level changes, Electron workspace/file I/O changes, Excel export changes, or before a final commit:

```powershell
npm.cmd run build
```

For documentation-only changes, no build is required.

## Documentation Updates

Update `README.md` only for implemented user-facing behavior, usage changes, scripts, or project structure changes.

Update `HISTORY.md` only for:

- user-facing features
- user-visible bug fixes
- data model or workspace format changes
- Electron file workflow changes
- significant architecture changes

Do not update `HISTORY.md` for small refactors, CSS-only tweaks, comments, or internal cleanup that does not affect behavior.

Keep document roles clear:

- `README.md`: user-facing overview, features, scripts, project structure
- `HISTORY.md`: chronological implemented changes
- `AGENTS.md`: Codex rules, architecture rules, validation, workflow

## Version Control

Make focused changes.

Use concise conventional-style commits when committing:

- `feat:`
- `fix:`
- `refactor:`
- `style:`
- `docs:`
- `chore:`

Commit and push only when the user asks, when a task is clearly complete, or when preserving a meaningful checkpoint. Do not commit after every tiny edit unless requested.
