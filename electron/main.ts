import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerTodoWorkspaceHandlers } from "./todoWorkspace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const DEFAULT_WORKSPACE_FILE_NAME = "hius-dt-jw.todo";
const DEVELOPMENT_WORKSPACE_DIRECTORY_NAME = "hius-dt-jw-todo";
const PACKAGED_WORKSPACE_DIRECTORY_NAME = "HIUS Todo";
const MAIN_WINDOW_WIDTH = 1400;
const MAIN_WINDOW_MIN_WIDTH = 1400;
const MAIN_WINDOW_MIN_HEIGHT = 900;
const MAIN_WINDOW_HEIGHT = MAIN_WINDOW_MIN_HEIGHT;
const SIDEBAR_WIDTH = 280;
const WORKSPACE_WINDOW_MIN_WIDTH = MAIN_WINDOW_MIN_WIDTH - SIDEBAR_WIDTH;
const WORKSPACE_WINDOW_MIN_HEIGHT = MAIN_WINDOW_MIN_HEIGHT;
const WORKSPACE_WINDOW_WIDTH = WORKSPACE_WINDOW_MIN_WIDTH;
const WORKSPACE_WINDOW_HEIGHT = WORKSPACE_WINDOW_MIN_HEIGHT;
const MIN_RENDERER_ZOOM_FACTOR = 0.25;
const MAX_RENDERER_ZOOM_FACTOR = 1;
let isProjectDirty = false;
let saveRequestCount = 0;
let mainWindowRef: BrowserWindow | null = null;
let latestAppState: unknown = null;
let startupWorkspacePath: string | null = findTodoWorkspacePath(process.argv);
const workspaceWindows = new Map<string, BrowserWindow>();

function getManagedWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
}

function getWindowBaseTitle(window: BrowserWindow): string {
  return window.getTitle().replace(/^\*\s+/, "");
}

function updateDirtyState(value: boolean): void {
  isProjectDirty = value;
  getManagedWindows().forEach((window) => {
    window.setTitle(`${value ? "* " : ""}${getWindowBaseTitle(window)}`);
    window.webContents.send("todo-state:dirty-changed", value);
  });
}

function getWorkspaceWindowKeys(): string[] {
  return Array.from(workspaceWindows.keys());
}

function sendWorkspaceWindowKeys(): void {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) {
    return;
  }

  mainWindowRef.webContents.send("todo-workspace-window:keys-changed", getWorkspaceWindowKeys());
}

function broadcastAppState(state: unknown, sourceWebContentsId?: number): void {
  latestAppState = state;
  getManagedWindows().forEach((window) => {
    if (window.webContents.id === sourceWebContentsId) {
      return;
    }

    window.webContents.send("todo-state:changed", state);
  });
}

function normalizeArgPath(value: string): string {
  return value.trim().replace(/^"|"$/g, "");
}

function findTodoWorkspacePath(argv: string[]): string | null {
  const todoPath = argv
    .map(normalizeArgPath)
    .find((value) => path.extname(value).toLowerCase() === ".todo");

  return todoPath ?? null;
}

function focusMainWindow(): BrowserWindow | null {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) {
    return null;
  }

  if (mainWindowRef.isMinimized()) {
    mainWindowRef.restore();
  } else {
    mainWindowRef.show();
  }

  mainWindowRef.focus();
  return mainWindowRef;
}

async function requestOpenWorkspacePath(workspacePath: string): Promise<void> {
  const mainWindow = focusMainWindow();
  if (!mainWindow) {
    startupWorkspacePath = workspacePath;
    return;
  }

  const canContinue = await confirmUnsavedChanges(mainWindow);
  if (!canContinue) {
    return;
  }

  mainWindow.webContents.send("todo-workspace:open-path-request", workspacePath);
}

function isValidWorkspaceWindowKey(windowKey: string): boolean {
  return (
    windowKey === "view:calendar" ||
    windowKey === "view:feed" ||
    windowKey === "view:weekly" ||
    windowKey === "view:ledger" ||
    (windowKey.startsWith("project:") && windowKey.length > "project:".length)
  );
}

