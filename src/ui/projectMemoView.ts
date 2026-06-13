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
  addProjectEventButton,
  projectWorkLogCard,
  projectWorkLogEmpty,
  projectWorkLogList,
} from "./dom";

type ProjectMemoViewParams = {
  state: AppState;
  activeProject: Project | null;
  onSelectWorkLog: (workLogId: string) => void;
  onSelectEvent: (eventId: string) => void;
  onSelectTask: (taskId: string) => void;
  onAddEvent: () => void;
  showFutureItems: boolean;
  showPastItems: boolean;
  onToggleFutureItems: (showFutureItems: boolean) => void;
  onTogglePastItems: (showPastItems: boolean) => void;
};

type MemoFeedItem =
  | { kind: "workLog"; sortDateKey: string; workLog: WorkLog }
  | { kind: "event"; sortDateKey: string; event: ProjectEvent }
  | { kind: "task"; sortDateKey: string | null; task: Task };

const DEFAULT_VISIBLE_MEMO_COUNT = 4;

function createMemoWorkLogCard(activeProject: Project, workLog: WorkLog, onSelect: () => void): HTMLElement {
  const card = document.createElement("article");
  card.className = "project-memo-card clickable";
  card.style.setProperty("--project-color", activeProject.color);
  card.setAttribute("role", "button");
  card.tabIndex = 0;

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
  const linkedTaskDisplay = getLinkedTaskDisplay(activeProject, workLog);
  const metaParts: string[] = [workLog.type];
  if (linkedTaskDisplay.activeTask || linkedTaskDisplay.deletedTask || workLog.linkedTaskTitleSnapshot) {
    metaParts.push(linkedTaskDisplay.label);
  }
  meta.textContent = metaParts.join(" / ");

  card.addEventListener("click", onSelect);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  });

  card.append(header, meta);

  const contentPreview = getContentPreview(workLog.content);
  if (contentPreview) {
    const content = document.createElement("p");
    content.className = "project-memo-content";
    content.textContent = contentPreview;
    card.append(content);
  }

  return card;
}

function createMemoTaskCard(activeProject: Project, task: Task, onSelect: () => void): HTMLElement {
  const card = document.createElement("article");
  card.className = "project-memo-card project-memo-task-card clickable";
  card.classList.toggle("completed", task.completed);
  card.style.setProperty("--project-color", activeProject.color);
  card.setAttribute("role", "button");
  card.tabIndex = 0;

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

  card.addEventListener("click", onSelect);
  card.addEventListener("keydown", (keyboardEvent) => {
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault();
      onSelect();
    }
  });

  card.append(header, title, meta, content);
  return card;
}

function getEventDateLabel(event: ProjectEvent): string {
  if (event.endDate && event.endDate !== event.startDate) {
    return `${formatDisplayDate(event.startDate)} ~ ${formatDisplayDate(event.endDate)}`;
  }

  return formatDisplayDate(event.startDate);
}

function getEventLinkedTaskLabel(activeProject: Project, event: ProjectEvent): string | null {
  const activeTask = getTaskByProject(activeProject, event.taskId);
  if (activeTask) {
    return activeTask.title;
  }

  const deletedTask = getDeletedTaskByProject(activeProject, event.taskId);
  if (deletedTask) {
    return `${deletedTask.title} (삭제됨)`;
  }

  return null;
}

function createMemoEventCard(activeProject: Project, event: ProjectEvent, onSelect: () => void): HTMLElement {
  const card = document.createElement("article");
  card.className = "project-memo-card project-memo-event-card clickable";
  card.style.setProperty("--project-color", activeProject.color);
  card.setAttribute("role", "button");
  card.tabIndex = 0;

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

  const meta = document.createElement("p");
  meta.className = "project-memo-meta";
  const linkedTaskLabel = getEventLinkedTaskLabel(activeProject, event);
  if (linkedTaskLabel) {
    meta.textContent = linkedTaskLabel;
  }

  card.addEventListener("click", onSelect);
  card.addEventListener("keydown", (keyboardEvent) => {
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault();
      onSelect();
    }
  });

  card.append(header, title);
  if (linkedTaskLabel) {
    card.append(meta);
  }

  const contentPreview = getContentPreview(event.content);
  if (contentPreview) {
    const content = document.createElement("p");
    content.className = "project-memo-content";
    content.textContent = contentPreview;
    card.append(content);
  }

  return card;
}

function getMemoItemSortDateKey(item: MemoFeedItem): string | null {
  return item.sortDateKey;
}

function getMemoItemDateRange(item: MemoFeedItem): FeedDateRange {
  if (item.kind === "workLog") {
    return makeFeedDateRange(item.workLog.date, item.workLog.endDate);
  }

  if (item.kind === "event") {
    return makeFeedDateRange(item.event.startDate, item.event.endDate);
  }

  return makeFeedDateRange(item.task.dueDate);
}

function getMemoItemKey(item: MemoFeedItem): string {
  if (item.kind === "workLog") {
    return `workLog:${item.workLog.id}`;
  }

  if (item.kind === "event") {
    return `event:${item.event.id}`;
  }

  return `task:${item.task.id}`;
}

