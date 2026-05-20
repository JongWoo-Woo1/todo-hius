import { deleteTodo, getActiveProject, getState, reorderProjects, selectProject, toggleTodo } from "../state/store";
import { getMonthGridDates, getMonthLabel, toDateKey } from "../utils/calendar";
import { formatDueDate } from "../utils/date";
import {
  activeProjectName,
  calendarGrid,
  calendarFilterList,
  calendarMonthLabel,
  calendarViewButton,
  deleteProjectButton,
  emptyState,
  projectList,
  projectColorInput,
  projectWorkspace,
  todoCount,
  todoDetailDueDateInput,
  todoDetailMemoInput,
  todoDetailPanel,
  todoDetailTitle,
  todoForm,
  todoList,
  calendarWorkspace,
  toggleAllProjectsButton,
} from "./dom";

let selectedTodoId: string | null = null;
let currentView: "projects" | "calendar" = "projects";
let visibleMonth = new Date();
let selectedCalendarProjectIds: Set<string> | null = null;
let draggedProjectId: string | null = null;

function ensureCalendarSelection(): void {
  const projectIds = getState().projects.map((project) => project.id);
  if (!selectedCalendarProjectIds) {
    selectedCalendarProjectIds = new Set(projectIds);
    return;
  }

  const existingSelection = selectedCalendarProjectIds;
  selectedCalendarProjectIds = new Set(projectIds.filter((projectId) => existingSelection.has(projectId)));
}

function sortTodosByDueDate(): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  activeProject.todos.sort((left, right) => {
    if (!left.dueDate && !right.dueDate) {
      return left.title.localeCompare(right.title);
    }

    if (!left.dueDate) {
      return 1;
    }

    if (!right.dueDate) {
      return -1;
    }

    return left.dueDate.localeCompare(right.dueDate);
  });
}

function renderProjects(): void {
  projectList.innerHTML = "";

  getState().projects.forEach((project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-button";
    button.draggable = true;
    button.dataset.projectId = project.id;
    button.classList.toggle("active", currentView === "projects" && project.id === getState().activeProjectId);
    button.innerHTML = `
      <span class="project-name">
        <span class="project-swatch" style="--project-color: ${project.color}"></span>
        ${project.name}
      </span>
      <span>${project.todos.length}</span>
    `;
    button.addEventListener("click", () => {
      selectProject(project.id);
      currentView = "projects";
      render();
    });
    button.addEventListener("dragstart", (event) => {
      draggedProjectId = project.id;
      button.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", project.id);
      event.dataTransfer?.setDragImage(button, 12, 20);
    });
    button.addEventListener("dragend", () => {
      draggedProjectId = null;
      button.classList.remove("dragging");
    });
    button.addEventListener("dragover", (event) => {
      if (!draggedProjectId || draggedProjectId === project.id) {
        return;
      }

      event.preventDefault();
      button.classList.add("drag-over");
    });
    button.addEventListener("dragleave", () => {
      button.classList.remove("drag-over");
    });
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("drag-over");
      const sourceProjectId = draggedProjectId ?? event.dataTransfer?.getData("text/plain");
      if (!sourceProjectId) {
        return;
      }

      reorderProjects(sourceProjectId, project.id);
      draggedProjectId = null;
      render();
    });
    projectList.append(button);
  });
}

function renderCalendar(): void {
  ensureCalendarSelection();
  const selectedProjectIds = selectedCalendarProjectIds ?? new Set<string>();
  const dueTodosByDate = new Map<
    string,
    Array<{ projectName: string; title: string; completed: boolean; color: string }>
  >();

  getState().projects.forEach((project) => {
    if (!selectedProjectIds.has(project.id)) {
      return;
    }

    project.todos.forEach((todo) => {
      if (!todo.dueDate) {
        return;
      }

      const items = dueTodosByDate.get(todo.dueDate) ?? [];
      items.push({
        projectName: project.name,
        title: todo.title,
        completed: todo.completed,
        color: project.color,
      });
      dueTodosByDate.set(todo.dueDate, items);
    });
  });

  calendarMonthLabel.textContent = getMonthLabel(visibleMonth);
  calendarGrid.innerHTML = "";

  getMonthGridDates(visibleMonth).forEach((date) => {
    const dateKey = toDateKey(date);
    const cell = document.createElement("section");
    cell.className = "calendar-cell";
    cell.classList.toggle("outside-month", date.getMonth() !== visibleMonth.getMonth());

    const dateLabel = document.createElement("p");
    dateLabel.className = "calendar-date";
    dateLabel.textContent = String(date.getDate());
    cell.append(dateLabel);

    const todos = dueTodosByDate.get(dateKey) ?? [];
    todos.forEach((todo) => {
      const item = document.createElement("div");
      item.className = "calendar-item";
      item.classList.toggle("completed", todo.completed);
      item.style.setProperty("--project-color", todo.color);
      item.innerHTML = `
        <strong>${todo.title}</strong>
        <span>${todo.projectName}</span>
      `;
      cell.append(item);
    });

    calendarGrid.append(cell);
  });
}

