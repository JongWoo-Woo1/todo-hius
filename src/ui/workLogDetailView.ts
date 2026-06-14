import type { Project, Task, WorkLog, WorkLogType } from "../types";
import { formatDisplayDate } from "../utils/calendar";
import { workLogDetailContent, workLogDetailModal } from "./dom";
import { createDetailRow, getDetailValue } from "./detailView";

type WorkLogUpdates = Partial<WorkLog>;
type WorkLogFormMode = "create" | "edit";

export type WorkLogFeedSuggestion = {
  id: string;
  kind: "event" | "weekly" | "task";
  projectId: string;
  projectName: string;
  clientName: string;
  projectColor: string;
  title: string;
  dateStart: string | null;
  dateEnd: string | null;
  meta: string;
  preview: string;
  content: string;
  taskId?: string;
};

function getWorkLogTypeLabel(type: WorkLogType): string {
  switch (type) {
    case "계획":
      return "계획";
    case "수행":
      return "일지";
  }
}

function getWorkLogFormHeading(type: WorkLogType, mode: WorkLogFormMode): string {
  const action = mode === "create" ? "추가" : "수정";
  return `${getWorkLogTypeLabel(type)} ${action}`;
}

function isSuggestionOnDate(suggestion: WorkLogFeedSuggestion, date: string): boolean {
  if (!suggestion.dateStart || !suggestion.dateEnd) {
    return false;
  }

  return suggestion.dateStart <= date && date <= suggestion.dateEnd;
}

function getSuggestionDateLabel(suggestion: WorkLogFeedSuggestion): string {
  if (!suggestion.dateStart || !suggestion.dateEnd) {
    return "날짜 없음";
  }

  if (suggestion.dateStart !== suggestion.dateEnd) {
    return `${formatDisplayDate(suggestion.dateStart)} ~ ${formatDisplayDate(suggestion.dateEnd)}`;
  }

  return formatDisplayDate(suggestion.dateStart);
}

function createSuggestionCard(suggestion: WorkLogFeedSuggestion, onApply: (suggestion: WorkLogFeedSuggestion) => void): HTMLElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "work-log-feed-card";
  card.style.setProperty("--project-color", suggestion.projectColor);
  card.addEventListener("click", () => onApply(suggestion));

  const project = document.createElement("p");
  project.className = "feed-card-project";

  const swatch = document.createElement("span");
  swatch.className = "project-swatch";
  swatch.style.setProperty("--project-color", suggestion.projectColor);

  const projectName = document.createElement("span");
  projectName.className = "feed-card-project-name";
  projectName.textContent = suggestion.clientName
    ? `${suggestion.projectName} · ${suggestion.clientName}`
    : suggestion.projectName;
  project.append(swatch, projectName);

  const header = document.createElement("div");
  header.className = "project-memo-card-header";

  const badge = document.createElement("span");
  badge.className =
    suggestion.kind === "event"
      ? "project-memo-badge event"
      : suggestion.kind === "task"
        ? "project-memo-badge task"
        : "project-memo-badge";
  badge.textContent = suggestion.kind === "event" ? "Event" : suggestion.kind === "task" ? "Task" : "Weekly";

  const date = document.createElement("span");
  date.className = "project-memo-date";
  date.textContent = getSuggestionDateLabel(suggestion);
  header.append(badge, date);

  const title = document.createElement("strong");
  title.className = "project-memo-title";
  title.textContent = suggestion.title;

  card.append(project, header, title);

  if (suggestion.meta) {
    const meta = document.createElement("p");
    meta.className = "project-memo-meta";
    meta.textContent = suggestion.meta;
    card.append(meta);
  }

  if (suggestion.preview) {
    const preview = document.createElement("p");
    preview.className = "project-memo-content";
    preview.textContent = suggestion.preview;
    card.append(preview);
  }

  return card;
}

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

