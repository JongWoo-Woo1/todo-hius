import type {
  AppState,
  AppSchemaVersion,
  Project,
  ProjectEvent,
  ProjectPeriodStatus,
  Task,
  TaskPriority,
  TaskStatus,
  WorkLog,
  WorkLogType,
} from "../types";
import { getProjectColor } from "../utils/projectColor";

const CURRENT_SCHEMA_VERSION: AppSchemaVersion = 2;

function createEmptyState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: [],
    activeProjectId: null,
    workLogs: [],
    events: [],
  };
}

type LegacyTask = Partial<Omit<Task, "status">> & {
  status?: unknown;
  completed?: boolean;
};

// `todos` is the legacy serialization key (renamed to `tasks`); both are read for back-compat.
type LegacyProject = Partial<Omit<Project, "tasks" | "deletedTasks">> & {
  tasks?: LegacyTask[];
  todos?: LegacyTask[];
  deletedTasks?: LegacyTask[];
};

// `todoId` is the legacy serialization key (renamed to `taskId`); both are read for back-compat.
type LegacyWorkLog = Partial<WorkLog> & {
  todoId?: string;
};

type LegacyProjectEvent = Partial<ProjectEvent>;

type LegacyAppState = Partial<AppState> & {
  schemaVersion?: unknown;
  projects?: LegacyProject[];
  workLogs?: LegacyWorkLog[];
  events?: LegacyProjectEvent[];
};

const TASK_STATUSES: TaskStatus[] = ["대기", "진행중", "검토대기", "완료"];
const TASK_PRIORITIES: TaskPriority[] = ["낮음", "보통", "높음", "최우선"];
const WORK_LOG_TYPES: WorkLogType[] = ["계획", "수행"];
const PROJECT_PERIOD_STATUSES: ProjectPeriodStatus[] = ["대기", "연도월"];
const AI_SHIP_PROJECT_ID = "project-uipa-ai-ship";
const MERGED_AI_SHIP_PROJECT_IDS = new Set([AI_SHIP_PROJECT_ID, "project-ksoe-ai-ship"]);
const REMOVED_PROJECT_IDS = new Set(["project-hd-grc-ni-seminar"]);

let state = createEmptyState();
let stateChangeListener: (() => void) | null = null;

function normalizeTaskStatus(value: unknown): TaskStatus {
  if (value === "미완" || value === "보류") {
    return "대기";
  }

  return typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : "대기";
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

function isProjectPeriodStatus(value: unknown): value is ProjectPeriodStatus {
  return typeof value === "string" && PROJECT_PERIOD_STATUSES.includes(value as ProjectPeriodStatus);
}

function normalizeProjectPeriodMonth(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{2}|\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (!match) {
    return null;
  }

  const rawYear = match[1];
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const month = match[2].padStart(2, "0");
  return `${year}-${month}`;
}

function parseProjectPeriodText(value: unknown): {
  status: ProjectPeriodStatus;
  startMonth: string | null;
  endMonth: string | null;
} | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue === "대기") {
    return { status: "대기", startMonth: null, endMonth: null };
  }

  const rangeMatch = trimmedValue.match(/^(?:(\d{2}|\d{4})\.(\d{1,2}))?\s*~\s*(?:(\d{2}|\d{4})\.(\d{1,2}))?$/);
  if (!rangeMatch) {
    return null;
  }

  const startMonth = rangeMatch[1] && rangeMatch[2] ? normalizeProjectPeriodMonth(`${rangeMatch[1]}-${rangeMatch[2]}`) : null;
  const endMonth = rangeMatch[3] && rangeMatch[4] ? normalizeProjectPeriodMonth(`${rangeMatch[3]}-${rangeMatch[4]}`) : null;
  return { status: "연도월", startMonth, endMonth };
}

