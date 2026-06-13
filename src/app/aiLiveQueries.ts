import type { AppState } from "../types";
import { toDateKey } from "../utils/calendar";
import { getWeekdays } from "../utils/week";
import type { UiState } from "./uiState";
import {
  asBoolean,
  asDetailLevel,
  asString,
  compactEvent,
  compactProject,
  compactTask,
  compactWorkLog,
  dateRangeOverlaps,
  detailEvent,
  detailProject,
  detailTask,
  detailWorkLog,
  findProject,
  findTask,
  itemResult,
  matchesProject,
  matchesTask,
  paginate,
  resolveProject,
  type AiActionResult,
} from "./aiDto";

function parseDatePayload(value: unknown): Date {
  const date = asString(value);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date();
}

export function queryAppInfo(state: AppState, uiState: UiState): AiActionResult {
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

export function queryLiveProjects(state: AppState, payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const items = state.projects.map((project) => (mode === "detail" ? detailProject(state, project) : compactProject(state, project)));
  return { ok: true, result: paginate(items, payload, mode) };
}

export function queryLiveProjectSearch(state: AppState, payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const query = (asString(payload.query) ?? "").toLowerCase();
  const projects = query ? state.projects.filter((project) => matchesProject(project, query)) : state.projects;
  return {
    ok: true,
    result: paginate(
      projects.map((project) => compactProject(state, project)),
      payload,
      mode,
      mode === "detail" ? "Search returns compact matches. Call get_project_summary with the selected projectId." : undefined,
    ),
  };
}

export function queryProjectSummary(state: AppState, payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const project = resolveProject(state, payload);
  if (!project) {
    return { ok: true, result: itemResult(null, mode, false, "Project not found.") };
  }

  return {
    ok: true,
    result: itemResult(
      mode === "detail" ? detailProject(state, project) : compactProject(state, project),
      mode,
      true,
      mode === "detail" ? "For large projects, prefer search/list tools before requesting detail." : undefined,
    ),
  };
}

export function queryLiveTasks(state: AppState, payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const query = (asString(payload.query) ?? "").toLowerCase();
  const projectId = asString(payload.projectId);
  const includeCompleted = asBoolean(payload.includeCompleted) ?? false;
  const items: unknown[] = [];

  for (const project of state.projects) {
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

export function queryTaskSummary(state: AppState, payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const found = findTask(state, asString(payload.taskId) ?? asString(payload.query));
  if (!found) {
    return { ok: true, result: itemResult(null, mode, false, "Task not found.") };
  }

  return {
    ok: true,
    result: itemResult(
      mode === "detail" ? detailTask(state, found.project, found.task) : compactTask(found.project, found.task),
      mode,
      true,
    ),
  };
}

export function queryTodaySchedule(state: AppState, payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const date = toDateKey(parseDatePayload(payload.date));
  const includeCompleted = asBoolean(payload.includeCompleted) ?? false;
  const tasksDueToday: unknown[] = [];
  const overdueTasks: unknown[] = [];
  const events: unknown[] = [];
  const workLogs: unknown[] = [];

  for (const project of state.projects) {
    for (const task of project.tasks) {
      if (!includeCompleted && task.completed) {
        continue;
      }

      if (task.dueDate === date) {
        tasksDueToday.push(mode === "detail" ? detailTask(state, project, task) : compactTask(project, task));
      } else if (task.dueDate && task.dueDate < date && !task.completed) {
        overdueTasks.push(mode === "detail" ? detailTask(state, project, task) : compactTask(project, task));
      }
    }
  }

  for (const event of state.events) {
    const project = findProject(state, event.projectId);
    if (project && event.startDate <= date && (event.endDate ?? event.startDate) >= date) {
      events.push(mode === "detail" ? detailEvent(project, event) : compactEvent(project, event));
    }
  }

  for (const workLog of state.workLogs) {
    const project = findProject(state, workLog.projectId);
    if (project && workLog.date <= date && (workLog.endDate ?? workLog.date) >= date) {
      workLogs.push(mode === "detail" ? detailWorkLog(project, workLog) : compactWorkLog(project, workLog));
    }
  }

  return { ok: true, result: itemResult({ date, tasksDueToday, overdueTasks, events, workLogs }, mode, true) };
}

export function queryWeekSchedule(state: AppState, payload: Record<string, unknown>): AiActionResult {
  const mode = asDetailLevel(payload.detailLevel);
  const weekdays = getWeekdays(parseDatePayload(payload.weekDate));
  const weekStart = toDateKey(weekdays[0]);
  const weekEnd = toDateKey(weekdays[weekdays.length - 1]);
  const includeCompleted = asBoolean(payload.includeCompleted) ?? false;
  const tasks: unknown[] = [];
  const events: unknown[] = [];
  const workLogs: unknown[] = [];

  for (const project of state.projects) {
    for (const task of project.tasks) {
      if (!includeCompleted && task.completed) {
        continue;
      }

      if (task.dueDate && task.dueDate >= weekStart && task.dueDate <= weekEnd) {
        tasks.push(mode === "detail" ? detailTask(state, project, task) : compactTask(project, task));
      }
    }
  }

  for (const event of state.events) {
    const project = findProject(state, event.projectId);
    if (project && dateRangeOverlaps(event.startDate, event.endDate ?? event.startDate, weekStart, weekEnd)) {
      events.push(mode === "detail" ? detailEvent(project, event) : compactEvent(project, event));
    }
  }

  for (const workLog of state.workLogs) {
    const project = findProject(state, workLog.projectId);
    if (project && dateRangeOverlaps(workLog.date, workLog.endDate ?? workLog.date, weekStart, weekEnd)) {
      workLogs.push(mode === "detail" ? detailWorkLog(project, workLog) : compactWorkLog(project, workLog));
    }
  }

  return {
    ok: true,
    result: itemResult({ weekStart, weekEnd, label: `${weekStart} ~ ${weekEnd}`, tasks, events, workLogs }, mode, true),
  };
}
