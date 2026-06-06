import { formatDisplayDate } from "./calendar";

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) {
    return "No due date";
  }

  return formatDisplayDate(dueDate);
}
