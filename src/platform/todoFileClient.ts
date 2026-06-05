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

export function onTodoFileMenuCommand(callback: (command: TodoFileMenuCommand) => void): (() => void) | undefined {
  return getTodoFileApi()?.onMenuCommand(callback);
}

export function onTodoFileSaveRequest(callback: Parameters<TodoFileApi["onSaveRequest"]>[0]): (() => void) | undefined {
  return getTodoFileApi()?.onSaveRequest(callback);
}
