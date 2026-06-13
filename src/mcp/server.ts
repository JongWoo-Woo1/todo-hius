// HIUS Todo MCP server (phase 1, read-only).
//
// A standard MCP stdio server that exposes read-only queries over a `.todo` workspace, plus
// a schedule-summary tool. It does NOT control the running Electron app. Each tool reads the
// workspace fresh from disk, so changes saved by the app are picked up on the next call.
//
// IMPORTANT: stdout is reserved for the MCP protocol. Never console.log to stdout here; use
// console.error (stderr) for any diagnostics.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readWorkspace, resolveWorkspacePath } from "./core/workspaceReader";
import {
  getProjectDetail,
  getTodayScheduleContext,
  getWeekScheduleContext,
  listProjects,
  searchProjects,
  searchTasks,
} from "./core/workspaceQueries";
import { summarizeWeek } from "./core/scheduleSummary";
import { callBridgeAction } from "./core/bridgeClient";
import type { AppState } from "./core/mcpTypes";

const SERVER_NAME = "hius-todo";
const SERVER_VERSION = "0.1.0";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

async function loadState(workspacePath?: string): Promise<AppState> {
  return readWorkspace(resolveWorkspacePath(workspacePath));
}

function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

// Wrap a tool body so workspace read / parse errors become a clean tool error instead of
// crashing the server.
async function runTool(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run();
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

// Parse an optional YYYY-MM-DD argument into a local Date, defaulting to today.
function parseDateArg(value?: string): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date();
}

const workspacePathSchema = {
  workspacePath: z
    .string()
    .optional()
    .describe("Absolute path to a .todo workspace. Defaults to the development workspace when omitted."),
};

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

server.registerTool(
  "list_projects",
  {
    title: "List projects",
    description: "List all projects in the workspace with task counts.",
    inputSchema: { ...workspacePathSchema },
  },
  async ({ workspacePath }) =>
    runTool(async () => jsonResult(listProjects(await loadState(workspacePath)))),
);

server.registerTool(
  "search_projects",
  {
    title: "Search projects",
    description: "Search projects by name, client, or project number.",
    inputSchema: { ...workspacePathSchema, query: z.string().describe("Case-insensitive search text.") },
  },
  async ({ workspacePath, query }) =>
    runTool(async () => jsonResult(searchProjects(await loadState(workspacePath), query))),
);

server.registerTool(
  "search_tasks",
  {
    title: "Search tasks",
    description: "Search tasks across all projects by title, memo, or status.",
    inputSchema: { ...workspacePathSchema, query: z.string().describe("Case-insensitive search text.") },
  },
  async ({ workspacePath, query }) =>
    runTool(async () => jsonResult(searchTasks(await loadState(workspacePath), query))),
);

server.registerTool(
  "get_project_detail",
  {
    title: "Get project detail",
    description: "Get one project with its tasks, events, and work logs.",
    inputSchema: { ...workspacePathSchema, projectId: z.string().describe("The project id.") },
  },
  async ({ workspacePath, projectId }) =>
    runTool(async () => {
      const detail = getProjectDetail(await loadState(workspacePath), projectId);
      if (!detail) {
        return errorResult(`Project "${projectId}" was not found in the workspace.`);
      }

      return jsonResult(detail);
    }),
);

server.registerTool(
  "get_today_schedule",
  {
    title: "Get today's schedule",
    description: "Tasks due today, overdue open tasks, events, and work logs for a given day (default: today).",
    inputSchema: { ...workspacePathSchema, date: z.string().optional().describe("Target day as YYYY-MM-DD. Defaults to today.") },
  },
  async ({ workspacePath, date }) =>
    runTool(async () => jsonResult(getTodayScheduleContext(await loadState(workspacePath), parseDateArg(date)))),
);

server.registerTool(
  "get_week_schedule",
  {
    title: "Get week schedule",
    description: "Tasks, events, and work logs for the week (Mon-Sun) containing the given date (default: this week).",
    inputSchema: { ...workspacePathSchema, weekDate: z.string().optional().describe("Any day in the target week as YYYY-MM-DD. Defaults to this week.") },
  },
  async ({ workspacePath, weekDate }) =>
    runTool(async () => jsonResult(getWeekScheduleContext(await loadState(workspacePath), parseDateArg(weekDate)))),
);

server.registerTool(
  "summarize_week",
  {
    title: "Summarize week",
    description: "Human-readable text summary of this week's tasks, events, and work logs (no LLM call).",
    inputSchema: { ...workspacePathSchema, weekDate: z.string().optional().describe("Any day in the target week as YYYY-MM-DD. Defaults to this week.") },
  },
  async ({ workspacePath, weekDate }) =>
    runTool(async () => textResult(summarizeWeek(await loadState(workspacePath), parseDateArg(weekDate)))),
);

// ---------------------------------------------------------------------------------------
// App-control tools (phase 2). These do NOT edit the .todo file directly; they call the
// running Electron app's local bridge, which performs the action in the live app.
// ---------------------------------------------------------------------------------------

