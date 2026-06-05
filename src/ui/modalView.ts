import type { Project, TaskPriority, TaskStatus, Todo } from "../types";
import { formatProgressPercent } from "../utils/task";
import { calendarDetailContent, calendarDetailModal } from "./dom";

type TodoSelection = {
  project: Project;
  todo: Todo;
};

type TodoUpdates = Partial<Todo>;

type ModalViewOptions = {
  currentView: "projects" | "ledger" | "weekly" | "calendar";
  selectedProject: Project | null;
  selection: TodoSelection | null;
  isTodoEditing: boolean;
  onClose: () => void;
  onOpenProjectTodo: (projectId: string, todoId: string | null) => void;
  onEditTodo: () => void;
  onCancelTodoEdit: () => void;
  onSelectTodoFromProject: (todoId: string) => void;
  onUpdateTodo: (todoId: string, updates: TodoUpdates) => void;
};

function getDetailValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function createDetailRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "todo-detail-row";

  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;

  row.append(term, description);
  return row;
}

function getTodoProgressFromPercentValue(value: string): number {
  const progressPercent = Number(value);
  if (Number.isNaN(progressPercent)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progressPercent / 100));
}

function renderCalendarTodoView(project: Project, todo: Todo, options: ModalViewOptions): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "calendar-detail-view";

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `
    <div>
      <p class="eyebrow">${project.name}</p>
      <h3 id="calendar-detail-title">${todo.title}</h3>
    </div>
  `;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "quiet-button";
  closeButton.textContent = "닫기";
  closeButton.addEventListener("click", options.onClose);
  header.append(closeButton);

  const list = document.createElement("dl");
  list.className = "todo-detail-list calendar-detail-list";
  list.append(
    createDetailRow("내부 목표 완료일", getDetailValue(todo.dueDate)),
    createDetailRow("공수", getDetailValue(todo.estimate)),
    createDetailRow("진행상태", todo.status),
    createDetailRow("진척률", formatProgressPercent(todo.progress)),
    createDetailRow("우선순위", getDetailValue(todo.priority)),
    createDetailRow("메모", getDetailValue(todo.memo)),
  );

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const projectButton = document.createElement("button");
  projectButton.type = "button";
  projectButton.className = "quiet-button";
  projectButton.textContent = "Project로 이동";
  projectButton.addEventListener("click", () => {
    options.onOpenProjectTodo(project.id, todo.id);
  });

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "수정";
  editButton.addEventListener("click", options.onEditTodo);

  actions.append(projectButton, editButton);
  wrapper.append(header, list, actions);
  return wrapper;
}

function renderLedgerProjectView(project: Project, options: ModalViewOptions): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "calendar-detail-view ledger-project-detail-view";

  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = project.clientName || "No client";
  const heading = document.createElement("h3");
  heading.textContent = project.name;
  title.append(eyebrow, heading);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "quiet-button";
  closeButton.textContent = "닫기";
  closeButton.addEventListener("click", options.onClose);
  header.append(title, closeButton);

  const list = document.createElement("dl");
  list.className = "todo-detail-list calendar-detail-list";
  list.append(
    createDetailRow("업체", getDetailValue(project.clientName)),
    createDetailRow("프로젝트 번호", getDetailValue(project.projectNumber)),
    createDetailRow("프로젝트 기간", getDetailValue(project.periodText)),
    createDetailRow("시작일", getDetailValue(project.periodStart)),
    createDetailRow("종료일", getDetailValue(project.periodEnd)),
    createDetailRow("업무 수", `${project.todos.length}`),
  );

  const taskList = document.createElement("div");
  taskList.className = "ledger-project-task-list";
  if (project.todos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "이 프로젝트에 업무가 없습니다.";
    taskList.append(empty);
  } else {
    project.todos.forEach((todo) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "ledger-project-task-button";
      item.innerHTML = `
        <span class="status-badge" data-status="${todo.status}">${todo.status}</span>
        <strong>${todo.title}</strong>
        <span class="progress-pill">${formatProgressPercent(todo.progress)}</span>
      `;
      item.addEventListener("click", () => {
        options.onSelectTodoFromProject(todo.id);
      });
      taskList.append(item);
    });
  }

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const projectButton = document.createElement("button");
  projectButton.type = "button";
  projectButton.className = "quiet-button";
  projectButton.textContent = "Project로 이동";
  projectButton.addEventListener("click", () => {
    options.onOpenProjectTodo(project.id, null);
  });

  actions.append(projectButton);
  wrapper.append(header, list, taskList, actions);
  return wrapper;
}

function renderCalendarTodoEditForm(project: Project, todo: Todo, options: ModalViewOptions): HTMLElement {
  const form = document.createElement("form");
  form.className = "detail-form calendar-detail-form";
  form.innerHTML = `
    <div class="modal-header full-field">
      <div>
        <p class="eyebrow">${project.name}</p>
        <h3 id="calendar-detail-title">Task 수정</h3>
      </div>
      <button class="quiet-button" type="button" data-action="close">닫기</button>
    </div>
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
      <textarea name="memo" rows="4"></textarea>
    </label>
    <div class="modal-actions full-field">
      <button class="quiet-button" type="button" data-action="project">Project로 이동</button>
      <button class="quiet-button" type="button" data-action="cancel">취소</button>
      <button type="submit">저장</button>
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

  form.querySelector<HTMLButtonElement>('[data-action="close"]')!.addEventListener("click", options.onClose);
  form.querySelector<HTMLButtonElement>('[data-action="project"]')!.addEventListener("click", () => {
    options.onOpenProjectTodo(project.id, todo.id);
  });
  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", options.onCancelTodoEdit);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const progress = getTodoProgressFromPercentValue(progressInput.value);
    const selectedStatus = statusSelect.value as TaskStatus;
    const status: TaskStatus = progress >= 1 ? "완료" : selectedStatus;

    options.onUpdateTodo(todo.id, {
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

  return form;
}

export function renderCalendarDetailModalView(options: ModalViewOptions): void {
  calendarDetailContent.innerHTML = "";
  calendarDetailModal.onclick = (event) => {
    if (event.target !== calendarDetailModal) {
      return;
    }

    options.onClose();
  };

  if (options.currentView !== "calendar" && options.currentView !== "ledger") {
    calendarDetailModal.hidden = true;
    return;
  }

  if (options.selectedProject) {
    calendarDetailContent.append(renderLedgerProjectView(options.selectedProject, options));
    calendarDetailModal.hidden = false;
    return;
  }

  if (!options.selection) {
    calendarDetailModal.hidden = true;
    return;
  }

  calendarDetailContent.append(
    options.isTodoEditing
      ? renderCalendarTodoEditForm(options.selection.project, options.selection.todo, options)
      : renderCalendarTodoView(options.selection.project, options.selection.todo, options),
  );
  calendarDetailModal.hidden = false;
}
