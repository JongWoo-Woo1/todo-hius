# AGENTS.md

## Project

HIUS Todo is a Vite + TypeScript + pure DOM project management app, wrapped in Electron and persisting data with `.todo` workspace files.

Do not migrate the app to React unless the user explicitly asks. Do not reintroduce localStorage persistence.

## Efficient Context Rules

Read `docs/MCP.md` before MCP / AI bridge work. Keep MCP operating documentation consolidated there; do not create parallel MCP setup docs.

Read `AGENTS.md` first. `README.md` is human-facing documentation — read it only when the task needs project structure, scripts, or user-facing behavior, not at the start of every task.

Prefer focused search over broad reading. Inspect the smallest relevant file set first; do not scan the whole repo by default.

On Windows/PowerShell, prefer `rg` or focused file reads over `Get-Content | Select-Object` pipelines that trigger repeated approvals.

## File Access Rules

Respect `.gitignore`. Do not inspect or edit generated/dependency/build/runtime-output folders unless explicitly requested: `node_modules/`, `dist/`, `dist-electron/`, `release/`, `build/`, `log/`.

## Task Routing

Use this map before broad searching:

- App entry / DOM event wiring: `src/main.ts`
- Renderer AI bridge actions and live-state DTOs: `src/app/aiActions.ts`
- Temporary renderer UI state (selected task, modal state, current view, visible week): `src/app/uiState.ts`
- App data state and mutations + migration: `src/state/store.ts`
- AppState-derived lookups/selectors: `src/state/selectors.ts`
- Calendar range preferences: `src/state/calendarPreferences.ts`
- Shared app types (`AppState`, `Project`, `Task`, `WorkLog`): `src/types.ts`
- Renderer file API wrapper: `src/platform/todoFileClient.ts`
- DOM references: `src/ui/dom.ts`
- Top-level render orchestration / UI flow bridge: `src/ui/render.ts`
- Navigation / view switching UI: `src/ui/navView.ts`
- Project list UI: `src/ui/projectListView.ts`
- Project header/info UI: `src/ui/projectView.ts`
- Project detail shell / empty-state UI: `src/ui/projectDetailView.ts`
- Task list UI: `src/ui/taskListView.ts`
- Task detail / edit UI: `src/ui/taskView.ts`
- Calendar UI: `src/ui/calendarView.ts`
- Shared task-add modal UI (Calendar and Project): `src/ui/calendarAddView.ts`
- Global Feed UI (Event, Weekly, and Task feed cards): `src/ui/feedView.ts`
- Project Feed UI (Event, Weekly, and Task feed cards): `src/ui/projectMemoView.ts`
- Shared Feed helpers: `src/ui/feedShared.ts`
- Event detail/create/edit modal UI: `src/ui/eventDetailView.ts`
- Weekly UI: `src/ui/weeklyView.ts`
- Ledger UI: `src/ui/ledgerView.ts`
- Calendar/Ledger shared task & project modal UI: `src/ui/modalView.ts`
- WorkLog entry DOM UI: `src/ui/workLogView.ts`
- WorkLog section/summary UI (project & task linked logs): `src/ui/workLogSectionView.ts`
- WorkLog create/detail/edit modal: `src/ui/workLogDetailView.ts`
- Shared detail-row helpers: `src/ui/detailView.ts`
- Confirm dialog UI: `src/ui/confirmDialog.ts`
- Toast UI: `src/ui/toast.ts`
- Excel export: `src/excel/`
- MCP stdio server and live/app-control tools: `src/mcp/server.ts`
- MCP bridge smoke test: `src/mcp/bridgeSmokeTest.ts`
- Date/week/task/project helpers: `src/utils/`
- Electron app shell / menu / dirty state / display-scale zoom + window min/initial sizing: `electron/main.ts`
- Electron local AI bridge: `electron/aiBridge.ts`
- Electron bridge-test temp workspace setup: `electron/bridgeTestWorkspace.ts`
- Renderer bridge: `electron/preload.ts`
- Workspace open/save: `electron/todoWorkspace.ts`
- Sample/default data: `src/data/sampleProjects.ts`
- Installer shortcut-options page / custom NSIS hooks: `build/installer.nsh`

## Button and Event Search Strategy

For a specific button, menu, form, or event:

1. Search the visible UI label, DOM id, and TypeScript variable name.
2. Check `src/ui/dom.ts` for the DOM reference.
3. Check `src/main.ts` or the relevant `*View.ts` file for the event listener.
4. Follow the callback path through `render.ts` to state/Excel/Electron only as needed.

## Architecture Rules

- `electron/` owns the Electron main process, preload bridge, and filesystem access only.
- The renderer never accesses Node `fs` directly — go through the preload bridge and `src/platform/todoFileClient.ts`.
- `src/state/store.ts` owns AppState mutation and migration.
- `src/state/selectors.ts` owns AppState lookups/derived data only — no mutation.
- `src/app/uiState.ts` holds only temporary UI state (selected task, modal state, current view, etc.).
- `src/ui/*View.ts` files own DOM creation and rendering for one surface.
- `src/ui/render.ts` stays an orchestration layer: it wires each View to `uiState`, `store` mutations, and re-renders. It should do little DOM drawing itself.
- View files must not mutate AppState arbitrarily — pass intent up through callbacks into the `render.ts`/`store` flow.
- View files must not call Electron IPC directly — use `src/platform/todoFileClient.ts` and the existing `src/main.ts` wiring.
- Persist with `.todo` workspace files, not localStorage.
- MCP tools call the running app through `electron/aiBridge.ts` and `src/app/aiActions.ts`; keep MCP bridge-only.
- Live-state MCP responses should stay token-efficient: compact by default, paginated lists, no full `AppState`, and detail only when `detailLevel: "detail"` is requested.
- Detailed MCP tool schema and descriptions belong in `src/mcp/server.ts` `registerTool` metadata, which is the source of truth.
- Do not add delete tools to the MCP/AI bridge unless explicitly requested.

## Future Refactor Direction

The structure is already largely split into per-surface `*View.ts` modules. No large rewrite is needed.

- When shrinking `render.ts`, move one feature at a time, not large blocks at once.
- New UI should go in its own `*View.ts` file; keep only wiring logic in `render.ts`.
- Prefer `textContent`/`createElement` over `innerHTML`; never interpolate user input into `innerHTML`.
- Keep docs/types/validation aligned in small steps.

## Data Compatibility

Legacy project and task data continues to load through migration in `src/state/store.ts`. The migration still reads old serialization keys (`todos`, `todoId`) for back-compat — keep that.

Task completion fields must stay synchronized:

- `status === "완료"` ⇒ `completed = true`
- `progress === 1` ⇒ completed and status `"완료"`
- non-complete statuses keep `completed = false`

## Validation

- Small TypeScript changes: `npm.cmd run typecheck`
- MCP/AI bridge changes: `npm.cmd run typecheck`; run `npm.cmd run mcp:bridge-test` only when a test workspace is open and creating test Task/Event records is acceptable.
- Electron workspace/file I/O, Excel export, or build-affecting changes: `npm.cmd run build`
- Documentation-only changes: no build/typecheck required

## Version Control

Make focused changes. Use conventional-style commits (`feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `chore:`).

Commit and push only when the user asks, when a task is clearly complete, or to preserve a meaningful checkpoint.

When the user asks to push changes, briefly check whether `AGENTS.md` or `README.md` should be updated for the completed work and update only genuinely relevant documentation. When there is no explicit push request or documentation request, avoid routine `AGENTS.md`/`README.md` edits to keep token use and change noise low.