function normalizeProjectPeriod(project: LegacyProject): {
  periodStatus: ProjectPeriodStatus;
  periodStartMonth: string | null;
  periodEndMonth: string | null;
} {
  if (isProjectPeriodStatus(project.periodStatus)) {
    return {
      periodStatus: project.periodStatus,
      periodStartMonth: normalizeProjectPeriodMonth(project.periodStartMonth),
      periodEndMonth: normalizeProjectPeriodMonth(project.periodEndMonth),
    };
  }

  const parsedPeriodText = parseProjectPeriodText(project.periodText);
  if (parsedPeriodText) {
    return {
      periodStatus: parsedPeriodText.status,
      periodStartMonth: parsedPeriodText.startMonth,
      periodEndMonth: parsedPeriodText.endMonth,
    };
  }

  const startMonth = normalizeProjectPeriodMonth(project.periodStart);
  const endMonth = normalizeProjectPeriodMonth(project.periodEnd);
  if (startMonth || endMonth) {
    return {
      periodStatus: "연도월",
      periodStartMonth: startMonth,
      periodEndMonth: endMonth,
    };
  }

  return {
    periodStatus: "대기",
    periodStartMonth: null,
    periodEndMonth: null,
  };
}

function isAiShipProject(id: string, name: string): boolean {
  return MERGED_AI_SHIP_PROJECT_IDS.has(id) || name === "UIPA AI 선박" || name === "KSOE AI선박" || name === "AI 선박";
}

function normalizeProjectId(id: string, name: string): string {
  return isAiShipProject(id, name) ? AI_SHIP_PROJECT_ID : id;
}