export type WorkLogCreateInput = {
  projectId: string;
  date: string;
  endDate: string | null;
  type: WorkLogType;
  taskId: string | undefined;
  content: string;
};

export type WorkLogDetailModalOptions = {
  workLog: WorkLog | null;
  project: Project | undefined;
  linkedTaskLabel: string;
  canOpenLinkedTask: boolean;
  projectTasks: Task[];
  isEditing: boolean;
  isCreating: boolean;
  projects: Project[];
  feedSuggestions: WorkLogFeedSuggestion[];
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
  selectedTaskLabel?: string,
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

function renderFeedSuggestions(
  feedSection: HTMLElement,
  feedList: HTMLElement,
  taskSection: HTMLElement,
  taskList: HTMLElement,
  suggestions: WorkLogFeedSuggestion[],
  projectId: string,
  date: string,
  onApply: (suggestion: WorkLogFeedSuggestion) => void,
): void {
  feedList.innerHTML = "";
  taskList.innerHTML = "";

  const projectSuggestions = suggestions.filter((suggestion) => suggestion.projectId === projectId);
  const feedSuggestions = projectSuggestions.filter(
    (suggestion) => suggestion.kind !== "task" && isSuggestionOnDate(suggestion, date),
  );
  const taskSuggestions = projectSuggestions
    .filter((suggestion) => suggestion.kind === "task")
    .sort((left, right) => compareTaskReferenceSuggestions(left, right, date));

  feedSection.hidden = feedSuggestions.length === 0;
  taskSection.hidden = taskSuggestions.length === 0;

  feedSuggestions.forEach((suggestion) => {
    feedList.append(createSuggestionCard(suggestion, onApply));
  });
  taskSuggestions.forEach((suggestion) => {
    taskList.append(createSuggestionCard(suggestion, onApply));
  });
}

function compareTaskReferenceSuggestions(left: WorkLogFeedSuggestion, right: WorkLogFeedSuggestion, date: string): number {
  const leftUpcoming = Boolean(left.dateStart && left.dateStart >= date);
  const rightUpcoming = Boolean(right.dateStart && right.dateStart >= date);

  if (leftUpcoming !== rightUpcoming) {
    return leftUpcoming ? -1 : 1;
  }

  if (left.dateStart && right.dateStart && left.dateStart !== right.dateStart) {
    return left.dateStart.localeCompare(right.dateStart);
  }

  if (left.dateStart && !right.dateStart) {
    return -1;
  }

  if (!left.dateStart && right.dateStart) {
    return 1;
  }

  return left.title.localeCompare(right.title);
}

function createModalHeader(project: Project | undefined, heading: string, onClose: () => void): HTMLElement {
  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = project?.name ?? "Weekly";
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

  wrapper.append(createModalHeader(options.project, `${formatDisplayDate(workLog.date)} · ${workLog.type}`, options.onClose));

  const dateText = workLog.endDate
    ? `${formatDisplayDate(workLog.date)} ~ ${formatDisplayDate(workLog.endDate)}`
    : formatDisplayDate(workLog.date);

  const list = document.createElement("dl");
  list.className = "todo-detail-list calendar-detail-list";
  list.append(createDetailRow("날짜", getDetailValue(dateText)), createDetailRow("구분", workLog.type));
  if (options.linkedTaskLabel !== "Linked Task 없음") {
    list.append(createDetailRow("연결 업무", options.linkedTaskLabel));
  }
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

function renderWorkLogEditForm(workLog: WorkLog, options: WorkLogDetailModalOptions): HTMLElement {
  const form = document.createElement("form");
  form.className = "detail-form calendar-detail-form";

  form.innerHTML = `
    <div class="modal-header full-field">
      <div>
        <p class="eyebrow">${options.project?.name ?? "Weekly"}</p>
        <h3 id="work-log-detail-title">${getWorkLogFormHeading(workLog.type, "edit")}</h3>
      </div>
      <button class="quiet-button" type="button" data-action="close">닫기</button>
    </div>
    <label>
      날짜
      <input name="date" type="date" required />
    </label>
    <label data-plan-only>
      종료일
      <input name="endDate" type="date" />
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
      <select name="taskId"></select>
    </label>
    <label class="full-field">
      내용
      <textarea name="content" rows="14"></textarea>
    </label>
    <div class="modal-actions full-field">
      <button class="quiet-button" type="button" data-action="cancel">취소</button>
      <button type="submit">저장</button>
    </div>
  `;

  const dateInput = form.querySelector<HTMLInputElement>('[name="date"]')!;
  const endDateInput = form.querySelector<HTMLInputElement>('[name="endDate"]')!;
  const endDateField = form.querySelector<HTMLElement>("[data-plan-only]")!;
  const typeSelect = form.querySelector<HTMLSelectElement>('[name="type"]')!;
  const taskSelect = form.querySelector<HTMLSelectElement>('[name="taskId"]')!;
  const contentInput = form.querySelector<HTMLTextAreaElement>('[name="content"]')!;
  const heading = form.querySelector<HTMLHeadingElement>("#work-log-detail-title")!;

  dateInput.value = workLog.date;
  endDateInput.value = workLog.endDate ?? "";
  typeSelect.value = workLog.type;
  setTaskOptions(taskSelect, options.projectTasks, workLog.taskId, options.linkedTaskLabel);
  contentInput.value = workLog.content;
  addTabIndent(contentInput);

  const syncEndDateVisibility = (): void => {
    endDateField.hidden = typeSelect.value !== "계획";
    endDateInput.min = dateInput.value;
    heading.textContent = getWorkLogFormHeading(typeSelect.value as WorkLogType, "edit");
  };
  syncEndDateVisibility();
  typeSelect.addEventListener("change", syncEndDateVisibility);
  dateInput.addEventListener("change", syncEndDateVisibility);

  form.querySelector<HTMLButtonElement>('[data-action="close"]')!.addEventListener("click", options.onClose);
  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", options.onCancelEdit);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const isPlan = typeSelect.value === "계획";
    options.onUpdate({
      date: dateInput.value,
      endDate: isPlan && endDateInput.value ? endDateInput.value : null,
      type: typeSelect.value as WorkLogType,
      taskId: taskSelect.value || undefined,
      content: contentInput.value.trim(),
    });
  });

  return form;
}

