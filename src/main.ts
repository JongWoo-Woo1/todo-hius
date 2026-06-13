import "./styles.css";

import {
  isTodoFileClientAvailable,
  getLatestTodoAppState,
  getStartupTodoWorkspacePath,
  openDefaultTodoWorkspace,
  listWorkspaceWindows,
  listRecentTodoWorkspaces,
  onTodoAppStateChange,
  onTodoDirtyChange,
  onOpenTodoWorkspacePathRequest,
  onWorkspaceWindowsChange,
  onTodoFileMenuCommand,
  onTodoFileSaveRequest,
  openTodoWorkspace,
  openTodoWorkspacePath,
  publishTodoAppState,
  removeRecentTodoWorkspace,
  saveTodoWorkspace,
  saveTodoWorkspaceAs,
  setTodoFileDirty,
} from "./platform/todoFileClient";
import { uiState } from "./app/uiState";
import {
  navigateBack,
  navigateForward,
  resetNavigationHistory,
  runWithoutNavigationRecording,
  setNavigationRenderer,
} from "./app/navigationHistory";
import { registerAiActionHandler } from "./app/aiActions";
import {
  addProject,
  deleteActiveProject,
  getActiveProject,
  getState,
  replaceState,
  replaceStateFromSync,
  setStateChangeListener,
  updateActiveProject,
  updateActiveProjectColor,
} from "./state/store";
import type { Project } from "./types";
import { toDateKey } from "./utils/calendar";
import { createId } from "./utils/id";
import { getProjectColor } from "./utils/projectColor";
import {
  addProjectButton,
  activeProjectNameButton,
  calendarColumnSelect,
  calendarEndMonthSelect,
  calendarStartMonthSelect,
  calendarViewButton,
  calendarWindowButton,
  feedViewButton,
  feedWindowButton,
  cancelProjectInfoButton,
  cancelProjectNameButton,
  deleteProjectButton,
  editProjectInfoButton,
  ledgerClientFilter,
  ledgerExportButton,
  ledgerHideCompletedInput,
  ledgerOverdueOnlyInput,
  ledgerStatusFilter,
  ledgerViewButton,
  ledgerWindowButton,
  projectClientNameInput,
  projectColorInput,
  projectInfoForm,
  projectNameForm,
  projectNameInput,
  projectNumberInput,
  projectPeriodEndMonthInput,
  projectPeriodStartMonthInput,
  projectPeriodStatusSelect,
  toggleAllProjectsButton,
  nextWeekButton,
  previousWeekButton,
  weeklyExportButton,
  weeklyViewButton,
  weeklyWindowButton,
} from "./ui/dom";
import {
  activateCalendarButton,
  clearSelectedTask,
  goToNextWeek,
  goToPreviousWeek,
  getVisibleWeekDate,
  includeCalendarProject,
  openWorkspaceWindowKey,
  render,
  resetCalendarSelection,
  resetFeedSelection,
  setOpenedWorkspaceWindowKeys,
  showLedgerView,
  showProjectInfoEditMode,
  showProjectNameEditMode,
  showProjectView,
  showWeeklyView,
  showFeedView,
  toggleAllCalendarProjects,
  updateCalendarRangePreferences,
} from "./ui/render";
import { confirmDelete } from "./ui/confirmDialog";
import { showToast } from "./ui/toast";
import { closeStartupDialog, openStartupDialog } from "./ui/startupDialog";

let currentTodoWorkspacePath: string | undefined;
let isDirty = false;
const workspaceWindowKey = getWorkspaceWindowKey();
let isApplyingSyncedState = false;

function getWorkspaceWindowKey(): string | null {
  const windowKey = new URLSearchParams(window.location.search).get("windowKey")?.trim();
  return windowKey || null;
}

function createUniqueProjectName(): string {
  const baseName = "new project";
  const projectNames = new Set(getState().projects.map((project) => project.name));
  if (!projectNames.has(baseName)) {
    return baseName;
  }

  let count = 1;
  while (projectNames.has(`${baseName} ${count}`)) {
    count += 1;
  }

  return `${baseName} ${count}`;
}

function updateTodoWorkspacePath(filePath: string | undefined): void {
  currentTodoWorkspacePath = filePath;
}

