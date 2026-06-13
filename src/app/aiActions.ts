// Renderer-side handler for AI control actions forwarded from the local bridge
// (electron/aiBridge.ts -> preload hiusTodoAi -> here). Each action is translated into the
// app's existing store/render operations so AI-driven changes behave exactly like the UI.
//
// Navigation actions do not mark the workspace dirty; create actions go through the store's
// add* functions (which persist + sync like normal edits). Deletion is intentionally not
// supported in this phase.

import {
  addEvent,
  addTaskToProject,
  addWorkLog,
  getState,
  selectProjectForView,
} from "../state/store";
import { createId } from "../utils/id";
import type { Project, TaskPriority, WorkLogType } from "../types";
import {
  activateCalendarButton,
  openWorkspaceWindowKey,
  render,
  selectTask,
  showFeedView,
  showLedgerView,
  showProjectView,
  showWeeklyView,
} from "../ui/render";
import { uiState } from "./uiState";
import type { ProjectEvent, Task, WorkLog } from "../types";
import { toDateKey } from "../utils/calendar";
import { getWeekdays } from "../utils/week";

type AiActionResult = { ok: true; result?: unknown } | { ok: false; error: string };
type DetailLevel = "compact" | "detail";

type LiveResult = {
  source: "live-app";
  mode: DetailLevel;
  total: number;
  limit?: number;
  offset?: number;
  items?: unknown[];
  item?: unknown;
  note?: string;
};

const TASK_PRIORITIES: TaskPriority[] = ["낮음", "보통", "높음", "최우선"];
const WORK_LOG_TYPES: WorkLogType[] = ["계획", "수행"];

const DEFAULT_LIVE_LIMIT = 20;
const MAX_LIVE_LIMIT = 100;
const SUMMARY_TEXT_LIMIT = 120;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asDetailLevel(value: unknown): DetailLevel {
  return value === "detail" ? "detail" : "compact";
}

function asLimit(value: unknown): number {
  const limit = Math.trunc(asNumber(value) ?? DEFAULT_LIVE_LIMIT);
  return Math.min(Math.max(limit, 1), MAX_LIVE_LIMIT);
}

function asOffset(value: unknown): number {
  return Math.max(Math.trunc(asNumber(value) ?? 0), 0);
}

