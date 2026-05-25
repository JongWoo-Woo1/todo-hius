# Versioning Guide

This project uses lightweight semantic versioning and Git history.

## Version Format

Use `MAJOR.MINOR.PATCH`.

- `MAJOR`: incompatible data model or workflow changes
- `MINOR`: new user-facing features
- `PATCH`: fixes, style refinements, migration corrections, and small internal changes

The current package version is stored in `package.json`.

## Commit Style

Use concise conventional-style commit prefixes:

- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for internal restructuring
- `style:` for visual-only CSS/UI polish
- `docs:` for documentation-only changes
- `chore:` for tooling, dependency, or repository maintenance

Examples:

```text
feat: add project info editing fields
fix: hide range controls in monthly calendar mode
docs: add changelog and versioning guide
```

## Recommended Workflow

1. Make a focused change.
2. Run:

```bash
npm run typecheck
npm run build
```

3. Update `HISTORY.md`.
4. Commit with a clear message.
5. Push to `origin/main` when the local state is ready to share.

## Release Checklist

Before tagging a release:

- Confirm `npm run typecheck` passes.
- Confirm `npm run build` passes.
- Confirm localStorage migration still handles older saved data.
- Update `HISTORY.md`.
- Update `package.json` version if needed.
- Create a Git tag, for example:

```bash
git tag v1.1.0
```