function renderWorkLogCreateForm(options: WorkLogDetailModalOptions): HTMLElement {
  const form = document.createElement("form");
  form.className = "detail-form calendar-detail-form work-log-feed-form";

  const projectOptions = options.projects
    .map((project) => `<option value="${project.id}">${project.clientName ? `${project.clientName} / ${project.name}` : project.name}</option>`)
    .join("");

  form.innerHTML = `
    <div class="modal-header full-field">
      <div>
        <p class="eyebrow">Weekly</p>
        <h3 id="work-log-detail-title">${getWorkLogFormHeading(options.defaultType, "create")}</h3>
      </div>
      <button class="quiet-button" type="button" data-action="close">닫기</button>
    </div>
    <section class="work-log-weekly-panel">
      <label>
        프로젝트
        <select name="projectId" required>${projectOptions}</select>
      </label>
      <label>
        날짜
        <input name="date" type="date" required />
      </label>
      <label data-plan-only>
        종료일
        <input name="endDate" type="date" />
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
        <select name="taskId"></select>
      </label>
      <label class="full-field">
        내용
        <textarea name="content" rows="14"></textarea>
      </label>
    </section>
    <aside class="work-log-feed-panel" data-feed-panel>
      <div class="work-log-reference-scroll">
      <section class="work-log-reference-section" data-feed-section>
        <h5>Feed</h5>
        <div class="work-log-feed-list" data-feed-list></div>
      </section>
      <section class="work-log-reference-section" data-task-section>
        <h5>Task</h5>
        <div class="work-log-feed-list" data-task-list></div>
      </section>
      </div>
    </aside>
    <div class="modal-actions full-field">
      <button class="quiet-button" type="button" data-action="cancel">취소</button>
      <button type="submit">추가</button>
    </div>
  `;

  const projectSelect = form.querySelector<HTMLSelectElement>('[name="projectId"]')!;
  const dateInput = form.querySelector<HTMLInputElement>('[name="date"]')!;
  const endDateInput = form.querySelector<HTMLInputElement>('[name="endDate"]')!;
  const endDateField = form.querySelector<HTMLElement>("[data-plan-only]")!;
  const typeSelect = form.querySelector<HTMLSelectElement>('[name="type"]')!;
  const taskSelect = form.querySelector<HTMLSelectElement>('[name="taskId"]')!;
  const contentInput = form.querySelector<HTMLTextAreaElement>('[name="content"]')!;
  const heading = form.querySelector<HTMLHeadingElement>("#work-log-detail-title")!;
  const feedPanel = form.querySelector<HTMLElement>("[data-feed-panel]")!;
  const feedSection = form.querySelector<HTMLElement>("[data-feed-section]")!;
  const feedList = form.querySelector<HTMLElement>("[data-feed-list]")!;
  const taskSection = form.querySelector<HTMLElement>("[data-task-section]")!;
  const taskList = form.querySelector<HTMLElement>("[data-task-list]")!;

  dateInput.value = options.defaultDate;
  typeSelect.value = options.defaultType;
  projectSelect.value = options.projects[0]?.id ?? "";
  addTabIndent(contentInput);

  const syncEndDateVisibility = (): void => {
    const isPlan = typeSelect.value === "계획";
    endDateField.hidden = !isPlan;
    feedPanel.hidden = !isPlan;
    form.classList.toggle("without-feed-panel", !isPlan);
    form.closest(".work-log-detail-card")?.classList.toggle("has-feed-panel", isPlan);
    endDateInput.min = dateInput.value;
    heading.textContent = getWorkLogFormHeading(typeSelect.value as WorkLogType, "create");
    if (!isPlan) {
      return;
    }

    renderFeedSuggestions(feedSection, feedList, taskSection, taskList, options.feedSuggestions, projectSelect.value, dateInput.value, (suggestion) => {
      if (suggestion.kind === "task" && suggestion.taskId) {
        taskSelect.value = suggestion.taskId;
        taskSelect.focus();
        return;
      }

      contentInput.value = suggestion.content;
      contentInput.focus();
    });
  };
  syncEndDateVisibility();
  typeSelect.addEventListener("change", syncEndDateVisibility);
  dateInput.addEventListener("change", syncEndDateVisibility);

  const syncTaskOptions = (): void => {
    const project = options.projects.find((candidate) => candidate.id === projectSelect.value);
    setTaskOptions(taskSelect, project?.tasks ?? []);
  };
  syncTaskOptions();
  projectSelect.addEventListener("change", () => {
    syncTaskOptions();
    syncEndDateVisibility();
  });

  form.querySelector<HTMLButtonElement>('[data-action="close"]')!.addEventListener("click", options.onClose);
  form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.addEventListener("click", options.onClose);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const isPlan = typeSelect.value === "계획";
    options.onCreate({
      projectId: projectSelect.value,
      date: dateInput.value,
      endDate: isPlan && endDateInput.value ? endDateInput.value : null,
      type: typeSelect.value as WorkLogType,
      taskId: taskSelect.value || undefined,
      content: contentInput.value.trim(),
    });
  });

  return form;
}

export function renderWorkLogDetailModalView(options: WorkLogDetailModalOptions): void {
  workLogDetailContent.innerHTML = "";
  workLogDetailContent
    .closest(".work-log-detail-card")
    ?.classList.toggle("has-feed-panel", options.isCreating && options.defaultType === "계획");
  workLogDetailModal.onclick = (event) => {
    if (event.target === workLogDetailModal && !options.isCreating && !options.isEditing) {
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
