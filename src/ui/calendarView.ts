import type { CalendarRangePreferences } from "../state/calendarPreferences";
import { normalizeCalendarRangePreferences } from "../state/calendarPreferences";
import type { AppState, ProjectEvent } from "../types";
import { getMonthGridDates, toDateKey } from "../utils/calendar";
import {
  calendarAddEventButton,
  calendarColumnSelect,
  calendarEmptyState,
  calendarEndMonthSelect,
  calendarFilterList,
  calendarGrid,
  calendarRangeControls,
  calendarSettingsBackdrop,
  calendarSettingsButton,
  calendarSettingsCloseButton,
  calendarSettingsPanel,
  calendarStartMonthSelect,
  toggleAllProjectsButton,
} from "./dom";

type CalendarTask = {
  projectId: string;
  taskId: string;
  dueDate: string;
  clientName: string;
  projectName: string;
  title: string;
  completed: boolean;
  color: string;
};

type CalendarEvent = ProjectEvent & {
  clientName: string;
  projectName: string;
  color: string;
};

type CalendarRangeCard = {
  id: string;
  highlightKey: string;
  title: string;
  clientName: string;
  projectName: string;
  color: string;
  completed?: boolean;
  startIndex: number;
  endIndex: number;
  labelIndex: number;
  originalStartDate: string;
  startsAtRangeStart: boolean;
  onSelect: () => void;
};

type CalendarRangeCardWithLane = CalendarRangeCard & {
  lane: number;
};

type CalendarViewOptions = {
  selectedProjectIds: Set<string>;
  calendarRangePreferences: CalendarRangePreferences;
  onSelectedProjectIdsChange: (selectedProjectIds: Set<string>) => void;
  onCalendarRangePreferencesChange: (preferences: CalendarRangePreferences) => void;
  onTaskSelect: (task: CalendarTask) => void;
  onEventSelect: (eventId: string) => void;
  onAddEvent: () => void;
  isSettingsOpen: boolean;
  onToggleSettings: (open: boolean) => void;
};

