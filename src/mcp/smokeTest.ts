// Smoke test for the MCP read-only core.
//
// Usage: npm.cmd run mcp:smoke -- "<path to .todo>"
// If no path is given, the development default workspace is used.
//
// Reads the workspace and prints project/task/event/workLog counts, the project list, and
// this week's schedule summary. This does not start the MCP server.

import { resolveWorkspacePath, readWorkspace } from "./core/workspaceReader";
import { listProjects } from "./core/workspaceQueries";
import { summarizeWeek } from "./core/scheduleSummary";

async function main(): Promise<void> {
  const workspacePath = resolveWorkspacePath(process.argv[2]);
  console.log(`Workspace: ${workspacePath}\n`);

  const state = await readWorkspace(workspacePath);

  const projectCount = state.projects.length;
  const taskCount = state.projects.reduce((total, project) => total + project.tasks.length, 0);
  const eventCount = state.events.length;
  const workLogCount = state.workLogs.length;

  console.log("== Counts ==");
  console.log(`projects : ${projectCount}`);
  console.log(`tasks    : ${taskCount}`);
  console.log(`events   : ${eventCount}`);
  console.log(`workLogs : ${workLogCount}`);

  console.log("\n== Projects ==");
  const projects = listProjects(state);
  if (projects.length === 0) {
    console.log("(none)");
  } else {
    for (const project of projects) {
      const client = project.clientName ? ` [${project.clientName}]` : "";
      console.log(`- ${project.name}${client}  (tasks ${project.taskCount}, open ${project.openTaskCount})`);
    }
  }

  console.log("\n== This week ==");
  console.log(summarizeWeek(state, new Date()));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
