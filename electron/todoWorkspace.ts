import { app, dialog, ipcMain, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
import JSZip from "jszip";
import path from "node:path";

const RECENTS_FILE_NAME = "recent-workspaces.json";
const MAX_RECENTS = 10;

type RecentEntry = {
  path: string;
  name: string;
  exists: boolean;
};

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  estimate?: string;
  status: string;
  progress: number;
  workerComment?: string;
  managerComment?: string;
  issueRisk?: string;
  priority?: string;
  memo: string;
  completed: boolean;
};

type Project = {
  id: string;
  name: string;
  clientName: string;
  projectNumber?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  periodText?: string;
  periodStatus?: string;
  periodStartMonth?: string | null;
  periodEndMonth?: string | null;
  color: string;
  tasks: Task[];
  deletedTasks: Task[];
};

type WorkLog = {
  id: string;
  projectId: string;
  taskId?: string;
  linkedTaskTitleSnapshot?: string;
  linkedTaskDeleted?: boolean;
  date: string;
  endDate?: string | null;
  type: string;
  content: string;
};

type AppSchemaVersion = 1 | 2;

type ProjectEvent = {
  id: string;
  projectId: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  content: string;
  taskId?: string;
};

type AppState = {
  schemaVersion: AppSchemaVersion;
  projects: Project[];
  activeProjectId: string | null;
  workLogs: WorkLog[];
  events: ProjectEvent[];
};

type TodoWorkspaceManifest = {
  kind: "hius.todo.workspace";
  version: 1;
  schemaVersion?: AppSchemaVersion;
  name: string;
  activeProjectId: string | null;
  projectFiles: string[];
  workLogs?: WorkLog[];
  events?: ProjectEvent[];
};

type TodoZipManifest = {
  formatVersion: 1;
  appVersion: string;
  schemaVersion?: AppSchemaVersion;
  projectOrder: string[];
  activeProjectId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TodoProjectFile = {
  kind: "hius.todo.project";
  version: 1;
  schemaVersion?: AppSchemaVersion;
  project: Project;
  workLogs?: WorkLog[];
  events?: ProjectEvent[];
};

type OpenWorkspaceResult =
  | {
      canceled: true;
    }
  | {
      canceled: false;
      workspacePath: string;
      state: AppState;
    };

type SaveWorkspaceResult = {
  canceled: boolean;
  workspacePath?: string;
};

type DefaultWorkspaceResult =
  | {
      found: false;
      workspacePath: string;
    }
  | {
      found: true;
      workspacePath: string;
      state: AppState;
    };

type TodoWorkspacePaths = {
  defaultWorkspacePath: string;
};

const WORKSPACE_KIND = "hius.todo.workspace";
const PROJECT_KIND = "hius.todo.project";
const TODO_ZIP_FORMAT_VERSION = 1;
const TODO_ZIP_MANIFEST_FILE = "manifest.json";
const TODO_ZIP_PROJECTS_DIRECTORY = "projects";
const DEFAULT_WORKSPACE_FILE_NAME = "hius-dt-jw.todo";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertWorkspaceManifest(value: unknown): asserts value is TodoWorkspaceManifest {
  if (!isRecord(value) || value.kind !== WORKSPACE_KIND || !Array.isArray(value.projectFiles)) {
    throw new Error("Invalid .todo workspace file.");
  }
}

function assertProjectFile(value: unknown): asserts value is TodoProjectFile {
  if (!isRecord(value) || value.kind !== PROJECT_KIND || !isRecord(value.project)) {
    throw new Error("Invalid .todo project file.");
  }
}

function assertZipManifest(value: unknown): asserts value is TodoZipManifest {
  if (
    !isRecord(value) ||
    value.formatVersion !== TODO_ZIP_FORMAT_VERSION ||
    !Array.isArray(value.projectOrder) ||
    typeof value.activeProjectId !== "string" && value.activeProjectId !== null
  ) {
    throw new Error("Invalid .todo ZIP manifest.");
  }
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getRecentsFilePath(): string {
  return path.join(app.getPath("userData"), RECENTS_FILE_NAME);
}

async function readRecentPaths(): Promise<string[]> {
  try {
    const data = JSON.parse(await fs.readFile(getRecentsFilePath(), "utf8"));
    if (Array.isArray(data?.recents)) {
      return data.recents.filter((entry: unknown): entry is string => typeof entry === "string");
    }
  } catch {
    // No recents file yet (or unreadable) — start empty.
  }
  return [];
}

async function writeRecentPaths(recents: string[]): Promise<void> {
  const filePath = getRecentsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify({ recents }, null, 2)}\n`, "utf8");
}

async function addRecentWorkspace(workspacePath: string): Promise<void> {
  const normalized = path.resolve(workspacePath);
  const existing = await readRecentPaths();
  const deduped = existing.filter((entry) => path.resolve(entry).toLowerCase() !== normalized.toLowerCase());
  await writeRecentPaths([normalized, ...deduped].slice(0, MAX_RECENTS));
}

async function removeRecentWorkspace(workspacePath: string): Promise<void> {
  const normalized = path.resolve(workspacePath).toLowerCase();
  const existing = await readRecentPaths();
  await writeRecentPaths(existing.filter((entry) => path.resolve(entry).toLowerCase() !== normalized));
}

async function listRecentWorkspaces(): Promise<RecentEntry[]> {
  const recents = await readRecentPaths();
  return Promise.all(
    recents.map(async (entry) => ({
      path: entry,
      name: path.basename(entry, ".todo"),
      exists: await pathExists(entry),
    })),
  );
}

function parseJson(value: string, description: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid ${description}.`);
  }
}

function isZipWorkspaceBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }

  return buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function createProjectFile(project: Project, workLogs: WorkLog[], events: ProjectEvent[]): TodoProjectFile {
  return {
    kind: PROJECT_KIND,
    version: 1,
    schemaVersion: 2,
    project,
    workLogs,
    events,
  };
}

function stateFromProjectFiles(
  schemaVersion: AppSchemaVersion,
  activeProjectId: string | null,
  projectFiles: TodoProjectFile[],
  manifestWorkLogs: WorkLog[] = [],
  manifestEvents: ProjectEvent[] = [],
): AppState {
  return {
    schemaVersion,
    projects: projectFiles.map((projectFile) => projectFile.project),
    activeProjectId,
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

async function openLegacyWorkspaceFile(workspacePath: string, workspaceContent: string): Promise<AppState> {
  const manifest = parseJson(workspaceContent, ".todo workspace file");
  assertWorkspaceManifest(manifest);

  const workspaceDirectory = path.dirname(workspacePath);
  const projectFiles = await Promise.all(
    manifest.projectFiles.map(async (projectFile) => {
      const projectFilePath = path.resolve(workspaceDirectory, projectFile);
      const projectData = await readJsonFile(projectFilePath);
      assertProjectFile(projectData);
      return projectData;
    }),
  );

  return stateFromProjectFiles(
    manifest.schemaVersion === 2 ? 2 : 1,
    manifest.activeProjectId,
    projectFiles,
    Array.isArray(manifest.workLogs) ? manifest.workLogs : [],
    Array.isArray(manifest.events) ? manifest.events : [],
  );
}

async function readZipText(zip: JSZip, fileName: string): Promise<string> {
  const file = zip.file(fileName);
  if (!file) {
    throw new Error(`Missing ${fileName} in .todo workspace.`);
  }

  return file.async("string");
}

async function openZipWorkspaceFile(workspaceBuffer: Buffer): Promise<AppState> {
  const zip = await JSZip.loadAsync(workspaceBuffer);
  const manifestData = parseJson(await readZipText(zip, TODO_ZIP_MANIFEST_FILE), "ZIP manifest.json");
  assertZipManifest(manifestData);

  const projectIds = manifestData.projectOrder.filter((projectId): projectId is string => typeof projectId === "string");
  const projectFiles = await Promise.all(
    projectIds.map(async (projectId) => {
      const projectJson = await readZipText(zip, `${TODO_ZIP_PROJECTS_DIRECTORY}/${projectId}.json`);
      const projectData = parseJson(projectJson, `ZIP project ${projectId}`);
      assertProjectFile(projectData);
      return projectData;
    }),
  );

  return stateFromProjectFiles(manifestData.schemaVersion === 2 ? 2 : 1, manifestData.activeProjectId, projectFiles);
}

async function openWorkspaceFile(workspacePath: string): Promise<AppState> {
  const workspaceBuffer = await fs.readFile(workspacePath);

  if (isZipWorkspaceBuffer(workspaceBuffer)) {
    return openZipWorkspaceFile(workspaceBuffer);
  }

  return openLegacyWorkspaceFile(workspacePath, workspaceBuffer.toString("utf8"));
}

function groupWorkspaceItemsByProject(state: AppState): {
  workLogsByProjectId: Map<string, WorkLog[]>;
  eventsByProjectId: Map<string, ProjectEvent[]>;
} {
  const workLogsByProjectId = new Map<string, WorkLog[]>();
  const eventsByProjectId = new Map<string, ProjectEvent[]>();

  (state.workLogs ?? []).forEach((workLog) => {
    const projectWorkLogs = workLogsByProjectId.get(workLog.projectId) ?? [];
    projectWorkLogs.push(workLog);
    workLogsByProjectId.set(workLog.projectId, projectWorkLogs);
  });

  (state.events ?? []).forEach((event) => {
    const projectEvents = eventsByProjectId.get(event.projectId) ?? [];
    projectEvents.push(event);
    eventsByProjectId.set(event.projectId, projectEvents);
  });

  return { workLogsByProjectId, eventsByProjectId };
}

async function readExistingZipCreatedAt(workspacePath: string): Promise<string | null> {
  try {
    const buffer = await fs.readFile(workspacePath);
    if (!isZipWorkspaceBuffer(buffer)) {
      return null;
    }

    const zip = await JSZip.loadAsync(buffer);
    const manifest = parseJson(await readZipText(zip, TODO_ZIP_MANIFEST_FILE), "ZIP manifest.json");
    if (isRecord(manifest) && typeof manifest.createdAt === "string") {
      return manifest.createdAt;
    }
  } catch {
    // Legacy or unreadable files get a fresh container timestamp on the next successful save.
  }

  return null;
}

async function replaceFileWithTemporary(workspacePath: string, temporaryWorkspacePath: string): Promise<void> {
  const backupWorkspacePath = `${workspacePath}.bak-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const hadWorkspaceFile = await pathExists(workspacePath);

  try {
    if (hadWorkspaceFile) {
      await fs.rename(workspacePath, backupWorkspacePath);
    }

    await fs.rename(temporaryWorkspacePath, workspacePath);

    if (hadWorkspaceFile) {
      await fs.rm(backupWorkspacePath, { force: true });
    }
  } catch (error) {
    await fs.rm(workspacePath, { force: true });
    if (hadWorkspaceFile && (await pathExists(backupWorkspacePath))) {
      await fs.rename(backupWorkspacePath, workspacePath);
    }
    throw error;
  } finally {
    await fs.rm(temporaryWorkspacePath, { force: true });
  }
}

async function saveWorkspaceFile(workspacePath: string, state: AppState): Promise<void> {
  const now = new Date().toISOString();
  const createdAt = (await readExistingZipCreatedAt(workspacePath)) ?? now;
  const zip = new JSZip();
  const { workLogsByProjectId, eventsByProjectId } = groupWorkspaceItemsByProject(state);
  const manifest: TodoZipManifest = {
    formatVersion: TODO_ZIP_FORMAT_VERSION,
    appVersion: app.getVersion(),
    schemaVersion: 2,
    projectOrder: state.projects.map((project) => project.id),
    activeProjectId: state.activeProjectId,
    createdAt,
    updatedAt: now,
  };

  zip.file(TODO_ZIP_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const project of state.projects) {
    const projectFile = createProjectFile(
      project,
      workLogsByProjectId.get(project.id) ?? [],
      eventsByProjectId.get(project.id) ?? [],
    );
    zip.file(`${TODO_ZIP_PROJECTS_DIRECTORY}/${project.id}.json`, `${JSON.stringify(projectFile, null, 2)}\n`);
  }

  const temporaryWorkspacePath = `${workspacePath}.tmp`;
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  await fs.mkdir(path.dirname(workspacePath), { recursive: true });
  await fs.rm(temporaryWorkspacePath, { force: true });
  await fs.writeFile(temporaryWorkspacePath, zipBuffer);
  try {
    await replaceFileWithTemporary(workspacePath, temporaryWorkspacePath);
  } finally {
    await fs.rm(temporaryWorkspacePath, { force: true });
  }
}

export function registerTodoWorkspaceHandlers(mainWindow: BrowserWindow, paths: TodoWorkspacePaths): void {
  ipcMain.handle("todo-workspace:open-default", async (): Promise<DefaultWorkspaceResult> => {
    try {
      await fs.access(paths.defaultWorkspacePath);
      return {
        found: true,
        workspacePath: paths.defaultWorkspacePath,
        state: await openWorkspaceFile(paths.defaultWorkspacePath),
      };
    } catch {
      return {
        found: false,
        workspacePath: paths.defaultWorkspacePath,
      };
    }
  });

  ipcMain.handle("todo-workspace:open", async (): Promise<OpenWorkspaceResult> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Open",
      filters: [{ name: "HIUS Todo Workspace", extensions: ["todo"] }],
      properties: ["openFile"],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const workspacePath = result.filePaths[0];
    const state = await openWorkspaceFile(workspacePath);
    await addRecentWorkspace(workspacePath);
    return {
      canceled: false,
      workspacePath,
      state,
    };
  });

  ipcMain.handle("todo-workspace:open-path", async (_event, workspacePath: string): Promise<OpenWorkspaceResult> => {
    if (!workspacePath || !(await pathExists(workspacePath))) {
      await removeRecentWorkspace(workspacePath);
      return { canceled: true };
    }

    try {
      const state = await openWorkspaceFile(workspacePath);
      await addRecentWorkspace(workspacePath);
      return { canceled: false, workspacePath, state };
    } catch {
      await removeRecentWorkspace(workspacePath);
      return { canceled: true };
    }
  });

  ipcMain.handle("todo-workspace:recents", async (): Promise<{ recents: RecentEntry[] }> => {
    return { recents: await listRecentWorkspaces() };
  });

  ipcMain.handle("todo-workspace:remove-recent", async (_event, workspacePath: string): Promise<{ recents: RecentEntry[] }> => {
    await removeRecentWorkspace(workspacePath);
    return { recents: await listRecentWorkspaces() };
  });

  ipcMain.handle(
    "todo-workspace:save",
    async (_event, state: AppState, requestedWorkspacePath?: string): Promise<SaveWorkspaceResult> => {
      let workspacePath = requestedWorkspacePath;

      if (!workspacePath) {
        const result = await dialog.showSaveDialog(mainWindow, {
          title: "Save As",
          defaultPath: requestedWorkspacePath ?? paths.defaultWorkspacePath,
          filters: [{ name: "HIUS Todo Workspace", extensions: ["todo"] }],
        });

        if (result.canceled || !result.filePath) {
          return { canceled: true };
        }

        workspacePath = result.filePath;
      }

      await saveWorkspaceFile(workspacePath, state);
      await addRecentWorkspace(workspacePath);
      return {
        canceled: false,
        workspacePath,
      };
    },
  );
}
