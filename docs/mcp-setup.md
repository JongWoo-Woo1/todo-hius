# HIUS Todo MCP Setup

This guide documents how to test the same `todo-hius` MCP server from Claude Code and Codex.
The flow is intended for subscription-based coding agents and does not require separate OpenAI
or Anthropic API tokens.

## MCP Server Command

Run the MCP server from the project root:

```powershell
npm.cmd run mcp:server
```

The server is a stdio MCP server. `stdout` is reserved for MCP protocol messages, and diagnostics
are written to `stderr`.

For a direct read-only smoke test without starting an MCP client:

```powershell
npm.cmd run mcp:smoke
npm.cmd run mcp:smoke -- "C:\path\to\test-workspace.todo"
```

## Workspace Path

Read tools accept an optional `workspacePath` argument.

If `workspacePath` is omitted, the server uses the development workspace:

```txt
hius-dt-jw-todo/hius-dt-jw.todo
```

If that file does not exist in your checkout, use a copied test workspace and pass its absolute
path explicitly.

To test another `.todo` file, tell the AI the absolute workspace path in the prompt, or pass it
when calling a read tool:

```txt
Use workspacePath="C:\path\to\test-workspace.todo" for HIUS Todo MCP reads.
```

App-control tools do not write directly to the `.todo` file. They call the running Electron app
through the local bridge, so the app must already have the target workspace open.

## Electron App Bridge Check

Start the app:

```powershell
npm.cmd run dev:electron
```

Open the test `.todo` workspace in the app. When the app is running, the local AI bridge writes
its port file here:

```powershell
Get-Content "$env:TEMP\hius-todo-ai-bridge.json"
```

The file should contain a JSON object with a `port` value. To verify the bridge by driving the app:

```powershell
npm.cmd run mcp:bridge-test
```

To inspect the bridge status manually:

```powershell
$bridge = Get-Content "$env:TEMP\hius-todo-ai-bridge.json" | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:$($bridge.port)/info"
```

If a bridge tool reports that the port file cannot be found, start `npm.cmd run dev:electron`
and make sure the Electron window is open.

## Live-State Tools

The MCP server exposes two read paths:

- File-based tools read a saved `.todo` file from disk. Use these when you need a specific
  workspace file and can provide `workspacePath`.
- Live tools read the currently running Electron app memory through the local bridge. Use these
  for prompts such as "show my todo-hius project list" when the app is already open.

Live tools:

```txt
get_live_app_info
list_live_projects
search_live_projects
get_live_project_summary
search_live_tasks
get_live_task_summary
get_live_today_schedule
get_live_week_schedule
```

Live responses are compact by default and use `limit`/`offset` for lists. Request
`detailLevel: "detail"` only after selecting a specific project or task id.

## Claude Code Connection

From the project root:

```powershell
claude mcp add --transport stdio todo-hius -- npm.cmd run mcp:server
```

Then start or restart Claude Code in this project and ask it to use the `todo-hius` MCP tools.

## Codex Connection

From the project root:

```powershell
codex mcp add todo-hius -- npm.cmd run mcp:server
```

If the Codex CLI helper is unavailable in your environment, add an MCP server entry equivalent to:

```toml
[mcp_servers.todo-hius]
command = "npm.cmd"
args = ["run", "mcp:server"]
cwd = "C:\\JW_PROJECT\\260517_MyFirstCodex"
```

Restart Codex after changing MCP configuration.

## Test Questions

Use questions like these after connecting Claude Code or Codex:

```txt
내 todo-hius 프로젝트 목록 보여줘.
이번 주 일정을 정리해줘.
KSOE 프로젝트를 찾아서 열어줘.
Calendar 화면을 새 창으로 열어줘.
KSOE 프로젝트에 테스트 업무 하나 만들어줘.
```

When testing a copied workspace, include the path:

```txt
Use workspacePath="C:\path\to\test-workspace.todo". 내 todo-hius 프로젝트 목록 보여줘.
```

## Safe Test Data

- 실제 업무 파일을 바로 쓰기 전에 테스트용 `.todo` 복사본으로 먼저 확인한다.
- 쓰기 tool은 create/update 중심으로 테스트한다.
- 현재 MCP server는 delete tool을 제공하지 않는다.
- 테스트로 생성한 Task/Event/WorkLog는 앱에서 직접 삭제한다.

## Smoke Scenario

1. `todo-hius` 앱 실행
2. 테스트용 `.todo` 열기
3. MCP server 연결
4. AI에게 프로젝트 목록 요청
5. AI에게 이번 주 일정 요약 요청
6. AI에게 Calendar 화면 열기 요청
7. AI에게 특정 프로젝트 새 창 열기 요청
8. AI에게 테스트 업무 생성 요청
9. AI에게 테스트 일정 생성 요청
10. 앱에서 생성 결과 확인
