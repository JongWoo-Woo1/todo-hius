import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("hiusTodoFile", {
  openWorkspace: () => ipcRenderer.invoke("todo-workspace:open"),
  saveWorkspace: (state: unknown, workspacePath?: string) =>
    ipcRenderer.invoke("todo-workspace:save", state, workspacePath),
});
