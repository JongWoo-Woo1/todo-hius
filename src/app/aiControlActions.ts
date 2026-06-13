import {
  addEvent,
  addTaskToProject,
  addWorkLog,
  getState,
  selectProjectForView,
} from "../state/store";
import type { TaskPriority, WorkLogType } from "../types";
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
import { createId } from "../utils/id";
import { asString, resolveProject, type AiActionResult } from "./aiDto";

const TASK_PRIORITIES: TaskPriority[] = ["낮음", "보통", "높음", "최우선"];
const WORK_LOG_TYPES: WorkLogType[] = ["계획", "수행"];

function coercePriority(value: unknown): TaskPriority {
  const priority = asString(value);
  return priority && (TASK_PRIORITIES as string[]).includes(priority) ? (priority as TaskPriority) : "보통";
}

function coerceWorkLogType(value: unknown): WorkLogType {
  const type = asString(value);
  return type && (WORK_LOG_TYPES as string[]).includes(type) ? (type as WorkLogType) : "수행";
}

export function navigateToView(payload: Record<string, unknown>): AiActionResult {
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

export function navigateToProject(payload: Record<string, unknown>): AiActionResult {
  const project = resolveProject(getState(), payload);
  if (!project) {
    return { ok: false, error: "Project not found." };
  }

  selectProjectForView(project.id);
  showProjectView();
  render();
  return { ok: true, result: { projectId: project.id, name: project.name } };
}

export async function openWorkspaceWindow(payload: Record<string, unknown>): Promise<AiActionResult> {
  const view = asString(payload.view);
  let windowKey: string;

  if (view) {
    if (!["calendar", "feed", "weekly", "ledger"].includes(view)) {
      return { ok: false, error: `Unknown window view: ${view}` };
    }
    windowKey = `view:${view}`;
  } else {
    const project = resolveProject(getState(), payload);
    if (!project) {
      return { ok: false, error: "Project not found for workspace window." };
    }
    windowKey = `project:${project.id}`;
  }

  await openWorkspaceWindowKey(windowKey);
  return { ok: true, result: { windowKey } };
}

export function openTask(payload: Record<string, unknown>): AiActionResult {
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

export function createTask(payload: Record<string, unknown>): AiActionResult {
  const project = resolveProject(getState(), payload);
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

export function createEvent(payload: Record<string, unknown>): AiActionResult {
  const project = resolveProject(getState(), payload);
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

export function createWorkLog(payload: Record<string, unknown>): AiActionResult {
  const project = resolveProject(getState(), payload);
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
