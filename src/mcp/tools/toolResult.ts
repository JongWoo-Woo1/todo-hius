import { z } from "zod";
import { callBridgeAction } from "../core/bridgeClient";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function jsonResult(value: unknown, options: { pretty?: boolean } = {}): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, options.pretty === false ? undefined : 2) }] };
}

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

// Wrap a tool body so workspace read / bridge errors become a clean tool error instead of
// crashing the server.
export async function runTool(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run();
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

// Parse an optional YYYY-MM-DD argument into a local Date, defaulting to today.
export function parseDateArg(value?: string): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date();
}

export const bridgeUrlSchema = {
  bridgeUrl: z
    .string()
    .optional()
    .describe("Bridge base URL (http://127.0.0.1:PORT). Defaults to the running app's bridge via its port file."),
};

export async function bridgeTool(action: string, payload: Record<string, unknown>, bridgeUrl?: string): Promise<ToolResult> {
  return runTool(async () => {
    const response = await callBridgeAction(action, payload, bridgeUrl);
    if (!response.ok) {
      return errorResult(response.error ?? `Action "${action}" failed.`);
    }

    return jsonResult(response.result ?? { ok: true }, { pretty: false });
  });
}
