import {
  normalizeCalendarRangePreferences,
  type CalendarRangePreferences,
} from "../state/calendarPreferences";
import { uiState } from "../app/uiState";
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
import {
  findTodoWithProject,
  getProjectById,
  getProjectWorkLogs,
  getTodoByProject,
  getTodoWorkLogs,
} from "../state/selectors";
import type { Project, TaskPriority, TaskStatus, Todo, WorkLog } from "../types";
import { toDateKey } from "../utils/calendar";
import { formatDueDate } from "../utils/date";
import { formatProgressPercent, isTodoOverdue } from "../utils/task";
import {
  calendarViewButton,
  calendarWorkspace,
  deleteProjectButton,
  emptyState,
  ledgerViewButton,
  ledgerWorkspace,
  projectList,
  projectWorkLogCard,
  projectWorkLogEmpty,
  projectWorkLogList,
  projectWorkspace,
  todoCount,
  todoForm,
  todoList,
  weeklyViewButton,
  weeklyWorkspace,
} from "./dom";
import { renderCalendarView } from "./calendarView";
import { renderLedgerView } from "./ledgerView";
import { renderCalendarDetailModalView } from "./modalView";
import {
  renderEmptyProjectHeader,
  renderProjectHeader,
  renderProjectInfoView as renderProjectInfo,
  setProjectInfoEditMode,
  setProjectNameEditMode,
} from "./projectView";
import {
  createWorkLogEntry as createWorkLogEntryElement,
  createWorkLogMoreButton,
} from "./workLogView";
import { renderWeeklyView } from "./weeklyView";

const RECENT_WORK_LOG_DAYS = 7;

// Shared helpers

function toSingleLineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function ensureCalendarSelection(): void {
  const projectIds = getState().projects.map((project) => project.id);
  if (!uiState.selectedCalendarProjectIds) {
    uiState.selectedCalendarProjectIds = new Set(projectIds);
    return;
  }

  const existingSelection = uiState.selectedCalendarProjectIds;
  uiState.selectedCalendarProjectIds = new Set(projectIds.filter((projectId) => existingSelection.has(projectId)));
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

function renderLedger(): void {
  renderLedgerView(getState(), {
    onProjectSelect: (project) => {
      uiState.selectedModalProjectId = project.id;
      uiState.selectedModalTodoId = null;
      uiState.isModalTodoEditing = false;
      render();
    },
    onTodoSelect: (todo) => {
      uiState.selectedModalProjectId = null;
      uiState.selectedModalTodoId = todo.id;
      uiState.isModalTodoEditing = false;
      render();
    },
  });
}

// WorkLog

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

function createWorkLogEntry(workLog: WorkLog, options: { showProject?: boolean; compact?: boolean } = {}): HTMLElement {
  const project = getProjectById(getState(), workLog.projectId);
  const linkedTodo = getTodoByProject(project, workLog.todoId);

  return createWorkLogEntryElement(workLog, {
    ...options,
    project,
    linkedTodo,
    onOpen: project
      ? () => {
          goToProjectTodo(project.id, linkedTodo?.id ?? null);
          render();
        }
      : undefined,
    onDelete: () => {
      deleteWorkLog(workLog.id);
      render();
    },
  });
}

// Project list

function renderProjects(): void {
  projectList.innerHTML = "";

  getState().projects.forEach((project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-button";
    button.draggable = true;
    button.dataset.projectId = project.id;
    button.classList.toggle("active", uiState.currentView === "projects" && project.id === getState().activeProjectId);

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
      uiState.isProjectInfoEditing = false;
      uiState.isProjectNameEditing = false;
      uiState.currentView = "projects";
      render();
    });
    button.addEventListener("dragstart", (event) => {
      uiState.draggedProjectId = project.id;
      button.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", project.id);
      event.dataTransfer?.setDragImage(button, 12, 20);
    });
    button.addEventListener("dragend", () => {
      uiState.draggedProjectId = null;
      button.classList.remove("dragging");
    });
    button.addEventListener("dragover", (event) => {
      if (!uiState.draggedProjectId || uiState.draggedProjectId === project.id) {
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
      const sourceProjectId = uiState.draggedProjectId ?? event.dataTransfer?.getData("text/plain");
      if (!sourceProjectId) {
        return;
      }

      reorderProjects(sourceProjectId, project.id);
      uiState.draggedProjectId = null;
      render();
    });
    projectList.append(button);
  });
}

// Calendar