function getMemoItemLabel(item: MemoFeedItem): string {
  if (item.kind === "workLog") {
    return item.workLog.content;
  }

  if (item.kind === "event") {
    return item.event.title;
  }

  return item.task.title;
}

function compareMemoItems(left: MemoFeedItem, right: MemoFeedItem): number {
  return compareFeedItems(left, right, getMemoItemSortDateKey, getMemoItemLabel);
}

function getMemoFeedItems(state: AppState, activeProject: Project): MemoFeedItem[] {
  const workLogItems: MemoFeedItem[] = getProjectWorkLogs(state, activeProject.id).map((workLog) => ({
    kind: "workLog",
    sortDateKey: workLog.date,
    workLog,
  }));
  const eventItems: MemoFeedItem[] = getProjectEvents(state, activeProject.id).map((event) => ({
    kind: "event",
    sortDateKey: event.endDate ?? event.startDate,
    event,
  }));
  const taskItems: MemoFeedItem[] = activeProject.tasks.map((task) => ({
    kind: "task",
    sortDateKey: task.dueDate,
    task,
  }));

  return [...workLogItems, ...eventItems, ...taskItems].sort(compareMemoItems);
}

function getMemoFeedVisibility(memoItems: MemoFeedItem[], showFutureItems: boolean, showPastItems: boolean): {
  visibleItems: MemoFeedItem[];
  futureHiddenCount: number;
  pastHiddenCount: number;
} {
  return splitFeedByWindow(
    memoItems,
    getMemoItemDateRange,
    getMemoItemKey,
    showFutureItems,
    showPastItems,
    DEFAULT_VISIBLE_MEMO_COUNT,
  );
}

function createMemoMoreButton({
  visibleCount,
  totalCount,
  expanded,
  label,
  collapseLabel,
  onToggle,
}: {
  visibleCount: number;
  totalCount: number;
  expanded: boolean;
  label: string;
  collapseLabel?: string;
  onToggle: () => void;
}): HTMLButtonElement {
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

function shouldShowMemoMoreButton(visibleCount: number, totalCount: number, showAll: boolean): boolean {
  return visibleCount !== totalCount || (showAll && totalCount > 0);
}

function appendMemoMoreButton(
  visibleCount: number,
  totalCount: number,
  expanded: boolean,
  label: string,
  onToggle: () => void,
  collapseLabel?: string,
): void {
  projectWorkLogList.append(
    createMemoMoreButton({
      visibleCount,
      totalCount,
      expanded,
      label,
      collapseLabel,
      onToggle,
    }),
  );
}

export function renderProjectMemoView({
  state,
  activeProject,
  onSelectWorkLog,
  onSelectEvent,
  onSelectTask,
  onAddEvent,
  showFutureItems,
  showPastItems,
  onToggleFutureItems,
  onTogglePastItems,
}: ProjectMemoViewParams): void {
  projectWorkLogList.innerHTML = "";

  if (!activeProject) {
    projectWorkLogCard.hidden = true;
    projectWorkLogEmpty.hidden = true;
    addProjectEventButton.disabled = true;
    return;
  }

  const memoItems = getMemoFeedItems(state, activeProject);
  const { visibleItems, futureHiddenCount, pastHiddenCount } = getMemoFeedVisibility(
    memoItems,
    showFutureItems,
    showPastItems,
  );
  projectWorkLogCard.hidden = false;
  projectWorkLogEmpty.hidden = memoItems.length > 0;
  addProjectEventButton.disabled = false;
  addProjectEventButton.onclick = onAddEvent;

  const visibleCount = visibleItems.length;
  if (shouldShowMemoMoreButton(visibleCount, visibleCount + futureHiddenCount, showFutureItems)) {
    appendMemoMoreButton(
      visibleCount,
      visibleCount + futureHiddenCount,
      showFutureItems,
      "최신 피드 더보기",
      () => {
        onToggleFutureItems(!showFutureItems);
      },
      "최신 피드 접기",
    );
  }

  visibleItems.forEach((item) => {
    if (item.kind === "workLog") {
      projectWorkLogList.append(
        createMemoWorkLogCard(activeProject, item.workLog, () => {
          onSelectWorkLog(item.workLog.id);
        }),
      );
      return;
    }

    if (item.kind === "task") {
      projectWorkLogList.append(
        createMemoTaskCard(activeProject, item.task, () => {
          onSelectTask(item.task.id);
        }),
      );
      return;
    }

    projectWorkLogList.append(
      createMemoEventCard(activeProject, item.event, () => {
        onSelectEvent(item.event.id);
      }),
    );
  });

  if (shouldShowMemoMoreButton(visibleCount, visibleCount + pastHiddenCount, showPastItems)) {
    appendMemoMoreButton(visibleCount, visibleCount + pastHiddenCount, showPastItems, "과거 피드 더보기", () => {
      onTogglePastItems(!showPastItems);
    });
  }
}
