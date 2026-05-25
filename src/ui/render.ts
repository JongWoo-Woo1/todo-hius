import {
  loadCalendarRangePreferences,
  normalizeCalendarRangePreferences,
  saveCalendarRangePreferences,
  type CalendarRangePreferences,
} from "../state/calendarPreferences";
import { deleteTodo, getActiveProject, getState, reorderProjects, selectProject, toggleTodo } from "../state/store";
import { getMonthGridDates, getMonthLabel, toDateKey } from "../utils/calendar";
import { formatDueDate } from "../utils/date";
import {
  activeProjectName,
  calendarColumnSelect,
  calendarEndMonthSelect,
  calendarFilterList,
  calendarGrid,
  calendarMonthLabel,
  calendarRangeControls,
  calendarStartMonthSelect,
  calendarViewButton,
  calendarWeekdays,
  calendarWorkspace,
  deleteProjectButton,
  emptyState,
  ledgerClientFilter,
  ledgerEmptyState,
  ledgerHideCompletedInput,
  ledgerStatusFilter,
  ledgerTableBody,
  ledgerViewButton,
  ledgerWorkspace,
  projectColorInput,
  projectClientNameInput,
  projectInfoForm,
  projectList,
  projectNumberInput,
  projectPeriodEndInput,
  projectPeriodStartInput,
  projectPeriodTextInput,
  projectWorkspace,
  todoCount,
  todoDetailDueDateInput,
  todoDetailEstimateInput,
  todoDetailIssueRiskInput,
  todoDetailManagerCommentInput,
  todoDetailMemoInput,
  todoDetailPanel,
  todoDetailPrioritySelect,
  todoDetailProgressInput,
  todoDetailStatusSelect,
  todoDetailTaskTitleInput,
  todoDetailTitle,
  todoDetailWorkerCommentInput,
  todoForm,
  todoList,
  toggleAllProjectsButton,
} from "./dom";

type CalendarTodo = {
  projectName: string;
  title: string;
  completed: boolean;
  color: string;
};

let selectedTodoId: string | null = null;
let currentView: "projects" | "ledger" | "calendar" = "calendar";
let visibleMonth = new Date();
let selectedCalendarProjectIds: Set<string> | null = null;
let draggedProjectId: string | null = null;
let calendarMode: "month" | "range" = "month";
let calendarRangePreferences = loadCalendarRangePreferences();

