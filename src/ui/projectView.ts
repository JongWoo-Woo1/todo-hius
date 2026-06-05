import type { Project } from "../types";
import {
  activeProjectName,
  activeProjectNameButton,
  cancelProjectInfoButton,
  editProjectInfoButton,
  projectClientNameInput,
  projectColorInput,
  projectInfoForm,
  projectInfoView,
  projectNameForm,
  projectNameInput,
  projectNumberInput,
  projectPeriodEndInput,
  projectPeriodStartInput,
  projectPeriodTextInput,
} from "./dom";

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

export function renderEmptyProjectHeader(): void {
  activeProjectName.textContent = "Add a project";
  activeProjectNameButton.disabled = true;
  projectInfoView.hidden = true;
}

export function renderProjectHeader(project: Project): void {
  activeProjectName.textContent = project.name;
  activeProjectNameButton.disabled = false;
  projectColorInput.value = project.color;
  projectClientNameInput.value = project.clientName;
  projectNumberInput.value = project.projectNumber ?? "";
  projectPeriodTextInput.value = project.periodText ?? "";
  projectPeriodStartInput.value = project.periodStart ?? "";
  projectPeriodEndInput.value = project.periodEnd ?? "";
}

export function renderProjectInfoView(project: Project | null): void {
  projectInfoView.innerHTML = "";

  if (!project) {
    return;
  }

  projectInfoView.append(
    createDetailRow("업체명", getDetailValue(project.clientName)),
    createDetailRow("프로젝트 번호", getDetailValue(project.projectNumber)),
    createDetailRow("프로젝트 기간", getDetailValue(project.periodText)),
    createDetailRow("시작일", getDetailValue(project.periodStart)),
    createDetailRow("종료일", getDetailValue(project.periodEnd)),
  );
}

export function setProjectInfoEditMode(isEditing: boolean, hasActiveProject: boolean): void {
  projectInfoView.hidden = isEditing;
  projectInfoForm.hidden = !isEditing;
  editProjectInfoButton.hidden = isEditing || !hasActiveProject;
  cancelProjectInfoButton.hidden = !isEditing;
}

export function setProjectNameEditMode(isEditing: boolean, project: Project | null): void {
  const shouldEdit = isEditing && Boolean(project);
  activeProjectNameButton.hidden = shouldEdit;
  projectNameForm.hidden = !shouldEdit;

  if (project) {
    projectNameInput.value = project.name;
  }

  if (shouldEdit) {
    window.requestAnimationFrame(() => {
      projectNameInput.focus();
      projectNameInput.select();
    });
  }
}
