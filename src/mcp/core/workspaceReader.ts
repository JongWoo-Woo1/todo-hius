// Read-only `.todo` workspace reader for the MCP layer.
//
// Supports both workspace formats the app writes/opens:
//   - the current single-file ZIP container (manifest.json + projects/<id>.json), and
//   - the legacy folder-style ".todo + projects/" workspace.
//
// This intentionally does NOT depend on Electron (`app`/`dialog`/`ipcMain`) so it can run
// in a plain Node process (the MCP server / smoke test). The parsing mirrors the read side
// of electron/todoWorkspace.ts, and the resulting raw state is run through the app's own
// schema migration (store.migrateRawState) so MCP sees exactly the same AppState the app does.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { migrateRawState } from "../../state/store";
import type { AppState } from "./mcpTypes";

const TODO_ZIP_MANIFEST_FILE = "manifest.json";
const TODO_ZIP_PROJECTS_DIRECTORY = "projects";
const WORKSPACE_KIND = "hius.todo.workspace";
const PROJECT_KIND = "hius.todo.project";
const DEFAULT_WORKSPACE_DIRECTORY_NAME = "hius-dt-jw-todo";
const DEFAULT_WORKSPACE_FILE_NAME = "hius-dt-jw.todo";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJson(value: string, description: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid ${description}.`);
  }
}

function isZipWorkspaceBuffer(buffer: Buffer): boolean {
  // ZIP files start with the "PK" local-file-header magic.
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

type RawProjectFile = {
  project: unknown;
  workLogs?: unknown;
  events?: unknown;
};

function extractProjectFile(value: unknown, description: string): RawProjectFile {
  if (!isRecord(value) || value.kind !== PROJECT_KIND || !isRecord(value.project)) {
    throw new Error(`Invalid ${description}.`);
  }

  return {
    project: value.project,
    workLogs: Array.isArray(value.workLogs) ? value.workLogs : [],
    events: Array.isArray(value.events) ? value.events : [],
  };
}

// Assemble a raw (pre-migration) AppState-shaped object from parsed project files.
function rawStateFromProjectFiles(
  schemaVersion: number,
  activeProjectId: unknown,
  projectFiles: RawProjectFile[],
  manifestWorkLogs: unknown[] = [],
  manifestEvents: unknown[] = [],
): unknown {
  return {
    schemaVersion: schemaVersion === 2 ? 2 : 1,
    projects: projectFiles.map((projectFile) => projectFile.project),
    activeProjectId: typeof activeProjectId === "string" ? activeProjectId : null,
    workLogs: [
      ...manifestWorkLogs,
      ...projectFiles.flatMap((projectFile) => (Array.isArray(projectFile.workLogs) ? projectFile.workLogs : [])),
    ],
    events: [
      ...manifestEvents,
      ...projectFiles.flatMap((projectFile) => (Array.isArray(projectFile.events) ? projectFile.events : [])),
    ],
  };
}

async function readZipText(zip: JSZip, fileName: string): Promise<string> {
  const file = zip.file(fileName);
  if (!file) {
    throw new Error(`Missing ${fileName} in .todo workspace.`);
  }

  return file.async("string");
}

async function readZipWorkspace(workspaceBuffer: Buffer): Promise<unknown> {
  const zip = await JSZip.loadAsync(workspaceBuffer);
  const manifest = parseJson(await readZipText(zip, TODO_ZIP_MANIFEST_FILE), "ZIP manifest.json");
  if (!isRecord(manifest) || !Array.isArray(manifest.projectOrder)) {
    throw new Error("Invalid .todo ZIP manifest.");
  }

  const projectIds = manifest.projectOrder.filter((projectId): projectId is string => typeof projectId === "string");
  const projectFiles = await Promise.all(
    projectIds.map(async (projectId) => {
      const projectJson = await readZipText(zip, `${TODO_ZIP_PROJECTS_DIRECTORY}/${projectId}.json`);
      return extractProjectFile(parseJson(projectJson, `ZIP project ${projectId}`), `ZIP project ${projectId}`);
    }),
  );

  const schemaVersion = typeof manifest.schemaVersion === "number" ? manifest.schemaVersion : 1;
  return rawStateFromProjectFiles(schemaVersion, manifest.activeProjectId, projectFiles);
}

async function readLegacyWorkspace(workspacePath: string, workspaceContent: string): Promise<unknown> {
  const manifest = parseJson(workspaceContent, ".todo workspace file");
  if (!isRecord(manifest) || manifest.kind !== WORKSPACE_KIND || !Array.isArray(manifest.projectFiles)) {
    throw new Error("Invalid .todo workspace file.");
  }

  const workspaceDirectory = path.dirname(workspacePath);
  const projectFiles = await Promise.all(
    manifest.projectFiles
      .filter((projectFile): projectFile is string => typeof projectFile === "string")
      .map(async (projectFile) => {
        const projectFilePath = path.resolve(workspaceDirectory, projectFile);
        const projectData = parseJson(await fs.readFile(projectFilePath, "utf8"), `project file ${projectFile}`);
        return extractProjectFile(projectData, `project file ${projectFile}`);
      }),
  );

  const schemaVersion = typeof manifest.schemaVersion === "number" ? manifest.schemaVersion : 1;
  return rawStateFromProjectFiles(
    schemaVersion,
    manifest.activeProjectId,
    projectFiles,
    Array.isArray(manifest.workLogs) ? manifest.workLogs : [],
    Array.isArray(manifest.events) ? manifest.events : [],
  );
}

// Read a `.todo` workspace from disk and return the migrated AppState.
export async function readWorkspace(workspacePath: string): Promise<AppState> {
  const workspaceBuffer = await fs.readFile(workspacePath);
  const rawState = isZipWorkspaceBuffer(workspaceBuffer)
    ? await readZipWorkspace(workspaceBuffer)
    : await readLegacyWorkspace(workspacePath, workspaceBuffer.toString("utf8"));

  const state = migrateRawState(rawState);
  if (!state) {
    throw new Error(`The .todo workspace at "${workspacePath}" is not a valid HIUS Todo workspace.`);
  }

  return state;
}

// The development default workspace, relative to the repository root
// (<repo>/hius-dt-jw-todo/hius-dt-jw.todo). Used when no workspacePath is provided.
export function getDefaultWorkspacePath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(moduleDir, "../../..");
  return path.join(repoRoot, DEFAULT_WORKSPACE_DIRECTORY_NAME, DEFAULT_WORKSPACE_FILE_NAME);
}

// Resolve a possibly-undefined workspacePath to an absolute path, falling back to the
// development default workspace.
export function resolveWorkspacePath(workspacePath?: string | null): string {
  const candidate = workspacePath?.trim();
  if (candidate) {
    return path.resolve(candidate);
  }

  return getDefaultWorkspacePath();
}