const RANGE_CALENDAR_YEAR = 2026;
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}`);
const MAX_VISIBLE_CALENDAR_CARDS = 3;
const MORE_CARD_LANE = MAX_VISIBLE_CALENDAR_CARDS;

function getDueTasksByDate(state: AppState, selectedProjectIds: Set<string>): Map<string, CalendarTask[]> {
  const dueTasksByDate = new Map<string, CalendarTask[]>();

  state.projects.forEach((project) => {
    if (!selectedProjectIds.has(project.id)) {
      return;
    }

    project.tasks.forEach((task) => {
      if (!task.dueDate) {
        return;
      }

      const items = dueTasksByDate.get(task.dueDate) ?? [];
      items.push({
        projectId: project.id,
        taskId: task.id,
        dueDate: task.dueDate,
        clientName: project.clientName,
        projectName: project.name,
        title: task.title,
        completed: task.completed,
        color: project.color,
      });
      dueTasksByDate.set(task.dueDate, items);
    });
  });

  return dueTasksByDate;
}

function getCalendarEvents(state: AppState, selectedProjectIds: Set<string>): CalendarEvent[] {
  const projectById = new Map(state.projects.map((project) => [project.id, project]));

  return state.events.flatMap((event) => {
    const project = projectById.get(event.projectId);
    if (!project || !selectedProjectIds.has(project.id)) {
      return [];
    }

    return [{
      ...event,
      clientName: project.clientName,
      projectName: project.name,
      color: project.color,
    }];
  });
}

function clampDateKey(dateKey: string, minKey: string, maxKey: string): string {
  if (dateKey < minKey) {
    return minKey;
  }

  if (dateKey > maxKey) {
    return maxKey;
  }

  return dateKey;
}

function createCalendarCardMeta(clientName: string, projectName: string): HTMLElement {
  const meta = document.createElement("div");
  meta.className = "calendar-item-meta";
  if (clientName) {
    const client = document.createElement("span");
    client.className = "calendar-client-chip";
    client.textContent = clientName;
    meta.append(client);
  }

  const project = document.createElement("span");
  project.className = "calendar-project-name";
  project.textContent = projectName;
  meta.append(project);
  return meta;
}

function createCalendarRangeCard(card: CalendarRangeCard, hasLabel: boolean): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "calendar-range-card";
  element.dataset.calendarCardKey = card.highlightKey;
  element.classList.toggle("completed", Boolean(card.completed));
  element.classList.toggle("starts-at-range-start", card.startsAtRangeStart);
  element.style.setProperty("--project-color", card.color);
  element.setAttribute("aria-label", `${card.title} ${card.clientName} ${card.projectName}`.trim());

  if (hasLabel) {
    const content = document.createElement("div");
    content.className = "calendar-range-card-content";
    const title = document.createElement("strong");
    title.textContent = card.title;
    content.append(title, createCalendarCardMeta(card.clientName, card.projectName));
    element.append(content);
  }

  element.addEventListener("click", (clickEvent) => {
    clickEvent.stopPropagation();
    card.onSelect();
  });
  element.addEventListener("pointerenter", () => {
    setCalendarCardHighlighted(card.highlightKey, true);
  });
  element.addEventListener("pointerleave", () => {
    setCalendarCardHighlighted(card.highlightKey, false);
  });
  element.addEventListener("focus", () => {
    setCalendarCardHighlighted(card.highlightKey, true);
  });
  element.addEventListener("blur", () => {
    setCalendarCardHighlighted(card.highlightKey, false);
  });

  return element;
}

function createCalendarMoreCard(hiddenCount: number): HTMLElement {
  const element = document.createElement("div");
  element.className = "calendar-range-card calendar-range-more-card";
  element.textContent = `+${hiddenCount} more`;
  element.setAttribute("aria-label", `${hiddenCount} more calendar items`);
  return element;
}

function setCalendarCardHighlighted(highlightKey: string, isHighlighted: boolean): void {
  document.querySelectorAll<HTMLElement>(".calendar-range-card").forEach((card) => {
    if (card.dataset.calendarCardKey === highlightKey) {
      card.classList.toggle("highlighted", isHighlighted);
    }
  });
}

function doCardsOverlap(left: CalendarRangeCard, right: CalendarRangeCard): boolean {
  return left.startIndex <= right.endIndex && right.startIndex <= left.endIndex;
}

function assignCalendarCardLanes(cards: CalendarRangeCard[]): CalendarRangeCardWithLane[] {
  const laneCards: CalendarRangeCard[][] = [];

  return cards.map((card) => {
    let lane = laneCards.findIndex((items) => items.every((item) => !doCardsOverlap(item, card)));
    if (lane < 0) {
      lane = laneCards.length;
      laneCards.push([]);
    }

    laneCards[lane].push(card);
    return { ...card, lane };
  });
}

function countHiddenCardsByDay(cards: CalendarRangeCardWithLane[]): Map<number, number> {
  const hiddenCounts = new Map<number, number>();

  cards
    .filter((card) => card.lane >= MAX_VISIBLE_CALENDAR_CARDS)
    .forEach((card) => {
      for (let index = card.startIndex; index <= card.endIndex; index += 1) {
        hiddenCounts.set(index, (hiddenCounts.get(index) ?? 0) + 1);
      }
    });

  return hiddenCounts;
}

function appendRangeCardsToWeekRow({
  week,
  gridDates,
  dueTasksByDate,
  events,
  weekRow,
  onTaskSelect,
  onEventSelect,
}: {
  week: number;
  gridDates: Date[];
  dueTasksByDate: Map<string, CalendarTask[]>;
  events: CalendarEvent[];
  weekRow: HTMLElement;
  onTaskSelect: (task: CalendarTask) => void;
  onEventSelect: (eventId: string) => void;
}): number {
  const firstKey = toDateKey(gridDates[0]);
  const lastKey = toDateKey(gridDates[gridDates.length - 1]);
  const weekStartIndex = week * 7;
  const weekEndIndex = weekStartIndex + 6;
  const cards: CalendarRangeCard[] = [];

  events
    .filter((event) => event.startDate <= lastKey && (event.endDate ?? event.startDate) >= firstKey)
    .forEach((event) => {
      const startKey = clampDateKey(event.startDate, firstKey, lastKey);
      const endKey = clampDateKey(event.endDate ?? event.startDate, firstKey, lastKey);
      const startIndex = gridDates.findIndex((date) => toDateKey(date) === startKey);
      const endIndex = gridDates.findIndex((date) => toDateKey(date) === endKey);
      if (startIndex < 0 || endIndex < 0) {
        return;
      }

      const labelIndex = Math.floor((startIndex + endIndex) / 2);
      if (endIndex < weekStartIndex || startIndex > weekEndIndex) {
        return;
      }

      const segmentStartIndex = Math.max(startIndex, weekStartIndex);
      const segmentEndIndex = Math.min(endIndex, weekEndIndex);
      cards.push({
        id: event.id,
        highlightKey: `event:${event.id}`,
        title: event.title,
        clientName: event.clientName,
        projectName: event.projectName,
        color: event.color,
        startIndex: segmentStartIndex,
        endIndex: segmentEndIndex,
        labelIndex,
        originalStartDate: event.startDate,
        startsAtRangeStart: toDateKey(gridDates[segmentStartIndex]) === event.startDate,
        onSelect: () => onEventSelect(event.id),
      });
    });

  for (let index = weekStartIndex; index <= weekEndIndex; index += 1) {
    const dateKey = toDateKey(gridDates[index]);
    const tasks = dueTasksByDate.get(dateKey) ?? [];
    tasks.forEach((task) => {
      cards.push({
        id: task.taskId,
        highlightKey: `task:${task.taskId}`,
        title: task.title,
        clientName: task.clientName,
        projectName: task.projectName,
        color: task.color,
        completed: task.completed,
        startIndex: index,
        endIndex: index,
        labelIndex: index,
        originalStartDate: task.dueDate,
        startsAtRangeStart: true,
        onSelect: () => onTaskSelect(task),
      });
    });
  }

  const sortedCards = cards
    .sort((left, right) => {
      const startDiff = left.startIndex - right.startIndex;
      if (startDiff !== 0) {
        return startDiff;
      }

      const originalStartDiff = left.originalStartDate.localeCompare(right.originalStartDate);
      if (originalStartDiff !== 0) {
        return originalStartDiff;
      }

      const leftDuration = left.endIndex - left.startIndex;
      const rightDuration = right.endIndex - right.startIndex;
      if (leftDuration !== rightDuration) {
        return rightDuration - leftDuration;
      }

      return left.title.localeCompare(right.title);
    });
  const cardsWithLane = assignCalendarCardLanes(sortedCards);
  const laneCount = Math.min(
    cardsWithLane.reduce((maxLane, card) => Math.max(maxLane, card.lane + 1), 0),
    MORE_CARD_LANE + 1,
  );
  const hiddenCounts = countHiddenCardsByDay(cardsWithLane);

  cardsWithLane
    .filter((card) => card.lane < MAX_VISIBLE_CALENDAR_CARDS)
    .forEach((card) => {
      const element = createCalendarRangeCard(
        card,
        card.labelIndex >= card.startIndex && card.labelIndex <= card.endIndex,
      );
      element.style.gridColumn = `${(card.startIndex % 7) + 1} / ${(card.endIndex % 7) + 2}`;
      element.style.gridRow = "1";
      element.style.setProperty("--calendar-card-lane", String(card.lane));
      element.style.setProperty("--calendar-card-days", String(card.endIndex - card.startIndex + 1));
      element.style.setProperty("--calendar-card-label-column", String(card.labelIndex - card.startIndex + 1));
      weekRow.append(element);
    });

  hiddenCounts.forEach((hiddenCount, dayIndex) => {
    const element = createCalendarMoreCard(hiddenCount);
    element.style.gridColumn = `${(dayIndex % 7) + 1} / ${(dayIndex % 7) + 2}`;
    element.style.gridRow = "1";
    element.style.setProperty("--calendar-card-lane", String(MORE_CARD_LANE));
    element.style.setProperty("--calendar-card-days", "1");
    element.style.setProperty("--calendar-card-label-column", "1");
    weekRow.append(element);
  });

  weekRow.style.setProperty("--calendar-card-lanes", String(laneCount));
  return cards.length;
}

function appendMonthGrid({
  monthDate,
  dueTasksByDate,
  events,
  container,
  onTaskSelect,
  onEventSelect,
}: {
  monthDate: Date;
  dueTasksByDate: Map<string, CalendarTask[]>;
  events: CalendarEvent[];
  container: HTMLElement;
  onTaskSelect: (task: CalendarTask) => void;
  onEventSelect: (eventId: string) => void;
}): number {
  let itemCount = 0;
  const todayKey = toDateKey(new Date());
  const gridDates = getMonthGridDates(monthDate);

  for (let week = 0; week < 6; week += 1) {
    const weekRow = document.createElement("div");
    weekRow.className = "calendar-week-row";
    itemCount += appendRangeCardsToWeekRow({
      week,
      gridDates,
      dueTasksByDate,
      events,
      weekRow,
      onTaskSelect,
      onEventSelect,
    });

    for (let day = 0; day < 7; day += 1) {
      const index = week * 7 + day;
      const date = gridDates[index];
      const dateKey = toDateKey(date);
      const isOutsideMonth = date.getMonth() !== monthDate.getMonth();
      const cell = document.createElement("section");
      cell.className = "calendar-cell";
      cell.style.gridColumn = String(day + 1);
      cell.style.gridRow = "1";
      cell.classList.toggle("outside-month", isOutsideMonth);
      cell.classList.toggle("today", dateKey === todayKey && !isOutsideMonth);

      const dateLabel = document.createElement("p");
      dateLabel.className = "calendar-date";
      dateLabel.textContent = String(date.getDate());
      cell.append(dateLabel);

      weekRow.append(cell);
    }

    container.append(weekRow);
  }
  return itemCount;
}

function appendWeekdays(container: HTMLElement): void {
  const weekdays = document.createElement("div");
  weekdays.className = "calendar-weekdays month-weekdays";
  weekdays.setAttribute("aria-hidden", "true");
  weekdays.innerHTML = `
    <span>Sun</span>
    <span>Mon</span>
    <span>Tue</span>
    <span>Wed</span>
    <span>Thu</span>
    <span>Fri</span>
    <span>Sat</span>
  `;
  container.append(weekdays);
}

function renderRangeCalendar(
  dueTasksByDate: Map<string, CalendarTask[]>,
  events: CalendarEvent[],
  preferences: CalendarRangePreferences,
  onTaskSelect: (task: CalendarTask) => void,
  onEventSelect: (eventId: string) => void,
): number {
  calendarGrid.className = "calendar-range-grid";
  calendarGrid.style.setProperty("--calendar-range-columns", String(preferences.columns));
  let itemCount = 0;

  for (let month = preferences.startMonth; month <= preferences.endMonth; month += 1) {
    const monthSection = document.createElement("section");
    monthSection.className = "calendar-month-panel";

    const monthHeader = document.createElement("div");
    monthHeader.className = "calendar-month-header";

    const monthTitle = document.createElement("h3");
    monthTitle.textContent = `${RANGE_CALENDAR_YEAR}.${String(month).padStart(2, "0")}`;

    monthHeader.append(monthTitle);
    monthSection.append(monthHeader);
    appendWeekdays(monthSection);

    const monthGrid = document.createElement("div");
    monthGrid.className = "calendar-grid compact-calendar-grid";
    itemCount += appendMonthGrid({
      monthDate: new Date(RANGE_CALENDAR_YEAR, month - 1, 1),
      dueTasksByDate,
      events,
      container: monthGrid,
      onTaskSelect,
      onEventSelect,
    });
    monthSection.append(monthGrid);

    calendarGrid.append(monthSection);
  }

  return itemCount;
}

function renderCalendarFilters(
  state: AppState,
  selectedProjectIds: Set<string>,
  onSelectedProjectIdsChange: (selectedProjectIds: Set<string>) => void,
): void {
  calendarFilterList.innerHTML = "";

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
    calendarFilterList.append(label);
  });

  const allSelected = state.projects.length > 0 && selectedProjectIds.size === state.projects.length;
  toggleAllProjectsButton.textContent = allSelected ? "Clear all" : "Select all";
}

function renderMonthOptions(preferences: CalendarRangePreferences): void {
  calendarStartMonthSelect.innerHTML = "";
  calendarEndMonthSelect.innerHTML = "";

  MONTH_LABELS.forEach((label, index) => {
    const month = index + 1;
    calendarStartMonthSelect.append(new Option(label, String(month)));
    calendarEndMonthSelect.append(new Option(label, String(month)));
  });

  calendarStartMonthSelect.value = String(preferences.startMonth);
  calendarEndMonthSelect.value = String(preferences.endMonth);
}

function renderColumnOptions(preferences: CalendarRangePreferences): void {
  const monthCount = preferences.endMonth - preferences.startMonth + 1;
  const maxColumns = Math.min(4, monthCount);
  calendarColumnSelect.innerHTML = "";

  for (let columns = 1; columns <= maxColumns; columns += 1) {
    calendarColumnSelect.append(new Option(String(columns), String(columns)));
  }

  calendarColumnSelect.value = String(preferences.columns);
}

function renderRangeControls(preferences: CalendarRangePreferences): void {
  renderMonthOptions(preferences);
  renderColumnOptions(preferences);
}

function renderSettingsPanel(isOpen: boolean, onToggleSettings: (open: boolean) => void): void {
  calendarSettingsPanel.hidden = !isOpen;
  calendarSettingsPanel.setAttribute("aria-hidden", String(!isOpen));
  calendarSettingsPanel.classList.toggle("is-open", isOpen);
  calendarSettingsBackdrop.hidden = !isOpen;
  calendarSettingsButton.setAttribute("aria-expanded", String(isOpen));

  calendarSettingsButton.onclick = () => onToggleSettings(!isOpen);
  calendarSettingsCloseButton.onclick = () => onToggleSettings(false);
  calendarSettingsBackdrop.onclick = () => onToggleSettings(false);
}

export function renderCalendarView(state: AppState, options: CalendarViewOptions): void {
  const preferences = normalizeCalendarRangePreferences(options.calendarRangePreferences);
  options.onCalendarRangePreferencesChange(preferences);
  renderRangeControls(preferences);
  renderCalendarFilters(state, options.selectedProjectIds, options.onSelectedProjectIdsChange);
  calendarAddEventButton.disabled = state.projects.length === 0;
  calendarAddEventButton.onclick = options.onAddEvent;
  renderSettingsPanel(options.isSettingsOpen, options.onToggleSettings);

  const dueTasksByDate = getDueTasksByDate(state, options.selectedProjectIds);
  const events = getCalendarEvents(state, options.selectedProjectIds);
  calendarGrid.innerHTML = "";
  calendarRangeControls.hidden = false;
  const itemCount = renderRangeCalendar(
    dueTasksByDate,
    events,
    preferences,
    options.onTaskSelect,
    options.onEventSelect,
  );

  calendarEmptyState.hidden = itemCount > 0;
}
