import type { Project } from "../types";
import { formatDisplayDate } from "./calendar";

export function formatProjectPeriod(project: Pick<Project, "periodText" | "periodStart" | "periodEnd">): string {
  if (project.periodText) {
    return project.periodText;
  }

  if (project.periodStart || project.periodEnd) {
    return `${formatDisplayDate(project.periodStart)} ~ ${formatDisplayDate(project.periodEnd)}`;
  }

  return "";
}
