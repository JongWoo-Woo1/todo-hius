import type { Task } from "../types";
import { formatDisplayDate } from "../utils/calendar";
import { taskTrashCard, taskTrashEmpty, taskTrashList, toggleTaskTrashButton } from "./dom";

export type TaskTrashViewParams = {
  deletedTasks: Task[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onRestoreTask: (taskId: string) => void;
  onPermanentlyDeleteTask: (task: Task) => void;
};

function createDeletedTaskItem(
  task: Task,
  handlers: Pick<TaskTrashViewParams, "onRestoreTask" | "onPermanentlyDeleteTask">,
): HTMLElement {
  const item = document.createElement("article");
  item.className = "task-trash-item";

  const body = document.createElement("div");
  body.className = "task-trash-item-body";

  const title = document.createElement("strong");
  title.textContent = task.title;

  const meta = document.createElement("p");
  meta.textContent = formatDisplayDate(task.dueDate);

  body.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "task-trash-actions";

  const restoreButton = document.createElement("button");
  restoreButton.type = "button";
  restoreButton.className = "quiet-button";
  restoreButton.textContent = "복원";
  restoreButton.addEventListener("click", () => handlers.onRestoreTask(task.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent = "영구 삭제";
  deleteButton.addEventListener("click", () => handlers.onPermanentlyDeleteTask(task));

  actions.append(restoreButton, deleteButton);
  item.append(body, actions);
  return item;
}

export function clearTaskTrashView(): void {
  taskTrashCard.hidden = true;
  taskTrashList.innerHTML = "";
  taskTrashList.hidden = true;
  taskTrashEmpty.hidden = true;
}

export function renderTaskTrashView(params: TaskTrashViewParams): void {
  const { deletedTasks, expanded } = params;
  taskTrashList.innerHTML = "";

  if (deletedTasks.length === 0) {
    clearTaskTrashView();
    return;
  }

  taskTrashCard.hidden = false;
  toggleTaskTrashButton.textContent = expanded ? "접기" : `삭제된 Task 보기 (${deletedTasks.length})`;
  toggleTaskTrashButton.onclick = params.onToggleExpanded;
  taskTrashList.hidden = !expanded;
  taskTrashEmpty.hidden = true;

  if (!expanded) {
    return;
  }

  deletedTasks.forEach((task) => {
    taskTrashList.append(createDeletedTaskItem(task, params));
  });
}