function renderCalendarFilters(): void {
  ensureCalendarSelection();
  const selectedProjectIds = selectedCalendarProjectIds ?? new Set<string>();
  calendarFilterList.innerHTML = "";

  getState().projects.forEach((project) => {
    const label = document.createElement("label");
    label.className = "calendar-filter-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedProjectIds.has(project.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedProjectIds.add(project.id);
      } else {
        selectedProjectIds.delete(project.id);
      }
      selectedCalendarProjectIds = selectedProjectIds;
      render();
    });

    const swatch = document.createElement("span");
    swatch.className = "project-swatch";
    swatch.style.setProperty("--project-color", project.color);

    const name = document.createElement("span");
    name.textContent = project.name;

    label.append(checkbox, swatch, name);
    calendarFilterList.append(label);
  });

  const allSelected =
    getState().projects.length > 0 && selectedProjectIds.size === getState().projects.length;
  toggleAllProjectsButton.textContent = allSelected ? "Clear all" : "Select all";
}

function renderTodos(): void {
  const activeProject = getActiveProject();
  todoList.innerHTML = "";

  if (!activeProject) {
    activeProjectName.textContent = "Add a project";
    todoCount.textContent = "0 items";
    emptyState.textContent = "Create a project first.";
    emptyState.hidden = false;
    todoForm.hidden = true;
    deleteProjectButton.hidden = true;
    selectedTodoId = null;
    renderTodoDetail();
    return;
  }

  sortTodosByDueDate();
  activeProjectName.textContent = activeProject.name;
  projectColorInput.value = activeProject.color;
  todoCount.textContent = `${activeProject.todos.length} items`;
  emptyState.textContent = "No tasks yet.";
  emptyState.hidden = activeProject.todos.length > 0;
  todoForm.hidden = false;
  deleteProjectButton.hidden = false;

  activeProject.todos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = "todo-item";
    item.classList.toggle("completed", todo.completed);
    item.classList.toggle("selected", todo.id === selectedTodoId);

    const checkbox = document.createElement("input");
    checkbox.className = "todo-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => {
      toggleTodo(todo.id, checkbox.checked);
      render();
    });
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const copy = document.createElement("div");
    copy.className = "todo-copy";
    copy.innerHTML = `
      <p class="todo-title">${todo.title}</p>
      <p class="todo-date">${formatDueDate(todo.dueDate)}</p>
    `;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-todo-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      deleteTodo(todo.id);
      if (selectedTodoId === todo.id) {
        selectedTodoId = null;
      }
      render();
    });
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    item.addEventListener("click", () => {
      selectedTodoId = todo.id;
      render();
    });

    item.append(checkbox, copy, deleteButton);
    todoList.append(item);
  });

  renderTodoDetail();
}

function renderTodoDetail(): void {
  const selectedTodo = getActiveProject()?.todos.find((todo) => todo.id === selectedTodoId);
  if (!selectedTodo) {
    todoDetailPanel.hidden = true;
    return;
  }

  todoDetailTitle.textContent = selectedTodo.title;
  todoDetailDueDateInput.value = selectedTodo.dueDate ?? "";
  todoDetailMemoInput.value = selectedTodo.memo;
  todoDetailPanel.hidden = false;
}

export function clearSelectedTodo(): void {
  selectedTodoId = null;
}

export function getSelectedTodoId(): string | null {
  return selectedTodoId;
}

export function showProjectView(): void {
  currentView = "projects";
}

export function showCalendarView(): void {
  currentView = "calendar";
}

export function goToPreviousMonth(): void {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
}

export function goToNextMonth(): void {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
}

export function toggleAllCalendarProjects(): void {
  const projectIds = getState().projects.map((project) => project.id);
  const selectedProjectIds = selectedCalendarProjectIds ?? new Set(projectIds);
  const allSelected = projectIds.length > 0 && selectedProjectIds.size === projectIds.length;
  selectedCalendarProjectIds = allSelected ? new Set() : new Set(projectIds);
}

export function render(): void {
  renderProjects();
  renderTodos();
  renderCalendarFilters();
  renderCalendar();
  projectWorkspace.hidden = currentView !== "projects";
  calendarWorkspace.hidden = currentView !== "calendar";
  calendarViewButton.classList.toggle("active", currentView === "calendar");
}
