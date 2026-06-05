import { uiState } from "../app/uiState";
import { getState } from "../state/store";
import { projectList } from "./dom";

export interface ProjectListHandlers {
  onSelectProject: (projectId: string) => void;
  onReorderProjects: (sourceProjectId: string, targetProjectId: string) => void;
  onRender: () => void;
}

function toSingleLineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function renderProjectList(handlers: ProjectListHandlers): void {
  projectList.innerHTML = "";

  getState().projects.forEach((project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-button";
    button.draggable = true;
    button.dataset.projectId = project.id;
    button.classList.toggle("active", uiState.currentView === "projects" && project.id === getState().activeProjectId);

    const name = document.createElement("span");
    name.className = "project-name";
    name.title = project.name;

    const swatch = document.createElement("span");
    swatch.className = "project-swatch";
    swatch.style.setProperty("--project-color", project.color);

    const label = document.createElement("span");
    label.className = "project-label";
    label.textContent = toSingleLineText(project.name);
    name.append(swatch, label);

    const client = document.createElement("span");
    client.className = "project-client";
    client.textContent = toSingleLineText(project.clientName) || "No client";
    client.title = project.clientName || "No client";

    button.append(name, client);
    button.addEventListener("click", () => {
      handlers.onSelectProject(project.id);
      uiState.isProjectInfoEditing = false;
      uiState.isProjectNameEditing = false;
      uiState.currentView = "projects";
      handlers.onRender();
    });
    button.addEventListener("dragstart", (event) => {
      uiState.draggedProjectId = project.id;
      button.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", project.id);
      event.dataTransfer?.setDragImage(button, 12, 20);
    });
    button.addEventListener("dragend", () => {
      uiState.draggedProjectId = null;
      button.classList.remove("dragging");
    });
    button.addEventListener("dragover", (event) => {
      if (!uiState.draggedProjectId || uiState.draggedProjectId === project.id) {
        return;
      }

      event.preventDefault();
      button.classList.add("drag-over");
    });
    button.addEventListener("dragleave", () => {
      button.classList.remove("drag-over");
    });
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("drag-over");
      const sourceProjectId = uiState.draggedProjectId ?? event.dataTransfer?.getData("text/plain");
      if (!sourceProjectId) {
        return;
      }

      handlers.onReorderProjects(sourceProjectId, project.id);
      uiState.draggedProjectId = null;
      handlers.onRender();
    });
    projectList.append(button);
  });
}
