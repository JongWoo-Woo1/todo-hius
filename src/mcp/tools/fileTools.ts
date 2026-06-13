import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppState } from "../core/mcpTypes";
import { summarizeWeek } from "../core/scheduleSummary";
import {
  getProjectDetail,
  getTodayScheduleContext,
  getWeekScheduleContext,
  listProjects,
  searchProjects,
  searchTasks,
} from "../core/workspaceQueries";
import { readWorkspace, resolveWorkspacePath } from "../core/workspaceReader";
import { errorResult, jsonResult, parseDateArg, runTool, textResult } from "./toolResult";

async function loadState(workspacePath?: string): Promise<AppState> {
  return readWorkspace(resolveWorkspacePath(workspacePath));
}

const workspacePathSchema = {
  workspacePath: z
    .string()
    .optional()
    .describe("Absolute path to a .todo workspace. Defaults to the development workspace when omitted."),
};

export function registerFileTools(server: McpServer): void {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "File-based read: list projects from a saved .todo workspace with task counts.",
      inputSchema: { ...workspacePathSchema },
    },
    async ({ workspacePath }) =>
      runTool(async () => jsonResult(listProjects(await loadState(workspacePath)))),
  );

  server.registerTool(
    "search_projects",
    {
      title: "Search projects",
      description: "File-based read: search projects in a saved .todo workspace by name, client, or project number.",
      inputSchema: { ...workspacePathSchema, query: z.string().describe("Case-insensitive search text.") },
    },
    async ({ workspacePath, query }) =>
      runTool(async () => jsonResult(searchProjects(await loadState(workspacePath), query))),
  );

  server.registerTool(
    "search_tasks",
    {
      title: "Search tasks",
      description: "File-based read: search tasks in a saved .todo workspace by title, memo, or status.",
      inputSchema: { ...workspacePathSchema, query: z.string().describe("Case-insensitive search text.") },
    },
    async ({ workspacePath, query }) =>
      runTool(async () => jsonResult(searchTasks(await loadState(workspacePath), query))),
  );

  server.registerTool(
    "get_project_detail",
    {
      title: "Get project detail",
      description: "File-based read: get one project from a saved .todo workspace with its tasks, events, and work logs.",
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
      description: "File-based read: tasks due today, overdue open tasks, events, and work logs from a saved .todo workspace.",
      inputSchema: { ...workspacePathSchema, date: z.string().optional().describe("Target day as YYYY-MM-DD. Defaults to today.") },
    },
    async ({ workspacePath, date }) =>
      runTool(async () => jsonResult(getTodayScheduleContext(await loadState(workspacePath), parseDateArg(date)))),
  );

  server.registerTool(
    "get_week_schedule",
    {
      title: "Get week schedule",
      description: "File-based read: tasks, events, and work logs for the week (Mon-Sun) from a saved .todo workspace.",
      inputSchema: { ...workspacePathSchema, weekDate: z.string().optional().describe("Any day in the target week as YYYY-MM-DD. Defaults to this week.") },
    },
    async ({ workspacePath, weekDate }) =>
      runTool(async () => jsonResult(getWeekScheduleContext(await loadState(workspacePath), parseDateArg(weekDate)))),
  );

  server.registerTool(
    "summarize_week",
    {
      title: "Summarize week",
      description: "File-based read: human-readable summary of this week's saved .todo tasks, events, and work logs.",
      inputSchema: { ...workspacePathSchema, weekDate: z.string().optional().describe("Any day in the target week as YYYY-MM-DD. Defaults to this week.") },
    },
    async ({ workspacePath, weekDate }) =>
      runTool(async () => textResult(summarizeWeek(await loadState(workspacePath), parseDateArg(weekDate)))),
  );
}