function getWorkspaceWindowInitialTitle(windowKey: string): string {
  if (windowKey === "view:calendar") {
    return "HIUS Todo - Calendar";
  }

  if (windowKey === "view:feed") {
    return "HIUS Todo - Feed";
  }

  if (windowKey === "view:weekly") {
    return "HIUS Todo - Weekly";
  }

  if (windowKey === "view:ledger") {
    return "HIUS Todo - Ledger";
  }

  return "HIUS Todo - Project";
}

function getDefaultRendererZoomFactor(window: BrowserWindow): number {
  if (!app.isPackaged) {
    return 1;
  }

  const scaleFactor = screen.getDisplayMatching(window.getBounds()).scaleFactor || 1;
  return Math.min(MAX_RENDERER_ZOOM_FACTOR, Math.max(MIN_RENDERER_ZOOM_FACTOR, 1 / scaleFactor));
}

function setDefaultRendererZoom(window: BrowserWindow): void {
  window.webContents.setZoomFactor(getDefaultRendererZoomFactor(window));
}

function applyDefaultWebContentsScale(window: BrowserWindow): void {
  setDefaultRendererZoom(window);
  window.webContents.on("did-finish-load", () => {
    setDefaultRendererZoom(window);
  });

  window.on("move", () => {
    setDefaultRendererZoom(window);
  });

  window.on("resize", () => {
    setDefaultRendererZoom(window);
  });
}

async function loadWorkspaceWindow(window: BrowserWindow, windowKey: string): Promise<void> {
  if (devServerUrl) {
    const url = new URL(devServerUrl);
    url.searchParams.set("windowKey", windowKey);
    await window.loadURL(url.toString());
    return;
  }

  await window.loadFile(path.join(__dirname, "../renderer/index.html"), {
    query: { windowKey },
  });
}

