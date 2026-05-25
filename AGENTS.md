# AGENTS.md

## Project Role

This repository is a Vite + TypeScript + pure DOM project management Todo app.

Codex should preserve this direction:

- Do not migrate the app to React.
- Do not migrate the app to Electron.
- Keep `src/` as the source of truth.
- Keep the current browser/localStorage-based workflow unless the user explicitly changes direction.

## File Access Rules

Respect `.gitignore`.

Do not inspect or edit ignored folders or generated output, including:

- `node_modules/`
- `dist/`
- `build/`

Do not read ignored environment or log files unless the user explicitly asks for them.

## Core Architecture

Main files:

- `index.html`: DOM layout for Project, Ledger, and Calendar workspaces
- `src/styles.css`: app styling loaded by Vite
- `src/main.ts`: event wiring and form handling
- `src/types.ts`: shared TypeScript types
- `src/state/store.ts`: state mutation, migration, persistence, active project handling
- `src/state/storage.ts`: localStorage raw read/write wrapper
- `src/state/calendarPreferences.ts`: cached calendar range preferences
- `src/data/sampleProjects.ts`: initial sample data for empty browser state
- `src/ui/dom.ts`: DOM element references
- `src/ui/render.ts`: rendering, current view state, selected Todo state
- `src/utils/`: shared helpers

Data is persisted in localStorage with this key:

```text
project-todo-state
```

Keep this key stable so existing user data remains compatible.

## Compatibility Rules

Existing legacy localStorage data must continue to load.

Project and Todo migration lives in `src/state/store.ts`.

Todo completion fields must stay synchronized:

- `status === "완료"` means `completed = true`
- `progress === 1` can be treated as completed and status `"완료"`
- non-complete statuses should keep `completed = false`

## Validation

Run these after meaningful code changes:

```bash
npm run typecheck
npm run build
```

On this Windows/PowerShell setup, use `npm.cmd` if needed:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## Version Control

Use Git history actively.

Commit focused changes with concise conventional-style messages:

- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for internal restructuring
- `style:` for visual-only CSS/UI polish
- `docs:` for documentation-only changes
- `chore:` for tooling, dependency, or repository maintenance

Update `HISTORY.md` for user-facing features, fixes, data model changes, and important workflow/documentation changes.

Recommended workflow:

1. Make a focused change.
2. Run typecheck and build.
3. Update `HISTORY.md`.
4. Commit with a clear message.

## Documentation Layout

Keep Markdown documentation intentionally small:

- `README.md`: program overview, user-facing feature guide, scripts, and project structure
- `HISTORY.md`: chronological change history
- `AGENTS.md`: Codex working rules, architecture notes, validation, and version control rules