const RANGE_CALENDAR_YEAR = 2026;
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}`);

function ensureCalendarSelection(): void {
  const projectIds = getState().projects.map((project) => project.id);
  if (!selectedCalendarProjectIds) {
    selectedCalendarProjectIds = new Set(projectIds);
    return;
  }

  const existingSelection = selectedCalendarProjectIds;
  selectedCalendarProjectIds = new Set(projectIds.filter((projectId) => existingSelection.has(projectId)));
}

function sortTodosByDueDate(): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  activeProject.todos.sort((left, right) => {
    if (!left.dueDate && !right.dueDate) {
      return left.title.localeCompare(right.title);
    }

    if (!left.dueDate) {
      return 1;
    }

    if (!right.dueDate) {
      return -1;
    }

    return left.dueDate.localeCompare(right.dueDate);
  });
}

function formatProjectPeriod(project: { periodText?: string; periodStart?: string | null; periodEnd?: string | null }): string {
  if (project.periodText) {
    return project.periodText;
  }

  if (project.periodStart || project.periodEnd) {
    return `${project.periodStart ?? ""} ~ ${project.periodEnd ?? ""}`;
  }

  return "";
}

function renderLedgerClientOptions(): void {
  const currentValue = ledgerClientFilter.value || "전체";
  const clients = Array.from(new Set(getState().projects.map((project) => project.clientName).filter(Boolean))).sort();
  ledgerClientFilter.innerHTML = "";
  ledgerClientFilter.append(new Option("전체", "전체"));

  clients.forEach((clientName) => {
    ledgerClientFilter.append(new Option(clientName, clientName));
  });

  ledgerClientFilter.value = clients.includes(currentValue) ? currentValue : "전체";
}

function renderLedger(): void {
  renderLedgerClientOptions();
  ledgerTableBody.innerHTML = "";

  const statusFilter = ledgerStatusFilter.value || "전체";
  const clientFilter = ledgerClientFilter.value || "전체";
  let rowCount = 0;

  getState().projects.forEach((project) => {
    if (clientFilter !== "전체" && project.clientName !== clientFilter) {
      return;
    }

    project.todos.forEach((todo) => {
      if (statusFilter !== "전체" && todo.status !== statusFilter) {
        return;
      }

      if (ledgerHideCompletedInput.checked && todo.completed) {
        return;
      }

      const row = document.createElement("tr");
      row.classList.toggle("completed", todo.completed);
      row.tabIndex = 0;
      row.innerHTML = `
        <td>${project.clientName}</td>
        <td>${project.projectNumber ?? ""}</td>
        <td>${project.name}</td>
        <td>${formatProjectPeriod(project)}</td>
        <td>${todo.dueDate ?? ""}</td>
        <td>${todo.estimate ?? ""}</td>
        <td>${todo.title}</td>
        <td><span class="status-badge" data-status="${todo.status}">${todo.status}</span></td>
        <td>${Math.round(todo.progress * 100)}%</td>
        <td>${todo.priority ?? ""}</td>
        <td>${todo.issueRisk ?? ""}</td>
        <td>${todo.workerComment ?? ""}</td>
        <td>${todo.managerComment ?? ""}</td>
      `;
      row.addEventListener("click", () => {
        selectProject(project.id);
        selectedTodoId = todo.id;
        currentView = "projects";
        render();
      });
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        selectProject(project.id);
        selectedTodoId = todo.id;
        currentView = "projects";
        render();
      });
      ledgerTableBody.append(row);
      rowCount += 1;
    });
  });

  ledgerEmptyState.hidden = rowCount > 0;
}

function renderProjects(): void {
  projectList.innerHTML = "";

  getState().projects.forEach((project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-button";
    button.draggable = true;
    button.dataset.projectId = project.id;
    button.classList.toggle("active", currentView === "projects" && project.id === getState().activeProjectId);
    button.innerHTML = `
      <span class="project-name">
        <span class="project-swatch" style="--project-color: ${project.color}"></span>
        ${project.name}
      </span>
      <span>${project.todos.length}</span>
    `;
    button.addEventListener("click", () => {
      selectProject(project.id);
      currentView = "projects";
      render();
    });
    button.addEventListener("dragstart", (event) => {
      draggedProjectId = project.id;
      button.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", project.id);
      event.dataTransfer?.setDragImage(button, 12, 20);
    });
    button.addEventListener("dragend", () => {
      draggedProjectId = null;
      button.classList.remove("dragging");
    });
    button.addEventListener("dragover", (event) => {
      if (!draggedProjectId || draggedProjectId === project.id) {
        return;
      }

      event.preventDefault();
      button.classList.add("drag-over");
    });
    button.addEventListener("dragleave", () => {
      button.classList.remove("drag-over");
    });
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("drag-over");
      const sourceProjectId = draggedProjectId ?? event.dataTransfer?.getData("text/plain");
      if (!sourceProjectId) {
        return;
      }

      reorderProjects(sourceProjectId, project.id);
      draggedProjectId = null;
      render();
    });
    projectList.append(button);
  });
}

function getDueTodosByDate(): Map<string, CalendarTodo[]> {
  const selectedProjectIds = selectedCalendarProjectIds ?? new Set<string>();
  const dueTodosByDate = new Map<string, CalendarTodo[]>();

  getState().projects.forEach((project) => {
    if (!selectedProjectIds.has(project.id)) {
      return;
    }

    project.todos.forEach((todo) => {
      if (!todo.dueDate) {
        return;
      }

      const items = dueTodosByDate.get(todo.dueDate) ?? [];
      items.push({
        projectName: project.name,
        title: todo.title,
        completed: todo.completed,
        color: project.color,
      });
      dueTodosByDate.set(todo.dueDate, items);
    });
  });

  return dueTodosByDate;
}

function appendMonthGrid(monthDate: Date, dueTodosByDate: Map<string, CalendarTodo[]>, container: HTMLElement): void {
  getMonthGridDates(monthDate).forEach((date) => {
    const dateKey = toDateKey(date);
    const cell = document.createElement("section");
    cell.className = "calendar-cell";
    cell.classList.toggle("outside-month", date.getMonth() !== monthDate.getMonth());

    const dateLabel = document.createElement("p");
    dateLabel.className = "calendar-date";
    dateLabel.textContent = String(date.getDate());
    cell.append(dateLabel);

    const todos = dueTodosByDate.get(dateKey) ?? [];
    todos.forEach((todo) => {
      const item = document.createElement("div");
      item.className = "calendar-item";
      item.classList.toggle("completed", todo.completed);
      item.style.setProperty("--project-color", todo.color);
      item.innerHTML = `
        <strong>${todo.title}</strong>
        <span>${todo.projectName}</span>
      `;
      cell.append(item);
    });

    container.append(cell);
  });
}

function appendWeekdays(container: HTMLElement): void {
  const weekdays = document.createElement("div");
  weekdays.className = "calendar-weekdays month-weekdays";
  weekdays.setAttribute("aria-hidden", "true");
  weekdays.innerHTML = `
    <span>Sun</span>
    <span>Mon</span>
    <span>Tue</span>
    <span>Wed</span>
    <span>Thu</span>
    <span>Fri</span>
    <span>Sat</span>
  `;
  container.append(weekdays);
}

function renderMonthCalendar(dueTodosByDate: Map<string, CalendarTodo[]>): void {
  calendarMonthLabel.textContent = getMonthLabel(visibleMonth);
  calendarGrid.className = "calendar-grid";
  calendarGrid.removeAttribute("style");
  appendMonthGrid(visibleMonth, dueTodosByDate, calendarGrid);
}

function renderRangeCalendar(dueTodosByDate: Map<string, CalendarTodo[]>): void {
  const preferences = normalizeCalendarRangePreferences(calendarRangePreferences);
  calendarRangePreferences = preferences;
  calendarMonthLabel.textContent = `${RANGE_CALENDAR_YEAR}`;
  calendarGrid.className = "calendar-range-grid";
  calendarGrid.style.setProperty("--calendar-range-columns", String(preferences.columns));

  for (let month = preferences.startMonth; month <= preferences.endMonth; month += 1) {
    const monthSection = document.createElement("section");
    monthSection.className = "calendar-month-panel";

    const monthTitle = document.createElement("h3");
    monthTitle.textContent = `${RANGE_CALENDAR_YEAR}.${String(month).padStart(2, "0")}`;
    monthSection.append(monthTitle);
    appendWeekdays(monthSection);

    const monthGrid = document.createElement("div");
    monthGrid.className = "calendar-grid compact-calendar-grid";
    appendMonthGrid(new Date(RANGE_CALENDAR_YEAR, month - 1, 1), dueTodosByDate, monthGrid);
    monthSection.append(monthGrid);

    calendarGrid.append(monthSection);
  }
}

function renderCalendar(): void {
  ensureCalendarSelection();
  const dueTodosByDate = getDueTodosByDate();
  calendarGrid.innerHTML = "";
  calendarRangeControls.hidden = calendarMode !== "range";
  calendarWeekdays.hidden = calendarMode === "range";

  if (calendarMode === "range") {
    renderRangeCalendar(dueTodosByDate);
    return;
  }

  renderMonthCalendar(dueTodosByDate);
}

function renderCalendarFilters(): void {
  ensureCalendarSelection();
  const selectedProjectIds = selectedCalendarProjectIds ?? new Set<string>();
  calendarFilterList.innerHTML = "";

  getState().projects.forEach((project) => {
    const label = document.createElement("label");
    label.className = "calendar-filter-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedProjectIds.has(project.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedProjectIds.add(project.id);
      } else {
        selectedProjectIds.delete(project.id);
      }
      selectedCalendarProjectIds = selectedProjectIds;
      render();
    });

    const swatch = document.createElement("span");
    swatch.className = "project-swatch";
    swatch.style.setProperty("--project-color", project.color);

    const name = document.createElement("span");
    name.textContent = project.name;

    label.append(checkbox, swatch, name);
    calendarFilterList.append(label);
  });

  const allSelected = getState().projects.length > 0 && selectedProjectIds.size === getState().projects.length;
  toggleAllProjectsButton.textContent = allSelected ? "Clear all" : "Select all";
}

function renderMonthOptions(): void {
  calendarStartMonthSelect.innerHTML = "";
  calendarEndMonthSelect.innerHTML = "";

  MONTH_LABELS.forEach((label, index) => {
    const month = index + 1;
    calendarStartMonthSelect.append(new Option(label, String(month)));
    calendarEndMonthSelect.append(new Option(label, String(month)));
  });

  calendarStartMonthSelect.value = String(calendarRangePreferences.startMonth);
  calendarEndMonthSelect.value = String(calendarRangePreferences.endMonth);
}

function renderColumnOptions(): void {
  const monthCount = calendarRangePreferences.endMonth - calendarRangePreferences.startMonth + 1;
  const maxColumns = Math.min(4, monthCount);
  calendarColumnSelect.innerHTML = "";

  for (let columns = 1; columns <= maxColumns; columns += 1) {
    calendarColumnSelect.append(new Option(String(columns), String(columns)));
  }

  calendarRangePreferences = normalizeCalendarRangePreferences(calendarRangePreferences);
  calendarColumnSelect.value = String(calendarRangePreferences.columns);
}

function renderRangeControls(): void {
  renderMonthOptions();
  renderColumnOptions();
}

function renderTodos(): void {
  const activeProject = getActiveProject();
  todoList.innerHTML = "";

  if (!activeProject) {
    activeProjectName.textContent = "Add a project";
    todoCount.textContent = "0 items";
    emptyState.textContent = "Create a project first.";
    emptyState.hidden = false;
    todoForm.hidden = true;
    projectInfoForm.hidden = true;
    deleteProjectButton.hidden = true;
    selectedTodoId = null;
    renderTodoDetail();
    return;
  }

  sortTodosByDueDate();
  activeProjectName.textContent = activeProject.name;
  projectColorInput.value = activeProject.color;
  projectClientNameInput.value = activeProject.clientName;
  projectNumberInput.value = activeProject.projectNumber ?? "";
  projectPeriodTextInput.value = activeProject.periodText ?? "";
  projectPeriodStartInput.value = activeProject.periodStart ?? "";
  projectPeriodEndInput.value = activeProject.periodEnd ?? "";
  todoCount.textContent = `${activeProject.todos.length} items`;
  emptyState.textContent = "No tasks yet.";
  emptyState.hidden = activeProject.todos.length > 0;
  todoForm.hidden = false;
  projectInfoForm.hidden = false;
  deleteProjectButton.hidden = false;

  activeProject.todos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = "todo-item";
    item.classList.toggle("completed", todo.completed);
    item.classList.toggle("selected", todo.id === selectedTodoId);

    const checkbox = document.createElement("input");
    checkbox.className = "todo-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => {
      toggleTodo(todo.id, checkbox.checked);
      render();
    });
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const copy = document.createElement("div");
    copy.className = "todo-copy";
    const progressPercent = Math.round(todo.progress * 100);
    copy.innerHTML = `
      <p class="todo-title">
        <span class="status-badge" data-status="${todo.status}">${todo.status}</span>
        ${todo.title}
      </p>
      <p class="todo-meta">
        <span class="progress-pill">${progressPercent}%</span>
        <span>${formatDueDate(todo.dueDate)}</span>
      </p>
    `;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-todo-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      deleteTodo(todo.id);
      if (selectedTodoId === todo.id) {
        selectedTodoId = null;
      }
      render();
    });
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    item.addEventListener("click", () => {
      selectedTodoId = todo.id;
      render();
    });

    item.append(checkbox, copy, deleteButton);
    todoList.append(item);
  });

  renderTodoDetail();
}

function renderTodoDetail(): void {
  const selectedTodo = getActiveProject()?.todos.find((todo) => todo.id === selectedTodoId);
  if (!selectedTodo) {
    todoDetailPanel.hidden = true;
    return;
  }

  todoDetailTitle.textContent = selectedTodo.title;
  todoDetailTaskTitleInput.value = selectedTodo.title;
  todoDetailDueDateInput.value = selectedTodo.dueDate ?? "";
  todoDetailEstimateInput.value = selectedTodo.estimate ?? "";
  todoDetailStatusSelect.value = selectedTodo.status;
  todoDetailProgressInput.value = String(Math.round(selectedTodo.progress * 100));
  todoDetailPrioritySelect.value = selectedTodo.priority ?? "보통";
  todoDetailWorkerCommentInput.value = selectedTodo.workerComment ?? "";
  todoDetailManagerCommentInput.value = selectedTodo.managerComment ?? "";
  todoDetailIssueRiskInput.value = selectedTodo.issueRisk ?? "";
  todoDetailMemoInput.value = selectedTodo.memo;
  todoDetailPanel.hidden = false;
}

export function clearSelectedTodo(): void {
  selectedTodoId = null;
}

export function selectTodo(todoId: string): void {
  selectedTodoId = todoId;
}

export function getSelectedTodoId(): string | null {
  return selectedTodoId;
}

export function showProjectView(): void {
  currentView = "projects";
}

export function showLedgerView(): void {
  currentView = "ledger";
}

export function activateCalendarButton(): void {
  if (currentView === "calendar") {
    calendarMode = calendarMode === "month" ? "range" : "month";
    return;
  }

  currentView = "calendar";
}

export function goToPreviousMonth(): void {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
}

export function goToNextMonth(): void {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
}

export function toggleAllCalendarProjects(): void {
  const projectIds = getState().projects.map((project) => project.id);
  const selectedProjectIds = selectedCalendarProjectIds ?? new Set(projectIds);
  const allSelected = projectIds.length > 0 && selectedProjectIds.size === projectIds.length;
  selectedCalendarProjectIds = allSelected ? new Set() : new Set(projectIds);
}

export function updateCalendarRangePreferences(updates: Partial<CalendarRangePreferences>): void {
  calendarRangePreferences = normalizeCalendarRangePreferences({
    ...calendarRangePreferences,
    ...updates,
  });
  saveCalendarRangePreferences(calendarRangePreferences);
}

export function render(): void {
  renderProjects();
  renderTodos();
  renderRangeControls();
  renderLedger();
  renderCalendarFilters();
  renderCalendar();
  projectWorkspace.hidden = currentView !== "projects";
  ledgerWorkspace.hidden = currentView !== "ledger";
  calendarWorkspace.hidden = currentView !== "calendar";
  ledgerViewButton.classList.toggle("active", currentView === "ledger");
  calendarViewButton.classList.toggle("active", currentView === "calendar");
}
