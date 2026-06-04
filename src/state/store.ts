import { createSampleState } from "../data/sampleProjects";
import type { AppState, Project, TaskPriority, TaskStatus, Todo, WorkLog, WorkLogType } from "../types";
import { getProjectColor } from "../utils/projectColor";
import { loadRawState, saveRawState } from "./storage";

type LegacyTodo = Partial<Todo> & {
  completed?: boolean;
};

type LegacyProject = Partial<Project> & {
  todos?: LegacyTodo[];
};

type LegacyWorkLog = Partial<WorkLog>;

type LegacyAppState = Partial<AppState> & {
  projects?: LegacyProject[];
  workLogs?: LegacyWorkLog[];
};

const TASK_STATUSES: TaskStatus[] = ["대기", "진행중", "미완", "완료", "보류"];
const TASK_PRIORITIES: TaskPriority[] = ["낮음", "보통", "높음", "최우선"];
const WORK_LOG_TYPES: WorkLogType[] = ["계획", "수행"];

let state = loadState();

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus);
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && TASK_PRIORITIES.includes(value as TaskPriority);
}

function isWorkLogType(value: unknown): value is WorkLogType {
  return typeof value === "string" && WORK_LOG_TYPES.includes(value as WorkLogType);
}

function normalizeProjectName(value: unknown): string {
  if (typeof value !== "string") {
    return "new project";
  }

  return value
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" - ") || "new project";
}

function normalizeClientName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim();
  if (trimmedValue.startsWith("KSOE")) {
    return "KSOE";
  }

  if (trimmedValue.startsWith("KATECH")) {
    return "KATECH";
  }

  return trimmedValue;
}

function normalizeProgress(value: unknown, completed: boolean): number {
  if (completed) {
    return 1;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function synchronizeTodoStatus(todo: Todo): Todo {
  if (todo.progress >= 1 || todo.status === "완료") {
    return {
      ...todo,
      completed: true,
      progress: 1,
      status: "완료",
    };
  }

  return {
    ...todo,
    completed: false,
  };
}

function normalizeTodo(todo: LegacyTodo, index: number): Todo {
  const completed = todo.completed === true;
  const progress = normalizeProgress(todo.progress, completed);
  const status = completed || progress >= 1 ? "완료" : isTaskStatus(todo.status) ? todo.status : "대기";

  return synchronizeTodoStatus({
    id: todo.id ?? `todo-${index}`,
    title: todo.title ?? "Untitled task",
    dueDate: todo.dueDate ?? null,
    estimate: todo.estimate ?? "",
    status,
    progress,
    workerComment: todo.workerComment ?? "",
    managerComment: todo.managerComment ?? "",
    issueRisk: todo.issueRisk ?? "",
    priority: isTaskPriority(todo.priority) ? todo.priority : "보통",
    memo: todo.memo ?? "",
    completed,
  });
}

function normalizeProject(project: LegacyProject, index: number): Project {
  return {
    id: project.id ?? `project-${index}`,
    name: normalizeProjectName(project.name),
    clientName: normalizeClientName(project.clientName),
    projectNumber: project.projectNumber ?? "",
    periodStart: project.periodStart ?? null,
    periodEnd: project.periodEnd ?? null,
    periodText: project.periodText ?? "",
    color: project.color ?? getProjectColor(index),
    todos: (project.todos ?? []).map(normalizeTodo),
  };
}

function normalizeWorkLog(workLog: LegacyWorkLog, index: number): WorkLog | null {
  const rawType = (workLog as { type?: unknown }).type;
  const type = rawType === undefined || rawType === null || rawType === "" ? "계획" : rawType;
  if (!isWorkLogType(type)) {
    return null;
  }

  return {
    id: workLog.id ?? `work-log-${index}`,
    projectId: workLog.projectId ?? "",
    todoId: workLog.todoId,
    date: workLog.date ?? new Date().toISOString().slice(0, 10),
    type,
    content: workLog.content ?? "",
  };
}

function migrateState(rawState: LegacyAppState): AppState {
  const projects = (rawState.projects ?? []).map(normalizeProject);
  const activeProjectId =
    rawState.activeProjectId && projects.some((project) => project.id === rawState.activeProjectId)
      ? rawState.activeProjectId
      : projects[0]?.id ?? null;

  return {
    projects,
    activeProjectId,
    workLogs: (rawState.workLogs ?? []).map(normalizeWorkLog).filter((workLog): workLog is WorkLog => workLog !== null),
  };
}

function loadState(): AppState {
  const rawState = loadRawState();
  if (!rawState) {
    return createSampleState();
  }

  try {
    return migrateState(JSON.parse(rawState) as LegacyAppState);
  } catch {
    return createSampleState();
  }
}

function saveState(): void {
  saveRawState(state);
}

function isImportableState(value: unknown): value is LegacyAppState {
  return typeof value === "object" && value !== null && Array.isArray((value as LegacyAppState).projects);
}

export function getState(): AppState {
  return state;
}

export function getActiveProject(): Project | undefined {
  return state.projects.find((project) => project.id === state.activeProjectId);
}

export function addProject(project: Project): void {
  state.projects.push(normalizeProject(project, state.projects.length));
  state.activeProjectId = project.id;
  saveState();
}

export function updateActiveProject(updates: Partial<Project>): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  if ("name" in updates) {
    updates.name = normalizeProjectName(updates.name);
  }

  if ("clientName" in updates) {
    updates.clientName = normalizeClientName(updates.clientName);
  }

  Object.assign(activeProject, updates);
  saveState();
}

export function updateActiveProjectColor(color: string): void {
  updateActiveProject({ color });
}

export function selectProject(projectId: string): void {
  state.activeProjectId = projectId;
  saveState();
}

export function reorderProjects(sourceProjectId: string, targetProjectId: string): void {
  if (sourceProjectId === targetProjectId) {
    return;
  }

  const sourceIndex = state.projects.findIndex((project) => project.id === sourceProjectId);
  const targetIndex = state.projects.findIndex((project) => project.id === targetProjectId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const [sourceProject] = state.projects.splice(sourceIndex, 1);
  state.projects.splice(targetIndex, 0, sourceProject);
  saveState();
}

export function deleteActiveProject(): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  state.projects = state.projects.filter((project) => project.id !== activeProject.id);
  state.activeProjectId = state.projects[0]?.id ?? null;
  state.workLogs = state.workLogs.filter((workLog) => workLog.projectId !== activeProject.id);
  saveState();
}

export function addTodo(todo: Todo): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  activeProject.todos.push(normalizeTodo(todo, activeProject.todos.length));
  saveState();
}

