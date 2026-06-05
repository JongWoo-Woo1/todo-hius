import type { AppState, Project, Todo } from "../types";
import { getLedgerRows } from "../utils/ledger";
import { formatProgressPercent, isTodoOverdue } from "../utils/task";
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
  onTodoSelect: (todo: Todo) => void;
};

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

export function renderLedgerView(state: AppState, { onProjectSelect, onTodoSelect }: LedgerViewOptions): void {
  renderLedgerClientOptions(state);
  ledgerTableBody.innerHTML = "";

  const statusFilter = ledgerStatusFilter.value || "전체";
  const clientFilter = ledgerClientFilter.value || "전체";
  const overdueOnly = ledgerOverdueOnlyInput.checked;

  const rows = getLedgerRows(state).filter(({ project, todo }) => {
    if (clientFilter !== "전체" && project.clientName !== clientFilter) {
      return false;
    }

    if (statusFilter !== "전체" && todo.status !== statusFilter) {
      return false;
    }

    if (ledgerHideCompletedInput.checked && todo.completed) {
      return false;
    }

    const overdue = isTodoOverdue(todo);
    if (overdueOnly && !overdue) {
      return false;
    }

    return true;
  });

  rows.forEach(({ project, todo, clientName, projectName, projectPeriod }, index) => {
    const clientRowSpan = rows.filter((row) => row.clientName === clientName).length;
    const projectRowSpan = rows.filter((row) => row.project.id === project.id).length;
    const isFirstClientRow = rows.findIndex((row) => row.clientName === clientName) === index;
    const isFirstProjectRow = rows.findIndex((row) => row.project.id === project.id) === index;
    const row = document.createElement("tr");
    row.classList.toggle("completed", todo.completed);
    row.classList.toggle("priority-high", todo.priority === "높음");
    row.dataset.ledgerClient = clientName;
    row.dataset.ledgerProjectId = project.id;
    row.dataset.ledgerTodoId = todo.id;
    row.tabIndex = 0;

    const groupedCells = [
      isFirstClientRow
        ? `<td class="ledger-merged-cell ledger-client-cell" data-ledger-client="${clientName}" rowspan="${clientRowSpan}">${clientName}</td>`
        : "",
      isFirstProjectRow
        ? `<td class="ledger-merged-cell ledger-project-cell" data-ledger-project-id="${project.id}" rowspan="${projectRowSpan}">${projectName}</td>`
        : "",
      isFirstProjectRow
        ? `<td class="ledger-merged-cell ledger-period-cell" data-ledger-project-id="${project.id}" rowspan="${projectRowSpan}">${projectPeriod}</td>`
        : "",
    ].join("");

    row.innerHTML = `
        ${groupedCells}
        <td class="ledger-date-cell">${todo.dueDate ?? ""}</td>
        <td class="ledger-estimate-cell">${todo.estimate ?? ""}</td>
        <td class="ledger-title-cell">${todo.title}</td>
        <td class="ledger-status-cell"><span class="status-badge" data-status="${todo.status}">${todo.status}</span></td>
        <td class="ledger-progress-cell"><span class="progress-pill">${formatProgressPercent(todo.progress)}</span></td>
        <td class="ledger-priority-cell">${todo.priority ? `<span class="priority-badge">${todo.priority}</span>` : ""}</td>
        <td class="ledger-issue-cell">${todo.issueRisk ?? ""}</td>
      `;
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
      onTodoSelect(todo);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      onTodoSelect(todo);
    });
    ledgerTableBody.append(row);
  });

  ledgerEmptyState.hidden = rows.length > 0;
}
