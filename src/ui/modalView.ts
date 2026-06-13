import type { Project, TaskPriority, TaskStatus, Task } from "../types";
import { formatDisplayDate } from "../utils/calendar";
import { formatProjectPeriod } from "../utils/project";
import { formatProgressPercent } from "../utils/task";
import { calendarDetailContent, calendarDetailModal } from "./dom";
import { createDetailRow, getDetailValue } from "./detailView";

type TaskSelection = {
  project: Project;
  task: Task;
};

type TaskUpdates = Partial<Task>;

type ModalViewOptions = {
  currentView: "projects" | "ledger" | "weekly" | "calendar" | "feed";
  selectedProject: Project | null;
  selection: TaskSelection | null;
  isTaskEditing: boolean;
  workLogSummary: HTMLElement | null;
  onClose: () => void;
  onOpenProjectTask: (projectId: string, taskId: string | null) => void;
  onEditTask: () => void;
  onDeleteTask: (task: Task) => void;
  onCancelTaskEdit: () => void;
  onSelectTaskFromProject: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: TaskUpdates) => void;
};

function getTaskProgressFromPercentValue(value: string): number {
  const progressPercent = Number(value);
  if (Number.isNaN(progressPercent)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progressPercent / 100));
}

function renderCalendarTaskView(project: Project, task: Task, options: ModalViewOptions): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "calendar-detail-view";

  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = project.name;
  const heading = document.createElement("h3");
  heading.id = "calendar-detail-title";
  heading.textContent = task.title;
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
    createDetailRow("내부 목표 완료일", getDetailValue(formatDisplayDate(task.dueDate))),
    createDetailRow("공수", getDetailValue(task.estimate)),
    createDetailRow("진행상태", task.status),
    createDetailRow("진척률", formatProgressPercent(task.progress)),
    createDetailRow("우선순위", getDetailValue(task.priority)),
    createDetailRow("메모", getDetailValue(task.memo)),
  );

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const projectButton = document.createElement("button");
  projectButton.type = "button";
  projectButton.className = "quiet-button";
  projectButton.textContent = "Project로 이동";
  projectButton.addEventListener("click", () => {
    options.onOpenProjectTask(project.id, task.id);
  });

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "수정";
  editButton.addEventListener("click", options.onEditTask);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent = "휴지통으로 이동";
  deleteButton.addEventListener("click", () => {
    options.onDeleteTask(task);
  });

  actions.append(projectButton, deleteButton, editButton);

  if (options.workLogSummary) {
    wrapper.append(header, list, options.workLogSummary, actions);
  } else {
    wrapper.append(header, list, actions);
  }
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
    createDetailRow("프로젝트 기간", getDetailValue(formatProjectPeriod(project))),
    createDetailRow("업무 수", `${project.tasks.length}`),
  );

  const taskList = document.createElement("div");
  taskList.className = "ledger-project-task-list";
  if (project.tasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "이 프로젝트에 업무가 없습니다.";
    taskList.append(empty);
  } else {
    project.tasks.forEach((task) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "ledger-project-task-button";

      const status = document.createElement("span");
      status.className = "status-badge";
      status.dataset.status = task.status;
      status.textContent = task.status;

      const title = document.createElement("strong");
      title.textContent = task.title;

      const progress = document.createElement("span");
      progress.className = "progress-pill";
      progress.textContent = formatProgressPercent(task.progress);

      item.append(status, title, progress);
      item.addEventListener("click", () => {
        options.onSelectTaskFromProject(task.id);
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
    options.onOpenProjectTask(project.id, null);
  });

  actions.append(projectButton);
  wrapper.append(header, list, taskList, actions);
  return wrapper;
}

function renderCalendarTaskEditForm(project: Project, task: Task, options: ModalViewOptions): HTMLElement {
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
        <option value="검토대기">검토대기</option>
        <option value="완료">완료</option>
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

  titleInput.value = task.title;
  dueDateInput.value = task.dueDate ?? "";
  estimateInput.value = task.estimate ?? "";
  statusSelect.value = task.status;
  progressInput.value = String(Math.round(task.progress * 100));
  prioritySelect.value = task.priority ?? "보통";
  memoInput.value = task.memo;

  form.querySelector<HTMLButtonElement>('[data-action="close"]')!.addEventListener("click", options.onClose);
  form.querySelector<HTMLButtonElement>('[data-action="project"]')!.addEventListener("click", () => {
    options.onOpenProjectTask(project.id, task.id);
  });
  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", options.onCancelTaskEdit);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const progress = getTaskProgressFromPercentValue(progressInput.value);
    const selectedStatus = statusSelect.value as TaskStatus;
    const status: TaskStatus = progress >= 1 ? "완료" : selectedStatus;

    options.onUpdateTask(task.id, {
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
    if (event.target !== calendarDetailModal || options.isTaskEditing) {
      return;
    }

    options.onClose();
  };

  if (
    options.currentView !== "calendar" &&
    options.currentView !== "ledger" &&
    options.currentView !== "feed"
  ) {
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
    options.isTaskEditing
      ? renderCalendarTaskEditForm(options.selection.project, options.selection.task, options)
      : renderCalendarTaskView(options.selection.project, options.selection.task, options),
  );
  calendarDetailModal.hidden = false;
}
