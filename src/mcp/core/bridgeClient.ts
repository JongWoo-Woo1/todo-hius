// Client for the running app's local AI control bridge (electron/aiBridge.ts).
//
// The bridge writes its chosen port to a well-known temp file; we read that to build the
// default bridge URL when one is not provided. Used by the MCP app-control tools and the
// bridge smoke test.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT_FILE = path.join(os.tmpdir(), "hius-todo-ai-bridge.json");

export type BridgeResponse = { ok: boolean; result?: unknown; error?: string };

// Resolve the bridge base URL: an explicit URL wins; otherwise read the port file the app
// wrote. Throws a helpful error when the app does not appear to be running.
export function resolveBridgeUrl(explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) {
    return trimmed.replace(/\/+$/, "");
  }

  let raw: string;
  try {
    raw = fs.readFileSync(PORT_FILE, "utf8");
  } catch {
    throw new Error(
      "Could not find the HIUS Todo bridge port file. Is the app running? Start it with `npm run dev:electron`.",
    );
  }

  const data = JSON.parse(raw) as { port?: unknown };
  if (typeof data.port !== "number") {
    throw new Error("The HIUS Todo bridge port file is invalid.");
  }

  return `http://127.0.0.1:${data.port}`;
}

export async function getBridgeInfo(bridgeUrl?: string): Promise<unknown> {
  const url = resolveBridgeUrl(bridgeUrl);
  const response = await fetch(`${url}/info`);
  return response.json();
}

export async function callBridgeAction(action: string, payload: unknown, bridgeUrl?: string): Promise<BridgeResponse> {
  const url = resolveBridgeUrl(bridgeUrl);
  const response = await fetch(`${url}/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });

  return (await response.json()) as BridgeResponse;
}
