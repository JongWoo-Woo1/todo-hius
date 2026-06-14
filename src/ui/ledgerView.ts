import type { AppState, Project, Task, TaskStatus } from "../types";
import { formatDisplayDate } from "../utils/calendar";
import { getLedgerRows } from "../utils/ledger";
import { formatProgressPercent } from "../utils/task";
import {
  ledgerEmptyState,
  ledgerProjectFilterList,
  ledgerSettingsBackdrop,
  ledgerSettingsButton,
  ledgerSettingsCloseButton,
  ledgerSettingsPanel,
  ledgerStatusFilterList,
  ledgerTableBody,
  ledgerToggleAllProjectsButton,
} from "./dom";

const LEDGER_STATUSES: TaskStatus[] = ["대기", "진행중", "검토대기", "완료"];

type LedgerViewOptions = {
  onProjectSelect: (project: Project) => void;
  onTaskSelect: (task: Task) => void;
  isSettingsOpen: boolean;
  onToggleSettings: (open: boolean) => void;
  selectedStatuses: Set<TaskStatus>;
  onSelectedStatusesChange: (statuses: Set<TaskStatus>) => void;
  onProjectVisibilityChange: (projectId: string, visible: boolean) => void;
  onToggleAllProjects: () => void;
};

function createLedgerCell(className: string, text: string): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.className = className;
  cell.textContent = text;
  return cell;
}

function createLedgerMergedCell({
  className,
  text,
  rowSpan,
  projectId,
  clientName,
}: {
  className: string;
  text: string;
  rowSpan: number;
  projectId?: string;
  clientName?: string;
}): HTMLTableCellElement {
  const cell = createLedgerCell(`ledger-merged-cell ${className}`, text);
  cell.rowSpan = rowSpan;

  if (projectId !== undefined) {
    cell.dataset.ledgerProjectId = projectId;
  }

  if (clientName !== undefined) {
    cell.dataset.ledgerClient = clientName;
  }

  return cell;
}

function createStatusCell(status: Task["status"]): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.className = "ledger-status-cell";

  const badge = document.createElement("span");
  badge.className = "status-badge";
  badge.dataset.status = status;
  badge.textContent = status;
  cell.append(badge);

  return cell;
}

function createProgressCell(progress: Task["progress"]): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.className = "ledger-progress-cell";

  const pill = document.createElement("span");
  pill.className = "progress-pill";
  pill.textContent = formatProgressPercent(progress);
  cell.append(pill);

  return cell;
}

function createPriorityCell(priority: Task["priority"]): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.className = "ledger-priority-cell";

  if (priority) {
    const badge = document.createElement("span");
    badge.className = "priority-badge";
    badge.textContent = priority;
    cell.append(badge);
  }

  return cell;
}

function renderLedgerStatusFilters(
  selectedStatuses: Set<TaskStatus>,
  onSelectedStatusesChange: (statuses: Set<TaskStatus>) => void,
): void {
  ledgerStatusFilterList.innerHTML = "";

  LEDGER_STATUSES.forEach((status) => {
    const label = document.createElement("label");
    label.className = "calendar-filter-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedStatuses.has(status);
    checkbox.addEventListener("change", () => {
      const nextStatuses = new Set(selectedStatuses);
      if (checkbox.checked) {
        nextStatuses.add(status);
      } else {
        nextStatuses.delete(status);
      }
      onSelectedStatusesChange(nextStatuses);
    });

    const name = document.createElement("span");
    name.textContent = status;

    label.append(checkbox, name);
    ledgerStatusFilterList.append(label);
  });
}

function renderLedgerProjectFilters(
  state: AppState,
  onProjectVisibilityChange: (projectId: string, visible: boolean) => void,
): void {
  ledgerProjectFilterList.innerHTML = "";

  state.projects.forEach((project) => {
    const label = document.createElement("label");
    label.className = "calendar-filter-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !project.hideFromLedger;
    checkbox.addEventListener("change", () => {
      onProjectVisibilityChange(project.id, checkbox.checked);
    });

    const swatch = document.createElement("span");
    swatch.className = "project-swatch";
    swatch.style.setProperty("--project-color", project.color);

    const name = document.createElement("span");
    name.textContent = project.name;

    label.append(checkbox, swatch, name);
    ledgerProjectFilterList.append(label);
  });
}

function renderLedgerSettingsPanel(isOpen: boolean, onToggleSettings: (open: boolean) => void): void {
  ledgerSettingsPanel.hidden = !isOpen;
  ledgerSettingsPanel.setAttribute("aria-hidden", String(!isOpen));
  ledgerSettingsPanel.classList.toggle("is-open", isOpen);
  ledgerSettingsBackdrop.hidden = !isOpen;
  ledgerSettingsButton.setAttribute("aria-expanded", String(isOpen));

  ledgerSettingsButton.onclick = () => onToggleSettings(!isOpen);
  ledgerSettingsCloseButton.onclick = () => onToggleSettings(false);
  ledgerSettingsBackdrop.onclick = () => onToggleSettings(false);
}

