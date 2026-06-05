import {
  normalizeCalendarRangePreferences,
  type CalendarRangePreferences,
} from "../state/calendarPreferences";
import { uiState } from "../app/uiState";
import {
  addWorkLog,
  deleteTodo,
  deleteWorkLog,
  getActiveProject,
  getState,
  reorderProjects,
  selectProject,
  toggleTodo,
  updateTodo,
  updateWorkLog,
} from "../state/store";
import { createId } from "../utils/id";
import { toDateKey } from "../utils/calendar";
import {
  findTodoWithProject,
  getProjectById,
  getSortedTodosByDueDate,
  getTodoByProject,
  getWorkLogById,
} from "../state/selectors";
import type { Project, Todo, WorkLogType } from "../types";
import { renderCalendarView } from "./calendarView";
import { renderLedgerView } from "./ledgerView";
import { renderCalendarDetailModalView } from "./modalView";
import { renderProjectList } from "./projectListView";
import {
  renderProjectHeader,
  renderProjectInfoView as renderProjectInfo,
  setProjectInfoEditMode,
  setProjectNameEditMode,
} from "./projectView";
import {
  createTodoDetailView,
  createTodoEditForm,
} from "./todoView";
import {
  renderProjectWorkLogSection,
  renderTodoWorkLogSummary as renderTodoWorkLogSummarySection,
} from "./workLogSectionView";
import { renderWeeklyView } from "./weeklyView";
import { confirmDelete } from "./confirmDialog";
import { renderEmptyProjectDetail, renderProjectDetailShell } from "./projectDetailView";
import { clearTodoList, renderTodoList } from "./todoListView";
import { renderViewVisibility } from "./navView";
import { renderWorkLogDetailModalView } from "./workLogDetailView";

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

function renderProjectWorkLogs(): void {
  renderProjectWorkLogSection({
    state: getState(),
    activeProject: getActiveProject() ?? null,
    expandedProjectWorkLogId: uiState.expandedProjectWorkLogId,
    onSelectWorkLog: (workLogId) => {
      openWorkLogDetail(workLogId);
      render();
    },
    onToggleExpand: (nextExpandedId) => {
      uiState.expandedProjectWorkLogId = nextExpandedId;
      render();
    },
  });
}

