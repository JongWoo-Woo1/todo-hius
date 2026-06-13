import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";

const BRIDGE_TEST_TEMPLATE_FILE_NAME = "empty-project-workspace.todo";
const BRIDGE_TEST_WORKSPACE_FILE_NAME = "hius-todo-bridge-test.todo";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getBridgeTestTemplatePath(): Promise<string> {
  const candidates = app.isPackaged
    ? [path.resolve(process.resourcesPath, "public", "templates", BRIDGE_TEST_TEMPLATE_FILE_NAME)]
    : [
        path.resolve(process.cwd(), "public", "templates", BRIDGE_TEST_TEMPLATE_FILE_NAME),
        path.resolve(moduleDir, "..", "..", "public", "templates", BRIDGE_TEST_TEMPLATE_FILE_NAME),
      ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Bridge test workspace template not found: ${BRIDGE_TEST_TEMPLATE_FILE_NAME}`);
}

export async function prepareBridgeTestWorkspace(): Promise<string> {
  const templatePath = await getBridgeTestTemplatePath();
  const workspacePath = path.join(os.tmpdir(), BRIDGE_TEST_WORKSPACE_FILE_NAME);
  await fs.copyFile(templatePath, workspacePath);
  return workspacePath;
}
