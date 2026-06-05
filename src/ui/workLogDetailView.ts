import type { Project, Todo, WorkLog, WorkLogType } from "../types";
import { workLogDetailContent, workLogDetailModal } from "./dom";
import { createDetailRow, getDetailValue } from "./detailView";

type WorkLogUpdates = Partial<WorkLog>;

export type WorkLogCreateInput = {
  projectId: string;
  date: string;
  type: WorkLogType;
  todoId: string | undefined;
  content: string;
};

export type WorkLogDetailModalOptions = {
  workLog: WorkLog | null;
  project: Project | undefined;
  linkedTodo: Todo | undefined;
  projectTodos: Todo[];
  isEditing: boolean;
  isCreating: boolean;
  projects: Project[];
  defaultDate: string;
  defaultType: WorkLogType;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onOpenTask: () => void;
  onUpdate: (updates: WorkLogUpdates) => void;
  onDelete: () => void;
  onCreate: (input: WorkLogCreateInput) => void;
};

function buildTodoOptions(todos: Todo[]): string {
  return ['<option value="">없음</option>', ...todos.map((todo) => `<option value="${todo.id}">${todo.title}</option>`)].join("");
}

function createModalHeader(project: Project | undefined, heading: string, onClose: () => void): HTMLElement {
  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = project?.name ?? "Weekly log";
  const headingEl = document.createElement("h3");
  headingEl.id = "work-log-detail-title";
  headingEl.textContent = heading;
  title.append(eyebrow, headingEl);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "quiet-button";
  closeButton.textContent = "닫기";
  closeButton.addEventListener("click", onClose);

  header.append(title, closeButton);
  return header;
}

function renderWorkLogDetail(workLog: WorkLog, options: WorkLogDetailModalOptions): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "calendar-detail-view work-log-detail-view";

  wrapper.append(createModalHeader(options.project, `${workLog.date} · ${workLog.type}`, options.onClose));

  const list = document.createElement("dl");
  list.className = "todo-detail-list calendar-detail-list";
  list.append(
    createDetailRow("날짜", getDetailValue(workLog.date)),
    createDetailRow("구분", workLog.type),
    createDetailRow("연결 업무", getDetailValue(options.linkedTodo?.title)),
  );
  wrapper.append(list);

  const contentLabel = document.createElement("h4");
  contentLabel.className = "work-log-detail-subtitle";
  contentLabel.textContent = "내용";
  const content = document.createElement("p");
  content.className = "work-log-detail-content";
  content.textContent = getDetailValue(workLog.content);
  wrapper.append(contentLabel, content);

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  if (options.linkedTodo) {
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "quiet-button";
    openButton.textContent = "Open task";
    openButton.addEventListener("click", options.onOpenTask);
    actions.append(openButton);
  }

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", options.onDelete);

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "수정";
  editButton.addEventListener("click", options.onEdit);

  actions.append(deleteButton, editButton);
  wrapper.append(actions);
  return wrapper;
}

function renderWorkLogEditForm(workLog: WorkLog, options: WorkLogDetailModalOptions): HTMLElement {
  const form = document.createElement("form");
  form.className = "detail-form calendar-detail-form";

  const todoOptions = options.projectTodos
    .map((todo) => `<option value="${todo.id}">${todo.title}</option>`)
    .join("");

  form.innerHTML = `
    <div class="modal-header full-field">
      <div>
        <p class="eyebrow">${options.project?.name ?? "Weekly log"}</p>
        <h3 id="work-log-detail-title">기록 수정</h3>
      </div>
      <button class="quiet-button" type="button" data-action="close">닫기</button>
    </div>
    <label>
      날짜
      <input name="date" type="date" required />
    </label>
    <label>
      구분
      <select name="type">
        <option value="계획">계획</option>
        <option value="수행">수행</option>
      </select>
    </label>
    <label class="full-field">
      연결 업무
      <select name="todoId">
        <option value="">없음</option>
        ${todoOptions}
      </select>
    </label>
    <label class="full-field">
      내용
      <textarea name="content" rows="5" required></textarea>
    </label>
    <div class="modal-actions full-field">
      <button class="quiet-button" type="button" data-action="cancel">취소</button>
      <button type="submit">저장</button>
    </div>
  `;

  const dateInput = form.querySelector<HTMLInputElement>('[name="date"]')!;
  const typeSelect = form.querySelector<HTMLSelectElement>('[name="type"]')!;
  const todoSelect = form.querySelector<HTMLSelectElement>('[name="todoId"]')!;
  const contentInput = form.querySelector<HTMLTextAreaElement>('[name="content"]')!;

  dateInput.value = workLog.date;
  typeSelect.value = workLog.type;
  todoSelect.value = workLog.todoId ?? "";
  contentInput.value = workLog.content;

  form.querySelector<HTMLButtonElement>('[data-action="close"]')!.addEventListener("click", options.onClose);
  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", options.onCancelEdit);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onUpdate({
      date: dateInput.value,
      type: typeSelect.value as WorkLogType,
      todoId: todoSelect.value || undefined,
      content: contentInput.value.trim(),
    });
  });

  return form;
}

