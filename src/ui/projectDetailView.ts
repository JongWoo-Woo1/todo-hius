import { deleteProjectButton, emptyState, projectWorkLogCard, todoCount, todoForm } from "./dom";
import { renderEmptyProjectHeader } from "./projectView";

// Project-detail surface shown when no project is selected.
export function renderEmptyProjectDetail(): void {
  renderEmptyProjectHeader();
  todoCount.textContent = "0 items";
  emptyState.textContent = "Create a project first.";
  emptyState.hidden = false;
  todoForm.hidden = true;
  projectWorkLogCard.hidden = true;
  deleteProjectButton.hidden = true;
}

// Project-detail surface shown for the active project's Todo list.
export function renderProjectDetailShell(todoItemCount: number): void {
  todoCount.textContent = `${todoItemCount} items`;
  emptyState.textContent = "선택된 프로젝트에 업무가 없습니다.";
  emptyState.hidden = todoItemCount > 0;
  todoForm.hidden = false;
  deleteProjectButton.hidden = false;
}