function setDirty(value: boolean): void {
  isDirty = value;
  setTodoFileDirty(value);
}

function publishCurrentState(): void {
  publishTodoAppState(getState());
}

function markDirty(): void {
  if (isApplyingSyncedState) {
    return;
  }

  setDirty(true);
  publishCurrentState();
}

function applySyncedState(state: unknown): boolean {
  isApplyingSyncedState = true;
  const replaced = replaceStateFromSync(state);
  isApplyingSyncedState = false;
  if (replaced) {
    // Cross-window state sync is not a user navigation, so don't record it.
    runWithoutNavigationRecording(render);
  }

  return replaced;
}

function startNewProject(): void {
  replaceState({ projects: [], activeProjectId: null, workLogs: [] });
  updateTodoWorkspacePath(undefined);
  setDirty(false);
  clearSelectedTask();
  resetCalendarSelection();
  resetFeedSelection();
  render();
  resetNavigationHistory();
}

async function openProjectByPath(workspacePath: string): Promise<boolean> {
  if (!isTodoFileClientAvailable()) {
    return false;
  }

  try {
    const result = await openTodoWorkspacePath(workspacePath);
    if (result.canceled) {
      showToast("프로젝트를 찾을 수 없어 목록에서 제거했습니다.", "error");
      return false;
    }

    const imported = replaceState(result.state);
    if (!imported) {
      showToast("유효하지 않은 .todo 워크스페이스입니다.", "error");
      return false;
    }

    updateTodoWorkspacePath(result.workspacePath);
    setDirty(false);
    publishCurrentState();
    clearSelectedTask();
    resetCalendarSelection();
    resetFeedSelection();
    render();
    resetNavigationHistory();
    return true;
  } catch (error) {
    console.error(error);
    showToast(".todo 워크스페이스를 여는 데 실패했습니다.", "error");
    return false;
  }
}

async function showStartupChooser(): Promise<void> {
  if (!isTodoFileClientAvailable()) {
    return;
  }

  const { recents } = await listRecentTodoWorkspaces();
  openStartupDialog({
    recents,
    onOpenRecent: async (workspacePath) => {
      const opened = await openProjectByPath(workspacePath);
      if (opened) {
        closeStartupDialog();
      } else {
        void showStartupChooser();
      }
    },
    onOpenOther: async () => {
      const opened = await openProject();
      if (opened) {
        closeStartupDialog();
      }
    },
    onNewProject: () => {
      startNewProject();
      closeStartupDialog();
    },
    onRemoveRecent: async (workspacePath) => {
      await removeRecentTodoWorkspace(workspacePath);
      void showStartupChooser();
    },
  });
}

async function openProject(): Promise<boolean> {
  if (!isTodoFileClientAvailable()) {
    return false;
  }

  try {
    const result = await openTodoWorkspace();
    if (result.canceled) {
      return false;
    }

    const imported = replaceState(result.state);
    if (!imported) {
      window.alert("Invalid .todo workspace. Please select a HIUS Todo workspace file.");
      return false;
    }

    updateTodoWorkspacePath(result.workspacePath);
    setDirty(false);
    publishCurrentState();
    clearSelectedTask();
    resetCalendarSelection();
    resetFeedSelection();
    render();
    resetNavigationHistory();
    return true;
  } catch (error) {
    console.error(error);
    window.alert("Failed to open the selected .todo workspace.");
    return false;
  }
}

async function saveProject({ saveAs = false }: { saveAs?: boolean } = {}): Promise<boolean> {
  if (!isTodoFileClientAvailable()) {
    return false;
  }

  try {
    const result = saveAs
      ? await saveTodoWorkspaceAs(getState())
      : await saveTodoWorkspace(getState(), currentTodoWorkspacePath);
    if (result.canceled) {
      return false;
    }

    updateTodoWorkspacePath(result.workspacePath);
    setDirty(false);
    publishCurrentState();
    showToast(
      result.workspacePath
        ? `프로젝트가 저장되었습니다.\n${result.workspacePath}`
        : "프로젝트가 저장되었습니다.",
      "success",
    );
    return true;
  } catch (error) {
    console.error(error);
    showToast(".todo 워크스페이스 저장에 실패했습니다.", "error");
    return false;
  }
}

