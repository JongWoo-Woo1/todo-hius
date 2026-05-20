export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${dueDate}T00:00:00`));
}
