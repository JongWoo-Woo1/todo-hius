// Renderer-side handler for AI actions forwarded from the local bridge
// (electron/aiBridge.ts -> preload hiusTodoAi -> here). Deletion is intentionally not
// supported.

import {
  createEvent,
  createTask,
  createWorkLog,
  navigateToProject,
  navigateToView,
  openTask,
  openWorkspaceWindow,
} from "./aiControlActions";
import {
  getAppInfo,
  getProjectSummary,
  getTaskSummary,
  getTodaySchedule,
  getWeekSchedule,
  listLiveProjects,
  searchLiveProjects,
  searchLiveTasks,
} from "./aiLiveState";
import { asRecord, type AiActionResult } from "./aiDto";

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
