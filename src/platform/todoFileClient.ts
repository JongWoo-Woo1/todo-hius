import type { AppState } from "../types";

type TodoFileApi = NonNullable<Window["hiusTodoFile"]>;

export type TodoFileMenuCommand = Parameters<Parameters<TodoFileApi["onMenuCommand"]>[0]>[0];

function getTodoFileApi(): TodoFileApi | undefined {
  return window.hiusTodoFile;
}

function getRequiredTodoFileApi(): TodoFileApi {
  const api = getTodoFileApi();
  if (!api) {
    throw new Error("HIUS Todo file API is not available.");
  }

  return api;
}

export function isTodoFileClientAvailable(): boolean {
  return Boolean(getTodoFileApi());
}

export function openDefaultTodoWorkspace(): ReturnType<TodoFileApi["openDefaultWorkspace"]> {
  return getRequiredTodoFileApi().openDefaultWorkspace();
}

export function openTodoWorkspace(): ReturnType<TodoFileApi["openWorkspace"]> {
  return getRequiredTodoFileApi().openWorkspace();
}

export type RecentWorkspaceEntry = Awaited<ReturnType<TodoFileApi["listRecents"]>>["recents"][number];

export function openTodoWorkspacePath(workspacePath: string): ReturnType<TodoFileApi["openWorkspacePath"]> {
  return getRequiredTodoFileApi().openWorkspacePath(workspacePath);
}

export function getStartupTodoWorkspacePath(): ReturnType<TodoFileApi["getStartupWorkspacePath"]> {
  return getRequiredTodoFileApi().getStartupWorkspacePath();
}

export function listRecentTodoWorkspaces(): ReturnType<TodoFileApi["listRecents"]> {
  return getRequiredTodoFileApi().listRecents();
}

export function removeRecentTodoWorkspace(workspacePath: string): ReturnType<TodoFileApi["removeRecent"]> {
  return getRequiredTodoFileApi().removeRecent(workspacePath);
}

export function saveTodoWorkspace(
  state: AppState,
  workspacePath?: string,
): ReturnType<TodoFileApi["saveWorkspace"]> {
  return getRequiredTodoFileApi().saveWorkspace(state, workspacePath);
}

export function saveTodoWorkspaceAs(state: AppState): ReturnType<TodoFileApi["saveWorkspaceAs"]> {
  return getRequiredTodoFileApi().saveWorkspaceAs(state);
}

export function setTodoFileDirty(isDirty: boolean): void {
  getTodoFileApi()?.setDirty(isDirty);
}

export function publishTodoAppState(state: AppState): void {
  getTodoFileApi()?.publishAppState(state);
}

export function getLatestTodoAppState(): ReturnType<TodoFileApi["getLatestAppState"]> {
  return getRequiredTodoFileApi().getLatestAppState();
}

export function onTodoAppStateChange(
  callback: Parameters<TodoFileApi["onAppStateChange"]>[0],
): (() => void) | undefined {
  return getTodoFileApi()?.onAppStateChange(callback);
}

export function onTodoDirtyChange(callback: Parameters<TodoFileApi["onDirtyChange"]>[0]): (() => void) | undefined {
  return getTodoFileApi()?.onDirtyChange(callback);
}

export function openWorkspaceWindow(windowKey: string): ReturnType<TodoFileApi["openWorkspaceWindow"]> {
  return getRequiredTodoFileApi().openWorkspaceWindow(windowKey);
}

export function listWorkspaceWindows(): ReturnType<TodoFileApi["listWorkspaceWindows"]> {
  return getRequiredTodoFileApi().listWorkspaceWindows();
}

export function onWorkspaceWindowsChange(
  callback: Parameters<TodoFileApi["onWorkspaceWindowsChange"]>[0],
): (() => void) | undefined {
  return getTodoFileApi()?.onWorkspaceWindowsChange(callback);
}

export function onTodoFileMenuCommand(callback: (command: TodoFileMenuCommand) => void): (() => void) | undefined {
  return getTodoFileApi()?.onMenuCommand(callback);
}

export function onOpenTodoWorkspacePathRequest(
  callback: Parameters<TodoFileApi["onOpenWorkspacePathRequest"]>[0],
): (() => void) | undefined {
  return getTodoFileApi()?.onOpenWorkspacePathRequest(callback);
}

export function onTodoFileSaveRequest(callback: Parameters<TodoFileApi["onSaveRequest"]>[0]): (() => void) | undefined {
  return getTodoFileApi()?.onSaveRequest(callback);
}
