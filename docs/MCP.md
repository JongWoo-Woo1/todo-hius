# MCP / AI Bridge

## Purpose

- Claude Code / Codex can use MCP and the local AI bridge to read or drive the running todo-hius app.
- ChatGPT Developer Mode HTTP MCP is a separate future step.

## Processes

- `npm.cmd run dev:electron`
  - Runs the Electron app.
  - Starts the local AI bridge.
  - Targets the running app memory for live-state reads and app-control actions.
- `npm.cmd run dev:electron:bridge`
  - Runs the Electron app for bridge smoke tests.
  - Copies `public/templates/empty-project-workspace.todo` to the OS temp directory and opens that copy.
  - Overwrites the temp copy on each start; the template file is not modified.
- `npm.cmd run mcp:server`
  - Starts the stdio MCP server for Claude Code / Codex.
  - This is the process Claude/Codex should launch from MCP configuration.
- `npm.cmd run mcp:bridge-test`
  - Tests the running app bridge.
  - Can create test Task/Event records in the active project.

## Tool Groups

- Live-state tools
  - Read the running Electron app memory.
  - Require the local bridge.
  - Return compact/paginated DTOs by default.
  - Examples: `get_live_app_info`, `list_live_projects`, `search_live_tasks`, `get_live_week_schedule`.
- App-control tools
  - Drive the running app UI or create records.
  - Examples: `navigate_to_view`, `navigate_to_project`, `open_workspace_window`, `create_task`, `create_event`, `create_work_log`.

## Token Efficiency Rules

- Live-state responses are compact by default.
- Lists use `limit` and `offset`.
- Never return the full `AppState`.
- Return detail only when `detailLevel: "detail"` is requested.
- Prefer search as compact list, then use the selected id for a detail request.

## Save Behavior

- `create_*` tools change the running app state.
- Permanent `.todo` file persistence still requires `Ctrl+S` or `File > Save` in the app.

## Safety

- Delete tools are not provided.
- Test with a copied workspace before using real work data.
- `mcp:bridge-test` can create test Task/Event records.

Bridge test flow:

```powershell
npm.cmd run dev:electron:bridge
npm.cmd run mcp:bridge-test
```

## Claude / Codex Setup

Claude Code:

```powershell
claude mcp add --transport stdio todo-hius -- npm.cmd run mcp:server
```

Codex:

```powershell
codex mcp add todo-hius -- npm.cmd run mcp:server
```

If a config-file workflow is needed:

```toml
[mcp_servers.todo-hius]
command = "npm.cmd"
args = ["run", "mcp:server"]
cwd = "C:\\JW_PROJECT\\260517_MyFirstCodex"
```

The detailed tool schema and descriptions live in `src/mcp/server.ts` `registerTool` metadata.
