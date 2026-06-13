import type { AppState, Project, ProjectEvent, Task, WorkLog } from "../types";

export type AiActionResult = { ok: true; result?: unknown } | { ok: false; error: string };
export type DetailLevel = "compact" | "detail";

export type LiveResult = {
  source: "live-app";
  mode: DetailLevel;
  total: number;
  limit?: number;
  offset?: number;
  items?: unknown[];
  item?: unknown;
  note?: string;
};

const DEFAULT_LIVE_LIMIT = 20;
const MAX_LIVE_LIMIT = 100;
const SUMMARY_TEXT_LIMIT = 120;

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function asDetailLevel(value: unknown): DetailLevel {
  return value === "detail" ? "detail" : "compact";
}

export function asLimit(value: unknown): number {
  const limit = Math.trunc(asNumber(value) ?? DEFAULT_LIVE_LIMIT);
  return Math.min(Math.max(limit, 1), MAX_LIVE_LIMIT);
}

export function asOffset(value: unknown): number {
  return Math.max(Math.trunc(asNumber(value) ?? 0), 0);
}

export function truncateText(value: string | null | undefined, maxLength = SUMMARY_TEXT_LIMIT): string {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

export function paginate(items: unknown[], payload: Record<string, unknown>, mode: DetailLevel, note?: string): LiveResult {
  const limit = asLimit(payload.limit);
  const offset = asOffset(payload.offset);
  return {
    source: "live-app",
    mode,
    total: items.length,
    limit,
    offset,
    items: items.slice(offset, offset + limit),
    ...(note ? { note } : {}),
  };
}

export function itemResult(item: unknown, mode: DetailLevel, found: boolean, note?: string): LiveResult {
  return {
    source: "live-app",
    mode,
    total: found ? 1 : 0,
    item: found ? item : null,
    ...(note ? { note } : {}),
  };
}

export function resolveProject(state: AppState, payload: Record<string, unknown>): Project | null {
  const projectId = asString(payload.projectId);
  if (projectId) {
    const byId = state.projects.find((project) => project.id === projectId);
    if (byId) {
      return byId;
    }
  }

  const query = asString(payload.projectQuery);
  if (query) {
    const needle = query.toLowerCase();
    const byQuery = state.projects.find((project) =>
      [project.name, project.clientName, project.projectNumber ?? ""].join(" ").toLowerCase().includes(needle),
    );
    if (byQuery) {
      return byQuery;
    }
  }

  if (!projectId && !query) {
    return state.projects.find((project) => project.id === state.activeProjectId) ?? null;
  }

  return null;
}

export function projectEvents(state: AppState, projectId: string): ProjectEvent[] {
  return state.events.filter((event) => event.projectId === projectId);
}

export function projectWorkLogs(state: AppState, projectId: string): WorkLog[] {
  return state.workLogs.filter((workLog) => workLog.projectId === projectId);
}

export function compactProject(state: AppState, project: Project) {
  const openTaskCount = project.tasks.filter((task) => !task.completed).length;
  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    projectNumber: project.projectNumber ?? "",
    taskCount: project.tasks.length,
    openTaskCount,
    eventCount: projectEvents(state, project.id).length,
    workLogCount: projectWorkLogs(state, project.id).length,
  };
}

export function compactTask(project: Project, task: Task) {
  return {
    projectId: project.id,
    projectName: project.name,
    taskId: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate,
    completed: task.completed,
    priority: task.priority ?? "",
  };
}

export function findTaskTitle(project: Project, taskId: string | undefined): string | null {
  if (!taskId) {
    return null;
  }

  return (
    project.tasks.find((task) => task.id === taskId)?.title ??
    project.deletedTasks.find((task) => task.id === taskId)?.title ??
    null
  );
}

export function compactEvent(project: Project, event: ProjectEvent) {
  return {
    projectId: project.id,
    projectName: project.name,
    eventId: event.id,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate ?? null,
  };
}

export function detailEvent(project: Project, event: ProjectEvent) {
  return {
    ...compactEvent(project, event),
    content: truncateText(event.content),
    taskId: event.taskId ?? null,
  };
}

export function compactWorkLog(project: Project, workLog: WorkLog) {
  return {
    projectId: project.id,
    projectName: project.name,
    workLogId: workLog.id,
    date: workLog.date,
    endDate: workLog.endDate ?? null,
    type: workLog.type,
  };
}

export function detailWorkLog(project: Project, workLog: WorkLog) {
  return {
    ...compactWorkLog(project, workLog),
    taskId: workLog.taskId ?? null,
    taskTitle: findTaskTitle(project, workLog.taskId) ?? workLog.linkedTaskTitleSnapshot ?? null,
    content: truncateText(workLog.content),
  };
}

export function detailTask(state: AppState, project: Project, task: Task) {
  return {
    ...compactTask(project, task),
    estimate: task.estimate ?? "",
    progress: task.progress,
    memo: truncateText(task.memo),
    workerComment: truncateText(task.workerComment),
    managerComment: truncateText(task.managerComment),
    issueRisk: truncateText(task.issueRisk),
    workLogs: state.workLogs
      .filter((workLog) => workLog.taskId === task.id)
      .map((workLog) => detailWorkLog(project, workLog)),
  };
}

export function detailProject(state: AppState, project: Project) {
  return {
    ...compactProject(state, project),
    periodStart: project.periodStart ?? null,
    periodEnd: project.periodEnd ?? null,
    periodText: project.periodText ?? "",
    periodStatus: project.periodStatus ?? "",
    tasks: project.tasks.map((task) => compactTask(project, task)),
    events: projectEvents(state, project.id).map((event) => detailEvent(project, event)),
    workLogs: projectWorkLogs(state, project.id).map((workLog) => detailWorkLog(project, workLog)),
  };
}

export function findTask(state: AppState, taskId: string | undefined): { project: Project; task: Task } | null {
  if (!taskId) {
    return null;
  }

  for (const project of state.projects) {
    const task = project.tasks.find((item) => item.id === taskId);
    if (task) {
      return { project, task };
    }
  }

  return null;
}

export function findProject(state: AppState, projectId: string): Project | undefined {
  return state.projects.find((project) => project.id === projectId);
}

export function matchesProject(project: Project, query: string): boolean {
  return [project.name, project.clientName, project.projectNumber ?? ""].join(" ").toLowerCase().includes(query);
}

export function matchesTask(project: Project, task: Task, query: string): boolean {
  return [project.name, project.clientName, project.projectNumber ?? "", task.title, task.memo, task.status]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function dateRangeOverlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && endA >= startB;
}
