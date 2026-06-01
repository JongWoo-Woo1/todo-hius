import type { Todo } from "../types";
import { toDateKey } from "./calendar";

export function formatProgressPercent(progress: number): string {
  return `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
}

export function isTodoComplete(todo: Todo): boolean {
  return todo.completed || todo.status === "완료" || todo.progress >= 1;
}

export function isTodoOverdue(todo: Todo, today = new Date()): boolean {
  if (!todo.dueDate || isTodoComplete(todo)) {
    return false;
  }

  return todo.dueDate < toDateKey(today);
}

export function isTodoDueSoon(todo: Todo, today = new Date(), daysAhead = 7): boolean {
  if (!todo.dueDate || isTodoComplete(todo)) {
    return false;
  }

  const todayKey = toDateKey(today);
  const dueSoonDate = new Date(today);
  dueSoonDate.setDate(dueSoonDate.getDate() + daysAhead);

  return todo.dueDate >= todayKey && todo.dueDate <= toDateKey(dueSoonDate);
}
