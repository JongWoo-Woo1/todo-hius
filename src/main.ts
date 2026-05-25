import "./styles.css";

import {
  addProject,
  addTodo,
  deleteActiveProject,
  getActiveProject,
  getState,
  updateActiveProject,
  updateActiveProjectColor,
  updateTodo,
} from "./state/store";
import type { Project, TaskPriority, TaskStatus, Todo } from "./types";
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
} from "./ui/dom";
import {
  activateCalendarButton,
  clearSelectedTodo,
  getSelectedTodoId,
  goToNextMonth,
  goToPreviousMonth,
  render,
  showLedgerView,
  showProjectView,
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

ledgerStatusFilter.addEventListener("change", () => {
  render();
});

ledgerClientFilter.addEventListener("change", () => {
  render();
});

ledgerHideCompletedInput.addEventListener("change", () => {
  render();
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

toggleAllProjectsButton.addEventListener("click", () => {
  toggleAllCalendarProjects();
  render();
});

render();
