import type { Project } from "../types";
import { formatDisplayDate } from "./calendar";

function formatYearMonth(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const [year, month] = value.split("-");
  if (!year || !month) {
    return value;
  }

  return `${year.slice(-2)}.${month.padStart(2, "0")}`;
}

export function formatProjectPeriod(
  project: Pick<
    Project,
    "periodText" | "periodStart" | "periodEnd" | "periodStatus" | "periodStartMonth" | "periodEndMonth"
  >,
): string {
  if (project.periodStatus === "대기") {
    return "대기";
  }

  if (project.periodStatus === "연도월") {
    const start = formatYearMonth(project.periodStartMonth);
    const end = formatYearMonth(project.periodEndMonth);
    if (start || end) {
      return `${start} ~ ${end}`.trim();
    }
    return "";
  }

  if (project.periodText) {
    return project.periodText;
  }

  if (project.periodStart || project.periodEnd) {
    return `${formatDisplayDate(project.periodStart)} ~ ${formatDisplayDate(project.periodEnd)}`;
  }

  return "";
}
