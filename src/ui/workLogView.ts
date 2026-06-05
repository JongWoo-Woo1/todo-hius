import type { Project, Todo, WorkLog } from "../types";

export type WorkLogEntryOptions = {
  project?: Project;
  linkedTodo?: Todo;
  showProject?: boolean;
  compact?: boolean;
  onSelect: () => void;
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
  entry.className = options.compact ? "work-log-entry compact clickable" : "work-log-entry clickable";
  entry.style.setProperty("--project-color", options.project?.color ?? "#94a3b8");
  entry.setAttribute("role", "button");
  entry.tabIndex = 0;

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

  entry.addEventListener("click", () => options.onSelect());
  entry.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      options.onSelect();
    }
  });

  entry.append(meta, content);
  return entry;
}
