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

// A work log laid out as a bar spanning weekday columns of the visible week.
// "수행" logs are single-day (startCol === endCol); "계획" logs may span a range.
type WeeklyBar = WeeklyItem & {
  startCol: number;
  endCol: number;
  lane: number;
};

type WeeklyViewOptions = {
  onSelectWorkLog: (workLogId: string) => void;
  onAddWorkLog: (date: string, type: WorkLogType) => void;
};

const WEEKLY_SECTIONS = [
  { key: "plan", title: "업무 계획", type: "계획" },
  { key: "done", title: "업무 일지", type: "수행" },
] as const satisfies readonly { key: string; title: string; type: WorkLogType }[];

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

function toWeeklyItem(state: AppState, workLog: WorkLog): WeeklyItem {
  const project = getProjectById(state, workLog.projectId);
  const linkedTaskDisplay = getLinkedTaskDisplay(project, workLog);
  const hasLinkedTask = Boolean(
    linkedTaskDisplay.activeTask || linkedTaskDisplay.deletedTask || workLog.linkedTaskTitleSnapshot,
  );

  return {
    id: workLog.id,
    projectId: workLog.projectId,
    taskId: workLog.taskId,
    clientName: project?.clientName ?? "",
    projectName: project?.name ?? "Unknown",
    taskTitle: hasLinkedTask ? linkedTaskDisplay.label : undefined,
    content: workLog.content,
    color: project?.color ?? "#94a3b8",
  };
}

// Shared card used by both the "계획" and "일지" rows. The only difference
// between the two rows is the column span of the card (see createBar).
function createWeeklyCard(item: WeeklyItem, options: WeeklyViewOptions): HTMLElement {
  const card = document.createElement("div");
  card.className = "weekly-card";
  card.style.setProperty("--project-color", item.color);
  makeActivatable(card, () => options.onSelectWorkLog(item.id));

  const meta = document.createElement("div");
  meta.className = "weekly-item-meta";
  const client = document.createElement("span");
  client.className = "weekly-client-chip";
  client.textContent = item.clientName || "No client";
  const projectName = document.createElement("span");
  projectName.className = "weekly-project-name";
  projectName.textContent = item.projectName;
  meta.append(client, projectName);
  card.append(meta);

  if (item.taskTitle) {
    const linked = document.createElement("p");
    linked.className = "weekly-linked-title";
    linked.textContent = item.taskTitle;
    card.append(linked);
  }

  if (item.content) {
    const content = document.createElement("p");
    content.className = "weekly-item-content";
    content.textContent = item.content;
    card.append(content);
  }

  return card;
}

// Lays each log out as a bar over the weekday columns of the visible week.
// Single-day logs ("수행", or "계획" without an endDate) span one column.
function computeSectionBars(state: AppState, logs: WorkLog[], weekdayKeys: string[]): WeeklyBar[] {
  const bars: WeeklyBar[] = [];
  logs.forEach((workLog) => {
    const start = workLog.date;
    const end = workLog.endDate && workLog.endDate > workLog.date ? workLog.endDate : workLog.date;

    let startCol = -1;
    let endCol = -1;
    weekdayKeys.forEach((key, index) => {
      if (key >= start && key <= end) {
        if (startCol === -1) {
          startCol = index;
        }
        endCol = index;
      }
    });

    if (startCol === -1) {
      return; // range does not touch any weekday of the visible week
    }

    bars.push({ ...toWeeklyItem(state, workLog), startCol, endCol, lane: 0 });
  });

  bars.sort((left, right) => left.startCol - right.startCol || left.endCol - right.endCol);

  // Greedy lane assignment so overlapping bars stack vertically.
  const laneEndCols: number[] = [];
  bars.forEach((bar) => {
    let lane = laneEndCols.findIndex((endCol) => endCol < bar.startCol);
    if (lane === -1) {
      lane = laneEndCols.length;
    }
    laneEndCols[lane] = bar.endCol;
    bar.lane = lane;
  });

  return bars;
}

function createBar(bar: WeeklyBar, options: WeeklyViewOptions): HTMLElement {
  const card = createWeeklyCard(bar, options);
  card.classList.add("weekly-bar");
  card.style.gridColumn = `${bar.startCol + 1} / ${bar.endCol + 2}`;
  card.style.gridRow = String(bar.lane + 1);
  return card;
}

// Renders one section row's cell: the spanning bars plus the per-day "+" add
// buttons. Used identically for both the "계획" and "일지" rows.
function renderSectionCell(
  bars: WeeklyBar[],
  weekdayKeys: string[],
  type: WorkLogType,
  options: WeeklyViewOptions,
): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.colSpan = weekdayKeys.length;
  cell.className = "weekly-section-cell";

  // Background layer: per-day vertical separators.
  const dayColumns = document.createElement("div");
  dayColumns.className = "weekly-section-daycols";
  weekdayKeys.forEach(() => {
    const dayColumn = document.createElement("div");
    dayColumn.className = "weekly-section-daycol";
    dayColumns.append(dayColumn);
  });

  // Foreground layer: bars on top, with per-day "+" add buttons at the bottom.
  const body = document.createElement("div");
  body.className = "weekly-section-body";

  const grid = document.createElement("div");
  grid.className = "weekly-section-grid";
  bars.forEach((bar) => grid.append(createBar(bar, options)));

  const addRow = document.createElement("div");
  addRow.className = "weekly-section-add-row";
  weekdayKeys.forEach((dateKey) => {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "weekly-cell-add";
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", "기록 추가");
    addButton.addEventListener("click", () => options.onAddWorkLog(dateKey, type));
    addRow.append(addButton);
  });

  body.append(grid, addRow);
  cell.append(dayColumns, body);
  return cell;
}

export function renderWeeklyView(state: AppState, visibleWeekDate: Date, options: WeeklyViewOptions): void {
  weeklyRangeLabel.textContent = getWeekRangeLabel(visibleWeekDate);
  weeklyGrid.innerHTML = "";

  const weekdays = getWeekdays(visibleWeekDate);
  const weekdayKeys = weekdays.map((date) => toDateKey(date));

  const logsByType = new Map<WorkLogType, WorkLog[]>([
    ["계획", []],
    ["수행", []],
  ]);
  state.workLogs.forEach((workLog) => {
    logsByType.get(workLog.type)?.push(workLog);
  });

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

    const bars = computeSectionBars(state, logsByType.get(section.type) ?? [], weekdayKeys);
    row.append(renderSectionCell(bars, weekdayKeys, section.type, options));
    tbody.append(row);
  });

  table.append(tbody);
  weeklyGrid.append(table);

  weeklyEmptyState.hidden = true;
}