function normalizeWorkLogProjectId(value: unknown): string | null {
  if (typeof value !== "string") {
    return "";
  }

  if (REMOVED_PROJECT_IDS.has(value)) {
    return null;
  }

  return MERGED_AI_SHIP_PROJECT_IDS.has(value) ? AI_SHIP_PROJECT_ID : value;
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

function synchronizeTaskStatus(task: Task): Task {
  if (task.progress >= 1 || task.status === "완료") {
    return {
      ...task,
      completed: true,
      progress: 1,
      status: "완료",
    };
  }

  return {
    ...task,
    completed: false,
  };
}

function normalizeTask(task: LegacyTask, index: number): Task {
  const completed = task.completed === true;
  const progress = normalizeProgress(task.progress, completed);
  const status = completed || progress >= 1 ? "완료" : normalizeTaskStatus(task.status);
  const memo = task.memo || task.issueRisk || "";

  return synchronizeTaskStatus({
    id: task.id ?? `task-${index}`,
    title: task.title ?? "Untitled task",
    dueDate: task.dueDate ?? null,
    estimate: task.estimate ?? "",
    status,
    progress,
    workerComment: task.workerComment ?? "",
    managerComment: task.managerComment ?? "",
    priority: isTaskPriority(task.priority) ? task.priority : "보통",
    memo,
    completed,
  });
}

function normalizeProject(project: LegacyProject, index: number): Project {
  const id = project.id ?? `project-${index}`;
  const name = normalizeProjectName(project.name);
  const isAiShip = isAiShipProject(id, name);
  const period = normalizeProjectPeriod(project);

  return {
    id: normalizeProjectId(id, name),
    name: isAiShip ? "AI 선박" : name,
    clientName: isAiShip ? "UIPA" : normalizeClientName(project.clientName),
    projectNumber: project.projectNumber ?? "",
    periodStart: project.periodStart ?? null,
    periodEnd: project.periodEnd ?? null,
    periodText: "",
    periodStatus: period.periodStatus,
    periodStartMonth: period.periodStartMonth,
    periodEndMonth: period.periodEndMonth,
    color: project.color ?? getProjectColor(index),
    tasks: (project.tasks ?? project.todos ?? []).map(normalizeTask),
    deletedTasks: (project.deletedTasks ?? []).map(normalizeTask),
  };
}

function normalizeWorkLog(workLog: LegacyWorkLog, index: number): WorkLog | null {
  const rawType = (workLog as { type?: unknown }).type;
  const type = rawType === undefined || rawType === null || rawType === "" ? "계획" : rawType;
  if (!isWorkLogType(type)) {
    return null;
  }

  const projectId = normalizeWorkLogProjectId(workLog.projectId);
  if (projectId === null) {
    return null;
  }

  const date = workLog.date ?? new Date().toISOString().slice(0, 10);
  // Only "계획" logs carry a range; keep endDate only when it is after the start.
  const rawEndDate = typeof workLog.endDate === "string" && workLog.endDate ? workLog.endDate : null;
  const endDate = type === "계획" && rawEndDate && rawEndDate > date ? rawEndDate : null;

  return {
    id: workLog.id ?? `work-log-${index}`,
    projectId,
    taskId: workLog.taskId ?? workLog.todoId,
    linkedTaskTitleSnapshot: workLog.linkedTaskTitleSnapshot,
    linkedTaskDeleted: workLog.linkedTaskDeleted === true,
    date,
    endDate,
    type,
    content: workLog.content ?? "",
  };
}

function normalizeProjectEvent(event: LegacyProjectEvent, index: number): ProjectEvent | null {
  const projectId = normalizeWorkLogProjectId(event.projectId);
  if (projectId === null) {
    return null;
  }

  return {
    id: event.id ?? `project-event-${index}`,
    projectId,
    title: event.title ?? "Untitled event",
    startDate: event.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: event.endDate ?? null,
    content: event.content ?? "",
    taskId: typeof event.taskId === "string" ? event.taskId : undefined,
  };
}

function shouldKeepProject(project: Project): boolean {
  return !REMOVED_PROJECT_IDS.has(project.id);
}

function mergeDuplicateProjects(projects: Project[]): Project[] {
  const mergedProjects: Project[] = [];
  const projectById = new Map<string, Project>();

  projects.filter(shouldKeepProject).forEach((project) => {
    const existingProject = projectById.get(project.id);
    if (!existingProject) {
      projectById.set(project.id, project);
      mergedProjects.push(project);
      return;
    }

    const existingTaskIds = new Set(existingProject.tasks.map((task) => task.id));
    project.tasks.forEach((task) => {
      if (!existingTaskIds.has(task.id)) {
        existingProject.tasks.push(task);
        existingTaskIds.add(task.id);
      }
    });

    const existingDeletedTaskIds = new Set([
      ...existingProject.tasks.map((task) => task.id),
      ...existingProject.deletedTasks.map((task) => task.id),
    ]);
    project.deletedTasks.forEach((task) => {
      if (!existingDeletedTaskIds.has(task.id)) {
        existingProject.deletedTasks.push(task);
        existingDeletedTaskIds.add(task.id);
      }
    });
  });

  return mergedProjects;
}

function getSchemaVersion(rawState: LegacyAppState): AppSchemaVersion {
  return rawState.schemaVersion === 2 ? 2 : 1;
}

function normalizeV1State(rawState: LegacyAppState): AppState {
  const projects = mergeDuplicateProjects((rawState.projects ?? []).map(normalizeProject));
  const requestedActiveProjectId =
    typeof rawState.activeProjectId === "string" ? normalizeWorkLogProjectId(rawState.activeProjectId) : null;
  const activeProjectId =
    requestedActiveProjectId && projects.some((project) => project.id === requestedActiveProjectId)
      ? requestedActiveProjectId
      : projects[0]?.id ?? null;

  return {
    schemaVersion: 1,
    projects,
    activeProjectId,
    workLogs: (rawState.workLogs ?? []).map(normalizeWorkLog).filter((workLog): workLog is WorkLog => workLog !== null),
    events: [],
  };
}

function migrateV1ToV2(v1State: AppState, rawState: LegacyAppState): AppState {
  const rawEvents = Array.isArray(rawState.events) ? rawState.events : [];

  return {
    ...v1State,
    schemaVersion: 2,
    events: rawEvents.map(normalizeProjectEvent).filter((event): event is ProjectEvent => event !== null),
  };
}

function migrateState(rawState: LegacyAppState): AppState {
  const schemaVersion = getSchemaVersion(rawState);
  let migratedState = normalizeV1State(rawState);

  if (schemaVersion === 1 || schemaVersion === 2) {
    migratedState = migrateV1ToV2(migratedState, rawState);
  }

  return migratedState;
}

function saveState(): void {
  // Electron branch keeps runtime state in memory. Persist with File > Save.
  stateChangeListener?.();
}

function isImportableState(value: unknown): value is LegacyAppState {
  return typeof value === "object" && value !== null && Array.isArray((value as LegacyAppState).projects);
}

export function getState(): AppState {
  return state;
}

export function setStateChangeListener(listener: (() => void) | null): void {
  stateChangeListener = listener;
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

export function selectProjectForView(projectId: string): void {
  if (!state.projects.some((project) => project.id === projectId)) {
    state.activeProjectId = null;
    return;
  }

  state.activeProjectId = projectId;
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
  state.events = state.events.filter((event) => event.projectId !== activeProject.id);
  saveState();
}

export function addTask(task: Task): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  activeProject.tasks.push(normalizeTask(task, activeProject.tasks.length));
  saveState();
}

export function addTaskToProject(projectId: string, task: Task): void {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    return;
  }

  project.tasks.push(normalizeTask(task, project.tasks.length));
  saveState();
}

