import { app, dialog, ipcMain, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
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
  type: string;
  content: string;
};

type AppState = {
  projects: Project[];
  activeProjectId: string | null;
  workLogs: WorkLog[];
};

type TodoWorkspaceManifest = {
  kind: "hius.todo.workspace";
  version: 1;
  name: string;
  activeProjectId: string | null;
  projectFiles: string[];
  workLogs?: WorkLog[];
};

type TodoProjectFile = {
  kind: "hius.todo.project";
  version: 1;
  project: Project;
  workLogs?: WorkLog[];
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

function sanitizeFileName(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim() || "untitled-project"
  );
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

async function openWorkspaceFile(workspacePath: string): Promise<AppState> {
  const manifest = await readJsonFile(workspacePath);
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

  return {
    projects: projectFiles.map((projectFile) => projectFile.project),
    activeProjectId: manifest.activeProjectId,
    workLogs: [
      ...(Array.isArray(manifest.workLogs) ? manifest.workLogs : []),
      ...projectFiles.flatMap((projectFile) => (Array.isArray(projectFile.workLogs) ? projectFile.workLogs : [])),
    ],
  };
}

async function saveWorkspaceFile(workspacePath: string, state: AppState): Promise<void> {
  const workspaceDirectory = path.dirname(workspacePath);
  const projectsDirectory = path.join(workspaceDirectory, "projects");
  const workspaceBaseName = path.basename(workspacePath);
  const saveId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const temporaryWorkspaceDirectory = path.join(workspaceDirectory, `.todo-save-${saveId}`);
  const temporaryProjectsDirectory = path.join(temporaryWorkspaceDirectory, "projects");
  const temporaryWorkspacePath = path.join(temporaryWorkspaceDirectory, workspaceBaseName);
  const backupProjectsDirectory = path.join(workspaceDirectory, `.projects-backup-${saveId}`);
  const usedFileNames = new Set<string>();
  const projectFiles: string[] = [];
  const workLogsByProjectId = new Map<string, WorkLog[]>();

  state.workLogs.forEach((workLog) => {
    const projectWorkLogs = workLogsByProjectId.get(workLog.projectId) ?? [];
    projectWorkLogs.push(workLog);
    workLogsByProjectId.set(workLog.projectId, projectWorkLogs);
  });

  await fs.rm(temporaryWorkspaceDirectory, { recursive: true, force: true });
  await fs.mkdir(temporaryProjectsDirectory, { recursive: true });

  for (const project of state.projects) {
    const baseFileName = sanitizeFileName(project.name);
    let fileName = `${baseFileName}.json`;
    let count = 1;
    while (usedFileNames.has(fileName.toLowerCase())) {
      fileName = `${baseFileName} ${count}.json`;
      count += 1;
    }
    usedFileNames.add(fileName.toLowerCase());

    const projectFile = path.join("projects", fileName);
    projectFiles.push(projectFile.replace(/\\/g, "/"));
    await writeJsonFile(path.join(temporaryWorkspaceDirectory, projectFile), {
      kind: PROJECT_KIND,
      version: 1,
      project,
      workLogs: workLogsByProjectId.get(project.id) ?? [],
    } satisfies TodoProjectFile);
  }

  const manifest: TodoWorkspaceManifest = {
    kind: WORKSPACE_KIND,
    version: 1,
    name: path.basename(workspacePath, ".todo"),
    activeProjectId: state.activeProjectId,
    projectFiles,
  };

  await writeJsonFile(temporaryWorkspacePath, manifest);

  const hadProjectsDirectory = await pathExists(projectsDirectory);

  try {
    if (hadProjectsDirectory) {
      await fs.rm(backupProjectsDirectory, { recursive: true, force: true });
      await fs.rename(projectsDirectory, backupProjectsDirectory);
    }

    await fs.rename(temporaryProjectsDirectory, projectsDirectory);
    await fs.copyFile(temporaryWorkspacePath, workspacePath);

    if (hadProjectsDirectory) {
      await fs.rm(backupProjectsDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    await fs.rm(projectsDirectory, { recursive: true, force: true });
    if (hadProjectsDirectory && (await pathExists(backupProjectsDirectory))) {
      await fs.rename(backupProjectsDirectory, projectsDirectory);
    }
    throw error;
  } finally {
    await fs.rm(temporaryWorkspaceDirectory, { recursive: true, force: true });
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