onTodoFileMenuCommand((command) => {
  if (command === "open-project") {
    void openProject();
    return;
  }

  if (command === "save-project") {
    void saveProject();
    return;
  }

  if (command === "save-project-as") {
    void saveProject({ saveAs: true });
  }
});

onTodoFileSaveRequest(async (_requestId, saveAs) => saveProject({ saveAs }));

onOpenTodoWorkspacePathRequest((workspacePath) => {
  void openProjectByPath(workspacePath);
});

onTodoAppStateChange((state) => {
  applySyncedState(state);
});

onTodoDirtyChange((value) => {
  isDirty = value;
});

if (!workspaceWindowKey) {
  onWorkspaceWindowsChange((windowKeys) => {
    setOpenedWorkspaceWindowKeys(windowKeys);
  });
}

if (!workspaceWindowKey && isTodoFileClientAvailable()) {
  void listWorkspaceWindows().then(setOpenedWorkspaceWindowKeys).catch((error) => {
    console.error(error);
  });
}

addProjectButton.addEventListener("click", () => {
  const project: Project = {
    id: createId(),
    name: createUniqueProjectName(),
    clientName: "",
    projectNumber: "",
    periodStart: null,
    periodEnd: null,
    periodText: "",
    periodStatus: "대기",
    periodStartMonth: null,
    periodEndMonth: null,
    color: getProjectColor(getState().projects.length),
    tasks: [],
    deletedTasks: [],
  };

  addProject(project);
  includeCalendarProject(project.id);
  showProjectView();
  render();
});

activeProjectNameButton.addEventListener("click", () => {
  showProjectNameEditMode(true);
});

cancelProjectNameButton.addEventListener("click", () => {
  showProjectNameEditMode(false);
  render();
});

projectNameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = projectNameInput.value.trim();
  if (!name) {
    return;
  }

  updateActiveProject({ name });
  showProjectNameEditMode(false);
  render();
});

editProjectInfoButton.addEventListener("click", () => {
  showProjectInfoEditMode(true);
});

cancelProjectInfoButton.addEventListener("click", () => {
  showProjectInfoEditMode(false);
  render();
});

projectInfoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateActiveProject({
    clientName: projectClientNameInput.value.trim(),
    projectNumber: projectNumberInput.value.trim(),
    periodText: "",
    periodStatus: projectPeriodStatusSelect.value === "연도월" ? "연도월" : "대기",
    periodStartMonth: projectPeriodStatusSelect.value === "연도월" ? projectPeriodStartMonthInput.value || null : null,
    periodEndMonth: projectPeriodStatusSelect.value === "연도월" ? projectPeriodEndMonthInput.value || null : null,
  });
  showProjectInfoEditMode(false);
  render();
});

deleteProjectButton.addEventListener("click", async () => {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  const confirmed = await confirmDelete(
    `"${activeProject.name}" 프로젝트를 삭제하시겠습니까?\n프로젝트에 속한 모든 업무와 주간 업무 기록이 함께 삭제됩니다.`,
  );
  if (!confirmed) {
    return;
  }

  deleteActiveProject();
  clearSelectedTask();
  render();
});

projectColorInput.addEventListener("input", () => {
  updateActiveProjectColor(projectColorInput.value);
  render();
});

ledgerViewButton.addEventListener("click", () => {
  showLedgerView();
  render();
});

ledgerWindowButton.addEventListener("click", () => {
  void openWorkspaceWindowKey("view:ledger");
});

weeklyViewButton.addEventListener("click", () => {
  showWeeklyView();
  render();
});

weeklyWindowButton.addEventListener("click", () => {
  void openWorkspaceWindowKey("view:weekly");
});

feedViewButton.addEventListener("click", () => {
  showFeedView();
  render();
});

feedWindowButton.addEventListener("click", () => {
  void openWorkspaceWindowKey("view:feed");
});

ledgerStatusFilter.addEventListener("change", () => {
  render();
});

ledgerClientFilter.addEventListener("change", () => {
  render();
});

ledgerHideCompletedInput.addEventListener("change", () => {
  render();
});

ledgerOverdueOnlyInput.addEventListener("change", () => {
  render();
});

