import {
  addProject,
  addTodo,
  deleteActiveProject,
  getActiveProject,
  getState,
  updateActiveProjectColor,
  updateTodo,
} from "./state/store";
import type { Project, Todo } from "./types";
import { createId } from "./utils/id";
import {
  addProjectButton,
  closeTodoDetailButton,
  calendarViewButton,
  deleteProjectButton,
  nextMonthButton,
  previousMonthButton,
  projectColorInput,
  todoDetailDueDateInput,
  todoDetailForm,
  todoDetailMemoInput,
  todoDueDateInput,
  todoForm,
  todoTitleInput,
  toggleAllProjectsButton,
} from "./ui/dom";
import {
  clearSelectedTodo,
  getSelectedTodoId,
  goToNextMonth,
  goToPreviousMonth,
  render,
  showCalendarView,
  showProjectView,
  toggleAllCalendarProjects,
} from "./ui/render";
import { getProjectColor } from "./utils/projectColor";

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

addProjectButton.addEventListener("click", () => {
  const project: Project = {
    id: createId(),
    name: createUniqueProjectName(),
    color: getProjectColor(getState().projects.length),
    todos: [],
  };

  addProject(project);
  showProjectView();
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

  updateTodo(selectedTodoId, {
    dueDate: todoDetailDueDateInput.value || null,
    memo: todoDetailMemoInput.value.trim(),
  });
  render();
});

closeTodoDetailButton.addEventListener("click", () => {
  clearSelectedTodo();
  render();
});

calendarViewButton.addEventListener("click", () => {
  showCalendarView();
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