export function updateTask(taskId: string, updates: Partial<Task>): void {
  const project = state.projects.find((p) => p.tasks.some((t) => t.id === taskId));
  const taskIndex = project?.tasks.findIndex((item) => item.id === taskId) ?? -1;
  if (!project || taskIndex < 0) {
    return;
  }

  project.tasks[taskIndex] = normalizeTask(
    {
      ...project.tasks[taskIndex],
      ...updates,
    },
    taskIndex,
  );
  saveState();
}

export function toggleTask(taskId: string, completed: boolean): void {
  updateTask(taskId, {
    completed,
    status: completed ? "완료" : "대기",
    progress: completed ? 1 : 0,
  });
}

export function deleteTask(taskId: string): void {
  const project = state.projects.find((p) => p.tasks.some((t) => t.id === taskId));
  if (!project) {
    return;
  }

  const taskIndex = project.tasks.findIndex((task) => task.id === taskId);
  if (taskIndex < 0) {
    return;
  }

  const [deletedTask] = project.tasks.splice(taskIndex, 1);
  project.deletedTasks.push(deletedTask);
  state.workLogs.forEach((workLog) => {
    if (workLog.taskId !== taskId) {
      return;
    }

    workLog.linkedTaskTitleSnapshot = workLog.linkedTaskTitleSnapshot || deletedTask.title;
    workLog.linkedTaskDeleted = true;
  });
  saveState();
}

export function restoreDeletedTask(taskId: string): void {
  const project = state.projects.find((p) => p.deletedTasks.some((t) => t.id === taskId));
  if (!project) {
    return;
  }

  const taskIndex = project.deletedTasks.findIndex((task) => task.id === taskId);
  if (taskIndex < 0) {
    return;
  }

  const [restoredTask] = project.deletedTasks.splice(taskIndex, 1);
  project.tasks.push(restoredTask);
  state.workLogs.forEach((workLog) => {
    if (workLog.taskId === taskId) {
      workLog.linkedTaskDeleted = false;
    }
  });
  saveState();
}

export function permanentlyDeleteTask(taskId: string): void {
  const project = state.projects.find((p) => p.deletedTasks.some((t) => t.id === taskId));
  const taskIndex = project?.deletedTasks.findIndex((task) => task.id === taskId) ?? -1;
  if (!project || taskIndex < 0) {
    return;
  }

  const [deletedTask] = project.deletedTasks.splice(taskIndex, 1);
  state.workLogs.forEach((workLog) => {
    if (workLog.taskId !== taskId) {
      return;
    }

    workLog.linkedTaskTitleSnapshot = workLog.linkedTaskTitleSnapshot || deletedTask.title;
    workLog.linkedTaskDeleted = true;
  });
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

export function addEvent(event: ProjectEvent): void {
  const normalizedEvent = normalizeProjectEvent(event, state.events.length);
  if (!normalizedEvent) {
    return;
  }

  state.events.push(normalizedEvent);
  saveState();
}

export function updateEvent(eventId: string, updates: Partial<ProjectEvent>): void {
  const eventIndex = state.events.findIndex((event) => event.id === eventId);
  if (eventIndex < 0) {
    return;
  }

  const normalizedEvent = normalizeProjectEvent(
    {
      ...state.events[eventIndex],
      ...updates,
    },
    eventIndex,
  );
  if (!normalizedEvent) {
    state.events.splice(eventIndex, 1);
  } else {
    state.events[eventIndex] = normalizedEvent;
  }
  saveState();
}

export function deleteEvent(eventId: string): void {
  state.events = state.events.filter((event) => event.id !== eventId);
  saveState();
}

export function replaceState(rawState: unknown): boolean {
  if (!isImportableState(rawState)) {
    return false;
  }

  state = migrateState(rawState);
  saveState();
  return true;
}

export function replaceStateFromSync(rawState: unknown): boolean {
  if (!isImportableState(rawState)) {
    return false;
  }

  state = migrateState(rawState);
  return true;
}
