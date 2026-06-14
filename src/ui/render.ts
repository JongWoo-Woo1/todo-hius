import {
  normalizeCalendarRangePreferences,
  type CalendarRangePreferences,
} from "../state/calendarPreferences";
import { uiState } from "../app/uiState";
import { recordNavigation } from "../app/navigationHistory";
import { openWorkspaceWindow } from "../platform/todoFileClient";
import {
  addEvent,
  addTaskToProject,
  addWorkLog,
  deleteEvent,
  deleteTask,
  deleteWorkLog,
  getActiveProject,
  getState,
  permanentlyDeleteTask,
  reorderProjects,
  restoreDeletedTask,
  selectProject,
  selectProjectForView,
  toggleTask,
  updateProject,
  updateTask,
  updateEvent,
  updateWorkLog,
} from "../state/store";
import { createId } from "../utils/id";
import { toDateKey } from "../utils/calendar";
import {
  findTaskWithProject,
  getDeletedTaskByProject,
  getEventById,
  getLinkedTaskDisplay,
  getProjectById,
  getSortedTasksByDueDate,
  getTaskByProject,
  getWorkLogById,
} from "../state/selectors";
import type { Project, ProjectEvent, Task, WorkLogType } from "../types";
import { renderCalendarView } from "./calendarView";
import { renderFeedView } from "./feedView";
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
  renderTaskWorkLogSummary as renderTaskWorkLogSummarySection,
} from "./workLogSectionView";
import { renderProjectMemoView } from "./projectMemoView";
import { renderWeeklyView } from "./weeklyView";
import { confirmDelete } from "./confirmDialog";
import { renderEmptyProjectDetail, renderProjectDetailShell } from "./projectDetailView";
import { clearTaskList, renderTaskList } from "./taskListView";
import { clearTaskTrashView, renderTaskTrashView } from "./taskTrashView";
import { renderViewVisibility } from "./navView";
import { renderWorkLogDetailModalView, type WorkLogFeedSuggestion } from "./workLogDetailView";
import { renderEventDetailModalView, type EventInput } from "./eventDetailView";
import { renderCalendarTaskAddModalView } from "./calendarAddView";
import { getContentPreview } from "./feedShared";
import { showToast } from "./toast";

// Shared helpers

// Optional dev-only hook invoked after each render so the main window can buffer its
// top-level route in the Electron main process and survive a Vite renderer reload.
// Wiring only; the snapshot is built and published by src/main.ts.
let afterRenderHook: (() => void) | null = null;

export function setAfterRenderHook(hook: (() => void) | null): void {
  afterRenderHook = hook;
}

export function setOpenedWorkspaceWindowKeys(windowKeys: string[]): void {
  uiState.openedWorkspaceWindowKeys = new Set(windowKeys);
  render();
}

function getWorkspaceWindowProjectId(): string | null {
  const windowKey = uiState.workspaceWindowKey;
  if (!windowKey?.startsWith("project:")) {
    return null;
  }

  return windowKey.slice("project:".length) || null;
}

export function getWorkspaceWindowTitle(): string {
  const windowKey = uiState.workspaceWindowKey;
  if (windowKey === "view:calendar") {
    return "Calendar";
  }

  if (windowKey === "view:feed") {
    return "Feed";
  }

  if (windowKey === "view:weekly") {
    return "Weekly";
  }

  if (windowKey === "view:ledger") {
    return "Ledger";
  }

  const projectId = getWorkspaceWindowProjectId();
  if (projectId) {
    return getProjectById(getState(), projectId)?.name ?? "Project";
  }

  return "HIUS Todo";
}

export function applyWorkspaceWindowRoute(): void {
  const windowKey = uiState.workspaceWindowKey;
  if (!windowKey) {
    return;
  }

  if (windowKey === "view:calendar") {
    activateCalendarButton();
    return;
  }

  if (windowKey === "view:feed") {
    showFeedView();
    return;
  }

  if (windowKey === "view:weekly") {
    showWeeklyView();
    return;
  }

  if (windowKey === "view:ledger") {
    showLedgerView();
    return;
  }

  const projectId = getWorkspaceWindowProjectId();
  if (projectId) {
    selectProjectForView(projectId);
    showProjectView();
    return;
  }

  showProjectView();
}