export function renderLedgerView(
  state: AppState,
  {
    onProjectSelect,
    onTaskSelect,
    isSettingsOpen,
    onToggleSettings,
    selectedStatuses,
    onSelectedStatusesChange,
    onProjectVisibilityChange,
    onToggleAllProjects,
  }: LedgerViewOptions,
): void {
  renderLedgerStatusFilters(selectedStatuses, onSelectedStatusesChange);
  renderLedgerProjectFilters(state, onProjectVisibilityChange);
  renderLedgerSettingsPanel(isSettingsOpen, onToggleSettings);
  const visibleProjectCount = state.projects.filter((project) => !project.hideFromLedger).length;
  const allProjectsVisible = state.projects.length > 0 && visibleProjectCount === state.projects.length;
  ledgerToggleAllProjectsButton.textContent = allProjectsVisible ? "Clear all" : "Select all";
  ledgerToggleAllProjectsButton.onclick = onToggleAllProjects;
  ledgerTableBody.innerHTML = "";

  const rows = getLedgerRows(state).filter((ledgerRow) => {
    if (ledgerRow.kind === "project-empty") {
      return true;
    }

    const { task } = ledgerRow;
    return selectedStatuses.has(task.status);
  });

  rows.forEach((ledgerRow, index) => {
    const { project, clientName, projectName, projectPeriod } = ledgerRow;
    const clientRowSpan = rows.filter((row) => row.clientName === clientName).length;
    const projectRowSpan = rows.filter((row) => row.project.id === project.id).length;
    const isFirstClientRow = rows.findIndex((row) => row.clientName === clientName) === index;
    const isFirstProjectRow = rows.findIndex((row) => row.project.id === project.id) === index;
    const isTaskRow = ledgerRow.kind === "task";
    const task = isTaskRow ? ledgerRow.task : null;
    const isPriorityFocus = task?.priority === "높음" || task?.priority === "최우선";
    const row = document.createElement("tr");
    row.classList.toggle("completed", task?.completed === true);
    row.classList.toggle("priority-high", isPriorityFocus);
    row.dataset.ledgerClient = clientName;
    row.dataset.ledgerProjectId = project.id;
    if (task) {
      row.dataset.ledgerTaskId = task.id;
    }
    row.tabIndex = 0;

    if (isFirstClientRow) {
      row.append(
        createLedgerMergedCell({
          className: "ledger-client-cell",
          text: clientName,
          rowSpan: clientRowSpan,
          clientName,
        }),
      );
    }

    if (isFirstProjectRow) {
      row.append(
        createLedgerMergedCell({
          className: "ledger-project-cell",
          text: projectName,
          rowSpan: projectRowSpan,
          projectId: project.id,
        }),
        createLedgerMergedCell({
          className: "ledger-period-cell",
          text: projectPeriod,
          rowSpan: projectRowSpan,
          projectId: project.id,
        }),
      );
    }

    if (task) {
      row.append(
        createLedgerCell("ledger-date-cell", formatDisplayDate(task.dueDate)),
        createLedgerCell("ledger-estimate-cell", task.estimate ?? ""),
        createLedgerCell("ledger-title-cell", task.title),
        createStatusCell(task.status),
        createProgressCell(task.progress),
        createPriorityCell(task.priority),
        createLedgerCell("ledger-memo-cell", task.memo),
      );
    } else {
      row.append(
        createLedgerCell("ledger-date-cell", "-"),
        createLedgerCell("ledger-estimate-cell", "-"),
        createLedgerCell("ledger-title-cell", "업무 미등록"),
        createLedgerCell("ledger-status-cell", "-"),
        createLedgerCell("ledger-progress-cell", "-"),
        createLedgerCell("ledger-priority-cell", "-"),
        createLedgerCell("ledger-memo-cell", "-"),
      );
    }
    const clearLedgerHover = () => {
      ledgerTableBody.querySelectorAll<HTMLElement>(".ledger-hover").forEach((cell) => {
        cell.classList.remove("ledger-hover");
      });
      ledgerTableBody.querySelectorAll<HTMLElement>(".ledger-task-hover").forEach((hoveredRow) => {
        hoveredRow.classList.remove("ledger-task-hover");
      });
    };

    const setLedgerProjectHover = () => {
      clearLedgerHover();
      ledgerTableBody.querySelectorAll<HTMLElement>(".ledger-project-cell, .ledger-period-cell").forEach((cell) => {
        cell.classList.toggle("ledger-hover", cell.dataset.ledgerProjectId === project.id);
      });
    };

    const setLedgerTaskHover = () => {
      setLedgerProjectHover();
      row.classList.add("ledger-task-hover");
    };

    row.querySelectorAll<HTMLElement>(".ledger-project-cell, .ledger-period-cell").forEach((cell) => {
      cell.tabIndex = 0;
      cell.addEventListener("mouseenter", setLedgerProjectHover);
      cell.addEventListener("mouseleave", clearLedgerHover);
      cell.addEventListener("focus", setLedgerProjectHover);
      cell.addEventListener("blur", clearLedgerHover);
      cell.addEventListener("click", (event) => {
        event.stopPropagation();
        onProjectSelect(project);
      });
      cell.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onProjectSelect(project);
      });
    });
    row.querySelectorAll<HTMLElement>("td:not(.ledger-merged-cell)").forEach((cell) => {
      cell.addEventListener("mouseenter", setLedgerTaskHover);
      cell.addEventListener("mouseleave", clearLedgerHover);
    });
    row.addEventListener("focus", setLedgerTaskHover);
    row.addEventListener("blur", clearLedgerHover);
    row.addEventListener("click", () => {
      if (task) {
        onTaskSelect(task);
      } else {
        onProjectSelect(project);
      }
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      if (task) {
        onTaskSelect(task);
      } else {
        onProjectSelect(project);
      }
    });
    ledgerTableBody.append(row);
  });

  ledgerEmptyState.hidden = rows.length > 0;
}
