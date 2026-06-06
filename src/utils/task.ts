import type { Task } from "../types";
import { toDateKey } from "./calendar";

export function formatProgressPercent(progress: number): string {
  return `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
}

export function isTaskComplete(task: Task): boolean {
  return task.completed || task.status === "완료" || task.progress >= 1;
}

export function isTaskOverdue(task: Task, today = new Date()): boolean {
  if (!task.dueDate || isTaskComplete(task)) {
    return false;
  }

  return task.dueDate < toDateKey(today);
}
