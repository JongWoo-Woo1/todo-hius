import "./styles.css";

import {
  isTodoFileClientAvailable,
  onTodoFileMenuCommand,
  onTodoFileSaveRequest,
  openDefaultTodoWorkspace,
  openTodoWorkspace,
  saveTodoWorkspace,
  saveTodoWorkspaceAs,
  setTodoFileDirty,
} from "./platform/todoFileClient";
import {
  addProject,
  addTodo,
  deleteActiveProject,
  getActiveProject,
  getState,
  replaceState,
  setStateChangeListener,
  updateActiveProject,
  updateActiveProjectColor,
} from "./state/store";
import type { Project, Todo } from "./types";
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
  todoDueDateInput,
  todoForm,
  todoTitleInput,
  toggleAllProjectsButton,
  nextWeekButton,
  previousWeekButton,
  weeklyExportButton,
  weeklyViewButton,
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
import { confirmDelete } from "./ui/confirmDialog";

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

async function openDefaultProject(): Promise<void> {
  if (!isTodoFileClientAvailable()) {
    return;
  }

  try {
    const result = await openDefaultTodoWorkspace();
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
    return true;
  } catch (error) {
    console.error(error);
    window.alert("Failed to save the .todo workspace.");
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
    color: getProjectColor(getState().projects.length),
    todos: [],
  };

  addProject(project);
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

toggleAllProjectsButton.addEventListener("click", () => {
  toggleAllCalendarProjects();
  render();
});

render();

void openDefaultProject().finally(() => {
  setStateChangeListener(markDirty);
});
