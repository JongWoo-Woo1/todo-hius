import type { TaskPriority, TaskStatus, Todo } from "../types";
import { formatDueDate } from "../utils/date";
import { formatProgressPercent, isTodoOverdue } from "../utils/task";
import { createDetailRow, getDetailValue } from "./detailView";

type TodoUpdates = Partial<Todo>;

type TodoDetailViewOptions = {
  workLogSummary: HTMLElement;
  onEdit: () => void;
  onDelete: () => void;
};

type TodoEditFormOptions = {
  onUpdate: (updates: TodoUpdates) => void;
  onCancel: () => void;
  onDelete: () => void;
};

type TodoListItemOptions = {
  selected: boolean;
  detail: HTMLElement | null;
  onToggle: (completed: boolean) => void;
  onSelect: () => void;
};

function getProgressFromInput(input: HTMLInputElement): number {
  const progressPercent = Number(input.value);
  if (Number.isNaN(progressPercent)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progressPercent / 100));
}

function createStatusBadge(status: TaskStatus): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = "status-badge";
  badge.dataset.status = status;
  badge.textContent = status;
  return badge;
}

function createPriorityBadge(priority: TaskPriority): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = "priority-badge";
  badge.textContent = priority;
  return badge;
}

function createProgressPill(progress: number): HTMLSpanElement {
  const pill = document.createElement("span");
  pill.className = "progress-pill";
  pill.textContent = formatProgressPercent(progress);
  return pill;
}

export function createTodoDetailView(todo: Todo, options: TodoDetailViewOptions): HTMLElement {
  const detail = document.createElement("div");
  detail.className = "todo-inline-detail";

  const list = document.createElement("dl");
  list.className = "todo-detail-list";
  list.append(
    createDetailRow("내부 목표 완료일", getDetailValue(todo.dueDate)),
    createDetailRow("공수", getDetailValue(todo.estimate)),
    createDetailRow("진행상태", todo.status),
    createDetailRow("진척률", formatProgressPercent(todo.progress)),
    createDetailRow("우선순위", getDetailValue(todo.priority)),
    createDetailRow("메모", getDetailValue(todo.memo)),
  );

  const actions = document.createElement("div");
  actions.className = "todo-card-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "quiet-button";
  editButton.textContent = "수정";
  editButton.addEventListener("click", (event) => {
    event.stopPropagation();
    options.onEdit();
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-todo-button";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    options.onDelete();
  });

  actions.append(editButton, deleteButton);
  detail.append(list, options.workLogSummary, actions);
  return detail;
}

export function createTodoEditForm(todo: Todo, options: TodoEditFormOptions): HTMLElement {
  const form = document.createElement("form");
  form.className = "detail-form todo-inline-form";
  form.innerHTML = `
    <label>
      Task
      <input name="title" type="text" required />
    </label>
    <label>
      Target date
      <input name="dueDate" type="date" />
    </label>
    <label>
      Estimate
      <input name="estimate" type="text" placeholder="Example: 2d" />
    </label>
    <label>
      Status
      <select name="status">
        <option value="대기">대기</option>
        <option value="진행중">진행중</option>
        <option value="미완">미완</option>
        <option value="완료">완료</option>
        <option value="보류">보류</option>
      </select>
    </label>
    <label>
      Progress (%)
      <input name="progress" type="number" min="0" max="100" step="1" />
    </label>
    <label>
      Priority
      <select name="priority">
        <option value="낮음">낮음</option>
        <option value="보통">보통</option>
        <option value="높음">높음</option>
        <option value="최우선">최우선</option>
      </select>
    </label>
    <label class="full-field">
      Memo
      <textarea name="memo" rows="5" placeholder="Add notes for this task"></textarea>
    </label>
    <div class="todo-card-actions full-field">
      <button type="submit">저장</button>
      <button class="quiet-button" type="button" data-action="cancel">취소</button>
      <button class="delete-todo-button" type="button" data-action="delete">삭제</button>
    </div>
  `;

  const titleInput = form.querySelector<HTMLInputElement>('[name="title"]')!;
  const dueDateInput = form.querySelector<HTMLInputElement>('[name="dueDate"]')!;
  const estimateInput = form.querySelector<HTMLInputElement>('[name="estimate"]')!;
  const statusSelect = form.querySelector<HTMLSelectElement>('[name="status"]')!;
  const progressInput = form.querySelector<HTMLInputElement>('[name="progress"]')!;
  const prioritySelect = form.querySelector<HTMLSelectElement>('[name="priority"]')!;
  const memoInput = form.querySelector<HTMLTextAreaElement>('[name="memo"]')!;

  titleInput.value = todo.title;
  dueDateInput.value = todo.dueDate ?? "";
  estimateInput.value = todo.estimate ?? "";
  statusSelect.value = todo.status;
  progressInput.value = String(Math.round(todo.progress * 100));
  prioritySelect.value = todo.priority ?? "보통";
  memoInput.value = todo.memo;

  form.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const progress = getProgressFromInput(progressInput);
    const selectedStatus = statusSelect.value as TaskStatus;
    const status: TaskStatus = progress >= 1 ? "완료" : selectedStatus;

    options.onUpdate({
      title: titleInput.value.trim(),
      dueDate: dueDateInput.value || null,
      estimate: estimateInput.value.trim(),
      status,
      progress,
      completed: status === "완료",
      priority: prioritySelect.value as TaskPriority,
      memo: memoInput.value.trim(),
    });
  });

  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", options.onCancel);
  form.querySelector<HTMLButtonElement>('[data-action="delete"]')!.addEventListener("click", options.onDelete);

  return form;
}

export function createTodoListItem(todo: Todo, options: TodoListItemOptions): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "todo-item";
  item.classList.toggle("completed", todo.completed);
  item.classList.toggle("selected", options.selected);
  item.classList.toggle("expanded", options.selected);
  item.classList.toggle("overdue", isTodoOverdue(todo));

  const checkbox = document.createElement("input");
  checkbox.className = "todo-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;
  checkbox.addEventListener("change", () => {
    options.onToggle(checkbox.checked);
  });
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const copy = document.createElement("div");
  copy.className = "todo-copy";

  const title = document.createElement("p");
  title.className = "todo-title";
  title.append(createStatusBadge(todo.status));

  if (todo.priority) {
    title.append(createPriorityBadge(todo.priority));
  }

  if (isTodoOverdue(todo)) {
    const overdue = document.createElement("span");
    overdue.className = "overdue-badge";
    overdue.textContent = "Overdue";
    title.append(overdue);
  }

  title.append(document.createTextNode(todo.title));

  const meta = document.createElement("p");
  meta.className = "todo-meta";

  const dueDate = document.createElement("span");
  dueDate.textContent = formatDueDate(todo.dueDate);
  meta.append(createProgressPill(todo.progress), dueDate);

  copy.append(title, meta);

  item.addEventListener("click", options.onSelect);
  item.append(checkbox, copy);

  if (options.detail) {
    item.append(options.detail);
  }

  return item;
}
