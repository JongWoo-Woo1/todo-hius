import "./styles.css";

import {
  addProject,
  addTodo,
  addWorkLog,
  deleteActiveProject,
  exportStateJson,
  getActiveProject,
  getState,
  importStateFromJson,
  replaceState,
  resetStateToSampleData,
  setStateChangeListener,
  updateActiveProject,
  updateActiveProjectColor,
} from "./state/store";
import type { Project, Todo, WorkLogType } from "./types";
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
  cancelProjectInfoButton,
  cancelProjectNameButton,
  deleteProjectButton,
  editProjectInfoButton,
  exportJsonButton,
  importJsonButton,
  importJsonFileInput,
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
  projectPeriodEndInput,
  projectPeriodStartInput,
  projectPeriodTextInput,
  resetSampleDataButton,
  todoDueDateInput,
  todoForm,
  todoTitleInput,
  toggleAllProjectsButton,
  nextWeekButton,
  previousWeekButton,
  weeklyExportButton,
  weeklyViewButton,
  workLogContentInput,
  workLogDateInput,
  workLogForm,
  workLogProjectSelect,
  workLogTodoSelect,
  workLogTypeSelect,
} from "./ui/dom";
import {
  activateCalendarButton,
  clearSelectedTodo,
  goToNextWeek,
  goToPreviousWeek,
  getVisibleWeekDate,
  render,
  resetCalendarSelection,
  showLedgerView,
  showProjectInfoEditMode,
  showProjectNameEditMode,
  showProjectView,
  showWeeklyView,
  toggleAllCalendarProjects,
  updateCalendarRangePreferences,
} from "./ui/render";

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
  window.hiusTodoFile?.setDirty(value);
}

function markDirty(): void {
  setDirty(true);
}

async function openDefaultProject(): Promise<void> {
  if (!window.hiusTodoFile) {
    return;
  }

  try {
    const result = await window.hiusTodoFile.openDefaultWorkspace();
    if (!result.found) {
      updateTodoWorkspacePath(result.workspacePath);
      setDirty(false);
      return;
    }

    const imported = replaceState(result.state);
    if (!imported) {
      window.alert("Failed to load the default HIUS Todo project.");
      return;
    }

    updateTodoWorkspacePath(result.workspacePath);
    setDirty(false);
    clearSelectedTodo();
    resetCalendarSelection();
    render();
  } catch (error) {
    console.error(error);
    window.alert("Failed to load the default HIUS Todo project.");
  }
}

function downloadTextFile(content: string, fileName: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function openProject(): Promise<boolean> {
  if (!window.hiusTodoFile) {
    return false;
  }

  try {
    const result = await window.hiusTodoFile.openWorkspace();
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
    clearSelectedTodo();
    resetCalendarSelection();
    render();
    return true;
  } catch (error) {
    console.error(error);
    window.alert("Failed to open the selected .todo workspace.");
    return false;
  }
}

async function saveProject({ saveAs = false }: { saveAs?: boolean } = {}): Promise<boolean> {
  if (!window.hiusTodoFile) {
    return false;
  }

  try {
    const result = saveAs
      ? await window.hiusTodoFile.saveWorkspaceAs(getState())
      : await window.hiusTodoFile.saveWorkspace(getState(), currentTodoWorkspacePath);
    if (result.canceled) {
      return false;
    }

    updateTodoWorkspacePath(result.workspacePath);
    setDirty(false);
    return true;
  } catch (error) {
    console.error(error);
    window.alert("Failed to save the .todo workspace.");
    return false;
  }
}

window.hiusTodoFile?.onMenuCommand((command) => {
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

window.hiusTodoFile?.onSaveRequest(async (_requestId, saveAs) => saveProject({ saveAs }));

addProjectButton.addEventListener("click", () => {
  const project: Project = {
    id: createId(),
    name: createUniqueProjectName(),
    clientName: "",
    projectNumber: "",
    periodStart: null,
    periodEnd: null,
    periodText: "",
    color: getProjectColor(getState().projects.length),
    todos: [],
  };

  addProject(project);
  showProjectView();
  render();
});

exportJsonButton.addEventListener("click", () => {
  downloadTextFile(exportStateJson(), `project-todo-backup-${toDateKey(new Date())}.json`, "application/json");
});

importJsonButton.addEventListener("click", () => {
  importJsonFileInput.click();
});

importJsonFileInput.addEventListener("change", async () => {
  const file = importJsonFileInput.files?.[0];
  if (!file) {
    return;
  }

  const shouldImport = window.confirm("Importing this JSON file will overwrite the current local data. Continue?");
  if (!shouldImport) {
    importJsonFileInput.value = "";
    return;
  }

  const json = await file.text();
  const imported = importStateFromJson(json);
  importJsonFileInput.value = "";

  if (!imported) {
    window.alert("Invalid backup file. Please select a JSON file exported from this app.");
    return;
  }

  clearSelectedTodo();
  resetCalendarSelection();
  render();
});

resetSampleDataButton.addEventListener("click", () => {
  const shouldReset = window.confirm(
    "현재 작업 중인 데이터를 sampleProjects 데이터로 교체합니다. 필요한 경우 먼저 Save Project 또는 Export JSON으로 백업하세요. 계속할까요?",
  );
  if (!shouldReset) {
    return;
  }

  resetStateToSampleData();
  clearSelectedTodo();
  resetCalendarSelection();
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
    periodText: projectPeriodTextInput.value.trim(),
    periodStart: projectPeriodStartInput.value || null,
    periodEnd: projectPeriodEndInput.value || null,
  });
  showProjectInfoEditMode(false);
  render();
});

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const activeProject = getActiveProject();
  const title = todoTitleInput.value.trim();
  if (!activeProject || !title) {
    return;
  }

  const todo: Todo = {
    id: createId(),
    title,
    dueDate: todoDueDateInput.value || null,
    estimate: "",
    status: "대기",
    progress: 0,
    workerComment: "",
    managerComment: "",
    issueRisk: "",
    priority: "보통",
    memo: "",
    completed: false,
  };

  addTodo(todo);
  todoForm.reset();
  render();
});

deleteProjectButton.addEventListener("click", () => {
  deleteActiveProject();
  clearSelectedTodo();
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
  await downloadWorkbook(workbook, `project-ledger-${toDateKey(new Date())}.xlsx`);
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
  const [{ createWeeklyReportWorkbook, getWeeklyReportFileDate }, { downloadWorkbook }] = await Promise.all([
    import("./excel/weeklyReport"),
    import("./excel/downloadWorkbook"),
  ]);
  const visibleWeekDate = getVisibleWeekDate();
  const workbook = await createWeeklyReportWorkbook(getState(), visibleWeekDate);
  await downloadWorkbook(workbook, `weekly-report-${getWeeklyReportFileDate(visibleWeekDate)}.xlsx`);
});

workLogProjectSelect.addEventListener("change", () => {
  render();
});

workLogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = workLogContentInput.value.trim();
  const projectId = workLogProjectSelect.value;

  if (!content || !projectId) {
    return;
  }

  addWorkLog({
    id: createId(),
    projectId,
    todoId: workLogTodoSelect.value || undefined,
    date: workLogDateInput.value,
    type: workLogTypeSelect.value as WorkLogType,
    content,
  });

  workLogContentInput.value = "";
  workLogTodoSelect.value = "";
  render();
});

toggleAllProjectsButton.addEventListener("click", () => {
  toggleAllCalendarProjects();
  render();
});

render();

void openDefaultProject().finally(() => {
  setStateChangeListener(markDirty);
});
