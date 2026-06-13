import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { bridgeTool, bridgeUrlSchema } from "./toolResult";

export function registerAppControlTools(server: McpServer): void {
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
}
