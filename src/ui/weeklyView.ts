import { getLinkedTaskDisplay, getProjectById } from "../state/selectors";
import type { AppState, WorkLog, WorkLogType } from "../types";
import { formatDisplayDate, toDateKey } from "../utils/calendar";
import { getWeekRangeLabel, getWeekdays } from "../utils/week";
import { weeklyEmptyState, weeklyGrid, weeklyRangeLabel } from "./dom";

type WeeklyItem = {
  id: string;
  projectId: string;
  taskId?: string;
  clientName: string;
  projectName: string;
  taskTitle?: string;
  content: string;
  color: string;
};

type WeeklyViewOptions = {
  onSelectWorkLog: (workLogId: string) => void;
  onAddWorkLog: (date: string, type: WorkLogType) => void;
};

const WEEKLY_SECTIONS = [
  { key: "plan", title: "업무 계획", workLogType: "계획" },
  { key: "done", title: "업무 일지", workLogType: "수행" },
] as const;

function createWeeklyBuckets(visibleWeekDate: Date): Map<string, Record<(typeof WEEKLY_SECTIONS)[number]["key"], WeeklyItem[]>> {
  const buckets = new Map<string, Record<(typeof WEEKLY_SECTIONS)[number]["key"], WeeklyItem[]>>();

  getWeekdays(visibleWeekDate).forEach((date) => {
    buckets.set(toDateKey(date), {
      plan: [],
      done: [],
    });
  });

  return buckets;
}

function getWorkLogBucketKeys(
  workLog: WorkLog,
  buckets: Map<string, Record<(typeof WEEKLY_SECTIONS)[number]["key"], WeeklyItem[]>>,
): string[] {
  if (workLog.type !== "계획" || !workLog.endDate) {
    return buckets.has(workLog.date) ? [workLog.date] : [];
  }

  return Array.from(buckets.keys()).filter((dateKey) => workLog.date <= dateKey && dateKey <= workLog.endDate!);
}

function getLinkedTaskTitle(workLog: WorkLog, linkedTaskDisplay: ReturnType<typeof getLinkedTaskDisplay>): string | undefined {
  if (linkedTaskDisplay.activeTask || linkedTaskDisplay.deletedTask || workLog.linkedTaskTitleSnapshot) {
    return linkedTaskDisplay.label;
  }

  return undefined;
}

function makeActivatable(element: HTMLElement, activate: () => void): void {
  element.classList.add("clickable");
  element.setAttribute("role", "button");
  element.tabIndex = 0;
  element.addEventListener("click", activate);
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });
}

function renderWeeklyProjectGroup(groupItems: WeeklyItem[], options: WeeklyViewOptions): HTMLElement {
  const firstItem = groupItems[0];
  const isSingle = groupItems.length === 1;

  const group = document.createElement("div");
  group.className = "weekly-project-group";
  group.style.setProperty("--project-color", firstItem.color);

  if (isSingle) {
    makeActivatable(group, () => options.onSelectWorkLog(firstItem.id));
  }

  const meta = document.createElement("div");
  meta.className = "weekly-item-meta";
  const client = document.createElement("span");
  client.className = "weekly-client-chip";
  client.textContent = firstItem.clientName || "No client";
  const projectName = document.createElement("span");
  projectName.className = "weekly-project-name";
  projectName.textContent = firstItem.projectName;
  meta.append(client, projectName);
  group.append(meta);

  groupItems.forEach((item) => {
    const entry = document.createElement("div");
    entry.className = "weekly-group-entry";

    if (!isSingle) {
      makeActivatable(entry, () => options.onSelectWorkLog(item.id));
    }

    if (item.taskTitle) {
      const linked = document.createElement("p");
      linked.className = "weekly-linked-title";
      linked.textContent = item.taskTitle;
      entry.append(linked);
    }

    if (item.content) {
      const content = document.createElement("p");
      content.className = "weekly-item-content";
      content.textContent = item.content;
      entry.append(content);
    }

    group.append(entry);
  });

  return group;
}

function renderWeeklyItems(items: WeeklyItem[], options: WeeklyViewOptions): HTMLElement {
  const body = document.createElement("div");
  body.className = "weekly-table-cell-body";

  const groupMap = new Map<string, WeeklyItem[]>();
  items.forEach((item) => {
    if (!groupMap.has(item.projectId)) groupMap.set(item.projectId, []);
    groupMap.get(item.projectId)!.push(item);
  });

  groupMap.forEach((groupItems) => {
    body.append(renderWeeklyProjectGroup(groupItems, options));
  });

  return body;
}

export function renderWeeklyView(state: AppState, visibleWeekDate: Date, options: WeeklyViewOptions): void {
  weeklyRangeLabel.textContent = getWeekRangeLabel(visibleWeekDate);
  weeklyGrid.innerHTML = "";

  const buckets = createWeeklyBuckets(visibleWeekDate);

  state.workLogs.forEach((workLog) => {
    const bucketKeys = getWorkLogBucketKeys(workLog, buckets);
    if (bucketKeys.length === 0) {
      return;
    }

    const project = getProjectById(state, workLog.projectId);
    const linkedTaskDisplay = getLinkedTaskDisplay(project, workLog);
    const clientName = project?.clientName ?? "";
    const projectName = project?.name ?? "Unknown";
    const color = project?.color ?? "#94a3b8";
    const item: WeeklyItem = {
      id: workLog.id,
      projectId: workLog.projectId,
      taskId: workLog.taskId,
      clientName,
      projectName,
      taskTitle: getLinkedTaskTitle(workLog, linkedTaskDisplay),
      content: workLog.content,
      color,
    };

    bucketKeys.forEach((bucketKey) => {
      const bucket = buckets.get(bucketKey)!;
      if (workLog.type === "계획") {
        bucket.plan.push(item);
      } else if (workLog.type === "수행") {
        bucket.done.push(item);
      }
    });
  });

  const weekdays = getWeekdays(visibleWeekDate);
  const table = document.createElement("table");
  table.className = "weekly-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const sectionHeader = document.createElement("th");
  sectionHeader.scope = "col";
  sectionHeader.textContent = "구분";
  headerRow.append(sectionHeader);

  weekdays.forEach((date) => {
    const dateKey = toDateKey(date);
    const th = document.createElement("th");
    th.scope = "col";
    th.innerHTML = `
      <span>${date.toLocaleDateString("en-US", { weekday: "short" })}</span>
      <strong>${formatDisplayDate(dateKey)}</strong>
    `;
    headerRow.append(th);
  });

  thead.append(headerRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  WEEKLY_SECTIONS.forEach((section) => {
    const row = document.createElement("tr");
    row.dataset.weeklySection = section.key;

    const rowHeader = document.createElement("th");
    rowHeader.scope = "row";
    rowHeader.textContent = section.title;
    row.append(rowHeader);

    weekdays.forEach((date) => {
      const dateKey = toDateKey(date);
      const dayBuckets = buckets.get(dateKey)!;
      const cell = document.createElement("td");
      const body = renderWeeklyItems(dayBuckets[section.key], options);

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "weekly-cell-add";
      addButton.textContent = "+";
      addButton.setAttribute("aria-label", "기록 추가");
      addButton.addEventListener("click", () => options.onAddWorkLog(dateKey, section.workLogType));
      body.append(addButton);

      cell.append(body);
      row.append(cell);
    });

    tbody.append(row);
  });
  table.append(tbody);
  weeklyGrid.append(table);

  weeklyEmptyState.hidden = true;
}
