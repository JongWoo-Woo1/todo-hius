import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { bridgeTool, bridgeUrlSchema } from "./toolResult";

const liveListSchema = {
  ...bridgeUrlSchema,
  limit: z.number().optional().describe("Maximum items to return. Defaults to 20."),
  offset: z.number().optional().describe("Zero-based offset for paging. Defaults to 0."),
  includeCompleted: z.boolean().optional().describe("Include completed tasks where relevant. Defaults to false."),
  projectId: z.string().optional().describe("Project id filter where relevant."),
  query: z.string().optional().describe("Search text where relevant."),
  date: z.string().optional().describe("Target date as YYYY-MM-DD where relevant. Defaults to today."),
  weekDate: z.string().optional().describe("Any date in the target week as YYYY-MM-DD where relevant. Defaults to this week."),
  detailLevel: z.enum(["compact", "detail"]).optional().describe("Defaults to compact. Use detail only when needed."),
};

export function registerLiveTools(server: McpServer): void {
  server.registerTool(
    "get_live_app_info",
    {
      title: "Get live app info",
      description: "Live-app read: compact status from the running Electron app memory via the local bridge.",
      inputSchema: { ...bridgeUrlSchema },
    },
    async ({ bridgeUrl }) => bridgeTool("get_app_info", {}, bridgeUrl),
  );

  server.registerTool(
    "list_live_projects",
    {
      title: "List live projects",
      description: "Live-app read: compact project list from the running Electron app memory.",
      inputSchema: { ...liveListSchema },
    },
    async ({ bridgeUrl, limit, offset, detailLevel }) =>
      bridgeTool("list_projects", { limit, offset, detailLevel }, bridgeUrl),
  );

  server.registerTool(
    "search_live_projects",
    {
      title: "Search live projects",
      description: "Live-app read: search projects in the running Electron app memory. Returns compact matches; use get_live_project_summary for detail.",
      inputSchema: { ...liveListSchema },
    },
    async ({ bridgeUrl, limit, offset, query, detailLevel }) =>
      bridgeTool("search_projects", { limit, offset, query, detailLevel }, bridgeUrl),
  );

  server.registerTool(
    "get_live_project_summary",
    {
      title: "Get live project summary",
      description: "Live-app read: get one project summary from the running Electron app memory by projectId or query.",
      inputSchema: {
        ...bridgeUrlSchema,
        projectId: z.string().optional().describe("Exact project id."),
        projectQuery: z.string().optional().describe("Project search text used when projectId is omitted."),
        detailLevel: z.enum(["compact", "detail"]).optional().describe("Defaults to compact. Use detail only when needed."),
      },
    },
    async ({ bridgeUrl, projectId, projectQuery, detailLevel }) =>
      bridgeTool("get_project_summary", { projectId, projectQuery, detailLevel }, bridgeUrl),
  );

  server.registerTool(
    "search_live_tasks",
    {
      title: "Search live tasks",
      description: "Live-app read: search tasks in the running Electron app memory. Returns compact matches; use get_live_task_summary for detail.",
      inputSchema: { ...liveListSchema },
    },
    async ({ bridgeUrl, limit, offset, includeCompleted, projectId, query, detailLevel }) =>
      bridgeTool("search_tasks", { limit, offset, includeCompleted, projectId, query, detailLevel }, bridgeUrl),
  );

  server.registerTool(
    "get_live_task_summary",
    {
      title: "Get live task summary",
      description: "Live-app read: get one task summary from the running Electron app memory by taskId.",
      inputSchema: {
        ...bridgeUrlSchema,
        taskId: z.string().optional().describe("Exact task id."),
        query: z.string().optional().describe("Fallback task id/search text when taskId is omitted."),
        detailLevel: z.enum(["compact", "detail"]).optional().describe("Defaults to compact. Use detail only when needed."),
      },
    },
    async ({ bridgeUrl, taskId, query, detailLevel }) =>
      bridgeTool("get_task_summary", { taskId, query, detailLevel }, bridgeUrl),
  );

  server.registerTool(
    "get_live_today_schedule",
    {
      title: "Get live today's schedule",
      description: "Live-app read: compact schedule for one day from the running Electron app memory.",
      inputSchema: { ...liveListSchema },
    },
    async ({ bridgeUrl, date, includeCompleted, detailLevel }) =>
      bridgeTool("get_today_schedule", { date, includeCompleted, detailLevel }, bridgeUrl),
  );

  server.registerTool(
    "get_live_week_schedule",
    {
      title: "Get live week schedule",
      description: "Live-app read: compact week schedule from the running Electron app memory.",
      inputSchema: { ...liveListSchema },
    },
    async ({ bridgeUrl, weekDate, includeCompleted, detailLevel }) =>
      bridgeTool("get_week_schedule", { weekDate, includeCompleted, detailLevel }, bridgeUrl),
  );
}
