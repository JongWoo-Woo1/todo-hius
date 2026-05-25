import "./styles.css";

import {
  addProject,
  addTodo,
  addWorkLog,
  deleteActiveProject,
  getActiveProject,
  getState,
  updateActiveProject,
  updateActiveProjectColor,
  updateTodo,
} from "./state/store";
import type { Project, TaskPriority, TaskStatus, Todo, WorkLogType } from "./types";
import { toDateKey } from "./utils/calendar";
import { createId } from "./utils/id";
import { getProjectColor } from "./utils/projectColor";
import {
  addProjectButton,
  calendarColumnSelect,
  calendarEndMonthSelect,
  calendarStartMonthSelect,
  calendarViewButton,
  closeTodoDetailButton,
  deleteProjectButton,
  ledgerClientFilter,
  ledgerExportButton,
  ledgerHideCompletedInput,
  ledgerStatusFilter,
  ledgerViewButton,
  nextMonthButton,
  previousMonthButton,
  projectClientNameInput,
  projectColorInput,
  projectInfoForm,
  projectNumberInput,
  projectPeriodEndInput,
  projectPeriodStartInput,
  projectPeriodTextInput,
  todoDetailDueDateInput,
  todoDetailEstimateInput,
  todoDetailForm,
  todoDetailIssueRiskInput,
  todoDetailManagerCommentInput,
  todoDetailMemoInput,
  todoDetailPrioritySelect,
  todoDetailProgressInput,
  todoDetailStatusSelect,
  todoDetailTaskTitleInput,
  todoDetailWorkerCommentInput,
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
  getSelectedTodoId,
  goToNextMonth,
  goToNextWeek,
  goToPreviousMonth,
  goToPreviousWeek,
  getVisibleWeekDate,
  render,
  showLedgerView,
  showProjectView,
  showWeeklyView,
  toggleAllCalendarProjects,
  updateCalendarRangePreferences,
} from "./ui/render";

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

function getProgressFromPercentInput(): number {
  const progressPercent = Number(todoDetailProgressInput.value);
  if (Number.isNaN(progressPercent)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progressPercent / 100));
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
    color: getProjectColor(getState().projects.length),
    todos: [],
  };

  addProject(project);
  showProjectView();
  render();
});

projectInfoForm.addEventListener("change", () => {
  updateActiveProject({
    clientName: projectClientNameInput.value.trim(),
    projectNumber: projectNumberInput.value.trim(),
    periodText: projectPeriodTextInput.value.trim(),
    periodStart: projectPeriodStartInput.value || null,
    periodEnd: projectPeriodEndInput.value || null,
  });
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

todoDetailForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedTodoId = getSelectedTodoId();
  if (!selectedTodoId) {
    return;
  }

  const progress = getProgressFromPercentInput();
  const selectedStatus = todoDetailStatusSelect.value as TaskStatus;
  const status: TaskStatus = progress >= 1 ? "완료" : selectedStatus;

  updateTodo(selectedTodoId, {
    title: todoDetailTaskTitleInput.value.trim(),
    dueDate: todoDetailDueDateInput.value || null,
    estimate: todoDetailEstimateInput.value.trim(),
    status,
    progress,
    completed: status === "완료",
    priority: todoDetailPrioritySelect.value as TaskPriority,
    workerComment: todoDetailWorkerCommentInput.value.trim(),
    managerComment: todoDetailManagerCommentInput.value.trim(),
    issueRisk: todoDetailIssueRiskInput.value.trim(),
    memo: todoDetailMemoInput.value.trim(),
  });
  render();
});

closeTodoDetailButton.addEventListener("click", () => {
  clearSelectedTodo();
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

previousMonthButton.addEventListener("click", () => {
  goToPreviousMonth();
  render();
});

nextMonthButton.addEventListener("click", () => {
  goToNextMonth();
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
  const workbook = createWeeklyReportWorkbook(getState(), visibleWeekDate);
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