export function updateTodo(todoId: string, updates: Partial<Todo>): void {
  const activeProject = getActiveProject();
  const todoIndex = activeProject?.todos.findIndex((item) => item.id === todoId) ?? -1;
  if (!activeProject || todoIndex < 0) {
    return;
  }

  activeProject.todos[todoIndex] = normalizeTodo(
    {
      ...activeProject.todos[todoIndex],
      ...updates,
    },
    todoIndex,
  );
  saveState();
}

export function toggleTodo(todoId: string, completed: boolean): void {
  updateTodo(todoId, {
    completed,
    status: completed ? "완료" : "대기",
    progress: completed ? 1 : 0,
  });
}

export function deleteTodo(todoId: string): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  activeProject.todos = activeProject.todos.filter((todo) => todo.id !== todoId);
  state.workLogs = state.workLogs.filter((workLog) => workLog.todoId !== todoId);
  saveState();
}

export function addWorkLog(workLog: WorkLog): void {
  const normalizedWorkLog = normalizeWorkLog(workLog, state.workLogs.length);
  if (!normalizedWorkLog) {
    return;
  }

  state.workLogs.push(normalizedWorkLog);
  saveState();
}

export function updateWorkLog(workLogId: string, updates: Partial<WorkLog>): void {
  const workLogIndex = state.workLogs.findIndex((workLog) => workLog.id === workLogId);
  if (workLogIndex < 0) {
    return;
  }

  const normalizedWorkLog = normalizeWorkLog(
    {
      ...state.workLogs[workLogIndex],
      ...updates,
    },
    workLogIndex,
  );
  if (!normalizedWorkLog) {
    state.workLogs.splice(workLogIndex, 1);
  } else {
    state.workLogs[workLogIndex] = normalizedWorkLog;
  }
  saveState();
}

export function deleteWorkLog(workLogId: string): void {
  state.workLogs = state.workLogs.filter((workLog) => workLog.id !== workLogId);
  saveState();
}

export function exportStateJson(): string {
  return JSON.stringify(state, null, 2);
}

export function replaceState(rawState: unknown): boolean {
  if (!isImportableState(rawState)) {
    return false;
  }

  state = migrateState(rawState);
  saveState();
  return true;
}

export function resetStateToSampleData(): void {
  state = createSampleState();
  saveState();
}

export function importStateFromJson(json: string): boolean {
  try {
    return replaceState(JSON.parse(json));
  } catch {
    return false;
  }
}
