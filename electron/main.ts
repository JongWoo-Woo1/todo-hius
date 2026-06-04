import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerTodoWorkspaceHandlers } from "./todoWorkspace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let isProjectDirty = false;
let saveRequestCount = 0;

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
          label: "Open Project",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            void openProjectFromMenu(mainWindow);
          },
        },
        {
          label: "Save Project",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            mainWindow.webContents.send("todo-workspace:menu-command", "save-project");
          },
        },
        {
          label: "Save Project As",
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
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
  ]);
}

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: "HIUS Todo",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  registerTodoWorkspaceHandlers(mainWindow);
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}

ipcMain.on("todo-workspace:set-dirty", (event, value: boolean) => {
  isProjectDirty = value;
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  if (mainWindow) {
    mainWindow.setTitle(`${value ? "* " : ""}HIUS Todo`);
  }
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
