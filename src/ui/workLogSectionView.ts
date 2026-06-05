import {
  getProjectById,
  getProjectWorkLogs,
  getTodoByProject,
  getTodoWorkLogs,
} from "../state/selectors";
import type { AppState, Project, WorkLog } from "../types";
import { toDateKey } from "../utils/calendar";
import {
  projectWorkLogCard,
  projectWorkLogEmpty,
  projectWorkLogList,
} from "./dom";
import {
  createWorkLogEntry as createWorkLogEntryElement,
  createWorkLogMoreButton,
} from "./workLogView";

const RECENT_WORK_LOG_DAYS = 7;

type WorkLogEntryHandlers = {
  onSelectWorkLog: (workLogId: string) => void;
};

export type ProjectWorkLogSectionParams = WorkLogEntryHandlers & {
  state: AppState;
  activeProject: Project | null;
  expandedProjectWorkLogId: string | null;
  onToggleExpand: (nextExpandedId: string | null) => void;
};

export type TodoWorkLogSummaryParams = WorkLogEntryHandlers & {
  state: AppState;
  todoId: string;
  showAll: boolean;
  onToggleExpand: (todoId: string, expand: boolean) => void;
};

function getRecentWorkLogCutoffKey(): string {
  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (RECENT_WORK_LOG_DAYS - 1));
  return toDateKey(cutoff);
}

export function getVisibleWorkLogs(workLogs: WorkLog[], showAll: boolean): WorkLog[] {
  if (showAll) {
    return workLogs;
  }

  const cutoffKey = getRecentWorkLogCutoffKey();
  return workLogs.filter((workLog) => workLog.date >= cutoffKey);
}

function createWorkLogEntry(
  state: AppState,
  workLog: WorkLog,
  handlers: WorkLogEntryHandlers,
  options: { showProject?: boolean; compact?: boolean } = {},
): HTMLElement {
  const project = getProjectById(state, workLog.projectId);
  const linkedTodo = getTodoByProject(project, workLog.todoId);

  return createWorkLogEntryElement(workLog, {
    ...options,
    project,
    linkedTodo,
    onSelect: () => handlers.onSelectWorkLog(workLog.id),
  });
}

export function renderProjectWorkLogSection(params: ProjectWorkLogSectionParams): void {
  const { state, activeProject, expandedProjectWorkLogId, onToggleExpand } = params;
  projectWorkLogList.innerHTML = "";

  if (!activeProject) {
    projectWorkLogCard.hidden = true;
    projectWorkLogEmpty.hidden = true;
    return;
  }

  const workLogs = getProjectWorkLogs(state, activeProject.id);
  const showAll = expandedProjectWorkLogId === activeProject.id;
  const visibleWorkLogs = getVisibleWorkLogs(workLogs, showAll);
  projectWorkLogCard.hidden = false;
  projectWorkLogEmpty.hidden = workLogs.length > 0;

  visibleWorkLogs.forEach((workLog) => {
    projectWorkLogList.append(createWorkLogEntry(state, workLog, params));
  });

  if (visibleWorkLogs.length !== workLogs.length) {
    projectWorkLogList.append(
      createWorkLogMoreButton({
        visibleCount: visibleWorkLogs.length,
        totalCount: workLogs.length,
        expanded: showAll,
        onToggle: () => {
          onToggleExpand(activeProject.id);
        },
      }),
    );
  } else if (showAll && workLogs.length > 0) {
    projectWorkLogList.append(
      createWorkLogMoreButton({
        visibleCount: visibleWorkLogs.length,
        totalCount: workLogs.length,
        expanded: showAll,
        onToggle: () => {
          onToggleExpand(null);
        },
      }),
    );
  }
}

export function renderTodoWorkLogSummary(params: TodoWorkLogSummaryParams): HTMLElement {
  const { state, todoId, showAll, onToggleExpand } = params;
  const section = document.createElement("section");
  section.className = "todo-work-log-summary";

  const heading = document.createElement("h4");
  heading.textContent = "Linked Weekly Logs";
  section.append(heading);

  const workLogs = getTodoWorkLogs(state, todoId);
  const visibleWorkLogs = getVisibleWorkLogs(workLogs, showAll);
  if (workLogs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No weekly logs linked to this task yet.";
    section.append(empty);
    return section;
  }

  const list = document.createElement("div");
  list.className = "todo-work-log-list";
  visibleWorkLogs.forEach((workLog) => {
    list.append(createWorkLogEntry(state, workLog, params, { compact: true }));
  });

  if (visibleWorkLogs.length !== workLogs.length) {
    list.append(
      createWorkLogMoreButton({
        visibleCount: visibleWorkLogs.length,
        totalCount: workLogs.length,
        expanded: showAll,
        onToggle: () => {
          onToggleExpand(todoId, true);
        },
      }),
    );
  } else if (showAll && workLogs.length > 0) {
    list.append(
      createWorkLogMoreButton({
        visibleCount: visibleWorkLogs.length,
        totalCount: workLogs.length,
        expanded: showAll,
        onToggle: () => {
          onToggleExpand(todoId, false);
        },
      }),
    );
  }
  section.append(list);
  return section;
}
