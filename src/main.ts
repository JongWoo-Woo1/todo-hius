import "./styles.css";

import {
  isTodoFileClientAvailable,
  listRecentTodoWorkspaces,
  onTodoFileMenuCommand,
  onTodoFileSaveRequest,
  openTodoWorkspace,
  openTodoWorkspacePath,
  removeRecentTodoWorkspace,
  saveTodoWorkspace,
  saveTodoWorkspaceAs,
  setTodoFileDirty,
} from "./platform/todoFileClient";
import {
  addProject,
  deleteActiveProject,
  getActiveProject,
  getState,
  replaceState,
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
  feedViewButton,
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
} from "./ui/dom";
import {
  activateCalendarButton,
  clearSelectedTask,
  goToNextWeek,
  goToPreviousWeek,
  getVisibleWeekDate,
  includeCalendarProject,
  render,
  resetCalendarSelection,
  resetFeedSelection,
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

function markDirty(): void {
  setDirty(true);
}

function startNewProject(): void {
  replaceState({ projects: [], activeProjectId: null, workLogs: [] });
  updateTodoWorkspacePath(undefined);
  setDirty(false);
  clearSelectedTask();
  resetCalendarSelection();
  resetFeedSelection();
  render();
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
    clearSelectedTask();
    resetCalendarSelection();
    resetFeedSelection();
    render();
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
    clearSelectedTask();
    resetCalendarSelection();
    resetFeedSelection();
    render();
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

weeklyViewButton.addEventListener("click", () => {
  showWeeklyView();
  render();
});

feedViewButton.addEventListener("click", () => {
  showFeedView();
  render();
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

render();

setStateChangeListener(markDirty);
void showStartupChooser();
