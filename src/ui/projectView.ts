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
  projectPeriodEndMonthInput,
  projectPeriodStartMonthInput,
  projectPeriodStatusSelect,
} from "./dom";
import { formatProjectPeriod } from "../utils/project";
import { createDetailRow, getDetailValue } from "./detailView";

function syncProjectPeriodInputs(): void {
  const isMonthPeriod = projectPeriodStatusSelect.value === "연도월";
  projectPeriodStartMonthInput.disabled = !isMonthPeriod;
  projectPeriodEndMonthInput.disabled = !isMonthPeriod;
}

projectPeriodStatusSelect.addEventListener("change", syncProjectPeriodInputs);

export function renderEmptyProjectHeader(title = "Add a project"): void {
  activeProjectName.textContent = title;
  activeProjectNameButton.disabled = true;
  projectInfoView.hidden = true;
}

export function renderProjectHeader(project: Project): void {
  activeProjectName.textContent = project.name;
  activeProjectNameButton.disabled = false;
  projectColorInput.value = project.color;
  projectClientNameInput.value = project.clientName;
  projectNumberInput.value = project.projectNumber ?? "";
  projectPeriodStatusSelect.value = project.periodStatus ?? "대기";
  projectPeriodStartMonthInput.value = project.periodStartMonth ?? "";
  projectPeriodEndMonthInput.value = project.periodEndMonth ?? "";
  syncProjectPeriodInputs();
}

export function renderProjectInfoView(project: Project | null): void {
  projectInfoView.innerHTML = "";

  if (!project) {
    return;
  }

  projectInfoView.append(
    createDetailRow("업체명", getDetailValue(project.clientName)),
    createDetailRow("프로젝트 번호", getDetailValue(project.projectNumber)),
    createDetailRow("프로젝트 기간", getDetailValue(formatProjectPeriod(project))),
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
