import { uiState } from "../app/uiState";
import { getState } from "../state/store";
import { projectList } from "./dom";

export interface ProjectListHandlers {
  onSelectProject: (projectId: string) => void;
  onReorderProjects: (sourceProjectId: string, targetProjectId: string) => void;
  onOpenWorkspaceWindow: (windowKey: string) => void;
  onRender: () => void;
  openedWindowKeys: Set<string>;
}

function toSingleLineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function renderProjectList(handlers: ProjectListHandlers): void {
  projectList.innerHTML = "";

  getState().projects.forEach((project) => {
    const windowKey = `project:${project.id}`;
    const card = document.createElement("div");
    card.className = "project-card";
    card.draggable = true;
    card.dataset.projectId = project.id;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-button";
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

    button.append(name);
    const clientName = toSingleLineText(project.clientName);
    if (clientName) {
      const client = document.createElement("span");
      client.className = "project-client";
      client.textContent = clientName;
      client.title = clientName;
      button.append(client);
    }

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "workspace-window-button project-window-button";
    openButton.textContent = "[]";
    openButton.setAttribute("aria-label", `Open ${project.name} in new window`);
    openButton.classList.toggle("active", handlers.openedWindowKeys.has(windowKey));
    openButton.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onOpenWorkspaceWindow(windowKey);
    });

    card.append(button, openButton);
    button.addEventListener("click", () => {
      handlers.onSelectProject(project.id);
      uiState.isProjectInfoEditing = false;
      uiState.isProjectNameEditing = false;
      uiState.currentView = "projects";
      handlers.onRender();
    });
    card.addEventListener("dragstart", (event) => {
      uiState.draggedProjectId = project.id;
      card.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", project.id);
      event.dataTransfer?.setDragImage(card, 12, 20);
    });
    card.addEventListener("dragend", () => {
      uiState.draggedProjectId = null;
      card.classList.remove("dragging");
    });
    card.addEventListener("dragover", (event) => {
      if (!uiState.draggedProjectId || uiState.draggedProjectId === project.id) {
        return;
      }

      event.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("drag-over");
      const sourceProjectId = uiState.draggedProjectId ?? event.dataTransfer?.getData("text/plain");
      if (!sourceProjectId) {
        return;
      }

      handlers.onReorderProjects(sourceProjectId, project.id);
      uiState.draggedProjectId = null;
      handlers.onRender();
    });
    projectList.append(card);
  });
}
