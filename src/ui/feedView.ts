import {
  getDeletedTaskByProject,
  getLinkedTaskDisplay,
  getProjectEvents,
  getProjectWorkLogs,
  getTaskByProject,
} from "../state/selectors";
import type { AppState, Project, ProjectEvent, Task, WorkLog } from "../types";
import { formatDisplayDate } from "../utils/calendar";
import {
  compareFeedItems,
  getContentPreview,
  makeFeedDateRange,
  splitFeedByWindow,
  type FeedDateRange,
} from "./feedShared";
import {
  feedEmptyState,
  feedFilterList,
  feedList,
  feedSettingsBackdrop,
  feedSettingsButton,
  feedSettingsCloseButton,
  feedSettingsPanel,
  feedToggleAllButton,
} from "./dom";

type FeedViewParams = {
  state: AppState;
  selectedProjectIds: Set<string>;
  showFutureItems: boolean;
  showPastItems: boolean;
  isSettingsOpen: boolean;
  onSelectWorkLog: (workLogId: string) => void;
  onSelectEvent: (eventId: string) => void;
  onSelectTask: (taskId: string) => void;
  onToggleFutureItems: (showFutureItems: boolean) => void;
  onTogglePastItems: (showPastItems: boolean) => void;
  onSelectedProjectIdsChange: (selectedProjectIds: Set<string>) => void;
  onToggleAllProjects: () => void;
  onToggleSettings: (open: boolean) => void;
};

type FeedItem =
  | { kind: "workLog"; sortDateKey: string; project: Project; workLog: WorkLog }
  | { kind: "event"; sortDateKey: string; project: Project; event: ProjectEvent }
  | { kind: "task"; sortDateKey: string | null; project: Project; task: Task };

function getFeedItemSortDateKey(item: FeedItem): string | null {
  return item.sortDateKey;
}

function getFeedItemDateRange(item: FeedItem): FeedDateRange {
  if (item.kind === "workLog") {
    return makeFeedDateRange(item.workLog.date, item.workLog.endDate);
  }

  if (item.kind === "event") {
    return makeFeedDateRange(item.event.startDate, item.event.endDate);
  }

  return makeFeedDateRange(item.task.dueDate);
}

function getFeedItemKey(item: FeedItem): string {
  if (item.kind === "workLog") {
    return `workLog:${item.workLog.id}`;
  }

  if (item.kind === "event") {
    return `event:${item.event.id}`;
  }

  return `task:${item.task.id}`;
}

function getFeedItemLabel(item: FeedItem): string {
  if (item.kind === "workLog") {
    return item.workLog.content;
  }

  if (item.kind === "event") {
    return item.event.title;
  }

  return item.task.title;
}

function getFeedItems(state: AppState, selectedProjectIds: Set<string>): FeedItem[] {
  const items: FeedItem[] = [];

  state.projects.forEach((project) => {
    if (!selectedProjectIds.has(project.id)) {
      return;
    }

    getProjectWorkLogs(state, project.id).forEach((workLog) => {
      items.push({ kind: "workLog", sortDateKey: workLog.date, project, workLog });
    });
    getProjectEvents(state, project.id).forEach((event) => {
      items.push({ kind: "event", sortDateKey: event.endDate ?? event.startDate, project, event });
    });
    project.tasks.forEach((task) => {
      items.push({ kind: "task", sortDateKey: task.dueDate, project, task });
    });
  });

  return items.sort((left, right) =>
    compareFeedItems(left, right, getFeedItemSortDateKey, getFeedItemLabel),
  );
}

function createProjectLabel(project: Project): HTMLElement {
  const label = document.createElement("p");
  label.className = "feed-card-project";

  const swatch = document.createElement("span");
  swatch.className = "project-swatch";
  swatch.style.setProperty("--project-color", project.color);

  const name = document.createElement("span");
  name.className = "feed-card-project-name";
  name.textContent = project.clientName ? `${project.name} · ${project.clientName}` : project.name;

  label.append(swatch, name);
  return label;
}

function makeClickable(card: HTMLElement, onSelect: () => void): void {
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.addEventListener("click", onSelect);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  });
}

