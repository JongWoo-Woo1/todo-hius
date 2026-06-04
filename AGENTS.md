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

### Read Command Guidance

Avoid read-only pipelines such as `Get-Content ... | Select-Object ...` when inspecting files. The Windows sandbox often treats the pipeline segments separately and may require repeated approval.

Prefer these safer read patterns:

- Use `Select-String -Path <file> -Pattern <pattern> -Context <before>,<after>` for focused code inspection.
- Use `Get-Content -Path <file>` for full small files.
- Use `rg` / `rg --files` when available for searching files and text.
- If line-window reads are needed, prefer a single non-pipelined command or an already approved exact command pattern.

## Core Architecture

Main files:

- `index.html`: DOM layout for Project, Ledger, and Calendar workspaces
- `src/styles.css`: app styling loaded by Vite
- `src/main.ts`: event wiring and form handling
- `src/types.ts`: shared TypeScript types
- `src/vite-env.d.ts`: Vite client type declarations for CSS and asset imports
- `src/state/store.ts`: state mutation, migration, persistence, active project handling
- `src/state/storage.ts`: localStorage raw read/write wrapper
- `src/state/calendarPreferences.ts`: in-session calendar range preference defaults and normalization
- `src/data/sampleProjects.ts`: initial sample data for empty browser state
- `src/excel/`: Excel workbook creation and browser download helpers
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

## Prompt Efficiency Rule

The user should not need to repeat the full project instructions in every request.

At the start of each task, Codex should read `AGENTS.md`, `README.md`, and `HISTORY.md` to confirm the current project state and standing rules.

Standing rules in `AGENTS.md` apply automatically even when the user gives only a short instruction. Treat short user instructions as task-specific instructions layered on top of these standing rules.

Standing rules that do not need to be repeated include:

- Do not migrate the app to React.
- Do not migrate the app to Electron.
- Keep the current Vite + TypeScript + pure DOM direction.
- Keep the browser/localStorage-based workflow.
- Respect `.gitignore`.
- Do not inspect or edit `node_modules/`, `dist/`, or `build/`.
- Run typecheck and build after meaningful code changes.
- Keep the document roles clear:
  - `README.md` is for implemented user-facing program features.
  - `HISTORY.md` is for actual chronological changes.
  - `AGENTS.md` is for Codex working rules, architecture rules, validation, and version control rules.
- Update `HISTORY.md` when a meaningful change is made.
- Follow the commit and push workflow.

Ideas, review comments, or long-term possibilities mentioned in conversation are not implementation requirements until the user explicitly asks to implement them.

Only document actually implemented user features in `README.md`.

Only record actual changes in `HISTORY.md`.

Keep `AGENTS.md` limited to Codex working rules, architecture rules, validation rules, and version control rules.

Even when the user gives a short instruction, Codex should inspect the current code and documents before making changes.

When the user says something like "continue the next phase", Codex should use `HISTORY.md` and `README.md` to identify the current implementation state before continuing.

When uncertain, do not invent new feature requirements. Work within the safe scope supported by the current code and documents.

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
5. Push committed work to `origin/main` unless the user explicitly asks to keep it local.

When code changes require documentation updates, update the relevant Markdown file in the same commit. Keep `README.md` user-facing, `HISTORY.md` chronological, and `AGENTS.md` focused on Codex working rules.

## Documentation Layout

Keep Markdown documentation intentionally small:

- `README.md`: program overview, user-facing feature guide, scripts, and project structure
- `HISTORY.md`: chronological change history
- `AGENTS.md`: Codex working rules, architecture notes, validation, and version control rules
