import type { AppState, Project, Todo } from "../types";
import { formatProjectPeriod } from "./project";

export type LedgerRow = {
  project: Project;
  todo: Todo;
  clientName: string;
  projectNumber: string;
  projectName: string;
  projectPeriod: string;
};

export function getLedgerRows(state: AppState): LedgerRow[] {
  return state.projects
    .flatMap((project) =>
      project.todos.map((todo) => ({
        project,
        todo,
        clientName: project.clientName,
        projectNumber: project.projectNumber ?? "",
        projectName: project.name,
        projectPeriod: formatProjectPeriod(project),
      })),
    )
    .sort((left, right) => {
      const clientCompare = right.clientName.localeCompare(left.clientName, "ko");
      if (clientCompare !== 0) {
        return clientCompare;
      }

      const projectCompare = left.projectName.localeCompare(right.projectName, "ko");
      if (projectCompare !== 0) {
        return projectCompare;
      }

      return (left.todo.dueDate ?? "").localeCompare(right.todo.dueDate ?? "");
    });
}