function renderTodoWorkLogSummary(todoId: string): HTMLElement {
  return renderTodoWorkLogSummarySection({
    state: getState(),
    todoId,
    showAll: uiState.expandedTodoWorkLogIds.has(todoId),
    onSelectWorkLog: (workLogId) => {
      openWorkLogDetail(workLogId);
      render();
    },
    onToggleExpand: (id, expand) => {
      if (expand) {
        uiState.expandedTodoWorkLogIds.add(id);
      } else {
        uiState.expandedTodoWorkLogIds.delete(id);
      }
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

// Work log detail modal

function openWorkLogDetail(workLogId: string): void {
  uiState.selectedWorkLogId = workLogId;
  uiState.isWorkLogEditing = false;
  uiState.isWorkLogCreating = false;
}

function closeWorkLogDetail(): void {
  uiState.selectedWorkLogId = null;
  uiState.isWorkLogEditing = false;
  uiState.isWorkLogCreating = false;
  uiState.workLogCreateDate = null;
  uiState.workLogCreateType = null;
}

function openWorkLogCreate(date: string, type: WorkLogType): void {
  uiState.isWorkLogCreating = true;
  uiState.selectedWorkLogId = null;
  uiState.isWorkLogEditing = false;
  uiState.workLogCreateDate = date;
  uiState.workLogCreateType = type;
}

function renderWorkLogDetailModal(): void {
  const state = getState();
  const canShowWorkLogDetail = uiState.currentView === "projects" || uiState.currentView === "weekly";
  const isCreating = canShowWorkLogDetail && uiState.isWorkLogCreating;
  const workLog = canShowWorkLogDetail ? getWorkLogById(state, uiState.selectedWorkLogId) : undefined;
  const project = workLog ? getProjectById(state, workLog.projectId) : undefined;
  const linkedTodo = getTodoByProject(project, workLog?.todoId);

  renderWorkLogDetailModalView({
    workLog: workLog ?? null,
    project,
    linkedTodo,
    projectTodos: project?.todos ?? [],
    isEditing: uiState.isWorkLogEditing,
    isCreating,
    projects: state.projects,
    defaultDate: uiState.workLogCreateDate ?? toDateKey(uiState.visibleWeekDate),
    defaultType: uiState.workLogCreateType ?? "수행",
    onClose: () => {
      closeWorkLogDetail();
      render();
    },
    onEdit: () => {
      uiState.isWorkLogEditing = true;
      render();
    },
    onCancelEdit: () => {
      uiState.isWorkLogEditing = false;
      render();
    },
    onOpenTask: () => {
      if (project && linkedTodo) {
        goToProjectTodo(project.id, linkedTodo.id);
      }
      closeWorkLogDetail();
      render();
    },
    onUpdate: (updates) => {
      if (!workLog) {
        return;
      }

      updateWorkLog(workLog.id, updates);
      uiState.isWorkLogEditing = false;
      render();
    },
    onDelete: async () => {
      if (!workLog) {
        return;
      }

      if (!(await confirmDelete("선택한 주간 업무 기록을 삭제하시겠습니까?"))) {
        return;
      }

      deleteWorkLog(workLog.id);
      closeWorkLogDetail();
      render();
    },
    onCreate: ({ projectId, date, type, todoId, content }) => {
      if (!projectId || !content) {
        return;
      }

      addWorkLog({ id: createId(), projectId, date, type, todoId, content });
      closeWorkLogDetail();
      render();
    },
  });
}

// Project detail

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

function renderTodoDetailView(todo: Todo): HTMLElement {
  return createTodoDetailView(todo, {
    workLogSummary: renderTodoWorkLogSummary(todo.id),
    onEdit: () => {
      uiState.editingTodoId = todo.id;
      render();
    },
    onDelete: async () => {
      if (!(await confirmDelete(`"${todo.title}" 업무를 삭제하시겠습니까?\n연결된 주간 업무 기록도 함께 삭제됩니다.`))) {
        return;
      }

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
    onDelete: async () => {
      if (!(await confirmDelete(`"${todo.title}" 업무를 삭제하시겠습니까?\n연결된 주간 업무 기록도 함께 삭제됩니다.`))) {
        return;
      }

      deleteTodo(todo.id);
      uiState.selectedTodoId = null;
      uiState.editingTodoId = null;
      render();
    },
  });
}

function renderTodos(): void {
  const activeProject = getActiveProject();

  if (!activeProject) {
    clearTodoList();
    renderEmptyProjectDetail();
    uiState.isProjectNameEditing = false;
    showProjectNameEditMode(false);
    uiState.isProjectInfoEditing = false;
    showProjectInfoEditMode(false);
    uiState.selectedTodoId = null;
    uiState.editingTodoId = null;
    return;
  }

  const sortedTodos = getSortedTodosByDueDate(activeProject);
  renderProjectHeader(activeProject);
  showProjectNameEditMode(uiState.isProjectNameEditing);
  renderProjectInfo(activeProject);
  showProjectInfoEditMode(uiState.isProjectInfoEditing);
  renderProjectWorkLogs();
  renderProjectDetailShell(sortedTodos.length);

  renderTodoList({
    todos: sortedTodos,
    selectedTodoId: uiState.selectedTodoId,
    editingTodoId: uiState.editingTodoId,
    renderDetailView: renderTodoDetailView,
    renderEditForm: renderTodoEditForm,
    onToggle: (todoId, completed) => {
      toggleTodo(todoId, completed);
      render();
    },
    onSelect: (todoId) => {
      if (uiState.selectedTodoId === todoId) {
        uiState.selectedTodoId = null;
        uiState.editingTodoId = null;
        render();
        return;
      }

      uiState.selectedTodoId = todoId;
      if (uiState.editingTodoId && uiState.editingTodoId !== todoId) {
        uiState.editingTodoId = null;
      }
      render();
    },
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
  renderWeeklyView(getState(), uiState.visibleWeekDate, {
    onSelectWorkLog: (workLogId) => {
      openWorkLogDetail(workLogId);
      render();
    },
    onAddWorkLog: (date, type) => {
      openWorkLogCreate(date, type);
      render();
    },
  });
  renderCalendar();
  renderCalendarDetailModal();
  renderWorkLogDetailModal();
  renderViewVisibility(uiState.currentView);
}