function renderWorkLogCreateForm(options: WorkLogDetailModalOptions): HTMLElement {
  const form = document.createElement("form");
  form.className = "detail-form calendar-detail-form";

  const projectOptions = options.projects
    .map((project) => `<option value="${project.id}">${project.clientName ? `${project.clientName} / ${project.name}` : project.name}</option>`)
    .join("");

  form.innerHTML = `
    <div class="modal-header full-field">
      <div>
        <p class="eyebrow">Weekly log</p>
        <h3 id="work-log-detail-title">기록 추가</h3>
      </div>
      <button class="quiet-button" type="button" data-action="close">닫기</button>
    </div>
    <label>
      프로젝트
      <select name="projectId" required>${projectOptions}</select>
    </label>
    <label>
      날짜
      <input name="date" type="date" required />
    </label>
    <label>
      구분
      <select name="type">
        <option value="계획">계획</option>
        <option value="수행">수행</option>
      </select>
    </label>
    <label class="full-field">
      연결 업무
      <select name="todoId"></select>
    </label>
    <label class="full-field">
      내용
      <textarea name="content" rows="5" required></textarea>
    </label>
    <div class="modal-actions full-field">
      <button class="quiet-button" type="button" data-action="cancel">취소</button>
      <button type="submit">추가</button>
    </div>
  `;

  const projectSelect = form.querySelector<HTMLSelectElement>('[name="projectId"]')!;
  const dateInput = form.querySelector<HTMLInputElement>('[name="date"]')!;
  const typeSelect = form.querySelector<HTMLSelectElement>('[name="type"]')!;
  const todoSelect = form.querySelector<HTMLSelectElement>('[name="todoId"]')!;
  const contentInput = form.querySelector<HTMLTextAreaElement>('[name="content"]')!;

  dateInput.value = options.defaultDate;
  typeSelect.value = options.defaultType;
  projectSelect.value = options.projects[0]?.id ?? "";

  const syncTodoOptions = (): void => {
    const project = options.projects.find((candidate) => candidate.id === projectSelect.value);
    todoSelect.innerHTML = buildTodoOptions(project?.todos ?? []);
  };
  syncTodoOptions();
  projectSelect.addEventListener("change", syncTodoOptions);

  form.querySelector<HTMLButtonElement>('[data-action="close"]')!.addEventListener("click", options.onClose);
  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", options.onClose);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onCreate({
      projectId: projectSelect.value,
      date: dateInput.value,
      type: typeSelect.value as WorkLogType,
      todoId: todoSelect.value || undefined,
      content: contentInput.value.trim(),
    });
  });

  return form;
}

export function renderWorkLogDetailModalView(options: WorkLogDetailModalOptions): void {
  workLogDetailContent.innerHTML = "";
  workLogDetailModal.onclick = (event) => {
    if (event.target === workLogDetailModal) {
      options.onClose();
    }
  };

  if (options.isCreating) {
    workLogDetailContent.append(renderWorkLogCreateForm(options));
    workLogDetailModal.hidden = false;
    return;
  }

  if (!options.workLog) {
    workLogDetailModal.hidden = true;
    return;
  }

  workLogDetailContent.append(
    options.isEditing
      ? renderWorkLogEditForm(options.workLog, options)
      : renderWorkLogDetail(options.workLog, options),
  );
  workLogDetailModal.hidden = false;
}
