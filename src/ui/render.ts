import {
  getDefaultCalendarRangePreferences,
  normalizeCalendarRangePreferences,
  type CalendarRangePreferences,
} from "../state/calendarPreferences";
import {
  deleteTodo,
  deleteWorkLog,
  getActiveProject,
  getState,
  reorderProjects,
  selectProject,
  toggleTodo,
  updateTodo,
} from "../state/store";
import type { Project, TaskPriority, TaskStatus, Todo, WorkLog } from "../types";
import { getMonthGridDates, toDateKey } from "../utils/calendar";
import { formatDueDate } from "../utils/date";
import { getLedgerRows } from "../utils/ledger";
import { formatProgressPercent, isTodoOverdue } from "../utils/task";
import { getWeekRangeLabel, getWeekdays } from "../utils/week";
import {
  activeProjectName,
  activeProjectNameButton,
  calendarColumnSelect,
  calendarDetailContent,
  calendarDetailModal,
  calendarEndMonthSelect,
  calendarEmptyState,
  calendarFilterList,
  calendarGrid,
  calendarMonthLabel,
  calendarRangeControls,
  calendarStartMonthSelect,
  calendarViewButton,
  calendarWorkspace,
  cancelProjectInfoButton,
  cancelProjectNameButton,
  deleteProjectButton,
  editProjectInfoButton,
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
  projectInfoView,
  projectList,
  projectNameForm,
  projectNameInput,
  projectNumberInput,
  projectPeriodEndInput,
  projectPeriodStartInput,
  projectPeriodTextInput,
  projectWorkLogCard,
  projectWorkLogEmpty,
  projectWorkLogList,
  projectWorkspace,
  todoCount,
  todoForm,
  todoList,
  toggleAllProjectsButton,
  weeklyEmptyState,
  weeklyGrid,
  weeklyRangeLabel,
  weeklyViewButton,
  weeklyWorkspace,
} from "./dom";

type CalendarTodo = {
  projectId: string;
  todoId: string;
  projectName: string;
  title: string;
  completed: boolean;
  overdue: boolean;
  color: string;
};

type WeeklyItem = {
  id?: string;
  projectId?: string;
  todoId?: string;
  clientName: string;
  projectName: string;
  todoTitle?: string;
  content: string;
  color: string;
  source: "todo" | "workLog";
};

let selectedTodoId: string | null = null;
let editingTodoId: string | null = null;
let isProjectInfoEditing = false;
let isProjectNameEditing = false;
let currentView: "projects" | "ledger" | "weekly" | "calendar" = "calendar";
let visibleWeekDate = new Date();
let selectedCalendarProjectIds: Set<string> | null = null;
let selectedModalTodoId: string | null = null;
let isModalTodoEditing = false;
let selectedModalProjectId: string | null = null;
let draggedProjectId: string | null = null;
let calendarRangePreferences = getDefaultCalendarRangePreferences();
let expandedProjectWorkLogId: string | null = null;
const expandedTodoWorkLogIds = new Set<string>();

