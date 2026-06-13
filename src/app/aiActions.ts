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

type AiActionResult = { ok: true; result?: unknown } | { ok: false; error: string };

const TASK_PRIORITIES: TaskPriority[] = ["낮음", "보통", "높음", "최우선"];
const WORK_LOG_TYPES: WorkLogType[] = ["계획", "수행"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
