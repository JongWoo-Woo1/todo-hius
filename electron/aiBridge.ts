import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { ipcMain, type BrowserWindow } from "electron";

// Local HTTP bridge that lets an external process (the MCP server) drive the running app.
//
// Phase 2 / development "free mode": no auth, but the server only binds to 127.0.0.1 so it
// is not reachable from other machines. An HTTP request is forwarded to the main window's
// renderer over IPC; the renderer performs the action and replies, and that reply becomes
// the HTTP response. The chosen port is printed to the console and written to a port file
// so the MCP server can discover it.

const PORT_FILE = path.join(os.tmpdir(), "hius-todo-ai-bridge.json");
const ACTION_TIMEOUT_MS = 30_000;

type ActionResult = { ok: boolean; result?: unknown; error?: string };

const pendingActions = new Map<string, (result: ActionResult) => void>();
let requestCounter = 0;

function writePortFile(port: number): void {
  const payload = { port, pid: process.pid, startedAt: new Date().toISOString() };
  try {
    fs.writeFileSync(PORT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error("[ai-bridge] failed to write port file:", error);
  }
}

function removePortFile(): void {
  try {
    fs.rmSync(PORT_FILE, { force: true });
  } catch {
    // Best effort cleanup.
  }
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function dispatchAction(mainWindow: BrowserWindow, action: string, payload: unknown): Promise<ActionResult> {
  return new Promise((resolve) => {
    const requestId = `ai-${Date.now()}-${requestCounter++}`;
    const timeout = setTimeout(() => {
      if (pendingActions.delete(requestId)) {
        resolve({ ok: false, error: "Timed out waiting for the app to handle the action." });
      }
    }, ACTION_TIMEOUT_MS);

    pendingActions.set(requestId, (result) => {
      clearTimeout(timeout);
      resolve(result);
    });

    mainWindow.webContents.send("ai-action:request", requestId, action, payload);
  });
}

async function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  getMainWindow: () => BrowserWindow | null,
): Promise<void> {
  const url = req.url ?? "/";

  if (req.method === "GET" && (url === "/" || url === "/info")) {
    const mainWindow = getMainWindow();
    sendJson(res, 200, {
      ok: true,
      name: "hius-todo-ai-bridge",
      mode: "free",
      hasMainWindow: Boolean(mainWindow && !mainWindow.isDestroyed()),
    });
    return;
  }

  if (req.method === "POST" && url === "/action") {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      sendJson(res, 503, { ok: false, error: "No running HIUS Todo main window." });
      return;
    }

    let parsed: { action?: unknown; payload?: unknown };
    try {
      parsed = JSON.parse(await readRequestBody(req)) as { action?: unknown; payload?: unknown };
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
      return;
    }

    if (typeof parsed.action !== "string") {
      sendJson(res, 400, { ok: false, error: "Missing 'action'." });
      return;
    }

    const result = await dispatchAction(mainWindow, parsed.action, parsed.payload ?? {});
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found." });
}

export function startAiBridge(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.on("ai-action:result", (_event, requestId: string, result: ActionResult) => {
    const resolver = pendingActions.get(requestId);
    if (!resolver) {
      return;
    }

    pendingActions.delete(requestId);
    resolver(result && typeof result === "object" ? result : { ok: false, error: "Invalid action result." });
  });

  const server = http.createServer((req, res) => {
    void handleHttpRequest(req, res, getMainWindow).catch((error) => {
      console.error("[ai-bridge] request error:", error);
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: "Internal bridge error." });
      }
    });
  });

  server.on("error", (error) => {
    console.error("[ai-bridge] server error:", error);
  });

  // Port 0 lets the OS pick a free ephemeral port; 127.0.0.1 keeps it local-only.
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    writePortFile(port);
    console.log(`[ai-bridge] listening on http://127.0.0.1:${port} (free dev mode)`);
  });

  process.on("exit", removePortFile);
}
