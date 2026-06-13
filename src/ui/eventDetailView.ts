import type { Project, ProjectEvent, Task } from "../types";
import { formatDisplayDate } from "../utils/calendar";
import { eventDetailContent, eventDetailModal } from "./dom";
import { createDetailRow, getDetailValue } from "./detailView";

export type EventInput = {
  projectId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  taskId: string | undefined;
  content: string;
};

export type EventDetailModalOptions = {
  event: ProjectEvent | null;
  project: Project | undefined;
  projects: Project[];
  selectedProjectId: string | null;
  lockProjectSelect: boolean;
  linkedTaskLabel: string | null;
  canOpenLinkedTask: boolean;
  projectTasks: Task[];
  isEditing: boolean;
  isCreating: boolean;
  defaultStartDate: string;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onOpenTask: () => void;
  onUpdate: (updates: EventInput) => void;
  onDelete: () => void;
  onCreate: (input: EventInput) => void;
};

function addTabIndent(textarea: HTMLTextAreaElement): void {
  textarea.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + "  " + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
  });
}

function appendOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function setTaskOptions(
  select: HTMLSelectElement,
  tasks: Task[],
  selectedTaskId?: string,
  selectedTaskLabel?: string | null,
): void {
  select.innerHTML = "";
  appendOption(select, "", "선택 안 함");

  tasks.forEach((task) => {
    appendOption(select, task.id, task.title);
  });

  const hasSelectedTask = Boolean(selectedTaskId && tasks.some((task) => task.id === selectedTaskId));
  if (selectedTaskId && !hasSelectedTask) {
    appendOption(select, selectedTaskId, selectedTaskLabel ?? selectedTaskId);
  }

  select.value = selectedTaskId ?? "";
}

function getProjectOptionLabel(project: Project): string {
  return project.clientName ? `${project.clientName} / ${project.name}` : project.name;
}

function setProjectOptions(select: HTMLSelectElement, projects: Project[], selectedProjectId: string | null): void {
  select.innerHTML = "";
  appendOption(select, "", "프로젝트 선택");

  projects.forEach((project) => {
    appendOption(select, project.id, getProjectOptionLabel(project));
  });

  select.value =
    selectedProjectId && projects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : "";
}

function getEventDateLabel(event: ProjectEvent): string {
  if (event.endDate && event.endDate !== event.startDate) {
    return `${formatDisplayDate(event.startDate)} ~ ${formatDisplayDate(event.endDate)}`;
  }

  return formatDisplayDate(event.startDate);
}

