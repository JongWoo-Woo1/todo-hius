import type { Project } from "../types";
import { toDateKey } from "../utils/calendar";
import { calendarAddContent, calendarAddModal } from "./dom";

export type CalendarTaskCreateInput = {
  projectId: string;
  title: string;
  dueDate: string | null;
};

export type CalendarTaskAddModalOptions = {
  isOpen: boolean;
  projects: Project[];
  activeProjectId: string | null;
  onClose: () => void;
  onCreateTask: (input: CalendarTaskCreateInput) => void;
};

function appendProjectOptions(select: HTMLSelectElement, projects: Project[]): void {
  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.clientName ? `${project.clientName} / ${project.name}` : project.name;
    select.append(option);
  });
}

export function renderCalendarTaskAddModalView(options: CalendarTaskAddModalOptions): void {
  calendarAddContent.innerHTML = "";
  calendarAddModal.onclick = (event) => {
    if (event.target === calendarAddModal) {
      options.onClose();
    }
  };

  if (!options.isOpen) {
    calendarAddModal.hidden = true;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "calendar-add-view";

  const header = document.createElement("div");
  header.className = "modal-header";
  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Calendar";
  const heading = document.createElement("h3");
  heading.id = "calendar-add-title";
  heading.textContent = "Task 추가";
  title.append(eyebrow, heading);
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "quiet-button";
  closeButton.textContent = "닫기";
  closeButton.addEventListener("click", options.onClose);
  header.append(title, closeButton);

  const taskForm = document.createElement("form");
  taskForm.className = "calendar-add-task-form";

  const projectLabel = document.createElement("label");
  projectLabel.textContent = "프로젝트";
  const projectSelect = document.createElement("select");
  projectSelect.required = true;
  appendProjectOptions(projectSelect, options.projects);
  projectSelect.value =
    options.activeProjectId && options.projects.some((project) => project.id === options.activeProjectId)
      ? options.activeProjectId
      : options.projects[0]?.id ?? "";
  projectLabel.append(projectSelect);

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Task";
  const titleInput = document.createElement("input");
  titleInput.required = true;
  titleInput.placeholder = "업무명";
  titleLabel.append(titleInput);

  const dueDateLabel = document.createElement("label");
  dueDateLabel.textContent = "내부 목표 완료일";
  const dueDateInput = document.createElement("input");
  dueDateInput.type = "date";
  dueDateInput.value = toDateKey(new Date());
  dueDateLabel.append(dueDateInput);

  const taskActions = document.createElement("div");
  taskActions.className = "modal-actions";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "quiet-button";
  cancelButton.textContent = "취소";
  cancelButton.addEventListener("click", options.onClose);
  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "추가";
  taskActions.append(cancelButton, submitButton);

  taskForm.append(projectLabel, titleLabel, dueDateLabel, taskActions);
  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onCreateTask({
      projectId: projectSelect.value,
      title: titleInput.value.trim(),
      dueDate: dueDateInput.value || null,
    });
  });

  wrapper.append(header, taskForm);
  calendarAddContent.append(wrapper);
  calendarAddModal.hidden = false;
}