export async function openWorkspaceWindowKey(windowKey: string): Promise<void> {
  try {
    const windowKeys = await openWorkspaceWindow(windowKey);
    setOpenedWorkspaceWindowKeys(windowKeys);
  } catch (error) {
    console.error(error);
    showToast("새창을 여는 데 실패했습니다.", "error");
  }
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

function ensureFeedSelection(): void {
  const projectIds = getState().projects.map((project) => project.id);
  if (!uiState.selectedFeedProjectIds) {
    uiState.selectedFeedProjectIds = new Set(projectIds);
    return;
  }

  const existingSelection = uiState.selectedFeedProjectIds;
  uiState.selectedFeedProjectIds = new Set(projectIds.filter((projectId) => existingSelection.has(projectId)));
}

function renderFeed(): void {
  ensureFeedSelection();
  renderFeedView({
    state: getState(),
    selectedProjectIds: uiState.selectedFeedProjectIds ?? new Set<string>(),
    showFutureItems: uiState.isFeedFutureExpanded,
    showPastItems: uiState.isFeedPastExpanded,
    isSettingsOpen: uiState.isFeedSettingsOpen,
    onSelectWorkLog: (workLogId) => {
      openWorkLogDetail(workLogId);
      render();
    },
    onSelectEvent: (eventId) => {
      openEventDetail(eventId);
      render();
    },
    onSelectTask: (taskId) => {
      uiState.selectedModalProjectId = null;
      uiState.selectedModalTaskId = taskId;
      uiState.isModalTaskEditing = false;
      render();
    },
    onToggleFutureItems: (showFutureItems) => {
      uiState.isFeedFutureExpanded = showFutureItems;
      render();
    },
    onTogglePastItems: (showPastItems) => {
      uiState.isFeedPastExpanded = showPastItems;
      render();
    },
    onSelectedProjectIdsChange: (selectedProjectIds) => {
      uiState.selectedFeedProjectIds = selectedProjectIds;
      render();
    },
    onToggleAllProjects: () => {
      const projectIds = getState().projects.map((project) => project.id);
      const selected = uiState.selectedFeedProjectIds ?? new Set(projectIds);
      const allSelected = projectIds.length > 0 && selected.size === projectIds.length;
      uiState.selectedFeedProjectIds = allSelected ? new Set() : new Set(projectIds);
      render();
    },
    onToggleSettings: (open) => {
      uiState.isFeedSettingsOpen = open;
      render();
    },
  });
}

function renderLedger(): void {
  renderLedgerView(getState(), {
    isSettingsOpen: uiState.isLedgerSettingsOpen,
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
    onToggleSettings: (open) => {
      uiState.isLedgerSettingsOpen = open;
      render();
    },
    selectedStatuses: uiState.selectedLedgerStatuses,
    onSelectedStatusesChange: (statuses) => {
      uiState.selectedLedgerStatuses = statuses;
      render();
    },
    onProjectVisibilityChange: (projectId, visible) => {
      updateProject(projectId, { hideFromLedger: !visible });
      render();
    },
    onToggleAllProjects: () => {
      const state = getState();
      const allVisible = state.projects.length > 0 && state.projects.every((project) => !project.hideFromLedger);
      state.projects.forEach((project) => {
        updateProject(project.id, { hideFromLedger: allVisible });
      });
      render();
    },
  });
}

// WorkLog

function renderProjectMemo(): void {
  const activeProject = getActiveProject() ?? null;

  renderProjectMemoView({
    state: getState(),
    activeProject,
    onSelectWorkLog: (workLogId) => {
      openWorkLogDetail(workLogId);
      render();
    },
    onSelectEvent: (eventId) => {
      openEventDetail(eventId);
      render();
    },
    onSelectTask: (taskId) => {
      uiState.selectedTaskId = taskId;
      uiState.editingTaskId = null;
      closeWorkLogDetail();
      closeEventDetail();
      render();
    },
    onAddEvent: () => {
      openEventCreate();
      render();
    },
    showFutureItems: Boolean(activeProject && uiState.expandedProjectFutureFeedId === activeProject.id),
    showPastItems: Boolean(activeProject && uiState.expandedProjectPastFeedId === activeProject.id),
    onToggleFutureItems: (showFutureItems) => {
      uiState.expandedProjectFutureFeedId = showFutureItems && activeProject ? activeProject.id : null;
      render();
    },
    onTogglePastItems: (showPastItems) => {
      uiState.expandedProjectPastFeedId = showPastItems && activeProject ? activeProject.id : null;
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
    onEventSelect: (eventId) => {
      openEventDetail(eventId);
      render();
    },
    onAddEvent: () => {
      openEventCreate();
      render();
    },
    isSettingsOpen: uiState.isCalendarSettingsOpen,
    onToggleSettings: (open) => {
      uiState.isCalendarSettingsOpen = open;
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
    onDeleteTask: async (task) => {
      if (!(await confirmDelete(`"${task.title}" 업무를 휴지통으로 이동하시겠습니까?\n연결된 주간 업무 기록은 유지됩니다.`))) {
        return;
      }

      deleteTask(task.id);
      closeCalendarDetailModal();
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
  closeEventDetail();
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
  closeEventDetail();
}

function getEventTaskLabel(project: Project, event: ProjectEvent): string {
  const activeTask = getTaskByProject(project, event.taskId);
  if (activeTask) {
    return activeTask.title;
  }

  const deletedTask = getDeletedTaskByProject(project, event.taskId);
  if (deletedTask) {
    return `${deletedTask.title} (삭제됨)`;
  }

  return "";
}

function makeFeedSuggestionContent(title: string, content: string): string {
  return [title, content.trim()].filter(Boolean).join("\n\n");
}

function getWorkLogFeedSuggestions(state: ReturnType<typeof getState>): WorkLogFeedSuggestion[] {
  const suggestions: WorkLogFeedSuggestion[] = [];

  state.projects.forEach((project) => {
    const projectWorkLogs = state.workLogs.filter((workLog) => workLog.projectId === project.id);
    projectWorkLogs.forEach((workLog) => {
      suggestions.push({
        id: workLog.id,
        kind: "weekly",
        projectId: project.id,
        projectName: project.name,
        clientName: project.clientName,
        projectColor: project.color,
        title: workLog.type,
        dateStart: workLog.date,
        dateEnd: workLog.endDate ?? workLog.date,
        meta: workLog.type,
        preview: getContentPreview(workLog.content),
        content: workLog.content,
      });
    });

    const projectEvents = state.events.filter((event) => event.projectId === project.id);
    projectEvents.forEach((event) => {
      const content = makeFeedSuggestionContent(event.title, event.content);
      suggestions.push({
        id: event.id,
        kind: "event",
        projectId: project.id,
        projectName: project.name,
        clientName: project.clientName,
        projectColor: project.color,
        title: event.title,
        dateStart: event.startDate,
        dateEnd: event.endDate ?? event.startDate,
        meta: getEventTaskLabel(project, event),
        preview: getContentPreview(event.content),
        content,
      });
    });

    project.tasks.forEach((task) => {
      if (task.completed) {
        return;
      }

      const detail = task.memo || task.workerComment || task.managerComment || task.issueRisk || "";
      const content = makeFeedSuggestionContent(task.title, detail);
      suggestions.push({
        id: task.id,
        kind: "task",
        projectId: project.id,
        projectName: project.name,
        clientName: project.clientName,
        projectColor: project.color,
        title: task.title,
        dateStart: task.dueDate,
        dateEnd: task.dueDate,
        meta: [task.status, task.priority].filter(Boolean).join(" / "),
        preview: getContentPreview(detail),
        content,
        taskId: task.id,
      });
    });
  });

  return suggestions.sort((left, right) => {
    if (left.dateStart && right.dateStart && left.dateStart !== right.dateStart) {
      const dateDiff = left.dateStart.localeCompare(right.dateStart);
      return dateDiff;
    }

    if (left.dateStart && !right.dateStart) {
      return -1;
    }

    if (!left.dateStart && right.dateStart) {
      return 1;
    }

    const kindDiff = left.kind.localeCompare(right.kind);
    if (kindDiff !== 0) {
      return kindDiff;
    }

    return left.title.localeCompare(right.title);
  });
}

function renderWorkLogDetailModal(): void {
  const state = getState();
  const canShowWorkLogDetail =
    uiState.currentView === "projects" || uiState.currentView === "weekly" || uiState.currentView === "feed";
  const isCreating = canShowWorkLogDetail && uiState.isWorkLogCreating;
  const workLog = canShowWorkLogDetail ? getWorkLogById(state, uiState.selectedWorkLogId) : undefined;
  const project = workLog ? getProjectById(state, workLog.projectId) : undefined;
  const linkedTaskDisplay = workLog ? getLinkedTaskDisplay(project, workLog) : null;

  renderWorkLogDetailModalView({
    workLog: workLog ?? null,
    project,
    linkedTaskLabel: linkedTaskDisplay?.label ?? "Linked Task 없음",
    canOpenLinkedTask: Boolean(linkedTaskDisplay?.activeTask),
    projectTasks: project?.tasks ?? [],
    isEditing: uiState.isWorkLogEditing,
    isCreating,
    projects: state.projects,
    feedSuggestions: getWorkLogFeedSuggestions(state),
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
      if (project && linkedTaskDisplay?.activeTask) {
        goToProjectTask(project.id, linkedTaskDisplay.activeTask.id);
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
    onCreate: ({ projectId, date, endDate, type, taskId, content }) => {
      if (!projectId) {
        return;
      }

      addWorkLog({ id: createId(), projectId, date, endDate, type, taskId, content });
      closeWorkLogDetail();
      render();
    },
  });
}

// Event detail modal

function openEventDetail(eventId: string): void {
  uiState.selectedEventId = eventId;
  uiState.isEventEditing = false;
  uiState.isEventCreating = false;
  closeWorkLogDetail();
}

function closeEventDetail(): void {
  uiState.selectedEventId = null;
  uiState.isEventEditing = false;
  uiState.isEventCreating = false;
  uiState.eventCreateDate = null;
}

function openEventCreate(date?: string): void {
  uiState.isEventCreating = true;
  uiState.selectedEventId = null;
  uiState.isEventEditing = false;
  uiState.eventCreateDate = date ?? null;
  uiState.isCalendarTaskCreating = false;
  closeWorkLogDetail();
}

function getEventLinkedTask(project: Project | undefined, event: ProjectEvent | null): Task | undefined {
  if (!event) {
    return undefined;
  }

  return getTaskByProject(project, event.taskId);
}

function getEventLinkedTaskLabel(project: Project | undefined, event: ProjectEvent | null): string | null {
  if (!event || !event.taskId) {
    return null;
  }

  const activeTask = getTaskByProject(project, event.taskId);
  if (activeTask) {
    return activeTask.title;
  }

  const deletedTask = getDeletedTaskByProject(project, event.taskId);
  if (deletedTask) {
    return `${deletedTask.title} (삭제됨)`;
  }

  return null;
}

function renderEventDetailModal(): void {
  const state = getState();
  const canShowEventDetail =
    uiState.currentView === "projects" || uiState.currentView === "calendar" || uiState.currentView === "feed";
  const isCreating = canShowEventDetail && uiState.isEventCreating;
  const event = canShowEventDetail ? getEventById(state, uiState.selectedEventId) : undefined;
  const selectedProjectId = event?.projectId ?? (uiState.currentView === "projects" ? state.activeProjectId : null);
  const project = selectedProjectId ? getProjectById(state, selectedProjectId) : undefined;
  const linkedTask = getEventLinkedTask(project, event ?? null);
  const linkedTaskLabel = getEventLinkedTaskLabel(project, event ?? null);

  renderEventDetailModalView({
    event: event ?? null,
    project,
    projects: state.projects,
    selectedProjectId,
    lockProjectSelect: uiState.currentView === "projects" || Boolean(event),
    linkedTaskLabel,
    canOpenLinkedTask: Boolean(linkedTask),
    projectTasks: project?.tasks ?? [],
    isEditing: uiState.isEventEditing,
    isCreating,
    defaultStartDate: uiState.eventCreateDate ?? toDateKey(new Date()),
    onClose: () => {
      closeEventDetail();
      render();
    },
    onEdit: () => {
      uiState.isEventEditing = true;
      render();
    },
    onCancelEdit: () => {
      uiState.isEventEditing = false;
      render();
    },
    onOpenTask: () => {
      if (project && linkedTask) {
        goToProjectTask(project.id, linkedTask.id);
      }
      closeEventDetail();
      render();
    },
    onUpdate: (updates) => {
      if (!event) {
        return;
      }

      updateEvent(event.id, updates);
      uiState.isEventEditing = false;
      render();
    },
    onDelete: async () => {
      if (!event) {
        return;
      }

      if (!(await confirmDelete("선택한 Event를 삭제하시겠습니까?"))) {
        return;
      }

      deleteEvent(event.id);
      closeEventDetail();
      render();
    },
    onCreate: (input: EventInput) => {
      if (!input.projectId) {
        return;
      }

      addEvent({ id: createId(), ...input });
      closeEventDetail();
      render();
    },
  });
}

function closeCalendarTaskAddModal(): void {
  uiState.isCalendarTaskCreating = false;
}

function renderCalendarTaskAddModal(): void {
  renderCalendarTaskAddModalView({
    isOpen: (uiState.currentView === "calendar" || uiState.currentView === "projects") && uiState.isCalendarTaskCreating,
    projects: getState().projects,
    activeProjectId: getState().activeProjectId,
    onClose: () => {
      closeCalendarTaskAddModal();
      render();
    },
    onCreateTask: ({ projectId, title, dueDate }) => {
      if (!projectId || !title) {
        return;
      }

      addTaskToProject(projectId, {
        id: createId(),
        title,
        dueDate,
        estimate: "",
        status: "대기",
        progress: 0,
        workerComment: "",
        managerComment: "",
        priority: "보통",
        memo: "",
        completed: false,
      });
      closeCalendarTaskAddModal();
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
      if (!(await confirmDelete(`"${task.title}" 업무를 휴지통으로 이동하시겠습니까?\n연결된 주간 업무 기록은 유지됩니다.`))) {
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
      if (!(await confirmDelete(`"${task.title}" 업무를 휴지통으로 이동하시겠습니까?\n연결된 주간 업무 기록은 유지됩니다.`))) {
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
    clearTaskTrashView();
    const isChildProjectWindow = Boolean(getWorkspaceWindowProjectId());
    renderEmptyProjectDetail(
      isChildProjectWindow
        ? { title: "Project not found", message: "Project not found." }
        : undefined,
    );
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
  renderProjectMemo();
  renderProjectDetailShell(sortedTasks.length, () => {
    uiState.isCalendarTaskCreating = true;
    closeCalendarDetailModal();
    closeWorkLogDetail();
    closeEventDetail();
    render();
  });

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

  renderTaskTrashView({
    deletedTasks: activeProject.deletedTasks,
    expanded: uiState.expandedTaskTrashProjectId === activeProject.id,
    onToggleExpanded: () => {
      uiState.expandedTaskTrashProjectId =
        uiState.expandedTaskTrashProjectId === activeProject.id ? null : activeProject.id;
      render();
    },
    onRestoreTask: (taskId) => {
      restoreDeletedTask(taskId);
      render();
    },
    onPermanentlyDeleteTask: async (task) => {
      if (!(await confirmDelete(`"${task.title}" 업무를 영구 삭제하시겠습니까?\n연결된 주간 업무 기록은 유지됩니다.`))) {
        return;
      }

      permanentlyDeleteTask(task.id);
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

export function resetFeedSelection(): void {
  uiState.selectedFeedProjectIds = null;
}

export function includeCalendarProject(projectId: string): void {
  if (!uiState.selectedCalendarProjectIds) {
    return;
  }

  uiState.selectedCalendarProjectIds.add(projectId);
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

export function showFeedView(): void {
  uiState.currentView = "feed";
}

export function activateCalendarButton(): void {
  const activeProjectId = getState().activeProjectId;
  if (activeProjectId) {
    includeCalendarProject(activeProjectId);
  }

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
  if (uiState.workspaceWindowKey) {
    applyWorkspaceWindowRoute();
    document.title = `HIUS Todo - ${getWorkspaceWindowTitle()}`;
  }

  renderProjectList({
    onSelectProject: selectProject,
    onReorderProjects: reorderProjects,
    onOpenWorkspaceWindow: (windowKey) => {
      void openWorkspaceWindowKey(windowKey);
    },
    onRender: render,
    openedWindowKeys: uiState.openedWorkspaceWindowKeys,
  });
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
  renderFeed();
  renderCalendarDetailModal();
  renderWorkLogDetailModal();
  renderEventDetailModal();
  renderCalendarTaskAddModal();
  renderViewVisibility(uiState.currentView, uiState.openedWorkspaceWindowKeys);

  // Record this screen in the per-window navigation history. recordNavigation only
  // appends when the navigation context actually changed, so plain re-renders, state
  // sync, dirty changes and input edits do not create history entries.
  recordNavigation();

  afterRenderHook?.();
}
