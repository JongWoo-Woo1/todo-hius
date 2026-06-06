import type { AppState, Project, Task } from "../types";
import { formatDisplayDate } from "../utils/calendar";
import { getLedgerRows } from "../utils/ledger";
import { formatProgressPercent, isTaskOverdue } from "../utils/task";
import {
  ledgerClientFilter,
  ledgerEmptyState,
  ledgerHideCompletedInput,
  ledgerOverdueOnlyInput,
  ledgerStatusFilter,
  ledgerTableBody,
} from "./dom";

type LedgerViewOptions = {
  onProjectSelect: (project: Project) => void;
  onTaskSelect: (task: Task) => void;
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

function renderLedgerClientOptions(state: AppState): void {
  const currentValue = ledgerClientFilter.value || "전체";
  const clients = Array.from(new Set(state.projects.map((project) => project.clientName).filter(Boolean))).sort();
  ledgerClientFilter.innerHTML = "";
  ledgerClientFilter.append(new Option("전체", "전체"));

  clients.forEach((clientName) => {
    ledgerClientFilter.append(new Option(clientName, clientName));
  });

  ledgerClientFilter.value = clients.includes(currentValue) ? currentValue : "전체";
}

export function renderLedgerView(state: AppState, { onProjectSelect, onTaskSelect }: LedgerViewOptions): void {
  renderLedgerClientOptions(state);
  ledgerTableBody.innerHTML = "";

  const statusFilter = ledgerStatusFilter.value || "전체";
  const clientFilter = ledgerClientFilter.value || "전체";
  const overdueOnly = ledgerOverdueOnlyInput.checked;

  const rows = getLedgerRows(state).filter(({ project, task }) => {
    if (clientFilter !== "전체" && project.clientName !== clientFilter) {
      return false;
    }

    if (statusFilter !== "전체" && task.status !== statusFilter) {
      return false;
    }

    if (ledgerHideCompletedInput.checked && task.completed) {
      return false;
    }

    const overdue = isTaskOverdue(task);
    if (overdueOnly && !overdue) {
      return false;
    }

    return true;
  });

  rows.forEach(({ project, task, clientName, projectName, projectPeriod }, index) => {
    const clientRowSpan = rows.filter((row) => row.clientName === clientName).length;
    const projectRowSpan = rows.filter((row) => row.project.id === project.id).length;
    const isFirstClientRow = rows.findIndex((row) => row.clientName === clientName) === index;
    const isFirstProjectRow = rows.findIndex((row) => row.project.id === project.id) === index;
    const row = document.createElement("tr");
    row.classList.toggle("completed", task.completed);
    row.classList.toggle("priority-high", task.priority === "높음");
    row.dataset.ledgerClient = clientName;
    row.dataset.ledgerProjectId = project.id;
    row.dataset.ledgerTaskId = task.id;
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

    row.append(
      createLedgerCell("ledger-date-cell", formatDisplayDate(task.dueDate)),
      createLedgerCell("ledger-estimate-cell", task.estimate ?? ""),
      createLedgerCell("ledger-title-cell", task.title),
      createStatusCell(task.status),
      createProgressCell(task.progress),
      createPriorityCell(task.priority),
      createLedgerCell("ledger-issue-cell", task.issueRisk ?? ""),
    );
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
      onTaskSelect(task);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      onTaskSelect(task);
    });
    ledgerTableBody.append(row);
  });

  ledgerEmptyState.hidden = rows.length > 0;
}
