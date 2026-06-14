import type { AppState, Project, Task } from "../types";
import { formatProjectPeriod } from "./project";

type LedgerBaseRow = {
  project: Project;
  clientName: string;
  projectNumber: string;
  projectName: string;
  projectPeriod: string;
};

export type LedgerTaskRow = LedgerBaseRow & {
  kind: "task";
  task: Task;
};

export type LedgerProjectEmptyRow = LedgerBaseRow & {
  kind: "project-empty";
};

export type LedgerRow = LedgerTaskRow | LedgerProjectEmptyRow;

function compareTasksForLedger(left: Task, right: Task): number {
  if (left.completed !== right.completed) {
    return left.completed ? 1 : -1;
  }

  const leftIsTopPriority = left.priority === "최우선";
  const rightIsTopPriority = right.priority === "최우선";
  if (leftIsTopPriority !== rightIsTopPriority) {
    return leftIsTopPriority ? -1 : 1;
  }

  if (left.dueDate && right.dueDate) {
    const dueDateCompare = left.dueDate.localeCompare(right.dueDate);
    if (dueDateCompare !== 0) {
      return dueDateCompare;
    }
  } else if (left.dueDate) {
    return -1;
  } else if (right.dueDate) {
    return 1;
  }

  return left.title.localeCompare(right.title, "ko");
}

export function getLedgerRows(state: AppState): LedgerRow[] {
  return state.projects
    .filter((project) => !project.hideFromLedger)
    .flatMap((project): LedgerRow[] => {
      const baseRow = {
        project,
        clientName: project.clientName,
        projectNumber: project.projectNumber ?? "",
        projectName: project.name,
        projectPeriod: formatProjectPeriod(project),
      };

      if (project.tasks.length === 0) {
        return [{ ...baseRow, kind: "project-empty" }];
      }

      return project.tasks.map((task) => ({
        ...baseRow,
        kind: "task",
        task,
      }));
    })
    .sort((left, right) => {
      const clientCompare = right.clientName.localeCompare(left.clientName, "ko");
      if (clientCompare !== 0) {
        return clientCompare;
      }

      const projectCompare = left.projectName.localeCompare(right.projectName, "ko");
      if (projectCompare !== 0) {
        return projectCompare;
      }

      if (left.kind === "project-empty" && right.kind === "project-empty") {
        return 0;
      }

      if (left.kind === "project-empty") {
        return 1;
      }

      if (right.kind === "project-empty") {
        return -1;
      }

      return compareTasksForLedger(left.task, right.task);
    });
}
