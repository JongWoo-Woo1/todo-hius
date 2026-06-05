import type { Project, Todo, WorkLog } from "../types";

export type WorkLogEntryOptions = {
  project?: Project;
  linkedTodo?: Todo;
  showProject?: boolean;
  compact?: boolean;
  onOpen?: () => void;
  onDelete: () => void;
};

export type WorkLogMoreButtonOptions = {
  visibleCount: number;
  totalCount: number;
  expanded: boolean;
  onToggle: () => void;
};

export function createWorkLogMoreButton({
  visibleCount,
  totalCount,
  expanded,
  onToggle,
}: WorkLogMoreButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "quiet-button work-log-more-button";
  button.textContent = expanded ? `접기 (${visibleCount}/${totalCount})` : `더보기 (${visibleCount}/${totalCount})`;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onToggle();
  });
  return button;
}

export function createWorkLogEntry(workLog: WorkLog, options: WorkLogEntryOptions): HTMLElement {
  const entry = document.createElement("article");
  entry.className = options.compact ? "work-log-entry compact" : "work-log-entry";
  entry.style.setProperty("--project-color", options.project?.color ?? "#94a3b8");

  const meta = document.createElement("p");
  meta.className = "work-log-entry-meta";
  const parts = [workLog.date, workLog.type];
  if (options.showProject && options.project) {
    parts.push(options.project.name);
  }
  if (options.linkedTodo) {
    parts.push(options.linkedTodo.title);
  }
  meta.textContent = parts.join(" / ");

  const content = document.createElement("p");
  content.className = "work-log-entry-content";
  content.textContent = workLog.content;

  const actions = document.createElement("div");
  actions.className = "work-log-entry-actions";

  if (options.project && options.onOpen) {
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "quiet-button";
    openButton.textContent = "Open task";
    openButton.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onOpen?.();
    });
    actions.append(openButton);
  }

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-work-log-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    options.onDelete();
  });
  actions.append(deleteButton);

  entry.append(meta, content, actions);
  return entry;
}
