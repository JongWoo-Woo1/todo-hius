import {
  getDeletedTaskByProject,
  getLinkedTaskDisplay,
  getProjectEvents,
  getProjectWorkLogs,
  getTaskByProject,
} from "../state/selectors";
import type { AppState, Project, ProjectEvent, WorkLog } from "../types";
import { formatDisplayDate } from "../utils/calendar";
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
  onAddEvent: () => void;
};

type MemoFeedItem =
  | { kind: "workLog"; dateKey: string; workLog: WorkLog }
  | { kind: "event"; dateKey: string; event: ProjectEvent };

function getContentPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157)}...`;
}

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
  badge.textContent = "Weekly Log";

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

  const content = document.createElement("p");
  content.className = "project-memo-content";
  content.textContent = getContentPreview(workLog.content) || "내용 없음";

  card.addEventListener("click", onSelect);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  });

  card.append(header, meta, content);
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
  meta.textContent = linkedTaskLabel ?? "Event";

  const content = document.createElement("p");
  content.className = "project-memo-content";
  content.textContent = getContentPreview(event.content) || "내용 없음";

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

function getMemoFeedItems(state: AppState, activeProject: Project): MemoFeedItem[] {
  const workLogItems: MemoFeedItem[] = getProjectWorkLogs(state, activeProject.id).map((workLog) => ({
    kind: "workLog",
    dateKey: workLog.date,
    workLog,
  }));
  const eventItems: MemoFeedItem[] = getProjectEvents(state, activeProject.id).map((event) => ({
    kind: "event",
    dateKey: event.endDate ?? event.startDate,
    event,
  }));

  return [...workLogItems, ...eventItems].sort((left, right) => right.dateKey.localeCompare(left.dateKey));
}

export function renderProjectMemoView({ state, activeProject, onSelectWorkLog, onSelectEvent, onAddEvent }: ProjectMemoViewParams): void {
  projectWorkLogList.innerHTML = "";

  if (!activeProject) {
    projectWorkLogCard.hidden = true;
    projectWorkLogEmpty.hidden = true;
    addProjectEventButton.disabled = true;
    return;
  }

  const memoItems = getMemoFeedItems(state, activeProject);
  projectWorkLogCard.hidden = false;
  projectWorkLogEmpty.hidden = memoItems.length > 0;
  addProjectEventButton.disabled = false;
  addProjectEventButton.onclick = onAddEvent;

  memoItems.forEach((item) => {
    if (item.kind === "workLog") {
      projectWorkLogList.append(
        createMemoWorkLogCard(activeProject, item.workLog, () => {
          onSelectWorkLog(item.workLog.id);
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
}
