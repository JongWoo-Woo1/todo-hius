import {
  normalizeCalendarRangePreferences,
  type CalendarRangePreferences,
} from "../state/calendarPreferences";
import { uiState } from "../app/uiState";
import {
  addWorkLog,
  deleteTask,
  deleteWorkLog,
  getActiveProject,
  getState,
  reorderProjects,
  selectProject,
  toggleTask,
  updateTask,
  updateWorkLog,
} from "../state/store";
import { createId } from "../utils/id";
import { toDateKey } from "../utils/calendar";
import {
  findTaskWithProject,
  getProjectById,
  getSortedTasksByDueDate,
  getTaskByProject,
  getWorkLogById,
} from "../state/selectors";
import type { Project, Task, WorkLogType } from "../types";
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
  createTaskDetailView,
  createTaskEditForm,
} from "./taskView";
import {
  renderProjectWorkLogSection,
  renderTaskWorkLogSummary as renderTaskWorkLogSummarySection,
} from "./workLogSectionView";
import { renderWeeklyView } from "./weeklyView";
import { confirmDelete } from "./confirmDialog";
import { renderEmptyProjectDetail, renderProjectDetailShell } from "./projectDetailView";
import { clearTaskList, renderTaskList } from "./taskListView";
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
      uiState.selectedModalTaskId = null;
      uiState.isModalTaskEditing = false;
      render();
    },
    onTaskSelect: (task) => {
      uiState.selectedModalProjectId = null;
      uiState.selectedModalTaskId = task.id;
      uiState.isModalTaskEditing = false;
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

function renderTaskWorkLogSummary(taskId: string): HTMLElement {
  return renderTaskWorkLogSummarySection({
    state: getState(),
    taskId,
    showAll: uiState.expandedTaskWorkLogIds.has(taskId),
    onSelectWorkLog: (workLogId) => {
      openWorkLogDetail(workLogId);
      render();
    },
    onToggleExpand: (id, expand) => {
      if (expand) {
        uiState.expandedTaskWorkLogIds.add(id);
      } else {
        uiState.expandedTaskWorkLogIds.delete(id);
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
    onTaskSelect: (task) => {
      uiState.selectedModalProjectId = null;
      uiState.selectedModalTaskId = task.taskId;
      uiState.isModalTaskEditing = false;
      render();
    },
  });
}

// Modal

function closeCalendarDetailModal(): void {
  uiState.selectedModalProjectId = null;
  uiState.selectedModalTaskId = null;
  uiState.isModalTaskEditing = false;
}

function goToProjectTask(projectId: string, taskId: string | null): void {
  selectProject(projectId);
  uiState.selectedTaskId = taskId;
  uiState.editingTaskId = null;
  uiState.isProjectInfoEditing = false;
  uiState.isProjectNameEditing = false;
  closeCalendarDetailModal();
  uiState.currentView = "projects";
}

function renderCalendarDetailModal(): void {
  const selection = findTaskWithProject(getState(), uiState.selectedModalTaskId);
  const selectedProject = uiState.selectedModalProjectId
    ? (getProjectById(getState(), uiState.selectedModalProjectId) ?? null)
    : null;

  renderCalendarDetailModalView({
    currentView: uiState.currentView,
    selectedProject,
    selection,
    isTaskEditing: uiState.isModalTaskEditing,
    workLogSummary: selection ? renderTaskWorkLogSummary(selection.task.id) : null,
    onClose: () => {
      closeCalendarDetailModal();
      render();
    },
    onOpenProjectTask: (projectId, taskId) => {
      goToProjectTask(projectId, taskId);
      render();
    },
    onEditTask: () => {
      uiState.isModalTaskEditing = true;
      render();
    },
    onCancelTaskEdit: () => {
      uiState.isModalTaskEditing = false;
      render();
    },
    onSelectTaskFromProject: (taskId) => {
      uiState.selectedModalProjectId = null;
      uiState.selectedModalTaskId = taskId;
      uiState.isModalTaskEditing = false;
      render();
    },
    onUpdateTask: (taskId, updates) => {
      updateTask(taskId, updates);
      uiState.isModalTaskEditing = false;
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
  const linkedTask = getTaskByProject(project, workLog?.taskId);

  renderWorkLogDetailModalView({
    workLog: workLog ?? null,
    project,
    linkedTask,
    projectTasks: project?.tasks ?? [],
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
      if (project && linkedTask) {
        goToProjectTask(project.id, linkedTask.id);
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
    onCreate: ({ projectId, date, type, taskId, content }) => {
      // A linked task on its own signals intent to perform that task, so
      // content is optional as long as either content or a task is provided.
      if (!projectId || (!content && !taskId)) {
        return;
      }

      addWorkLog({ id: createId(), projectId, date, type, taskId, content });
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

// Task detail

function renderTaskDetailView(task: Task): HTMLElement {
  return createTaskDetailView(task, {
    workLogSummary: renderTaskWorkLogSummary(task.id),
    onEdit: () => {
      uiState.editingTaskId = task.id;
      render();
    },
    onDelete: async () => {
      if (!(await confirmDelete(`"${task.title}" 업무를 삭제하시겠습니까?\n연결된 주간 업무 기록도 함께 삭제됩니다.`))) {
        return;
      }

      deleteTask(task.id);
      uiState.selectedTaskId = null;
      uiState.editingTaskId = null;
      render();
    },
  });
}

function renderTaskEditForm(task: Task): HTMLElement {
  return createTaskEditForm(task, {
    onUpdate: (updates) => {
      updateTask(task.id, updates);
      uiState.editingTaskId = null;
      render();
    },
    onCancel: () => {
      uiState.editingTaskId = null;
      render();
    },
    onDelete: async () => {
      if (!(await confirmDelete(`"${task.title}" 업무를 삭제하시겠습니까?\n연결된 주간 업무 기록도 함께 삭제됩니다.`))) {
        return;
      }

      deleteTask(task.id);
      uiState.selectedTaskId = null;
      uiState.editingTaskId = null;
      render();
    },
  });
}

function renderTasks(): void {
  const activeProject = getActiveProject();

  if (!activeProject) {
    clearTaskList();
    renderEmptyProjectDetail();
    uiState.isProjectNameEditing = false;
    showProjectNameEditMode(false);
    uiState.isProjectInfoEditing = false;
    showProjectInfoEditMode(false);
    uiState.selectedTaskId = null;
    uiState.editingTaskId = null;
    return;
  }

  const sortedTasks = getSortedTasksByDueDate(activeProject);
  renderProjectHeader(activeProject);
  showProjectNameEditMode(uiState.isProjectNameEditing);
  renderProjectInfo(activeProject);
  showProjectInfoEditMode(uiState.isProjectInfoEditing);
  renderProjectWorkLogs();
  renderProjectDetailShell(sortedTasks.length);

  renderTaskList({
    tasks: sortedTasks,
    selectedTaskId: uiState.selectedTaskId,
    editingTaskId: uiState.editingTaskId,
    renderDetailView: renderTaskDetailView,
    renderEditForm: renderTaskEditForm,
    onToggle: (taskId, completed) => {
      toggleTask(taskId, completed);
      render();
    },
    onSelect: (taskId) => {
      if (uiState.selectedTaskId === taskId) {
        uiState.selectedTaskId = null;
        uiState.editingTaskId = null;
        render();
        return;
      }

      uiState.selectedTaskId = taskId;
      if (uiState.editingTaskId && uiState.editingTaskId !== taskId) {
        uiState.editingTaskId = null;
      }
      render();
    },
  });
}

// Exported render controls

export function clearSelectedTask(): void {
  uiState.selectedTaskId = null;
  uiState.editingTaskId = null;
}

export function resetCalendarSelection(): void {
  uiState.selectedCalendarProjectIds = null;
  closeCalendarDetailModal();
}

export function selectTask(taskId: string): void {
  uiState.selectedTaskId = taskId;
  uiState.editingTaskId = null;
}

export function getSelectedTaskId(): string | null {
  return uiState.selectedTaskId;
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
  renderTasks();
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
