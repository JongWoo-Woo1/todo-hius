import type { AppState, Project, Task, WorkLog } from "../types";

export type TaskWithProject = {
  project: Project;
  task: Task;
};

export type LinkedTaskDisplay = {
  label: string;
  activeTask?: Task;
  deletedTask?: Task;
};

export function getProjectById(state: AppState, projectId: string): Project | undefined {
  return state.projects.find((project) => project.id === projectId);
}

export function getTaskByProject(project: Project | undefined, taskId: string | undefined): Task | undefined {
  if (!project || !taskId) {
    return undefined;
  }

  return project.tasks.find((task) => task.id === taskId);
}

export function getDeletedTaskByProject(project: Project | undefined, taskId: string | undefined): Task | undefined {
  if (!project || !taskId) {
    return undefined;
  }

  return project.deletedTasks.find((task) => task.id === taskId);
}

export function getLinkedTaskDisplay(project: Project | undefined, workLog: WorkLog): LinkedTaskDisplay {
  const activeTask = getTaskByProject(project, workLog.taskId);
  if (activeTask) {
    return { label: activeTask.title, activeTask };
  }

  const deletedTask = getDeletedTaskByProject(project, workLog.taskId);
  if (deletedTask) {
    return { label: deletedTask.title, deletedTask };
  }

  if (workLog.linkedTaskTitleSnapshot && workLog.linkedTaskDeleted) {
    return { label: `${workLog.linkedTaskTitleSnapshot} (삭제됨)` };
  }

  return { label: "Linked Task 없음" };
}

export function getSortedTasksByDueDate(project: Project | undefined): Task[] {
  if (!project) {
    return [];
  }

  return [...project.tasks].sort((left, right) => {
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

export function getTaskWorkLogs(state: AppState, taskId: string): WorkLog[] {
  return state.workLogs
    .filter((workLog) => workLog.taskId === taskId)
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function findTaskWithProject(state: AppState, taskId: string | null): TaskWithProject | null {
  if (!taskId) {
    return null;
  }

  for (const project of state.projects) {
    const task = project.tasks.find((item) => item.id === taskId);
    if (task) {
      return { project, task };
    }
  }

  return null;
}
