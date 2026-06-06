export function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getMonthGridDates(date: Date): Date[] {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const gridDate = new Date(gridStart);
    gridDate.setDate(gridStart.getDate() + index);
    return gridDate;
  });
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Display format for a YYYY-MM-DD date string: drops the century digits of the
// year (2026-06-06 -> 26-06-06). Storage/keys keep the full toDateKey form.
export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${year.slice(-2)}-${month}-${day}`;
}
