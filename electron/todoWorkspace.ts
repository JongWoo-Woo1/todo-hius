import { dialog, ipcMain, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

type Todo = {
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
  color: string;
  todos: Todo[];
};

type WorkLog = {
  id: string;
  projectId: string;
  todoId?: string;
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
  workLogs: WorkLog[];
};

type TodoProjectFile = {
  kind: "hius.todo.project";
  version: 1;
  project: Project;
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

async function openWorkspaceFile(workspacePath: string): Promise<AppState> {
  const manifest = await readJsonFile(workspacePath);
  assertWorkspaceManifest(manifest);

  const workspaceDirectory = path.dirname(workspacePath);
  const projects = await Promise.all(
    manifest.projectFiles.map(async (projectFile) => {
      const projectFilePath = path.resolve(workspaceDirectory, projectFile);
      const projectData = await readJsonFile(projectFilePath);
      assertProjectFile(projectData);
      return projectData.project;
    }),
  );

  return {
    projects,
    activeProjectId: manifest.activeProjectId,
    workLogs: Array.isArray(manifest.workLogs) ? manifest.workLogs : [],
  };
}

async function saveWorkspaceFile(workspacePath: string, state: AppState): Promise<void> {
  const workspaceDirectory = path.dirname(workspacePath);
  const projectsDirectory = path.join(workspaceDirectory, "projects");
  const usedFileNames = new Set<string>();
  const projectFiles: string[] = [];

  await fs.mkdir(projectsDirectory, { recursive: true });

  for (const project of state.projects) {
    const baseFileName = sanitizeFileName(project.name);
    let fileName = `${baseFileName}.todo`;
    let count = 1;
    while (usedFileNames.has(fileName.toLowerCase())) {
      fileName = `${baseFileName} ${count}.todo`;
      count += 1;
    }
    usedFileNames.add(fileName.toLowerCase());

    const projectFile = path.join("projects", fileName);
    projectFiles.push(projectFile.replace(/\\/g, "/"));
    await writeJsonFile(path.join(workspaceDirectory, projectFile), {
      kind: PROJECT_KIND,
      version: 1,
      project,
    } satisfies TodoProjectFile);
  }

  const manifest: TodoWorkspaceManifest = {
    kind: WORKSPACE_KIND,
    version: 1,
    name: path.basename(workspacePath, ".todo"),
    activeProjectId: state.activeProjectId,
    projectFiles,
    workLogs: state.workLogs,
  };

  await writeJsonFile(workspacePath, manifest);
}

export function registerTodoWorkspaceHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle("todo-workspace:open", async (): Promise<OpenWorkspaceResult> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Open Todo Workspace",
      filters: [{ name: "HIUS Todo Workspace", extensions: ["todo"] }],
      properties: ["openFile"],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const workspacePath = result.filePaths[0];
    return {
      canceled: false,
      workspacePath,
      state: await openWorkspaceFile(workspacePath),
    };
  });

  ipcMain.handle(
    "todo-workspace:save",
    async (_event, state: AppState, requestedWorkspacePath?: string): Promise<SaveWorkspaceResult> => {
      let workspacePath = requestedWorkspacePath;

      if (!workspacePath) {
        const result = await dialog.showSaveDialog(mainWindow, {
          title: "Save Todo Workspace",
          defaultPath: DEFAULT_WORKSPACE_FILE_NAME,
          filters: [{ name: "HIUS Todo Workspace", extensions: ["todo"] }],
        });

        if (result.canceled || !result.filePath) {
          return { canceled: true };
        }

        workspacePath = result.filePath;
      }

      await saveWorkspaceFile(workspacePath, state);
      return {
        canceled: false,
        workspacePath,
      };
    },
  );
}
