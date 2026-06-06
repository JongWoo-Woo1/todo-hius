import type { Task } from "../types";
import { taskList } from "./dom";
import { createTaskListItem } from "./taskView";

export type TaskListParams = {
  tasks: Task[];
  selectedTaskId: string | null;
  editingTaskId: string | null;
  renderDetailView: (task: Task) => HTMLElement;
  renderEditForm: (task: Task) => HTMLElement;
  onToggle: (taskId: string, completed: boolean) => void;
  onSelect: (taskId: string) => void;
};

export function clearTaskList(): void {
  taskList.innerHTML = "";
}

export function renderTaskList(params: TaskListParams): void {
  const { tasks, selectedTaskId, editingTaskId, renderDetailView, renderEditForm, onToggle, onSelect } = params;
  taskList.innerHTML = "";

  tasks.forEach((task) => {
    const isSelected = task.id === selectedTaskId;
    const detail = isSelected ? (editingTaskId === task.id ? renderEditForm(task) : renderDetailView(task)) : null;
    const item = createTaskListItem(task, {
      selected: isSelected,
      detail,
      onToggle: (completed) => onToggle(task.id, completed),
      onSelect: () => onSelect(task.id),
    });
    taskList.append(item);
  });
}
