import type { Todo } from "../types";
import { todoList } from "./dom";
import { createTodoListItem } from "./todoView";

export type TodoListParams = {
  todos: Todo[];
  selectedTodoId: string | null;
  editingTodoId: string | null;
  renderDetailView: (todo: Todo) => HTMLElement;
  renderEditForm: (todo: Todo) => HTMLElement;
  onToggle: (todoId: string, completed: boolean) => void;
  onSelect: (todoId: string) => void;
};

export function clearTodoList(): void {
  todoList.innerHTML = "";
}

export function renderTodoList(params: TodoListParams): void {
  const { todos, selectedTodoId, editingTodoId, renderDetailView, renderEditForm, onToggle, onSelect } = params;
  todoList.innerHTML = "";

  todos.forEach((todo) => {
    const isSelected = todo.id === selectedTodoId;
    const detail = isSelected ? (editingTodoId === todo.id ? renderEditForm(todo) : renderDetailView(todo)) : null;
    const item = createTodoListItem(todo, {
      selected: isSelected,
      detail,
      onToggle: (completed) => onToggle(todo.id, completed),
      onSelect: () => onSelect(todo.id),
    });
    todoList.append(item);
  });
}
