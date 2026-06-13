// Smoke test for the AI control bridge (phase 2).
//
// Usage: npm.cmd run mcp:bridge-test  (with the app running via `npm.cmd run dev:electron`)
//
// Verifies the bridge connection, then drives the running app: navigate to Calendar, open a
// Feed window, create one test task and one test event. The task/event target the active
// project, so make sure a workspace with at least one project is open in the app.

import { callBridgeAction, getBridgeInfo } from "./core/bridgeClient";

function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function show(label: string, value: unknown): void {
  console.log(`\n# ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

async function main(): Promise<void> {
  show("bridge info", await getBridgeInfo());

  show("navigate_to_view calendar", await callBridgeAction("navigate_to_view", { view: "calendar" }));

  show("open_workspace_window feed", await callBridgeAction("open_workspace_window", { view: "feed" }));

  show(
    "create_task",
    await callBridgeAction("create_task", {
      title: "MCP 브리지 테스트 업무",
      dueDate: today(),
      priority: "보통",
      memo: "created by mcp:bridge-test",
    }),
  );

  show(
    "create_event",
    await callBridgeAction("create_event", {
      title: "MCP 브리지 테스트 일정",
      startDate: today(),
      content: "created by mcp:bridge-test",
    }),
  );

  console.log("\nDone.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
