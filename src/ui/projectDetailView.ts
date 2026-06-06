import { deleteProjectButton, emptyState, projectWorkLogCard, taskCount, taskForm } from "./dom";
import { renderEmptyProjectHeader } from "./projectView";

// Project-detail surface shown when no project is selected.
export function renderEmptyProjectDetail(): void {
  renderEmptyProjectHeader();
  taskCount.textContent = "0 items";
  emptyState.textContent = "Create a project first.";
  emptyState.hidden = false;
  taskForm.hidden = true;
  projectWorkLogCard.hidden = true;
  deleteProjectButton.hidden = true;
}

// Project-detail surface shown for the active project's Task list.
export function renderProjectDetailShell(taskItemCount: number): void {
  taskCount.textContent = `${taskItemCount} items`;
  emptyState.textContent = "선택된 프로젝트에 업무가 없습니다.";
  emptyState.hidden = taskItemCount > 0;
  taskForm.hidden = false;
  deleteProjectButton.hidden = false;
}