function createFeedWorkLogCard(project: Project, workLog: WorkLog, onSelect: () => void): HTMLElement {
  const card = document.createElement("article");
  card.className = "project-memo-card clickable feed-card";
  card.style.setProperty("--project-color", project.color);

  const header = document.createElement("div");
  header.className = "project-memo-card-header";

  const badge = document.createElement("span");
  badge.className = "project-memo-badge";
  badge.textContent = "Weekly";

  const date = document.createElement("span");
  date.className = "project-memo-date";
  date.textContent = formatDisplayDate(workLog.date);

  header.append(badge, date);

  const meta = document.createElement("p");
  meta.className = "project-memo-meta";
  const linkedTaskDisplay = getLinkedTaskDisplay(project, workLog);
  const metaParts: string[] = [workLog.type];
  if (linkedTaskDisplay.activeTask || linkedTaskDisplay.deletedTask || workLog.linkedTaskTitleSnapshot) {
    metaParts.push(linkedTaskDisplay.label);
  }
  meta.textContent = metaParts.join(" / ");

  card.append(createProjectLabel(project), header, meta);

  const contentPreview = getContentPreview(workLog.content);
  if (contentPreview) {
    const content = document.createElement("p");
    content.className = "project-memo-content";
    content.textContent = contentPreview;
    card.append(content);
  }

  makeClickable(card, onSelect);
  return card;
}

function createFeedTaskCard(project: Project, task: Task, onSelect: () => void): HTMLElement {
  const card = document.createElement("article");
  card.className = "project-memo-card project-memo-task-card clickable feed-card";
  card.classList.toggle("completed", task.completed);
  card.style.setProperty("--project-color", project.color);

  const header = document.createElement("div");
  header.className = "project-memo-card-header";

  const badge = document.createElement("span");
  badge.className = "project-memo-badge task";
  badge.textContent = "Task";

  const date = document.createElement("span");
  date.className = "project-memo-date";
  date.textContent = formatDisplayDate(task.dueDate) || "날짜 없음";

  header.append(badge, date);

  const title = document.createElement("h4");
  title.className = "project-memo-title";
  title.textContent = task.title;

  const meta = document.createElement("p");
  meta.className = "project-memo-meta";
  meta.textContent = [task.status, task.priority].filter(Boolean).join(" / ");

  const content = document.createElement("p");
  content.className = "project-memo-content";
  content.textContent =
    getContentPreview(task.memo || task.workerComment || task.managerComment || task.issueRisk || "") || "메모 없음";

  card.append(createProjectLabel(project), header, title, meta, content);
  makeClickable(card, onSelect);
  return card;
}

function getEventDateLabel(event: ProjectEvent): string {
  if (event.endDate && event.endDate !== event.startDate) {
    return `${formatDisplayDate(event.startDate)} ~ ${formatDisplayDate(event.endDate)}`;
  }

  return formatDisplayDate(event.startDate);
}

function getEventLinkedTaskLabel(project: Project, event: ProjectEvent): string | null {
  const activeTask = getTaskByProject(project, event.taskId);
  if (activeTask) {
    return activeTask.title;
  }

  const deletedTask = getDeletedTaskByProject(project, event.taskId);
  if (deletedTask) {
    return `${deletedTask.title} (삭제됨)`;
  }

  return null;
}

function createFeedEventCard(project: Project, event: ProjectEvent, onSelect: () => void): HTMLElement {
  const card = document.createElement("article");
  card.className = "project-memo-card project-memo-event-card clickable feed-card";
  card.style.setProperty("--project-color", project.color);

  const header = document.createElement("div");
  header.className = "project-memo-card-header";

  const badge = document.createElement("span");
  badge.className = "project-memo-badge event";
  badge.textContent = "Event";

  const date = document.createElement("span");
  date.className = "project-memo-date";
  date.textContent = getEventDateLabel(event);

  header.append(badge, date);

  const title = document.createElement("h4");
  title.className = "project-memo-title";
  title.textContent = event.title;

  card.append(createProjectLabel(project), header, title);

  const linkedTaskLabel = getEventLinkedTaskLabel(project, event);
  if (linkedTaskLabel) {
    const meta = document.createElement("p");
    meta.className = "project-memo-meta";
    meta.textContent = linkedTaskLabel;
    card.append(meta);
  }

  const contentPreview = getContentPreview(event.content);
  if (contentPreview) {
    const content = document.createElement("p");
    content.className = "project-memo-content";
    content.textContent = contentPreview;
    card.append(content);
  }

  makeClickable(card, onSelect);
  return card;
}