const RANGE_CALENDAR_YEAR = 2026;
const RECENT_WORK_LOG_DAYS = 7;
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}`);
const WEEKLY_SECTIONS = [
  { key: "plan", title: "업무 계획" },
  { key: "done", title: "업무 일지" },
] as const;

function toSingleLineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

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

  const rows = getLedgerRows(getState()).filter(({ project, todo }) => {
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
        selectedModalProjectId = project.id;
        selectedModalTodoId = null;
        isModalTodoEditing = false;
        render();
      });
      cell.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        selectedModalProjectId = project.id;
        selectedModalTodoId = null;
        isModalTodoEditing = false;
        render();
      });
    });
    row.querySelectorAll<HTMLElement>("td:not(.ledger-merged-cell)").forEach((cell) => {
      cell.addEventListener("mouseenter", setLedgerTaskHover);
      cell.addEventListener("mouseleave", clearLedgerHover);
    });
    row.addEventListener("focus", setLedgerTaskHover);
    row.addEventListener("blur", clearLedgerHover);
    row.addEventListener("click", () => {
      selectedModalProjectId = null;
      selectedModalTodoId = todo.id;
      isModalTodoEditing = false;
      render();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      selectedModalProjectId = null;
      selectedModalTodoId = todo.id;
      isModalTodoEditing = false;
      render();
    });
    ledgerTableBody.append(row);
  });

  ledgerEmptyState.hidden = rows.length > 0;
}

function createWeeklyBuckets(): Map<string, Record<(typeof WEEKLY_SECTIONS)[number]["key"], WeeklyItem[]>> {
  const buckets = new Map<string, Record<(typeof WEEKLY_SECTIONS)[number]["key"], WeeklyItem[]>>();

  getWeekdays(visibleWeekDate).forEach((date) => {
    buckets.set(toDateKey(date), {
      plan: [],
      done: [],
    });
  });

  return buckets;
}

function getProjectById(projectId: string): Project | undefined {
  return getState().projects.find((project) => project.id === projectId);
}

function getTodoByProject(project: Project | undefined, todoId: string | undefined): Todo | undefined {
  if (!project || !todoId) {
    return undefined;
  }

  return project.todos.find((todo) => todo.id === todoId);
}

function getProjectWorkLogs(projectId: string): WorkLog[] {
  return getState()
    .workLogs.filter((workLog) => workLog.projectId === projectId)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function getTodoWorkLogs(todoId: string): WorkLog[] {
  return getState()
    .workLogs.filter((workLog) => workLog.todoId === todoId)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function getRecentWorkLogCutoffKey(): string {
  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (RECENT_WORK_LOG_DAYS - 1));
  return toDateKey(cutoff);
}

function getVisibleWorkLogs(workLogs: WorkLog[], showAll: boolean): WorkLog[] {
  if (showAll) {
    return workLogs;
  }

  const cutoffKey = getRecentWorkLogCutoffKey();
  return workLogs.filter((workLog) => workLog.date >= cutoffKey);
}

function createWorkLogMoreButton({
  visibleCount,
  totalCount,
  expanded,
  onToggle,
}: {
  visibleCount: number;
  totalCount: number;
  expanded: boolean;
  onToggle: () => void;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "quiet-button work-log-more-button";
  button.textContent = expanded ? `접기 (${visibleCount}/${totalCount})` : `더보기 (${visibleCount}/${totalCount})`;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onToggle();
    render();
  });
  return button;
}

function createWorkLogEntry(workLog: WorkLog, options: { showProject?: boolean; compact?: boolean } = {}): HTMLElement {
  const project = getProjectById(workLog.projectId);
  const linkedTodo = getTodoByProject(project, workLog.todoId);
  const entry = document.createElement("article");
  entry.className = options.compact ? "work-log-entry compact" : "work-log-entry";
  entry.style.setProperty("--project-color", project?.color ?? "#94a3b8");

  const meta = document.createElement("p");
  meta.className = "work-log-entry-meta";
  const parts = [workLog.date, workLog.type];
  if (options.showProject && project) {
    parts.push(project.name);
  }
  if (linkedTodo) {
    parts.push(linkedTodo.title);
  }
  meta.textContent = parts.join(" / ");

  const content = document.createElement("p");
  content.className = "work-log-entry-content";
  content.textContent = workLog.content;

  const actions = document.createElement("div");
  actions.className = "work-log-entry-actions";

  if (project) {
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "quiet-button";
    openButton.textContent = "Open task";
    openButton.addEventListener("click", (event) => {
      event.stopPropagation();
      goToProjectTodo(project.id, linkedTodo?.id ?? null);
      render();
    });
    actions.append(openButton);
  }

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-work-log-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteWorkLog(workLog.id);
    render();
  });
  actions.append(deleteButton);

  entry.append(meta, content, actions);
  return entry;
}

function renderWeeklyItem(item: WeeklyItem): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-item";
  wrapper.classList.toggle("todo-source", item.source === "todo");
  wrapper.style.setProperty("--project-color", item.color);

  const header = document.createElement("p");
  header.className = "weekly-item-header";
  const client = document.createElement("strong");
  client.textContent = `[${item.clientName || "No client"}]`;
  const projectName = document.createElement("strong");
  projectName.textContent = `[${item.projectName}]`;
  header.append(client, projectName);
  if (item.todoTitle) {
    const linkedTask = document.createElement("span");
    linkedTask.className = "weekly-linked-task";
    linkedTask.textContent = item.todoTitle;
    header.append(linkedTask);
  }

  const content = document.createElement("p");
  content.className = "weekly-item-content";
  content.textContent = item.content;
  wrapper.append(header, content);

  return wrapper;
}

function renderWeeklyItems(items: WeeklyItem[]): HTMLElement {
  const body = document.createElement("div");
  body.className = "weekly-table-cell-body";
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "weekly-empty";
    empty.textContent = "No items yet.";
    body.append(empty);
    return body;
  }

  items.forEach((item) => {
    body.append(renderWeeklyItem(item));
  });

  return body;
}

function renderWeekly(): void {
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
        projectId: project.id,
        todoId: todo.id,
        clientName: project.clientName,
        projectName: project.name,
        todoTitle: todo.title,
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
    const linkedTodo = getTodoByProject(project, workLog.todoId);
    const clientName = project?.clientName ?? "";
    const projectName = project?.name ?? "Unknown";
    const color = project?.color ?? "#94a3b8";
    const item: WeeklyItem = {
      id: workLog.id,
      projectId: workLog.projectId,
      todoId: workLog.todoId,
      clientName,
      projectName,
      todoTitle: linkedTodo?.title,
      content: workLog.content,
      color,
      source: "workLog",
    };

    if (workLog.type === "계획") {
      bucket.plan.push(item);
    } else if (workLog.type === "수행") {
      bucket.done.push(item);
    } else {
      return;
    }
    weeklyItemCount += 1;
  });

  const weekdays = getWeekdays(visibleWeekDate);
  const table = document.createElement("table");
  table.className = "weekly-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const sectionHeader = document.createElement("th");
  sectionHeader.scope = "col";
  sectionHeader.textContent = "구분";
  headerRow.append(sectionHeader);

  weekdays.forEach((date) => {
    const dateKey = toDateKey(date);
    const th = document.createElement("th");
    th.scope = "col";
    th.innerHTML = `
      <span>${date.toLocaleDateString("en-US", { weekday: "short" })}</span>
      <strong>${dateKey}</strong>
    `;
    headerRow.append(th);
  });

  thead.append(headerRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  WEEKLY_SECTIONS.forEach((section) => {
    const row = document.createElement("tr");
    row.dataset.weeklySection = section.key;

    const rowHeader = document.createElement("th");
    rowHeader.scope = "row";
    rowHeader.textContent = section.title;
    row.append(rowHeader);

    weekdays.forEach((date) => {
      const dateKey = toDateKey(date);
      const dayBuckets = buckets.get(dateKey)!;
      const cell = document.createElement("td");
      cell.append(renderWeeklyItems(dayBuckets[section.key]));
      row.append(cell);
    });

    tbody.append(row);
  });
  table.append(tbody);
  weeklyGrid.append(table);

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

    const name = document.createElement("span");
    name.className = "project-name";
    name.title = project.name;

    const swatch = document.createElement("span");
    swatch.className = "project-swatch";
    swatch.style.setProperty("--project-color", project.color);

    const label = document.createElement("span");
    label.className = "project-label";
    label.textContent = toSingleLineText(project.name);
    name.append(swatch, label);

    const client = document.createElement("span");
    client.className = "project-client";
    client.textContent = toSingleLineText(project.clientName) || "No client";
    client.title = project.clientName || "No client";

    button.append(name, client);
    button.addEventListener("click", () => {
      selectProject(project.id);
      isProjectInfoEditing = false;
      isProjectNameEditing = false;
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
        projectId: project.id,
        todoId: todo.id,
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
      item.addEventListener("click", () => {
        selectedModalProjectId = null;
        selectedModalTodoId = todo.todoId;
        isModalTodoEditing = false;
        render();
      });
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
  calendarRangeControls.hidden = false;
  const itemCount = renderRangeCalendar(dueTodosByDate);

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

function getProgressFromInput(input: HTMLInputElement): number {
  const progressPercent = Number(input.value);
  if (Number.isNaN(progressPercent)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progressPercent / 100));
}

function getDetailValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function createDetailRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "todo-detail-row";

  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;

  row.append(term, description);
  return row;
}

function closeCalendarDetailModal(): void {
  selectedModalProjectId = null;
  selectedModalTodoId = null;
  isModalTodoEditing = false;
}

function goToProjectTodo(projectId: string, todoId: string | null): void {
  selectProject(projectId);
  selectedTodoId = todoId;
  editingTodoId = null;
  isProjectInfoEditing = false;
  isProjectNameEditing = false;
  closeCalendarDetailModal();
  currentView = "projects";
}

function goToCalendarTodoProject(projectId: string, todoId: string): void {
  goToProjectTodo(projectId, todoId);
}

function renderCalendarTodoView(project: Project, todo: Todo): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "calendar-detail-view";

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `
    <div>
      <p class="eyebrow">${project.name}</p>
      <h3 id="calendar-detail-title">${todo.title}</h3>
    </div>
  `;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "quiet-button";
  closeButton.textContent = "닫기";
  closeButton.addEventListener("click", () => {
    closeCalendarDetailModal();
    render();
  });
  header.append(closeButton);

  const list = document.createElement("dl");
  list.className = "todo-detail-list calendar-detail-list";
  list.append(
    createDetailRow("내부 목표 완료일", getDetailValue(todo.dueDate)),
    createDetailRow("공수", getDetailValue(todo.estimate)),
    createDetailRow("진행상태", todo.status),
    createDetailRow("진척률", formatProgressPercent(todo.progress)),
    createDetailRow("우선순위", getDetailValue(todo.priority)),
    createDetailRow("메모", getDetailValue(todo.memo)),
  );

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const projectButton = document.createElement("button");
  projectButton.type = "button";
  projectButton.className = "quiet-button";
  projectButton.textContent = "Project로 이동";
  projectButton.addEventListener("click", () => {
    goToCalendarTodoProject(project.id, todo.id);
    render();
  });

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "수정";
  editButton.addEventListener("click", () => {
    isModalTodoEditing = true;
    render();
  });

  actions.append(projectButton, editButton);
  wrapper.append(header, list, actions);
  return wrapper;
}

function renderLedgerProjectView(project: Project): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "calendar-detail-view ledger-project-detail-view";

  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = project.clientName || "No client";
  const heading = document.createElement("h3");
  heading.textContent = project.name;
  title.append(eyebrow, heading);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "quiet-button";
  closeButton.textContent = "닫기";
  closeButton.addEventListener("click", () => {
    closeCalendarDetailModal();
    render();
  });
  header.append(title, closeButton);

  const list = document.createElement("dl");
  list.className = "todo-detail-list calendar-detail-list";
  list.append(
    createDetailRow("업체", getDetailValue(project.clientName)),
    createDetailRow("프로젝트 번호", getDetailValue(project.projectNumber)),
    createDetailRow("프로젝트 기간", getDetailValue(project.periodText)),
    createDetailRow("시작일", getDetailValue(project.periodStart)),
    createDetailRow("종료일", getDetailValue(project.periodEnd)),
    createDetailRow("업무 수", `${project.todos.length}`),
  );

  const taskList = document.createElement("div");
  taskList.className = "ledger-project-task-list";
  if (project.todos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "이 프로젝트에 업무가 없습니다.";
    taskList.append(empty);
  } else {
    project.todos.forEach((todo) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "ledger-project-task-button";
      item.innerHTML = `
        <span class="status-badge" data-status="${todo.status}">${todo.status}</span>
        <strong>${todo.title}</strong>
        <span class="progress-pill">${formatProgressPercent(todo.progress)}</span>
      `;
      item.addEventListener("click", () => {
        selectedModalProjectId = null;
        selectedModalTodoId = todo.id;
        isModalTodoEditing = false;
        render();
      });
      taskList.append(item);
    });
  }

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const projectButton = document.createElement("button");
  projectButton.type = "button";
  projectButton.textContent = "Project로 이동";
  projectButton.addEventListener("click", () => {
    goToProjectTodo(project.id, null);
    render();
  });

  actions.append(projectButton);
  wrapper.append(header, list, taskList, actions);
  return wrapper;
}

function renderCalendarTodoEditForm(project: Project, todo: Todo): HTMLElement {
  const form = document.createElement("form");
  form.className = "detail-form calendar-detail-form";
  form.innerHTML = `
    <div class="modal-header full-field">
      <div>
        <p class="eyebrow">${project.name}</p>
        <h3 id="calendar-detail-title">Task 수정</h3>
      </div>
      <button class="quiet-button" type="button" data-action="close">닫기</button>
    </div>
    <label>
      Task
      <input name="title" type="text" required />
    </label>
    <label>
      Target date
      <input name="dueDate" type="date" />
    </label>
    <label>
      Estimate
      <input name="estimate" type="text" placeholder="Example: 2d" />
    </label>
    <label>
      Status
      <select name="status">
        <option value="대기">대기</option>
        <option value="진행중">진행중</option>
        <option value="미완">미완</option>
        <option value="완료">완료</option>
        <option value="보류">보류</option>
      </select>
    </label>
    <label>
      Progress (%)
      <input name="progress" type="number" min="0" max="100" step="1" />
    </label>
    <label>
      Priority
      <select name="priority">
        <option value="낮음">낮음</option>
        <option value="보통">보통</option>
        <option value="높음">높음</option>
        <option value="최우선">최우선</option>
      </select>
    </label>
    <label class="full-field">
      Memo
      <textarea name="memo" rows="4"></textarea>
    </label>
    <div class="modal-actions full-field">
      <button class="quiet-button" type="button" data-action="project">Project로 이동</button>
      <button class="quiet-button" type="button" data-action="cancel">취소</button>
      <button type="submit">저장</button>
    </div>
  `;

  const titleInput = form.querySelector<HTMLInputElement>('[name="title"]')!;
  const dueDateInput = form.querySelector<HTMLInputElement>('[name="dueDate"]')!;
  const estimateInput = form.querySelector<HTMLInputElement>('[name="estimate"]')!;
  const statusSelect = form.querySelector<HTMLSelectElement>('[name="status"]')!;
  const progressInput = form.querySelector<HTMLInputElement>('[name="progress"]')!;
  const prioritySelect = form.querySelector<HTMLSelectElement>('[name="priority"]')!;
  const memoInput = form.querySelector<HTMLTextAreaElement>('[name="memo"]')!;

  titleInput.value = todo.title;
  dueDateInput.value = todo.dueDate ?? "";
  estimateInput.value = todo.estimate ?? "";
  statusSelect.value = todo.status;
  progressInput.value = String(Math.round(todo.progress * 100));
  prioritySelect.value = todo.priority ?? "보통";
  memoInput.value = todo.memo;

  form.querySelector<HTMLButtonElement>('[data-action="close"]')!.addEventListener("click", () => {
    closeCalendarDetailModal();
    render();
  });
  form.querySelector<HTMLButtonElement>('[data-action="project"]')!.addEventListener("click", () => {
    goToCalendarTodoProject(project.id, todo.id);
    render();
  });
  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", () => {
    isModalTodoEditing = false;
    render();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const progress = getTodoProgressFromPercentValue(progressInput.value);
    const selectedStatus = statusSelect.value as TaskStatus;
    const status: TaskStatus = progress >= 1 ? "완료" : selectedStatus;

    updateTodo(todo.id, {
      title: titleInput.value.trim(),
      dueDate: dueDateInput.value || null,
      estimate: estimateInput.value.trim(),
      status,
      progress,
      completed: status === "완료",
      priority: prioritySelect.value as TaskPriority,
      memo: memoInput.value.trim(),
    });
    isModalTodoEditing = false;
    render();
  });

  return form;
}

function renderCalendarDetailModal(): void {
  const selection = findTodoWithProject(selectedModalTodoId);
  const selectedProject = selectedModalProjectId
    ? getState().projects.find((project) => project.id === selectedModalProjectId)
    : null;
  calendarDetailContent.innerHTML = "";
  calendarDetailModal.onclick = (event) => {
    if (event.target !== calendarDetailModal) {
      return;
    }

    closeCalendarDetailModal();
    render();
  };

  if (currentView !== "calendar" && currentView !== "ledger") {
    calendarDetailModal.hidden = true;
    return;
  }

  if (selectedProject) {
    calendarDetailContent.append(renderLedgerProjectView(selectedProject));
    calendarDetailModal.hidden = false;
    return;
  }

  if (!selection) {
    calendarDetailModal.hidden = true;
    return;
  }

  calendarDetailContent.append(
    isModalTodoEditing
      ? renderCalendarTodoEditForm(selection.project, selection.todo)
      : renderCalendarTodoView(selection.project, selection.todo),
  );
  calendarDetailModal.hidden = false;
}

function renderProjectInfoView(): void {
  const activeProject = getActiveProject();
  projectInfoView.innerHTML = "";

  if (!activeProject) {
    return;
  }

  projectInfoView.append(
    createDetailRow("업체명", getDetailValue(activeProject.clientName)),
    createDetailRow("프로젝트 번호", getDetailValue(activeProject.projectNumber)),
    createDetailRow("프로젝트 기간", getDetailValue(activeProject.periodText)),
    createDetailRow("시작일", getDetailValue(activeProject.periodStart)),
    createDetailRow("종료일", getDetailValue(activeProject.periodEnd)),
  );
}

function renderProjectWorkLogs(): void {
  const activeProject = getActiveProject();
  projectWorkLogList.innerHTML = "";

  if (!activeProject) {
    projectWorkLogCard.hidden = true;
    projectWorkLogEmpty.hidden = true;
    return;
  }

  const workLogs = getProjectWorkLogs(activeProject.id);
  const showAll = expandedProjectWorkLogId === activeProject.id;
  const visibleWorkLogs = getVisibleWorkLogs(workLogs, showAll);
  projectWorkLogCard.hidden = false;
  projectWorkLogEmpty.hidden = workLogs.length > 0;

  visibleWorkLogs.forEach((workLog) => {
    projectWorkLogList.append(createWorkLogEntry(workLog));
  });

  if (visibleWorkLogs.length !== workLogs.length) {
    projectWorkLogList.append(
      createWorkLogMoreButton({
        visibleCount: visibleWorkLogs.length,
        totalCount: workLogs.length,
        expanded: showAll,
        onToggle: () => {
          expandedProjectWorkLogId = activeProject.id;
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
          expandedProjectWorkLogId = null;
        },
      }),
    );
  }
}

export function showProjectInfoEditMode(isEditing: boolean): void {
  isProjectInfoEditing = isEditing;
  projectInfoView.hidden = isEditing;
  projectInfoForm.hidden = !isEditing;
  editProjectInfoButton.hidden = isEditing || !getActiveProject();
  cancelProjectInfoButton.hidden = !isEditing;
}

export function showProjectNameEditMode(isEditing: boolean): void {
  const activeProject = getActiveProject();
  isProjectNameEditing = isEditing && Boolean(activeProject);
  activeProjectNameButton.hidden = isProjectNameEditing;
  projectNameForm.hidden = !isProjectNameEditing;

  if (activeProject) {
    projectNameInput.value = activeProject.name;
  }

  if (isProjectNameEditing) {
    window.requestAnimationFrame(() => {
      projectNameInput.focus();
      projectNameInput.select();
    });
  }
}

function renderTodoWorkLogSummary(todoId: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "todo-work-log-summary";

  const heading = document.createElement("h4");
  heading.textContent = "Linked Weekly Logs";
  section.append(heading);

  const workLogs = getTodoWorkLogs(todoId);
  const showAll = expandedTodoWorkLogIds.has(todoId);
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
    list.append(createWorkLogEntry(workLog, { compact: true }));
  });

  if (visibleWorkLogs.length !== workLogs.length) {
    list.append(
      createWorkLogMoreButton({
        visibleCount: visibleWorkLogs.length,
        totalCount: workLogs.length,
        expanded: showAll,
        onToggle: () => {
          expandedTodoWorkLogIds.add(todoId);
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
          expandedTodoWorkLogIds.delete(todoId);
        },
      }),
    );
  }
  section.append(list);
  return section;
}

function renderTodoDetailView(todo: Todo): HTMLElement {
  const detail = document.createElement("div");
  detail.className = "todo-inline-detail";

  const list = document.createElement("dl");
  list.className = "todo-detail-list";
  list.append(
    createDetailRow("내부 목표 완료일", getDetailValue(todo.dueDate)),
    createDetailRow("공수", getDetailValue(todo.estimate)),
    createDetailRow("진행상태", todo.status),
    createDetailRow("진척률", formatProgressPercent(todo.progress)),
    createDetailRow("우선순위", getDetailValue(todo.priority)),
    createDetailRow("메모", getDetailValue(todo.memo)),
  );

  const actions = document.createElement("div");
  actions.className = "todo-card-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "quiet-button";
  editButton.textContent = "수정";
  editButton.addEventListener("click", (event) => {
    event.stopPropagation();
    editingTodoId = todo.id;
    render();
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-todo-button";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteTodo(todo.id);
    selectedTodoId = null;
    editingTodoId = null;
    render();
  });

  actions.append(editButton, deleteButton);
  detail.append(list, renderTodoWorkLogSummary(todo.id), actions);
  return detail;
}

function renderTodoEditForm(todo: Todo): HTMLElement {
  const form = document.createElement("form");
  form.className = "detail-form todo-inline-form";
  form.innerHTML = `
    <label>
      Task
      <input name="title" type="text" required />
    </label>
    <label>
      Target date
      <input name="dueDate" type="date" />
    </label>
    <label>
      Estimate
      <input name="estimate" type="text" placeholder="Example: 2d" />
    </label>
    <label>
      Status
      <select name="status">
        <option value="대기">대기</option>
        <option value="진행중">진행중</option>
        <option value="미완">미완</option>
        <option value="완료">완료</option>
        <option value="보류">보류</option>
      </select>
    </label>
    <label>
      Progress (%)
      <input name="progress" type="number" min="0" max="100" step="1" />
    </label>
    <label>
      Priority
      <select name="priority">
        <option value="낮음">낮음</option>
        <option value="보통">보통</option>
        <option value="높음">높음</option>
        <option value="최우선">최우선</option>
      </select>
    </label>
    <label class="full-field">
      Memo
      <textarea name="memo" rows="5" placeholder="Add notes for this task"></textarea>
    </label>
    <div class="todo-card-actions full-field">
      <button type="submit">저장</button>
      <button class="quiet-button" type="button" data-action="cancel">취소</button>
      <button class="delete-todo-button" type="button" data-action="delete">삭제</button>
    </div>
  `;

  const titleInput = form.querySelector<HTMLInputElement>('[name="title"]')!;
  const dueDateInput = form.querySelector<HTMLInputElement>('[name="dueDate"]')!;
  const estimateInput = form.querySelector<HTMLInputElement>('[name="estimate"]')!;
  const statusSelect = form.querySelector<HTMLSelectElement>('[name="status"]')!;
  const progressInput = form.querySelector<HTMLInputElement>('[name="progress"]')!;
  const prioritySelect = form.querySelector<HTMLSelectElement>('[name="priority"]')!;
  const memoInput = form.querySelector<HTMLTextAreaElement>('[name="memo"]')!;

  titleInput.value = todo.title;
  dueDateInput.value = todo.dueDate ?? "";
  estimateInput.value = todo.estimate ?? "";
  statusSelect.value = todo.status;
  progressInput.value = String(Math.round(todo.progress * 100));
  prioritySelect.value = todo.priority ?? "보통";
  memoInput.value = todo.memo;

  form.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const progress = getProgressFromInput(progressInput);
    const selectedStatus = statusSelect.value as TaskStatus;
    const status: TaskStatus = progress >= 1 ? "완료" : selectedStatus;

    updateTodo(todo.id, {
      title: titleInput.value.trim(),
      dueDate: dueDateInput.value || null,
      estimate: estimateInput.value.trim(),
      status,
      progress,
      completed: status === "완료",
      priority: prioritySelect.value as TaskPriority,
      memo: memoInput.value.trim(),
    });
    editingTodoId = null;
    render();
  });

  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", () => {
    editingTodoId = null;
    render();
  });
  form.querySelector<HTMLButtonElement>('[data-action="delete"]')!.addEventListener("click", () => {
    deleteTodo(todo.id);
    selectedTodoId = null;
    editingTodoId = null;
    render();
  });

  return form;
}

function renderTodos(): void {
  const activeProject = getActiveProject();
  todoList.innerHTML = "";

  if (!activeProject) {
    activeProjectName.textContent = "Add a project";
    isProjectNameEditing = false;
    showProjectNameEditMode(false);
    activeProjectNameButton.disabled = true;
    todoCount.textContent = "0 items";
    emptyState.textContent = "Create a project first.";
    emptyState.hidden = false;
    todoForm.hidden = true;
    isProjectInfoEditing = false;
    showProjectInfoEditMode(false);
    projectInfoView.hidden = true;
    projectWorkLogCard.hidden = true;
    deleteProjectButton.hidden = true;
    selectedTodoId = null;
    editingTodoId = null;
    return;
  }

  sortTodosByDueDate();
  activeProjectName.textContent = activeProject.name;
  activeProjectNameButton.disabled = false;
  showProjectNameEditMode(isProjectNameEditing);
  projectColorInput.value = activeProject.color;
  projectClientNameInput.value = activeProject.clientName;
  projectNumberInput.value = activeProject.projectNumber ?? "";
  projectPeriodTextInput.value = activeProject.periodText ?? "";
  projectPeriodStartInput.value = activeProject.periodStart ?? "";
  projectPeriodEndInput.value = activeProject.periodEnd ?? "";
  renderProjectInfoView();
  showProjectInfoEditMode(isProjectInfoEditing);
  renderProjectWorkLogs();
  todoCount.textContent = `${activeProject.todos.length} items`;
  emptyState.textContent = "선택된 프로젝트에 업무가 없습니다.";
  emptyState.hidden = activeProject.todos.length > 0;
  todoForm.hidden = false;
  deleteProjectButton.hidden = false;

  activeProject.todos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = "todo-item";
    item.classList.toggle("completed", todo.completed);
    item.classList.toggle("selected", todo.id === selectedTodoId);
    item.classList.toggle("expanded", todo.id === selectedTodoId);
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

    item.addEventListener("click", () => {
      if (selectedTodoId === todo.id) {
        selectedTodoId = null;
        editingTodoId = null;
        render();
        return;
      }

      selectedTodoId = todo.id;
      if (editingTodoId && editingTodoId !== todo.id) {
        editingTodoId = null;
      }
      render();
    });

    item.append(checkbox, copy);
    if (todo.id === selectedTodoId) {
      const detail = editingTodoId === todo.id ? renderTodoEditForm(todo) : renderTodoDetailView(todo);
      item.append(detail);
    }
    todoList.append(item);
  });
}

export function clearSelectedTodo(): void {
  selectedTodoId = null;
  editingTodoId = null;
}

export function resetCalendarSelection(): void {
  selectedCalendarProjectIds = null;
  closeCalendarDetailModal();
}

export function selectTodo(todoId: string): void {
  selectedTodoId = todoId;
  editingTodoId = null;
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
  currentView = "calendar";
}

function getTodoProgressFromPercentValue(value: string): number {
  const progressPercent = Number(value);
  if (Number.isNaN(progressPercent)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progressPercent / 100));
}

function findTodoWithProject(todoId: string | null): { project: Project; todo: Todo } | null {
  if (!todoId) {
    return null;
  }

  for (const project of getState().projects) {
    const todo = project.todos.find((item) => item.id === todoId);
    if (todo) {
      return { project, todo };
    }
  }

  return null;
}

export function goToPreviousWeek(): void {
  visibleWeekDate = new Date(visibleWeekDate.getFullYear(), visibleWeekDate.getMonth(), visibleWeekDate.getDate() - 7);
}

export function goToNextWeek(): void {
  visibleWeekDate = new Date(visibleWeekDate.getFullYear(), visibleWeekDate.getMonth(), visibleWeekDate.getDate() + 7);
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
}

export function render(): void {
  renderProjects();
  renderTodos();
  renderRangeControls();
  renderLedger();
  renderWeekly();
  renderCalendarFilters();
  renderCalendar();
  renderCalendarDetailModal();
  projectWorkspace.hidden = currentView !== "projects";
  ledgerWorkspace.hidden = currentView !== "ledger";
  weeklyWorkspace.hidden = currentView !== "weekly";
  calendarWorkspace.hidden = currentView !== "calendar";
  ledgerViewButton.classList.toggle("active", currentView === "ledger");
  weeklyViewButton.classList.toggle("active", currentView === "weekly");
  calendarViewButton.classList.toggle("active", currentView === "calendar");
}