ledgerExportButton.addEventListener("click", async () => {
  const [{ createProjectLedgerWorkbook }, { downloadWorkbook }] = await Promise.all([
    import("./excel/projectLedgerReport"),
    import("./excel/downloadWorkbook"),
  ]);
  const workbook = createProjectLedgerWorkbook(getState());
  const exportDate = toDateKey(new Date()).slice(5).replace("-", "");
  await downloadWorkbook(workbook, `진행 업무_DTS_${exportDate}.xlsx`);
});

calendarViewButton.addEventListener("click", () => {
  activateCalendarButton();
  render();
});

calendarWindowButton.addEventListener("click", () => {
  void openWorkspaceWindowKey("view:calendar");
});

calendarStartMonthSelect.addEventListener("change", () => {
  updateCalendarRangePreferences({
    startMonth: Number(calendarStartMonthSelect.value),
  });
  render();
});

calendarEndMonthSelect.addEventListener("change", () => {
  updateCalendarRangePreferences({
    endMonth: Number(calendarEndMonthSelect.value),
  });
  render();
});

calendarColumnSelect.addEventListener("change", () => {
  updateCalendarRangePreferences({
    columns: Number(calendarColumnSelect.value),
  });
  render();
});

previousWeekButton.addEventListener("click", () => {
  goToPreviousWeek();
  render();
});

nextWeekButton.addEventListener("click", () => {
  goToNextWeek();
  render();
});

weeklyExportButton.addEventListener("click", async () => {
  const [{ createWeeklyReportWorkbook, getWeeklyReportFileName }, { downloadWorkbook }] = await Promise.all([
    import("./excel/weeklyReport"),
    import("./excel/downloadWorkbook"),
  ]);
  const visibleWeekDate = getVisibleWeekDate();
  const workbook = await createWeeklyReportWorkbook(getState(), visibleWeekDate);
  await downloadWorkbook(workbook, getWeeklyReportFileName(visibleWeekDate));
});

toggleAllProjectsButton.addEventListener("click", () => {
  toggleAllCalendarProjects();
  render();
});

async function initializeWorkspaceWindow(): Promise<void> {
  document.body.classList.add("child-window-mode");
  uiState.workspaceWindowKey = workspaceWindowKey;

  if (isTodoFileClientAvailable()) {
    try {
      const latestState = await getLatestTodoAppState();
      if (latestState) {
        applySyncedState(latestState);
      } else {
        const result = await openDefaultTodoWorkspace();
        if (result.found) {
          applySyncedState(result.state);
          updateTodoWorkspacePath(result.workspacePath);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  clearSelectedTask();
  resetCalendarSelection();
  resetFeedSelection();
  render();
}

async function initializeMainWindow(): Promise<void> {
  render();
  setStateChangeListener(markDirty);

  if (isTodoFileClientAvailable()) {
    try {
      const startupWorkspacePath = await getStartupTodoWorkspacePath();
      if (startupWorkspacePath) {
        const opened = await openProjectByPath(startupWorkspacePath);
        if (opened) {
          return;
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  void showStartupChooser();
}

setNavigationRenderer(render);

// Mouse back/forward buttons drive the per-window navigation history. Chromium reports
// the back button as event.button === 3 and the forward button as event.button === 4.
function handleNavigationMouseDown(event: MouseEvent): void {
  if (event.button === 3 || event.button === 4) {
    // Prevent the default browser back/forward navigation; we handle it ourselves.
    event.preventDefault();
  }
}

function handleNavigationMouseUp(event: MouseEvent): void {
  if (event.button === 3) {
    event.preventDefault();
    navigateBack();
  } else if (event.button === 4) {
    event.preventDefault();
    navigateForward();
  }
}

// Alt+Left / Alt+Right mirror the mouse buttons.
function handleNavigationKeyDown(event: KeyboardEvent): void {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    navigateBack();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    navigateForward();
  }
}

window.addEventListener("mousedown", handleNavigationMouseDown);
window.addEventListener("mouseup", handleNavigationMouseUp);
window.addEventListener("keydown", handleNavigationKeyDown);

if (workspaceWindowKey) {
  setStateChangeListener(markDirty);
  void initializeWorkspaceWindow();
} else {
  // The AI control bridge forwards actions to the main window only.
  registerAiActionHandler();
  void initializeMainWindow();
}
