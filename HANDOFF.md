# Codex Handoff

This document is for the next Codex context. Continue from here without restarting the project from scratch.

## Project Summary

This is a Vite + TypeScript + pure DOM project management Todo app.

Do not migrate it to React or Electron. The current direction is a lightweight Windows-friendly web app that runs in the browser through Vite.

The app manages company projects, each with Todo items, project metadata, colors, calendar visibility, and detailed task information. Data is persisted in `localStorage` under the existing key `project-todo-state`.

## Current Core Features

- Project-based Todo management
- Project creation with unique default names:
  - `new project`
  - `new project 1`
  - `new project 2`
- Project deletion
- Project color editing
- Drag and drop project ordering in the left navigation
- Todo creation, deletion, completion toggle, and detail editing
- Todo sorting by nearest due date
- Calendar view across all projects
- Calendar project filters with checkbox selection
- Project colors shown in calendar items
- 2026 full/range calendar mode
- Calendar month range and column count preferences cached in localStorage
- Project Ledger View showing all projects and all todos in one table
- Ledger filtering by status, client, and completed visibility
- Ledger row click opens the related Project View and Todo detail panel

## Company Data Model

The data model was extended for company project management.

Project fields include:

- `clientName`: company/client name
- `projectNumber`: project number
- `name`: project name
- `periodStart`: project start date
- `periodEnd`: project end date
- `periodText`: free-form project period text
- `color`: project color used in navigation and calendar

Todo fields include:

- `title`: main work item
- `dueDate`: internal target completion date
- `estimate`: effort estimate
- `status`: `대기`, `진행중`, `미완`, `완료`, `보류`
- `progress`: number from `0` to `1`
- `priority`: `낮음`, `보통`, `높음`, `최우선`
- `workerComment`: worker comment
- `managerComment`: manager comment
- `issueRisk`: issue/risk note
- `memo`: general memo
- `completed`: legacy-compatible completion flag

WorkLog support exists in the data model and store helpers, but the WorkLog UI has not been implemented yet.

## Important Compatibility Rules

- Existing legacy localStorage data must continue to load.
- `completed`, `status`, and `progress` must stay synchronized:
  - `status === "완료"` means `completed = true`
  - `progress === 1` can be treated as completed and status `"완료"`
  - non-complete statuses should keep `completed = false`
- Keep the localStorage key as `project-todo-state`.
- Keep `src/` as the source of truth.
- Do not edit generated output in `dist/`.
- Follow `.gitignore`; ignored folders should not be inspected.

## Main Files

- `index.html`: DOM layout for Project, Ledger, and Calendar workspaces
- `styles.css`: full app styling
- `src/main.ts`: event wiring and form submit/change handling
- `src/types.ts`: shared TypeScript types
- `src/state/store.ts`: state mutation, migration, persistence, active project handling
- `src/state/storage.ts`: localStorage raw read/write wrapper
- `src/state/calendarPreferences.ts`: cached calendar range preferences
- `src/data/sampleProjects.ts`: initial sample data for empty browser state
- `src/ui/dom.ts`: DOM element references
- `src/ui/render.ts`: rendering, current view state, selected Todo state
- `src/utils/calendar.ts`: calendar helpers
- `src/utils/date.ts`: date formatting helpers
- `src/utils/id.ts`: ID generation
- `src/utils/projectColor.ts`: project color defaults/helpers

## Views

Project View:

- Opens when a project is selected or the Project sidebar button is clicked.
- Shows project metadata editing, project color, todo list, and selected Todo detail form.

Ledger View:

- Opens from the Ledger sidebar button.
- Shows all project Todos in one company-style table.
- Row click navigates back to Project View and selects the Todo for editing.

Calendar View:

- Opens by default when the app first loads.
- Calendar sidebar button toggles between normal monthly calendar and 2026 range calendar when already in Calendar View.
- Range calendar controls are only visible in range mode.

## Validation Commands

Run these after meaningful code changes:

```bash
npm run typecheck
npm run build
```

On this Windows/PowerShell setup, use `npm.cmd` if script execution policy blocks plain `npm`:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## Versioning And History

- `HISTORY.md` contains chronological project changes.
- `VERSIONING.md` contains commit and release rules.
- Update `HISTORY.md` for each user-facing feature, fix, or data model change.
- Commit focused changes with conventional-style messages.

## Suggested Next Work

- Add WorkLog UI for plan/execution/issue notes.
- Add inline editing or bulk editing in Ledger View.
- Add export support for the Ledger table, likely CSV first.
- Improve date range filtering in Ledger View.
- Add validation for project period and Todo progress inputs.
- Consider a dedicated backup/import flow for localStorage data.
