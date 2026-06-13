// HIUS Todo stdio MCP server.
//
// Tool groups:
// - Live-state tools read the running Electron app memory through the local AI bridge.
// - App-control tools drive navigation and create actions through the local AI bridge.
//
// IMPORTANT: stdout is reserved for the MCP protocol. Never console.log to stdout here; use
// console.error (stderr) for any diagnostics.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAppControlTools } from "./tools/appControlTools";
import { registerLiveTools } from "./tools/liveTools";

const SERVER_NAME = "hius-todo";
const SERVER_VERSION = "0.1.0";

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
registerLiveTools(server);
registerAppControlTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} MCP server v${SERVER_VERSION} ready (stdio).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
