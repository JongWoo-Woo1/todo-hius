import { contextBridge, ipcRenderer } from "electron";

type MenuCommand = "open-project" | "save-project" | "save-project-as";

contextBridge.exposeInMainWorld("hiusTodoFile", {
  openDefaultWorkspace: () => ipcRenderer.invoke("todo-workspace:open-default"),
  openWorkspace: () => ipcRenderer.invoke("todo-workspace:open"),
  openWorkspacePath: (workspacePath: string) => ipcRenderer.invoke("todo-workspace:open-path", workspacePath),
  getStartupWorkspacePath: () => ipcRenderer.invoke("todo-workspace:get-startup-path"),
  listRecents: () => ipcRenderer.invoke("todo-workspace:recents"),
  removeRecent: (workspacePath: string) => ipcRenderer.invoke("todo-workspace:remove-recent", workspacePath),
  saveWorkspace: (state: unknown, workspacePath?: string) =>
    ipcRenderer.invoke("todo-workspace:save", state, workspacePath),
  saveWorkspaceAs: (state: unknown) => ipcRenderer.invoke("todo-workspace:save", state),
  setDirty: (isDirty: boolean) => ipcRenderer.send("todo-workspace:set-dirty", isDirty),
  publishAppState: (state: unknown) => ipcRenderer.send("todo-state:publish", state),
  getLatestAppState: () => ipcRenderer.invoke("todo-state:get-latest"),
  onAppStateChange: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      callback(state);
    };
    ipcRenderer.on("todo-state:changed", listener);
    return () => {
      ipcRenderer.removeListener("todo-state:changed", listener);
    };
  },
  onDirtyChange: (callback: (isDirty: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isDirty: boolean) => {
      callback(isDirty);
    };
    ipcRenderer.on("todo-state:dirty-changed", listener);
    return () => {
      ipcRenderer.removeListener("todo-state:dirty-changed", listener);
    };
  },
  openWorkspaceWindow: (windowKey: string) => ipcRenderer.invoke("todo-workspace-window:open", windowKey),
  listWorkspaceWindows: () => ipcRenderer.invoke("todo-workspace-window:list"),
  onWorkspaceWindowsChange: (callback: (windowKeys: string[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, windowKeys: string[]) => {
      callback(windowKeys);
    };
    ipcRenderer.on("todo-workspace-window:keys-changed", listener);
    return () => {
      ipcRenderer.removeListener("todo-workspace-window:keys-changed", listener);
    };
  },
  onMenuCommand: (callback: (command: MenuCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: MenuCommand) => {
      callback(command);
    };
    ipcRenderer.on("todo-workspace:menu-command", listener);
    return () => {
      ipcRenderer.removeListener("todo-workspace:menu-command", listener);
    };
  },
  onOpenWorkspacePathRequest: (callback: (workspacePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, workspacePath: string) => {
      callback(workspacePath);
    };
    ipcRenderer.on("todo-workspace:open-path-request", listener);
    return () => {
      ipcRenderer.removeListener("todo-workspace:open-path-request", listener);
    };
  },
  onSaveRequest: (callback: (requestId: string, saveAs: boolean) => Promise<boolean>) => {
    const listener = async (_event: Electron.IpcRendererEvent, requestId: string, saveAs: boolean) => {
      const saved = await callback(requestId, saveAs);
      ipcRenderer.send("todo-workspace:save-response", requestId, saved);
    };
    ipcRenderer.on("todo-workspace:save-request", listener);
    return () => {
      ipcRenderer.removeListener("todo-workspace:save-request", listener);
    };
  },
});