async function openWorkspaceWindow(windowKey: string): Promise<string[]> {
  if (!isValidWorkspaceWindowKey(windowKey)) {
    throw new Error(`Invalid workspace window key: ${windowKey}`);
  }

  const existingWindow = workspaceWindows.get(windowKey);
  if (existingWindow && !existingWindow.isDestroyed()) {
    if (existingWindow.isMinimized()) {
      existingWindow.restore();
    } else {
      existingWindow.show();
    }
    existingWindow.focus();
    return getWorkspaceWindowKeys();
  }

  workspaceWindows.delete(windowKey);

  const childWindow = new BrowserWindow({
    width: WORKSPACE_WINDOW_WIDTH,
    height: WORKSPACE_WINDOW_HEIGHT,
    minWidth: WORKSPACE_WINDOW_MIN_WIDTH,
    minHeight: WORKSPACE_WINDOW_MIN_HEIGHT,
    parent: mainWindowRef && !mainWindowRef.isDestroyed() ? mainWindowRef : undefined,
    modal: false,
    minimizable: true,
    title: getWorkspaceWindowInitialTitle(windowKey),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--hius-window-key=${windowKey}`],
    },
  });

  applyDefaultWebContentsScale(childWindow);
  workspaceWindows.set(windowKey, childWindow);
  sendWorkspaceWindowKeys();

  childWindow.once("ready-to-show", () => {
    childWindow.show();
    childWindow.focus();
  });

  childWindow.on("closed", () => {
    if (workspaceWindows.get(windowKey) === childWindow) {
      workspaceWindows.delete(windowKey);
      sendWorkspaceWindowKeys();
    }
  });

  childWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await loadWorkspaceWindow(childWindow, windowKey);
  return getWorkspaceWindowKeys();
}

function getDefaultWorkspacePath(): string {
  if (!app.isPackaged) {
    return path.resolve(app.getAppPath(), DEVELOPMENT_WORKSPACE_DIRECTORY_NAME, DEFAULT_WORKSPACE_FILE_NAME);
  }

  const documentsPath = app.getPath("documents") || app.getPath("userData");
  return path.join(documentsPath, PACKAGED_WORKSPACE_DIRECTORY_NAME, DEFAULT_WORKSPACE_FILE_NAME);
}

function requestRendererSave(mainWindow: BrowserWindow, saveAs: boolean): Promise<boolean> {
  const requestId = `save-${Date.now()}-${saveRequestCount}`;
  saveRequestCount += 1;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ipcMain.removeListener("todo-workspace:save-response", onResponse);
      resolve(false);
    }, 30_000);

    function onResponse(_event: Electron.IpcMainEvent, responseRequestId: string, saved: boolean): void {
      if (responseRequestId !== requestId) {
        return;
      }

      clearTimeout(timeout);
      ipcMain.removeListener("todo-workspace:save-response", onResponse);
      resolve(saved);
    }

    ipcMain.on("todo-workspace:save-response", onResponse);
    mainWindow.webContents.send("todo-workspace:save-request", requestId, saveAs);
  });
}

async function confirmUnsavedChanges(mainWindow: BrowserWindow): Promise<boolean> {
  if (!isProjectDirty) {
    return true;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Unsaved Project",
    message: "Save changes before closing?",
    detail: "Your project has unsaved changes.",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });

  if (result.response === 2) {
    return false;
  }

  if (result.response === 1) {
    return true;
  }

  return requestRendererSave(mainWindow, false);
}

async function openProjectFromMenu(mainWindow: BrowserWindow): Promise<void> {
  const canContinue = await confirmUnsavedChanges(mainWindow);
  if (!canContinue) {
    return;
  }

  mainWindow.webContents.send("todo-workspace:menu-command", "open-project");
}

function createAppMenu(mainWindow: BrowserWindow): Menu {
  return Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Open",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            void openProjectFromMenu(mainWindow);
          },
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            mainWindow.webContents.send("todo-workspace:menu-command", "save-project");
          },
        },
        {
          label: "Save As",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => {
            mainWindow.webContents.send("todo-workspace:menu-command", "save-project-as");
          },
        },
        { type: "separator" },
        {
          label: "Exit",
          role: process.platform === "darwin" ? "close" : "quit",
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Reset Zoom",
          accelerator: "CmdOrCtrl+0",
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              setDefaultRendererZoom(focusedWindow);
            }
          },
        },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
  ]);
}

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_HEIGHT,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    title: "HIUS Todo",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindowRef = mainWindow;
  applyDefaultWebContentsScale(mainWindow);

  registerTodoWorkspaceHandlers(mainWindow, {
    defaultWorkspacePath: getDefaultWorkspacePath(),
  });
  Menu.setApplicationMenu(createAppMenu(mainWindow));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (event) => {
    if (!isProjectDirty) {
      return;
    }

    event.preventDefault();
    void confirmUnsavedChanges(mainWindow).then((canClose) => {
      if (canClose) {
        isProjectDirty = false;
        mainWindow.close();
      }
    });
  });

  mainWindow.on("closed", () => {
    mainWindowRef = null;
    workspaceWindows.forEach((workspaceWindow) => {
      if (!workspaceWindow.isDestroyed()) {
        workspaceWindow.close();
      }
    });
    workspaceWindows.clear();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

ipcMain.on("todo-workspace:set-dirty", (event, value: boolean) => {
  updateDirtyState(value);
});

ipcMain.on("todo-state:publish", (event, state: unknown) => {
  broadcastAppState(state, event.sender.id);
});

ipcMain.handle("todo-state:get-latest", () => {
  return latestAppState;
});

ipcMain.handle("todo-workspace:get-startup-path", () => {
  const workspacePath = startupWorkspacePath;
  startupWorkspacePath = null;
  return workspacePath;
});

ipcMain.handle("todo-workspace-window:open", async (_event, windowKey: string) => {
  return openWorkspaceWindow(windowKey);
});

ipcMain.handle("todo-workspace-window:list", () => {
  return getWorkspaceWindowKeys();
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const workspacePath = findTodoWorkspacePath(argv);
    if (workspacePath) {
      void requestOpenWorkspacePath(workspacePath);
      return;
    }

    focusMainWindow();
  });

  app.whenReady().then(() => {
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
