import { formatDisplayDate, toDateKey } from "./calendar";

function getMonday(date: Date): Date {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + mondayOffset);
}

export function getWeekdays(date: Date): Date[] {
  const monday = getMonday(date);
  return Array.from({ length: 5 }, (_, index) => {
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
  });
}

export function getWeekRangeLabel(date: Date): string {
  const weekdays = getWeekdays(date);
  return `${formatDisplayDate(toDateKey(weekdays[0]))} ~ ${formatDisplayDate(toDateKey(weekdays[weekdays.length - 1]))}`;
}
