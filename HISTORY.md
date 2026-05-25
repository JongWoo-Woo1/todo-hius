# History

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Added Vite client type declarations so TypeScript recognizes CSS side-effect imports.
- Added next-context guidance, Codex workflow, validation, and version control rules to `AGENTS.md`.
- Renamed the project change record from `CHANGELOG.md` to `HISTORY.md`.
- Added Project Ledger View for all projects and todos.
- Added Ledger status, client, and hide-completed filters.
- Added Ledger row navigation into the related Project View and Todo detail panel.
- Added Project Info editing fields for company project management:
  - client name
  - project number
  - period text
  - start date
  - end date
- Expanded Todo detail editing with:
  - title
  - target date
  - estimate
  - status
  - progress
  - priority
  - worker comment
  - manager comment
  - issue/risk
  - memo
- Added status badges and progress indicators to the Todo list.
- Added 2026 calendar range mode.
- Added month range and column count controls for the range calendar.
- Added localStorage caching for calendar range preferences.
- Added project color support and color-based calendar grouping.
- Added calendar project filters with select-all / clear-all behavior.
- Added drag and drop project ordering in the left navigation.
- Added `WorkLog` data type and store helpers for future work log UI.
- Added `src/state/storage.ts` to separate localStorage raw access from state migration.

### Changed

- Moved global CSS from root `styles.css` to `src/styles.css` and load it through `src/main.ts`.
- Removed the sidebar Project view button and ordered top-level navigation as Calendar, then Ledger.
- Added a sidebar divider between top-level view navigation and the project list.
- Reworked `README.md` into the user-facing program feature guide.
- Reduced Markdown documentation to `AGENTS.md`, `HISTORY.md`, and `README.md`.
- Moved versioning and commit guidance from `VERSIONING.md` into `AGENTS.md`.
- The app now opens to the Calendar view by default.
- The Calendar button toggles between monthly calendar and 2026 range calendar when already in Calendar view.
- Project navigation was simplified:
  - removed the top `Projects` title
  - removed the separate `Projects` view button
  - removed the New Project text input
  - added a bottom `+` button for creating default projects
- New projects are named `new project`, `new project 1`, `new project 2`, and so on to avoid duplicates.
- Todo data model was expanded for company project management fields.
- Project data model was expanded for company project metadata.
- `updateTodo()` now accepts `Partial<Todo>`.
- Existing localStorage data is migrated into the expanded data model at load time.
- Todo completion now synchronizes with status/progress:
  - status `완료` means completed
  - progress `1` means completed and status `완료`
- Sample projects were updated to company-style project examples.

### Fixed

- Calendar range controls are hidden in normal monthly calendar mode.
- Project active highlight is disabled while Calendar view is active.
- The `+` project button only becomes visible when hovered or focused.
- The `+` button now matches the sizing of project navigation buttons.

### Removed

- Removed `VERSIONING.md`; its rules now live in `AGENTS.md`.
- Removed `HANDOFF.md`; next-context guidance now lives in `AGENTS.md`.

## Historical Development Notes

These items were implemented before formal history tracking began and are recorded here in chronological order based on the conversation history.

1. Initialized a Vite + TypeScript + pure DOM Todo app.
2. Added project-based Todo management.
3. Added optional Todo due dates.
4. Added localStorage persistence.
5. Split code into modules:
   - state
   - UI DOM references
   - rendering
   - utilities
   - sample data
6. Added Vite development server support.
7. Added Todo detail editing for due date and memo.
8. Added due-date sorting.
9. Added all-project Calendar view.
10. Added project colors and Calendar filters.
11. Refined navigation UI.
12. Added project drag and drop ordering.
13. Expanded the data model for company project management.
14. Added Project Info and expanded Todo detail forms.
