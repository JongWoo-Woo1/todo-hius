import { STORAGE_KEY } from "../constants";
import { createSampleState } from "../data/sampleProjects";
import type { AppState, Project, Todo } from "../types";
import { getProjectColor } from "../utils/projectColor";

let state = loadState();

function loadState(): AppState {
  const rawState = localStorage.getItem(STORAGE_KEY);
  if (!rawState) {
    return createSampleState();
  }

  try {
    const parsedState = JSON.parse(rawState) as AppState;

    return {
      ...parsedState,
      projects: parsedState.projects.map((project, index) => ({
        ...project,
        color: project.color ?? getProjectColor(index),
        todos: project.todos.map((todo) => ({
          ...todo,
          memo: todo.memo ?? "",
        })),
      })),
    };
  } catch {
    return { projects: [], activeProjectId: null };
  }
}

function saveState(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getState(): AppState {
  return state;
}

export function getActiveProject(): Project | undefined {
  return state.projects.find((project) => project.id === state.activeProjectId);
}

export function addProject(project: Project): void {
  state.projects.push(project);
  state.activeProjectId = project.id;
  saveState();
}

export function updateActiveProjectColor(color: string): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  activeProject.color = color;
  saveState();
}

export function selectProject(projectId: string): void {
  state.activeProjectId = projectId;
  saveState();
}

export function reorderProjects(sourceProjectId: string, targetProjectId: string): void {
  if (sourceProjectId === targetProjectId) {
    return;
  }

  const sourceIndex = state.projects.findIndex((project) => project.id === sourceProjectId);
  const targetIndex = state.projects.findIndex((project) => project.id === targetProjectId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const [sourceProject] = state.projects.splice(sourceIndex, 1);
  state.projects.splice(targetIndex, 0, sourceProject);
  saveState();
}

export function deleteActiveProject(): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  state.projects = state.projects.filter((project) => project.id !== activeProject.id);
  state.activeProjectId = state.projects[0]?.id ?? null;
  saveState();
}

export function addTodo(todo: Todo): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  activeProject.todos.push(todo);
  saveState();
}

export function updateTodo(todoId: string, updates: Pick<Todo, "dueDate" | "memo">): void {
  const todo = getActiveProject()?.todos.find((item) => item.id === todoId);
  if (!todo) {
    return;
  }

  todo.dueDate = updates.dueDate;
  todo.memo = updates.memo;
  saveState();
}

export function toggleTodo(todoId: string, completed: boolean): void {
  const todo = getActiveProject()?.todos.find((item) => item.id === todoId);
  if (!todo) {
    return;
  }

  todo.completed = completed;
  saveState();
}

export function deleteTodo(todoId: string): void {
  const activeProject = getActiveProject();
  if (!activeProject) {
    return;
  }

  activeProject.todos = activeProject.todos.filter((todo) => todo.id !== todoId);
  saveState();
}
