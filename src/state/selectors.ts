import type { AppState, Project, Todo, WorkLog } from "../types";

export type TodoWithProject = {
  project: Project;
  todo: Todo;
};

export function getProjectById(state: AppState, projectId: string): Project | undefined {
  return state.projects.find((project) => project.id === projectId);
}

export function getTodoByProject(project: Project | undefined, todoId: string | undefined): Todo | undefined {
  if (!project || !todoId) {
    return undefined;
  }

  return project.todos.find((todo) => todo.id === todoId);
}

export function getSortedTodosByDueDate(project: Project | undefined): Todo[] {
  if (!project) {
    return [];
  }

  return [...project.todos].sort((left, right) => {
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

export function getWorkLogById(state: AppState, workLogId: string | null): WorkLog | undefined {
  if (!workLogId) {
    return undefined;
  }

  return state.workLogs.find((workLog) => workLog.id === workLogId);
}

export function getProjectWorkLogs(state: AppState, projectId: string): WorkLog[] {
  return state.workLogs
    .filter((workLog) => workLog.projectId === projectId)
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function getTodoWorkLogs(state: AppState, todoId: string): WorkLog[] {
  return state.workLogs
    .filter((workLog) => workLog.todoId === todoId)
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function findTodoWithProject(state: AppState, todoId: string | null): TodoWithProject | null {
  if (!todoId) {
    return null;
  }

  for (const project of state.projects) {
    const todo = project.todos.find((item) => item.id === todoId);
    if (todo) {
      return { project, todo };
    }
  }

  return null;
}
