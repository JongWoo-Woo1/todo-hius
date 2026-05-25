import type { Project } from "../types";

export function formatProjectPeriod(project: Pick<Project, "periodText" | "periodStart" | "periodEnd">): string {
  if (project.periodText) {
    return project.periodText;
  }

  if (project.periodStart || project.periodEnd) {
    return `${project.periodStart ?? ""} ~ ${project.periodEnd ?? ""}`;
  }

  return "";
}