function createModalHeader(project: Project | undefined, heading: string, onClose: () => void): HTMLElement {
  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = project?.name ?? "Event";
  const headingEl = document.createElement("h3");
  headingEl.id = "event-detail-title";
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

function renderEventDetail(event: ProjectEvent, options: EventDetailModalOptions): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "calendar-detail-view work-log-detail-view";
  wrapper.append(createModalHeader(options.project, event.title, options.onClose));

  const list = document.createElement("dl");
  list.className = "todo-detail-list calendar-detail-list";
  list.append(
    createDetailRow("기간", getDetailValue(getEventDateLabel(event))),
    createDetailRow("연결 업무", options.linkedTaskLabel ?? "선택 안 함"),
  );
  wrapper.append(list);

  const contentLabel = document.createElement("h4");
  contentLabel.className = "work-log-detail-subtitle";
  contentLabel.textContent = "내용";
  const content = document.createElement("p");
  content.className = "work-log-detail-content";
  content.textContent = getDetailValue(event.content);
  wrapper.append(contentLabel, content);

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  if (options.canOpenLinkedTask) {
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

function createEventForm(options: EventDetailModalOptions, event: ProjectEvent | null): HTMLFormElement {
  const form = document.createElement("form");
  form.className = "detail-form calendar-detail-form";

  const header = document.createElement("div");
  header.className = "modal-header full-field";
  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = options.project?.name ?? "Event";
  const heading = document.createElement("h3");
  heading.id = "event-detail-title";
  heading.textContent = event ? "Event 수정" : "Event 추가";
  title.append(eyebrow, heading);
  const closeButton = document.createElement("button");
  closeButton.className = "quiet-button";
  closeButton.type = "button";
  closeButton.textContent = "닫기";
  closeButton.addEventListener("click", options.onClose);
  header.append(title, closeButton);

  const titleLabel = document.createElement("label");
  titleLabel.className = "full-field";
  titleLabel.textContent = "제목";
  const titleInput = document.createElement("input");
  titleInput.name = "title";
  titleInput.required = true;
  titleLabel.append(titleInput);

  const projectLabel = document.createElement("label");
  projectLabel.className = "full-field";
  projectLabel.textContent = "Project Link";
  const projectSelect = document.createElement("select");
  projectSelect.name = "projectId";
  projectSelect.required = true;
  projectSelect.disabled = options.lockProjectSelect;
  projectLabel.append(projectSelect);

  const startLabel = document.createElement("label");
  startLabel.textContent = "시작일";
  const startInput = document.createElement("input");
  startInput.name = "startDate";
  startInput.type = "date";
  startInput.required = true;
  startLabel.append(startInput);

  const endLabel = document.createElement("label");
  endLabel.textContent = "종료일";
  const endInput = document.createElement("input");
  endInput.name = "endDate";
  endInput.type = "date";
  endLabel.append(endInput);

  const taskLabel = document.createElement("label");
  taskLabel.className = "full-field";
  taskLabel.textContent = "연결 업무";
  const taskSelect = document.createElement("select");
  taskSelect.name = "taskId";
  taskLabel.append(taskSelect);

  const contentLabel = document.createElement("label");
  contentLabel.className = "full-field";
  contentLabel.textContent = "내용";
  const contentInput = document.createElement("textarea");
  contentInput.name = "content";
  contentInput.rows = 12;
  contentLabel.append(contentInput);

  const actions = document.createElement("div");
  actions.className = "modal-actions full-field";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "quiet-button";
  cancelButton.textContent = "취소";
  cancelButton.addEventListener("click", event ? options.onCancelEdit : options.onClose);
  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = event ? "저장" : "추가";
  actions.append(cancelButton, submitButton);

  form.append(header, titleLabel, projectLabel, startLabel, endLabel, taskLabel, contentLabel, actions);

  titleInput.value = event?.title ?? "";
  setProjectOptions(projectSelect, options.projects, event?.projectId ?? options.selectedProjectId);
  startInput.value = event?.startDate ?? options.defaultStartDate;
  endInput.value = event?.endDate ?? "";
  const syncTaskOptions = (): void => {
    const selectedProject = options.projects.find((project) => project.id === projectSelect.value);
    setTaskOptions(taskSelect, selectedProject?.tasks ?? [], event?.taskId, options.linkedTaskLabel);
  };
  syncTaskOptions();
  projectSelect.addEventListener("change", syncTaskOptions);
  contentInput.value = event?.content ?? "";
  addTabIndent(contentInput);

  form.addEventListener("submit", (submitEvent) => {
    submitEvent.preventDefault();
    const input: EventInput = {
      projectId: projectSelect.value,
      title: titleInput.value.trim(),
      startDate: startInput.value,
      endDate: endInput.value || null,
      taskId: taskSelect.value || undefined,
      content: contentInput.value.trim(),
    };

    if (event) {
      options.onUpdate(input);
      return;
    }

    options.onCreate(input);
  });

  return form;
}

export function renderEventDetailModalView(options: EventDetailModalOptions): void {
  eventDetailContent.innerHTML = "";
  eventDetailModal.onclick = (event) => {
    if (event.target === eventDetailModal && !options.isCreating && !options.isEditing) {
      options.onClose();
    }
  };

  if (options.isCreating) {
    eventDetailContent.append(createEventForm(options, null));
    eventDetailModal.hidden = false;
    return;
  }

  if (!options.event) {
    eventDetailModal.hidden = true;
    return;
  }

  eventDetailContent.append(
    options.isEditing
      ? createEventForm(options, options.event)
      : renderEventDetail(options.event, options),
  );
  eventDetailModal.hidden = false;
}