const bridgeUrlSchema = {
  bridgeUrl: z
    .string()
    .optional()
    .describe("Bridge base URL (http://127.0.0.1:PORT). Defaults to the running app's bridge via its port file."),
};

async function bridgeTool(action: string, payload: Record<string, unknown>, bridgeUrl?: string): Promise<ToolResult> {
  return runTool(async () => {
    const response = await callBridgeAction(action, payload, bridgeUrl);
    if (!response.ok) {
      return errorResult(response.error ?? `Action "${action}" failed.`);
    }

    return jsonResult(response.result ?? { ok: true });
  });
}

server.registerTool(
  "navigate_to_view",
  {
    title: "Navigate to view",
    description: "Switch the running app's main window to a view.",
    inputSchema: {
      ...bridgeUrlSchema,
      view: z.enum(["calendar", "feed", "weekly", "ledger", "projects"]).describe("Target view."),
    },
  },
  async ({ bridgeUrl, view }) => bridgeTool("navigate_to_view", { view }, bridgeUrl),
);

server.registerTool(
  "navigate_to_project",
  {
    title: "Navigate to project",
    description: "Select a project in the running app by id or search query and show it.",
    inputSchema: {
      ...bridgeUrlSchema,
      projectId: z.string().optional().describe("Exact project id."),
      query: z.string().optional().describe("Search text matched against name/client/number."),
    },
  },
  async ({ bridgeUrl, projectId, query }) =>
    bridgeTool("navigate_to_project", { projectId, projectQuery: query }, bridgeUrl),
);

server.registerTool(
  "open_workspace_window",
  {
    title: "Open workspace window",
    description: "Open a view or a project in a separate window of the running app.",
    inputSchema: {
      ...bridgeUrlSchema,
      view: z.enum(["calendar", "feed", "weekly", "ledger"]).optional().describe("View to open in a new window."),
      projectId: z.string().optional().describe("Project id to open in a new window."),
      query: z.string().optional().describe("Project search text (used when projectId is omitted)."),
    },
  },
  async ({ bridgeUrl, view, projectId, query }) =>
    bridgeTool("open_workspace_window", { view, projectId, projectQuery: query }, bridgeUrl),
);

server.registerTool(
  "open_task",
  {
    title: "Open task",
    description: "Open a task's detail in the running app by id or title search.",
    inputSchema: {
      ...bridgeUrlSchema,
      taskId: z.string().optional().describe("Exact task id."),
      query: z.string().optional().describe("Task title search text."),
    },
  },
  async ({ bridgeUrl, taskId, query }) => bridgeTool("open_task", { taskId, query }, bridgeUrl),
);

server.registerTool(
  "create_task",
  {
    title: "Create task",
    description: "Create a task in a project of the running app.",
    inputSchema: {
      ...bridgeUrlSchema,
      projectId: z.string().optional().describe("Target project id."),
      projectQuery: z.string().optional().describe("Target project search text (used when projectId is omitted)."),
      title: z.string().describe("Task title."),
      dueDate: z.string().optional().describe("Due date as YYYY-MM-DD."),
      priority: z.enum(["낮음", "보통", "높음", "최우선"]).optional().describe("Task priority."),
      memo: z.string().optional().describe("Free-text memo."),
    },
  },
  async ({ bridgeUrl, projectId, projectQuery, title, dueDate, priority, memo }) =>
    bridgeTool("create_task", { projectId, projectQuery, title, dueDate, priority, memo }, bridgeUrl),
);

server.registerTool(
  "create_event",
  {
    title: "Create event",
    description: "Create a project event in the running app.",
    inputSchema: {
      ...bridgeUrlSchema,
      projectId: z.string().optional().describe("Target project id."),
      projectQuery: z.string().optional().describe("Target project search text (used when projectId is omitted)."),
      title: z.string().describe("Event title."),
      startDate: z.string().describe("Start date as YYYY-MM-DD."),
      endDate: z.string().optional().describe("End date as YYYY-MM-DD."),
      content: z.string().optional().describe("Event detail text."),
    },
  },
  async ({ bridgeUrl, projectId, projectQuery, title, startDate, endDate, content }) =>
    bridgeTool("create_event", { projectId, projectQuery, title, startDate, endDate, content }, bridgeUrl),
);

server.registerTool(
  "create_work_log",
  {
    title: "Create work log",
    description: "Create a weekly work log entry in the running app.",
    inputSchema: {
      ...bridgeUrlSchema,
      projectId: z.string().optional().describe("Target project id."),
      projectQuery: z.string().optional().describe("Target project search text (used when projectId is omitted)."),
      date: z.string().describe("Log date as YYYY-MM-DD."),
      type: z.enum(["계획", "수행"]).optional().describe("Log type (defaults to 수행)."),
      content: z.string().optional().describe("Log content."),
    },
  },
  async ({ bridgeUrl, projectId, projectQuery, date, type, content }) =>
    bridgeTool("create_work_log", { projectId, projectQuery, date, type, content }, bridgeUrl),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} MCP server v${SERVER_VERSION} ready (stdio).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
