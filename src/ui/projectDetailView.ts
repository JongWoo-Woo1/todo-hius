import { deleteProjectButton, emptyState, projectAddTaskButton, projectWorkLogCard, taskCount } from "./dom";
import { renderEmptyProjectHeader } from "./projectView";

// Project-detail surface shown when no project is selected.
export function renderEmptyProjectDetail({
  title = "Add a project",
  message = "Create a project first.",
}: {
  title?: string;
  message?: string;
} = {}): void {
  renderEmptyProjectHeader(title);
  taskCount.textContent = "0 items";
  emptyState.textContent = message;
  emptyState.hidden = false;
  projectAddTaskButton.hidden = true;
  projectWorkLogCard.hidden = true;
  deleteProjectButton.hidden = true;
}

// Project-detail surface shown for the active project's Task list.
export function renderProjectDetailShell(taskItemCount: number, onAddTask: () => void): void {
  taskCount.textContent = `${taskItemCount} items`;
  emptyState.textContent = "선택된 프로젝트에 업무가 없습니다.";
  emptyState.hidden = taskItemCount > 0;
  projectAddTaskButton.hidden = false;
  projectAddTaskButton.onclick = onAddTask;
  deleteProjectButton.hidden = false;
}
