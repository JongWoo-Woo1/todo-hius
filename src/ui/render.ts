import {
  loadCalendarRangePreferences,
  normalizeCalendarRangePreferences,
  saveCalendarRangePreferences,
  type CalendarRangePreferences,
} from "../state/calendarPreferences";
import { deleteTodo, deleteWorkLog, getActiveProject, getState, reorderProjects, selectProject, toggleTodo } from "../state/store";
import { getMonthGridDates, getMonthLabel, toDateKey } from "../utils/calendar";
import { formatDueDate } from "../utils/date";
import { formatProjectPeriod } from "../utils/project";
import { formatProgressPercent, isTodoOverdue } from "../utils/task";
import { getWeekRangeLabel, getWeekdays } from "../utils/week";
import {
  activeProjectName,
  calendarColumnSelect,
  calendarEndMonthSelect,
  calendarEmptyState,
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
  ledgerOverdueOnlyInput,
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
  weeklyEmptyState,
  weeklyGrid,
  weeklyRangeLabel,
  weeklyViewButton,
  weeklyWorkspace,
  workLogDateInput,
  workLogProjectSelect,
  workLogTodoSelect,
} from "./dom";

type CalendarTodo = {
  projectName: string;
  title: string;
  completed: boolean;
  overdue: boolean;
  color: string;
};

type WeeklyItem = {
  id?: string;
  projectName: string;
  content: string;
  color: string;
  source: "todo" | "workLog";
};

let selectedTodoId: string | null = null;
let currentView: "projects" | "ledger" | "weekly" | "calendar" = "calendar";
let visibleMonth = new Date();
let visibleWeekDate = new Date();
let selectedCalendarProjectIds: Set<string> | null = null;
let draggedProjectId: string | null = null;
let calendarMode: "month" | "range" = "month";
let calendarRangePreferences = loadCalendarRangePreferences();

