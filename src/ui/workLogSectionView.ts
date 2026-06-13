import {
  getLinkedTaskDisplay,
  getProjectById,
  getTaskWorkLogs,
} from "../state/selectors";
import type { AppState, WorkLog } from "../types";
import { toDateKey } from "../utils/calendar";
import {
  createWorkLogEntry as createWorkLogEntryElement,
  createWorkLogMoreButton,
} from "./workLogView";

const RECENT_WORK_LOG_DAYS = 7;

type WorkLogEntryHandlers = {
  onSelectWorkLog: (workLogId: string) => void;
};

export type TaskWorkLogSummaryParams = WorkLogEntryHandlers & {
  state: AppState;
  taskId: string;
  showAll: boolean;
  onToggleExpand: (taskId: string, expand: boolean) => void;
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
  const linkedTaskDisplay = getLinkedTaskDisplay(project, workLog);

  return createWorkLogEntryElement(workLog, {
    ...options,
    project,
    linkedTaskLabel: linkedTaskDisplay.label,
    onSelect: () => handlers.onSelectWorkLog(workLog.id),
  });
}

export function renderTaskWorkLogSummary(params: TaskWorkLogSummaryParams): HTMLElement {
  const { state, taskId, showAll, onToggleExpand } = params;
  const section = document.createElement("section");
  section.className = "todo-work-log-summary";

  const heading = document.createElement("h4");
  heading.textContent = "Linked Weekly Logs";
  section.append(heading);

  const workLogs = getTaskWorkLogs(state, taskId);
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
          onToggleExpand(taskId, true);
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
          onToggleExpand(taskId, false);
        },
      }),
    );
  }
  section.append(list);
  return section;
}
