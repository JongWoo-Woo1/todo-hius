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
import type { Project, Todo, WorkLog } from "../types";
import { toDateKey } from "../utils/calendar";
import {
  calendarViewButton,
  calendarWorkspace,
  deleteProjectButton,
  emptyState,
  ledgerViewButton,
  ledgerWorkspace,
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
import { renderProjectList } from "./projectListView";
import {
  renderEmptyProjectHeader,
  renderProjectHeader,
  renderProjectInfoView as renderProjectInfo,
  setProjectInfoEditMode,
  setProjectNameEditMode,
} from "./projectView";
import {
  createTodoDetailView,
  createTodoEditForm,
  createTodoListItem,
} from "./todoView";
import {
  createWorkLogEntry as createWorkLogEntryElement,
  createWorkLogMoreButton,
} from "./workLogView";
import { renderWeeklyView } from "./weeklyView";

const RECENT_WORK_LOG_DAYS = 7;

// Shared helpers

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

// Modal

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
  return createTodoDetailView(todo, {
    workLogSummary: renderTodoWorkLogSummary(todo.id),
    onEdit: () => {
      uiState.editingTodoId = todo.id;
      render();
    },
    onDelete: () => {
      deleteTodo(todo.id);
      uiState.selectedTodoId = null;
      uiState.editingTodoId = null;
      render();
    },
  });
}

function renderTodoEditForm(todo: Todo): HTMLElement {
  return createTodoEditForm(todo, {
    onUpdate: (updates) => {
      updateTodo(todo.id, updates);
      uiState.editingTodoId = null;
      render();
    },
    onCancel: () => {
      uiState.editingTodoId = null;
      render();
    },
    onDelete: () => {
      deleteTodo(todo.id);
      uiState.selectedTodoId = null;
      uiState.editingTodoId = null;
      render();
    },
  });
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
    const isSelected = todo.id === uiState.selectedTodoId;
    const detail = isSelected ? (uiState.editingTodoId === todo.id ? renderTodoEditForm(todo) : renderTodoDetailView(todo)) : null;
    const item = createTodoListItem(todo, {
      selected: isSelected,
      detail,
      onToggle: (completed) => {
        toggleTodo(todo.id, completed);
        render();
      },
      onSelect: () => {
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
      },
    });
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
  renderProjectList({ onSelectProject: selectProject, onReorderProjects: reorderProjects, onRender: render });
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