const RANGE_CALENDAR_YEAR = 2026;
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}`);
const WEEKLY_SECTIONS = [
  { key: "plan", title: "업무 계획" },
  { key: "done", title: "업무 내용" },
  { key: "note", title: "특이사항" },
] as const;

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
  const overdueOnly = ledgerOverdueOnlyInput.checked;
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

      const overdue = isTodoOverdue(todo);
      if (overdueOnly && !overdue) {
        return;
      }

      const row = document.createElement("tr");
      row.classList.toggle("completed", todo.completed);
      row.classList.toggle("overdue", overdue);
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
        <td><span class="progress-pill">${formatProgressPercent(todo.progress)}</span></td>
        <td>${todo.priority ? `<span class="priority-badge">${todo.priority}</span>` : ""}</td>
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

function renderWorkLogProjectOptions(): void {
  const currentProjectId = workLogProjectSelect.value || getState().activeProjectId || "";
  workLogProjectSelect.innerHTML = "";

  getState().projects.forEach((project) => {
    workLogProjectSelect.append(new Option(project.name, project.id));
  });

  const selectedProject = getState().projects.find((project) => project.id === currentProjectId) ?? getState().projects[0];
  workLogProjectSelect.value = selectedProject?.id ?? "";
}

function renderWorkLogTodoOptions(): void {
  const currentTodoId = workLogTodoSelect.value;
  const selectedProject = getState().projects.find((project) => project.id === workLogProjectSelect.value);
  workLogTodoSelect.innerHTML = "";
  workLogTodoSelect.append(new Option("업무 연결 없음", ""));

  selectedProject?.todos.forEach((todo) => {
    workLogTodoSelect.append(new Option(todo.title, todo.id));
  });

  workLogTodoSelect.value = selectedProject?.todos.some((todo) => todo.id === currentTodoId) ? currentTodoId : "";
}

function renderWorkLogFormOptions(): void {
  renderWorkLogProjectOptions();
  renderWorkLogTodoOptions();
  if (!workLogDateInput.value) {
    workLogDateInput.value = toDateKey(getWeekdays(visibleWeekDate)[0]);
  }
}

function createWeeklyBuckets(): Map<string, Record<(typeof WEEKLY_SECTIONS)[number]["key"], WeeklyItem[]>> {
  const buckets = new Map<string, Record<(typeof WEEKLY_SECTIONS)[number]["key"], WeeklyItem[]>>();

  getWeekdays(visibleWeekDate).forEach((date) => {
    buckets.set(toDateKey(date), {
      plan: [],
      done: [],
      note: [],
    });
  });

  return buckets;
}

function renderWeeklyItem(item: WeeklyItem): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-item";
  wrapper.classList.toggle("todo-source", item.source === "todo");
  wrapper.style.setProperty("--project-color", item.color);

  const copy = document.createElement("p");
  const projectName = document.createElement("strong");
  projectName.textContent = `[${item.projectName}]`;
  copy.append(projectName, ` ${item.content}`);
  wrapper.append(copy);

  if (item.source === "workLog" && item.id) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-work-log-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      deleteWorkLog(item.id!);
      render();
    });
    wrapper.append(deleteButton);
  }

  return wrapper;
}

function renderWeeklySection(title: string, items: WeeklyItem[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "weekly-section";

  const heading = document.createElement("h4");
  heading.textContent = title;
  section.append(heading);

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "weekly-empty";
    empty.textContent = "No items.";
    section.append(empty);
    return section;
  }

  items.forEach((item) => {
    section.append(renderWeeklyItem(item));
  });

  return section;
}

function renderWeekly(): void {
  renderWorkLogFormOptions();
  weeklyRangeLabel.textContent = getWeekRangeLabel(visibleWeekDate);
  weeklyGrid.innerHTML = "";

  const buckets = createWeeklyBuckets();
  let weeklyItemCount = 0;

  getState().projects.forEach((project) => {
    project.todos.forEach((todo) => {
      if (!todo.dueDate || !buckets.has(todo.dueDate)) {
        return;
      }

      buckets.get(todo.dueDate)!.plan.push({
        projectName: project.name,
        content: todo.title,
        color: project.color,
        source: "todo",
      });
      weeklyItemCount += 1;
    });
  });

  getState().workLogs.forEach((workLog) => {
    const bucket = buckets.get(workLog.date);
    if (!bucket) {
      return;
    }

    const project = getState().projects.find((item) => item.id === workLog.projectId);
    const projectName = project?.name ?? "Unknown";
    const color = project?.color ?? "#94a3b8";
    const item: WeeklyItem = {
      id: workLog.id,
      projectName,
      content: workLog.content,
      color,
      source: "workLog",
    };

    if (workLog.type === "계획") {
      bucket.plan.push(item);
    } else if (workLog.type === "수행") {
      bucket.done.push(item);
    } else {
      bucket.note.push(item);
    }
    weeklyItemCount += 1;
  });

  getWeekdays(visibleWeekDate).forEach((date) => {
    const dateKey = toDateKey(date);
    const dayBuckets = buckets.get(dateKey)!;
    const dayCard = document.createElement("article");
    dayCard.className = "weekly-day-card";

    const dayTitle = document.createElement("div");
    dayTitle.className = "weekly-day-title";
    const dayName = document.createElement("span");
    dayName.textContent = date.toLocaleDateString("en-US", { weekday: "short" });
    const dayDate = document.createElement("strong");
    dayDate.textContent = dateKey;
    dayTitle.append(dayName, dayDate);
    dayCard.append(dayTitle);

    WEEKLY_SECTIONS.forEach((section) => {
      dayCard.append(renderWeeklySection(section.title, dayBuckets[section.key]));
    });

    weeklyGrid.append(dayCard);
  });

  weeklyEmptyState.hidden = weeklyItemCount > 0;
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
        overdue: isTodoOverdue(todo),
        color: project.color,
      });
      dueTodosByDate.set(todo.dueDate, items);
    });
  });

  return dueTodosByDate;
}

function appendMonthGrid(monthDate: Date, dueTodosByDate: Map<string, CalendarTodo[]>, container: HTMLElement): number {
  let itemCount = 0;

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
      item.classList.toggle("overdue", todo.overdue);
      item.style.setProperty("--project-color", todo.color);
      item.innerHTML = `
        <strong>${todo.title}</strong>
        <span>${todo.projectName}${todo.overdue ? " · Overdue" : ""}</span>
      `;
      cell.append(item);
      itemCount += 1;
    });

    container.append(cell);
  });

  return itemCount;
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

function renderMonthCalendar(dueTodosByDate: Map<string, CalendarTodo[]>): number {
  calendarMonthLabel.textContent = getMonthLabel(visibleMonth);
  calendarGrid.className = "calendar-grid";
  calendarGrid.removeAttribute("style");
  return appendMonthGrid(visibleMonth, dueTodosByDate, calendarGrid);
}

function renderRangeCalendar(dueTodosByDate: Map<string, CalendarTodo[]>): number {
  const preferences = normalizeCalendarRangePreferences(calendarRangePreferences);
  calendarRangePreferences = preferences;
  calendarMonthLabel.textContent = `${RANGE_CALENDAR_YEAR}`;
  calendarGrid.className = "calendar-range-grid";
  calendarGrid.style.setProperty("--calendar-range-columns", String(preferences.columns));
  let itemCount = 0;

  for (let month = preferences.startMonth; month <= preferences.endMonth; month += 1) {
    const monthSection = document.createElement("section");
    monthSection.className = "calendar-month-panel";

    const monthTitle = document.createElement("h3");
    monthTitle.textContent = `${RANGE_CALENDAR_YEAR}.${String(month).padStart(2, "0")}`;
    monthSection.append(monthTitle);
    appendWeekdays(monthSection);

    const monthGrid = document.createElement("div");
    monthGrid.className = "calendar-grid compact-calendar-grid";
    itemCount += appendMonthGrid(new Date(RANGE_CALENDAR_YEAR, month - 1, 1), dueTodosByDate, monthGrid);
    monthSection.append(monthGrid);

    calendarGrid.append(monthSection);
  }

  return itemCount;
}

function renderCalendar(): void {
  ensureCalendarSelection();
  const dueTodosByDate = getDueTodosByDate();
  calendarGrid.innerHTML = "";
  calendarRangeControls.hidden = calendarMode !== "range";
  calendarWeekdays.hidden = calendarMode === "range";
  let itemCount = 0;

  if (calendarMode === "range") {
    itemCount = renderRangeCalendar(dueTodosByDate);
  } else {
    itemCount = renderMonthCalendar(dueTodosByDate);
  }

  calendarEmptyState.hidden = itemCount > 0;
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
  emptyState.textContent = "선택된 프로젝트에 업무가 없습니다.";
  emptyState.hidden = activeProject.todos.length > 0;
  todoForm.hidden = false;
  projectInfoForm.hidden = false;
  deleteProjectButton.hidden = false;

  activeProject.todos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = "todo-item";
    item.classList.toggle("completed", todo.completed);
    item.classList.toggle("selected", todo.id === selectedTodoId);
    item.classList.toggle("overdue", isTodoOverdue(todo));

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
    const overdue = isTodoOverdue(todo);
    copy.innerHTML = `
      <p class="todo-title">
        <span class="status-badge" data-status="${todo.status}">${todo.status}</span>
        ${todo.priority ? `<span class="priority-badge">${todo.priority}</span>` : ""}
        ${overdue ? `<span class="overdue-badge">Overdue</span>` : ""}
        ${todo.title}
      </p>
      <p class="todo-meta">
        <span class="progress-pill">${formatProgressPercent(todo.progress)}</span>
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