function truncateText(value: string | null | undefined, maxLength = SUMMARY_TEXT_LIMIT): string {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function parseDatePayload(value: unknown): Date {
  const date = asString(value);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date();
}

function paginate(items: unknown[], payload: Record<string, unknown>, mode: DetailLevel, note?: string): LiveResult {
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

function itemResult(item: unknown, mode: DetailLevel, found: boolean, note?: string): LiveResult {
  return {
    source: "live-app",
    mode,
    total: found ? 1 : 0,
    item: found ? item : null,
    ...(note ? { note } : {}),
  };
}

function coercePriority(value: unknown): TaskPriority {
  const priority = asString(value);
  return priority && (TASK_PRIORITIES as string[]).includes(priority) ? (priority as TaskPriority) : "보통";
}

function coerceWorkLogType(value: unknown): WorkLogType {
  const type = asString(value);
  return type && (WORK_LOG_TYPES as string[]).includes(type) ? (type as WorkLogType) : "수행";
}

// Resolve the target project from { projectId } or { projectQuery }, falling back to the
// active project when neither is given.
function resolveProject(payload: Record<string, unknown>): Project | null {
  const state = getState();

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

function projectEvents(projectId: string): ProjectEvent[] {
  return getState().events.filter((event) => event.projectId === projectId);
}

function projectWorkLogs(projectId: string): WorkLog[] {
  return getState().workLogs.filter((workLog) => workLog.projectId === projectId);
}

function compactProject(project: Project) {
  const openTaskCount = project.tasks.filter((task) => !task.completed).length;
  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    projectNumber: project.projectNumber ?? "",
    taskCount: project.tasks.length,
    openTaskCount,
    eventCount: projectEvents(project.id).length,
    workLogCount: projectWorkLogs(project.id).length,
  };
}

function compactTask(project: Project, task: Task) {
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

function findTaskTitle(project: Project, taskId: string | undefined): string | null {
  if (!taskId) {
    return null;
  }

  return (
    project.tasks.find((task) => task.id === taskId)?.title ??
    project.deletedTasks.find((task) => task.id === taskId)?.title ??
    null
  );
}

function compactEvent(project: Project, event: ProjectEvent) {
  return {
    projectId: project.id,
    projectName: project.name,
    eventId: event.id,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate ?? null,
  };
}

function detailEvent(project: Project, event: ProjectEvent) {
  return {
    ...compactEvent(project, event),
    content: truncateText(event.content),
    taskId: event.taskId ?? null,
  };
}

function compactWorkLog(project: Project, workLog: WorkLog) {
  return {
    projectId: project.id,
    projectName: project.name,
    workLogId: workLog.id,
    date: workLog.date,
    endDate: workLog.endDate ?? null,
    type: workLog.type,
  };
}

function detailWorkLog(project: Project, workLog: WorkLog) {
  return {
    ...compactWorkLog(project, workLog),
    taskId: workLog.taskId ?? null,
    taskTitle: findTaskTitle(project, workLog.taskId) ?? workLog.linkedTaskTitleSnapshot ?? null,
    content: truncateText(workLog.content),
  };
}

function detailTask(project: Project, task: Task) {
  return {
    ...compactTask(project, task),
    estimate: task.estimate ?? "",
    progress: task.progress,
    memo: truncateText(task.memo),
    workerComment: truncateText(task.workerComment),
    managerComment: truncateText(task.managerComment),
    issueRisk: truncateText(task.issueRisk),
    workLogs: getState().workLogs
      .filter((workLog) => workLog.taskId === task.id)
      .map((workLog) => detailWorkLog(project, workLog)),
  };
}

function detailProject(project: Project) {
  return {
    ...compactProject(project),
    periodStart: project.periodStart ?? null,
    periodEnd: project.periodEnd ?? null,
    periodText: project.periodText ?? "",
    periodStatus: project.periodStatus ?? "",
    tasks: project.tasks.map((task) => compactTask(project, task)),
    events: projectEvents(project.id).map((event) => detailEvent(project, event)),
    workLogs: projectWorkLogs(project.id).map((workLog) => detailWorkLog(project, workLog)),
  };
}

function findTask(taskId: string | undefined): { project: Project; task: Task } | null {
  if (!taskId) {
    return null;
  }

  for (const project of getState().projects) {
    const task = project.tasks.find((item) => item.id === taskId);
    if (task) {
      return { project, task };
    }
  }

  return null;
}

function findProject(projectId: string): Project | undefined {
  return getState().projects.find((project) => project.id === projectId);
}

function matchesProject(project: Project, query: string): boolean {
  return [project.name, project.clientName, project.projectNumber ?? ""].join(" ").toLowerCase().includes(query);
}

function matchesTask(project: Project, task: Task, query: string): boolean {
  return [project.name, project.clientName, project.projectNumber ?? "", task.title, task.memo, task.status]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function dateRangeOverlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && endA >= startB;
}

function getAppInfo(): AiActionResult {
  const state = getState();
  const activeProject = state.projects.find((project) => project.id === state.activeProjectId) ?? null;
  return {
    ok: true,
    result: itemResult(
      {
        currentView: uiState.currentView,
        activeProjectId: state.activeProjectId,
        activeProjectName: activeProject?.name ?? null,
        selectedTaskId: uiState.selectedTaskId,
        workspaceWindowKey: uiState.workspaceWindowKey,
        projectCount: state.projects.length,
        taskCount: state.projects.reduce((total, project) => total + project.tasks.length, 0),
        eventCount: state.events.length,
        workLogCount: state.workLogs.length,
      },
      "compact",
      true,
    ),
  };
}

function listLiveProjects(payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const items = getState().projects.map((project) => (mode === "detail" ? detailProject(project) : compactProject(project)));
  return { ok: true, result: paginate(items, payload, mode) };
}

function searchLiveProjects(payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const query = (asString(payload.query) ?? "").toLowerCase();
  const projects = query ? getState().projects.filter((project) => matchesProject(project, query)) : getState().projects;
  return {
    ok: true,
    result: paginate(
      projects.map(compactProject),
      payload,
      mode,
      mode === "detail" ? "Search returns compact matches. Call get_project_summary with the selected projectId." : undefined,
    ),
  };
}

function getProjectSummary(payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const project = resolveProject(payload);
  if (!project) {
    return { ok: true, result: itemResult(null, mode, false, "Project not found.") };
  }

  return { ok: true, result: itemResult(mode === "detail" ? detailProject(project) : compactProject(project), mode, true) };
}

function searchLiveTasks(payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const query = (asString(payload.query) ?? "").toLowerCase();
  const projectId = asString(payload.projectId);
  const includeCompleted = asBoolean(payload.includeCompleted) ?? false;
  const items: unknown[] = [];

  for (const project of getState().projects) {
    if (projectId && project.id !== projectId) {
      continue;
    }

    for (const task of project.tasks) {
      if (!includeCompleted && task.completed) {
        continue;
      }

      if (!query || matchesTask(project, task, query)) {
        items.push(compactTask(project, task));
      }
    }
  }

  return {
    ok: true,
    result: paginate(
      items,
      payload,
      mode,
      mode === "detail" ? "Search returns compact matches. Call get_task_summary with the selected taskId." : undefined,
    ),
  };
}

function getTaskSummary(payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const found = findTask(asString(payload.taskId) ?? asString(payload.query));
  if (!found) {
    return { ok: true, result: itemResult(null, mode, false, "Task not found.") };
  }

  return {
    ok: true,
    result: itemResult(mode === "detail" ? detailTask(found.project, found.task) : compactTask(found.project, found.task), mode, true),
  };
}

function getTodaySchedule(payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const date = toDateKey(parseDatePayload(payload.date));
  const includeCompleted = asBoolean(payload.includeCompleted) ?? false;
  const tasksDueToday: unknown[] = [];
  const overdueTasks: unknown[] = [];
  const events: unknown[] = [];
  const workLogs: unknown[] = [];

  for (const project of getState().projects) {
    for (const task of project.tasks) {
      if (!includeCompleted && task.completed) {
        continue;
      }

      if (task.dueDate === date) {
        tasksDueToday.push(mode === "detail" ? detailTask(project, task) : compactTask(project, task));
      } else if (task.dueDate && task.dueDate < date && !task.completed) {
        overdueTasks.push(mode === "detail" ? detailTask(project, task) : compactTask(project, task));
      }
    }
  }

  for (const event of getState().events) {
    const project = findProject(event.projectId);
    if (project && event.startDate <= date && (event.endDate ?? event.startDate) >= date) {
      events.push(mode === "detail" ? detailEvent(project, event) : compactEvent(project, event));
    }
  }

  for (const workLog of getState().workLogs) {
    const project = findProject(workLog.projectId);
    if (project && workLog.date <= date && (workLog.endDate ?? workLog.date) >= date) {
      workLogs.push(mode === "detail" ? detailWorkLog(project, workLog) : compactWorkLog(project, workLog));
    }
  }

  return { ok: true, result: itemResult({ date, tasksDueToday, overdueTasks, events, workLogs }, mode, true) };
}

function getWeekSchedule(payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const weekdays = getWeekdays(parseDatePayload(payload.weekDate));
  const weekStart = toDateKey(weekdays[0]);
  const weekEnd = toDateKey(weekdays[weekdays.length - 1]);
  const includeCompleted = asBoolean(payload.includeCompleted) ?? false;
  const tasks: unknown[] = [];
  const events: unknown[] = [];
  const workLogs: unknown[] = [];

  for (const project of getState().projects) {
    for (const task of project.tasks) {
      if (!includeCompleted && task.completed) {
        continue;
      }

      if (task.dueDate && task.dueDate >= weekStart && task.dueDate <= weekEnd) {
        tasks.push(mode === "detail" ? detailTask(project, task) : compactTask(project, task));
      }
    }
  }

  for (const event of getState().events) {
    const project = findProject(event.projectId);
    if (project && dateRangeOverlaps(event.startDate, event.endDate ?? event.startDate, weekStart, weekEnd)) {
      events.push(mode === "detail" ? detailEvent(project, event) : compactEvent(project, event));
    }
  }

  for (const workLog of getState().workLogs) {
    const project = findProject(workLog.projectId);
    if (project && dateRangeOverlaps(workLog.date, workLog.endDate ?? workLog.date, weekStart, weekEnd)) {
      workLogs.push(mode === "detail" ? detailWorkLog(project, workLog) : compactWorkLog(project, workLog));
    }
  }

  return {
    ok: true,
    result: itemResult({ weekStart, weekEnd, label: `${weekStart} ~ ${weekEnd}`, tasks, events, workLogs }, mode, true),
  };
}

function navigateToView(payload: Record<string, unknown>): AiActionResult {
  const view = asString(payload.view);
  switch (view) {
    case "calendar":
      activateCalendarButton();
      break;
    case "feed":
      showFeedView();
      break;
    case "weekly":
      showWeeklyView();
      break;
    case "ledger":
      showLedgerView();
      break;
    case "projects":
      showProjectView();
      break;
    default:
      return { ok: false, error: `Unknown view: ${view ?? "(none)"}` };
  }

  render();
  return { ok: true, result: { view } };
}

function navigateToProject(payload: Record<string, unknown>): AiActionResult {
  const project = resolveProject(payload);
  if (!project) {
    return { ok: false, error: "Project not found." };
  }

  selectProjectForView(project.id);
  showProjectView();
  render();
  return { ok: true, result: { projectId: project.id, name: project.name } };
}

async function openWorkspaceWindow(payload: Record<string, unknown>): Promise<AiActionResult> {
  const view = asString(payload.view);
  let windowKey: string;

  if (view) {
    if (!["calendar", "feed", "weekly", "ledger"].includes(view)) {
      return { ok: false, error: `Unknown window view: ${view}` };
    }
    windowKey = `view:${view}`;
  } else {
    const project = resolveProject(payload);
    if (!project) {
      return { ok: false, error: "Project not found for workspace window." };
    }
    windowKey = `project:${project.id}`;
  }

  await openWorkspaceWindowKey(windowKey);
  return { ok: true, result: { windowKey } };
}

function openTask(payload: Record<string, unknown>): AiActionResult {
  const taskId = asString(payload.taskId);
  const query = asString(payload.query)?.toLowerCase();
  const state = getState();

  for (const project of state.projects) {
    for (const task of project.tasks) {
      const matches = taskId ? task.id === taskId : Boolean(query) && task.title.toLowerCase().includes(query!);
      if (matches) {
        selectProjectForView(project.id);
        selectTask(task.id);
        showProjectView();
        render();
        return { ok: true, result: { projectId: project.id, taskId: task.id, title: task.title } };
      }
    }
  }

  return { ok: false, error: "Task not found." };
}

function createTask(payload: Record<string, unknown>): AiActionResult {
  const project = resolveProject(payload);
  if (!project) {
    return { ok: false, error: "Project not found for the task." };
  }

  const title = asString(payload.title);
  if (!title) {
    return { ok: false, error: "create_task requires a title." };
  }

  const taskId = createId();
  addTaskToProject(project.id, {
    id: taskId,
    title,
    dueDate: asString(payload.dueDate) ?? null,
    estimate: "",
    status: "대기",
    progress: 0,
    workerComment: "",
    managerComment: "",
    priority: coercePriority(payload.priority),
    memo: asString(payload.memo) ?? "",
    completed: false,
  });
  render();
  return { ok: true, result: { taskId, projectId: project.id } };
}

function createEvent(payload: Record<string, unknown>): AiActionResult {
  const project = resolveProject(payload);
  if (!project) {
    return { ok: false, error: "Project not found for the event." };
  }

  const title = asString(payload.title);
  const startDate = asString(payload.startDate);
  if (!title || !startDate) {
    return { ok: false, error: "create_event requires title and startDate (YYYY-MM-DD)." };
  }

  const eventId = createId();
  addEvent({
    id: eventId,
    projectId: project.id,
    title,
    startDate,
    endDate: asString(payload.endDate) ?? null,
    content: asString(payload.content) ?? "",
  });
  render();
  return { ok: true, result: { eventId, projectId: project.id } };
}

function createWorkLog(payload: Record<string, unknown>): AiActionResult {
  const project = resolveProject(payload);
  if (!project) {
    return { ok: false, error: "Project not found for the work log." };
  }

  const date = asString(payload.date);
  if (!date) {
    return { ok: false, error: "create_work_log requires a date (YYYY-MM-DD)." };
  }

  const workLogId = createId();
  addWorkLog({
    id: workLogId,
    projectId: project.id,
    date,
    endDate: null,
    type: coerceWorkLogType(payload.type),
    content: asString(payload.content) ?? "",
  });
  render();
  return { ok: true, result: { workLogId, projectId: project.id } };
}

export async function handleAiAction(action: string, payloadRaw: unknown): Promise<AiActionResult> {
  const payload = asRecord(payloadRaw);

  switch (action) {
    case "get_app_info":
      return getAppInfo();
    case "list_projects":
      return listLiveProjects(payload);
    case "search_projects":
      return searchLiveProjects(payload);
    case "get_project_summary":
      return getProjectSummary(payload);
    case "search_tasks":
      return searchLiveTasks(payload);
    case "get_task_summary":
      return getTaskSummary(payload);
    case "get_today_schedule":
      return getTodaySchedule(payload);
    case "get_week_schedule":
      return getWeekSchedule(payload);
    case "navigate_to_view":
      return navigateToView(payload);
    case "navigate_to_project":
      return navigateToProject(payload);
    case "open_workspace_window":
      return openWorkspaceWindow(payload);
    case "open_task":
      return openTask(payload);
    case "create_task":
      return createTask(payload);
    case "create_event":
      return createEvent(payload);
    case "create_work_log":
      return createWorkLog(payload);
    default:
      return { ok: false, error: `Unknown action: ${action}` };
  }
}

// Subscribe to bridge action requests for this window. Only the main window should call
// this (the bridge forwards to the main window), but it is safe to register elsewhere.
export function registerAiActionHandler(): void {
  const ai = window.hiusTodoAi;
  if (!ai) {
    return;
  }

  ai.onAiActionRequest((requestId, action, payload) => {
    void handleAiAction(action, payload)
      .catch((error: unknown): AiActionResult => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }))
      .then((result) => {
        ai.sendAiActionResult(requestId, result);
      });
  });
}