function createFeedMoreButton(
  visibleCount: number,
  totalCount: number,
  expanded: boolean,
  label: string,
  onToggle: () => void,
  collapseLabel?: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "quiet-button work-log-more-button project-memo-more-button";
  button.textContent = expanded
    ? `${collapseLabel ?? `${label} 접기`} (${visibleCount} / ${totalCount})`
    : `${label} (${visibleCount} / ${totalCount})`;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onToggle();
  });
  return button;
}

function shouldShowMoreButton(visibleCount: number, totalCount: number, showAll: boolean): boolean {
  return visibleCount !== totalCount || (showAll && totalCount > 0);
}

function renderFeedFilters(
  state: AppState,
  selectedProjectIds: Set<string>,
  onSelectedProjectIdsChange: (selectedProjectIds: Set<string>) => void,
): void {
  feedFilterList.innerHTML = "";

  state.projects.forEach((project) => {
    const label = document.createElement("label");
    label.className = "calendar-filter-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedProjectIds.has(project.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedProjectIds.add(project.id);
      } else {
        selectedProjectIds.delete(project.id);
      }
      onSelectedProjectIdsChange(selectedProjectIds);
    });

    const swatch = document.createElement("span");
    swatch.className = "project-swatch";
    swatch.style.setProperty("--project-color", project.color);

    const name = document.createElement("span");
    name.textContent = project.name;
    label.append(checkbox, swatch, name);
    feedFilterList.append(label);
  });

  const allSelected = state.projects.length > 0 && selectedProjectIds.size === state.projects.length;
  feedToggleAllButton.textContent = allSelected ? "Clear all" : "Select all";
}

function renderFeedSettingsPanel(isOpen: boolean, onToggleSettings: (open: boolean) => void): void {
  feedSettingsPanel.hidden = !isOpen;
  feedSettingsPanel.setAttribute("aria-hidden", String(!isOpen));
  feedSettingsPanel.classList.toggle("is-open", isOpen);
  feedSettingsBackdrop.hidden = !isOpen;
  feedSettingsButton.setAttribute("aria-expanded", String(isOpen));

  feedSettingsButton.onclick = () => onToggleSettings(!isOpen);
  feedSettingsCloseButton.onclick = () => onToggleSettings(false);
  feedSettingsBackdrop.onclick = () => onToggleSettings(false);
}

export function renderFeedView(params: FeedViewParams): void {
  const { state, selectedProjectIds, showFutureItems, showPastItems } = params;

  renderFeedFilters(state, selectedProjectIds, params.onSelectedProjectIdsChange);
  feedToggleAllButton.onclick = params.onToggleAllProjects;
  renderFeedSettingsPanel(params.isSettingsOpen, params.onToggleSettings);

  feedList.innerHTML = "";

  const feedItems = getFeedItems(state, selectedProjectIds);
  // Keep the -5 ~ +5 business-day window with future/past "더보기" buckets,
  // but show every item inside the window (no count cap).
  const { visibleItems, futureHiddenCount, pastHiddenCount } = splitFeedByWindow(
    feedItems,
    getFeedItemDateRange,
    getFeedItemKey,
    showFutureItems,
    showPastItems,
    Number.POSITIVE_INFINITY,
  );

  feedEmptyState.hidden = feedItems.length > 0;

  const visibleCount = visibleItems.length;
  if (shouldShowMoreButton(visibleCount, visibleCount + futureHiddenCount, showFutureItems)) {
    feedList.append(
      createFeedMoreButton(
        visibleCount,
        visibleCount + futureHiddenCount,
        showFutureItems,
        "최신 피드 더보기",
        () => params.onToggleFutureItems(!showFutureItems),
        "최신 피드 접기",
      ),
    );
  }

  visibleItems.forEach((item) => {
    if (item.kind === "workLog") {
      feedList.append(
        createFeedWorkLogCard(item.project, item.workLog, () => params.onSelectWorkLog(item.workLog.id)),
      );
      return;
    }

    if (item.kind === "task") {
      feedList.append(createFeedTaskCard(item.project, item.task, () => params.onSelectTask(item.task.id)));
      return;
    }

    feedList.append(createFeedEventCard(item.project, item.event, () => params.onSelectEvent(item.event.id)));
  });

  if (shouldShowMoreButton(visibleCount, visibleCount + pastHiddenCount, showPastItems)) {
    feedList.append(
      createFeedMoreButton(
        visibleCount,
        visibleCount + pastHiddenCount,
        showPastItems,
        "과거 피드 더보기",
        () => params.onTogglePastItems(!showPastItems),
      ),
    );
  }
}