function renderCalendar(): void {
  ensureCalendarSelection();
  renderCalendarView(getState(), {
    selectedProjectIds: uiState.selectedCalendarProjectIds ?? new Set<string>(),
    calendarRangePreferences: uiState.calendarRangePreferences,
    onSelectedProjectIdsChange: (selectedProjectIds) => {
      uiState.selectedCalendarProjectIds = selectedProjectIds;
      render();
    },
    onCalendarRangePreferencesChange: (preferences) => {
      uiState.calendarRangePreferences = preferences;
    },
    onTodoSelect: (todo) => {
      uiState.selectedModalProjectId = null;
      uiState.selectedModalTodoId = todo.todoId;
      uiState.isModalTodoEditing = false;
      render();
    },
  });
}

// Modal shared helpers

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
  uiState.selectedModalProjectId = null;
  uiState.selectedModalTodoId = null;
  uiState.isModalTodoEditing = false;
}

function goToProjectTodo(projectId: string, todoId: string | null): void {
  selectProject(projectId);
  uiState.selectedTodoId = todoId;
  uiState.editingTodoId = null;
  uiState.isProjectInfoEditing = false;
  uiState.isProjectNameEditing = false;
  closeCalendarDetailModal();
  uiState.currentView = "projects";
}

function renderCalendarDetailModal(): void {
  const selection = findTodoWithProject(getState(), uiState.selectedModalTodoId);
  const selectedProject = uiState.selectedModalProjectId
    ? (getProjectById(getState(), uiState.selectedModalProjectId) ?? null)
    : null;

  renderCalendarDetailModalView({
    currentView: uiState.currentView,
    selectedProject,
    selection,
    isTodoEditing: uiState.isModalTodoEditing,
    onClose: () => {
      closeCalendarDetailModal();
      render();
    },
    onOpenProjectTodo: (projectId, todoId) => {
      goToProjectTodo(projectId, todoId);
      render();
    },
    onEditTodo: () => {
      uiState.isModalTodoEditing = true;
      render();
    },
    onCancelTodoEdit: () => {
      uiState.isModalTodoEditing = false;
      render();
    },
    onSelectTodoFromProject: (todoId) => {
      uiState.selectedModalProjectId = null;
      uiState.selectedModalTodoId = todoId;
      uiState.isModalTodoEditing = false;
      render();
    },
    onUpdateTodo: (todoId, updates) => {
      updateTodo(todoId, updates);
      uiState.isModalTodoEditing = false;
      render();
    },
  });
}

// Project detail

function renderProjectWorkLogs(): void {
  const activeProject = getActiveProject();
  projectWorkLogList.innerHTML = "";

  if (!activeProject) {
    projectWorkLogCard.hidden = true;
    projectWorkLogEmpty.hidden = true;
    return;
  }

  const workLogs = getProjectWorkLogs(getState(), activeProject.id);
  const showAll = uiState.expandedProjectWorkLogId === activeProject.id;
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
          uiState.expandedProjectWorkLogId = activeProject.id;
          render();
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
          uiState.expandedProjectWorkLogId = null;
          render();
        },
      }),
    );
  }
}

export function showProjectInfoEditMode(isEditing: boolean): void {
  uiState.isProjectInfoEditing = isEditing;
  setProjectInfoEditMode(isEditing, Boolean(getActiveProject()));
}

export function showProjectNameEditMode(isEditing: boolean): void {
  const activeProject = getActiveProject();
  uiState.isProjectNameEditing = isEditing && Boolean(activeProject);
  setProjectNameEditMode(isEditing, activeProject ?? null);
}

// Todo detail

function renderTodoWorkLogSummary(todoId: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "todo-work-log-summary";

  const heading = document.createElement("h4");
  heading.textContent = "Linked Weekly Logs";
  section.append(heading);

  const workLogs = getTodoWorkLogs(getState(), todoId);
  const showAll = uiState.expandedTodoWorkLogIds.has(todoId);
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
          uiState.expandedTodoWorkLogIds.add(todoId);
          render();
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
          uiState.expandedTodoWorkLogIds.delete(todoId);
          render();
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
    uiState.editingTodoId = todo.id;
    render();
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-todo-button";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteTodo(todo.id);
    uiState.selectedTodoId = null;
    uiState.editingTodoId = null;
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
    uiState.editingTodoId = null;
    render();
  });

  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", () => {
    uiState.editingTodoId = null;
    render();
  });
  form.querySelector<HTMLButtonElement>('[data-action="delete"]')!.addEventListener("click", () => {
    deleteTodo(todo.id);
    uiState.selectedTodoId = null;
    uiState.editingTodoId = null;
    render();
  });

  return form;
}

