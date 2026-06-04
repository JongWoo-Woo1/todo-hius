import { contextBridge, ipcRenderer } from "electron";

type MenuCommand = "open-project" | "save-project" | "save-project-as";

contextBridge.exposeInMainWorld("hiusTodoFile", {
  openDefaultWorkspace: () => ipcRenderer.invoke("todo-workspace:open-default"),
  openWorkspace: () => ipcRenderer.invoke("todo-workspace:open"),
  saveWorkspace: (state: unknown, workspacePath?: string) =>
    ipcRenderer.invoke("todo-workspace:save", state, workspacePath),
  saveWorkspaceAs: (state: unknown) => ipcRenderer.invoke("todo-workspace:save", state),
  setDirty: (isDirty: boolean) => ipcRenderer.send("todo-workspace:set-dirty", isDirty),
  onMenuCommand: (callback: (command: MenuCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: MenuCommand) => {
      callback(command);
    };
    ipcRenderer.on("todo-workspace:menu-command", listener);
    return () => {
      ipcRenderer.removeListener("todo-workspace:menu-command", listener);
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