export function resetCalendarSelection(): void {
  selectedCalendarProjectIds = null;
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

export function showWeeklyView(): void {
  currentView = "weekly";
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

export function goToPreviousWeek(): void {
  visibleWeekDate = new Date(visibleWeekDate.getFullYear(), visibleWeekDate.getMonth(), visibleWeekDate.getDate() - 7);
  workLogDateInput.value = toDateKey(getWeekdays(visibleWeekDate)[0]);
}

export function goToNextWeek(): void {
  visibleWeekDate = new Date(visibleWeekDate.getFullYear(), visibleWeekDate.getMonth(), visibleWeekDate.getDate() + 7);
  workLogDateInput.value = toDateKey(getWeekdays(visibleWeekDate)[0]);
}

export function getVisibleWeekDate(): Date {
  return new Date(visibleWeekDate);
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
  renderWeekly();
  renderCalendarFilters();
  renderCalendar();
  projectWorkspace.hidden = currentView !== "projects";
  ledgerWorkspace.hidden = currentView !== "ledger";
  weeklyWorkspace.hidden = currentView !== "weekly";
  calendarWorkspace.hidden = currentView !== "calendar";
  ledgerViewButton.classList.toggle("active", currentView === "ledger");
  weeklyViewButton.classList.toggle("active", currentView === "weekly");
  calendarViewButton.classList.toggle("active", currentView === "calendar");
}