function renderTodos(): void {
  const activeProject = getActiveProject();
  todoList.innerHTML = "";

  if (!activeProject) {
    renderEmptyProjectHeader();
    uiState.isProjectNameEditing = false;
    showProjectNameEditMode(false);
    todoCount.textContent = "0 items";
    emptyState.textContent = "Create a project first.";
    emptyState.hidden = false;
    todoForm.hidden = true;
    uiState.isProjectInfoEditing = false;
    showProjectInfoEditMode(false);
    projectWorkLogCard.hidden = true;
    deleteProjectButton.hidden = true;
    uiState.selectedTodoId = null;
    uiState.editingTodoId = null;
    return;
  }

  sortTodosByDueDate();
  renderProjectHeader(activeProject);
  showProjectNameEditMode(uiState.isProjectNameEditing);
  renderProjectInfo(activeProject);
  showProjectInfoEditMode(uiState.isProjectInfoEditing);
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
    item.classList.toggle("selected", todo.id === uiState.selectedTodoId);
    item.classList.toggle("expanded", todo.id === uiState.selectedTodoId);
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
      if (uiState.selectedTodoId === todo.id) {
        uiState.selectedTodoId = null;
        uiState.editingTodoId = null;
        render();
        return;
      }

      uiState.selectedTodoId = todo.id;
      if (uiState.editingTodoId && uiState.editingTodoId !== todo.id) {
        uiState.editingTodoId = null;
      }
      render();
    });

    item.append(checkbox, copy);
    if (todo.id === uiState.selectedTodoId) {
      const detail = uiState.editingTodoId === todo.id ? renderTodoEditForm(todo) : renderTodoDetailView(todo);
      item.append(detail);
    }
    todoList.append(item);
  });
}

// Exported render controls

export function clearSelectedTodo(): void {
  uiState.selectedTodoId = null;
  uiState.editingTodoId = null;
}

export function resetCalendarSelection(): void {
  uiState.selectedCalendarProjectIds = null;
  closeCalendarDetailModal();
}

export function selectTodo(todoId: string): void {
  uiState.selectedTodoId = todoId;
  uiState.editingTodoId = null;
}

export function getSelectedTodoId(): string | null {
  return uiState.selectedTodoId;
}

export function showProjectView(): void {
  uiState.currentView = "projects";
}

export function showLedgerView(): void {
  uiState.currentView = "ledger";
}

export function showWeeklyView(): void {
  uiState.currentView = "weekly";
}

export function activateCalendarButton(): void {
  uiState.currentView = "calendar";
}

export function goToPreviousWeek(): void {
  uiState.visibleWeekDate = new Date(uiState.visibleWeekDate.getFullYear(), uiState.visibleWeekDate.getMonth(), uiState.visibleWeekDate.getDate() - 7);
}

export function goToNextWeek(): void {
  uiState.visibleWeekDate = new Date(uiState.visibleWeekDate.getFullYear(), uiState.visibleWeekDate.getMonth(), uiState.visibleWeekDate.getDate() + 7);
}

export function getVisibleWeekDate(): Date {
  return new Date(uiState.visibleWeekDate);
}

export function toggleAllCalendarProjects(): void {
  const projectIds = getState().projects.map((project) => project.id);
  const selectedProjectIds = uiState.selectedCalendarProjectIds ?? new Set(projectIds);
  const allSelected = projectIds.length > 0 && selectedProjectIds.size === projectIds.length;
  uiState.selectedCalendarProjectIds = allSelected ? new Set() : new Set(projectIds);
}

export function updateCalendarRangePreferences(updates: Partial<CalendarRangePreferences>): void {
  uiState.calendarRangePreferences = normalizeCalendarRangePreferences({
    ...uiState.calendarRangePreferences,
    ...updates,
  });
}

export function render(): void {
  renderProjects();
  renderTodos();
  renderLedger();
  renderWeeklyView(getState(), uiState.visibleWeekDate);
  renderCalendar();
  renderCalendarDetailModal();
  projectWorkspace.hidden = uiState.currentView !== "projects";
  ledgerWorkspace.hidden = uiState.currentView !== "ledger";
  weeklyWorkspace.hidden = uiState.currentView !== "weekly";
  calendarWorkspace.hidden = uiState.currentView !== "calendar";
  ledgerViewButton.classList.toggle("active", uiState.currentView === "ledger");
  weeklyViewButton.classList.toggle("active", uiState.currentView === "weekly");
  calendarViewButton.classList.toggle("active", uiState.currentView === "calendar");
}
