import type { CalendarRangePreferences } from "../state/calendarPreferences";
import { normalizeCalendarRangePreferences } from "../state/calendarPreferences";
import type { AppState } from "../types";
import { getMonthGridDates, toDateKey } from "../utils/calendar";
import {
  calendarColumnSelect,
  calendarEmptyState,
  calendarEndMonthSelect,
  calendarFilterList,
  calendarGrid,
  calendarMonthLabel,
  calendarRangeControls,
  calendarStartMonthSelect,
  toggleAllProjectsButton,
} from "./dom";

type CalendarTask = {
  projectId: string;
  taskId: string;
  clientName: string;
  projectName: string;
  title: string;
  completed: boolean;
  color: string;
};

type CalendarViewOptions = {
  selectedProjectIds: Set<string>;
  calendarRangePreferences: CalendarRangePreferences;
  onSelectedProjectIdsChange: (selectedProjectIds: Set<string>) => void;
  onCalendarRangePreferencesChange: (preferences: CalendarRangePreferences) => void;
  onTaskSelect: (task: CalendarTask) => void;
};

const RANGE_CALENDAR_YEAR = 2026;
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}`);

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

function appendMonthGrid({
  monthDate,
  dueTasksByDate,
  container,
  onTaskSelect,
}: {
  monthDate: Date;
  dueTasksByDate: Map<string, CalendarTask[]>;
  container: HTMLElement;
  onTaskSelect: (task: CalendarTask) => void;
}): number {
  let itemCount = 0;
  const todayKey = toDateKey(new Date());

  getMonthGridDates(monthDate).forEach((date) => {
    const dateKey = toDateKey(date);
    const isOutsideMonth = date.getMonth() !== monthDate.getMonth();
    const cell = document.createElement("section");
    cell.className = "calendar-cell";
    cell.classList.toggle("outside-month", isOutsideMonth);
    cell.classList.toggle("today", dateKey === todayKey && !isOutsideMonth);

    const dateLabel = document.createElement("p");
    dateLabel.className = "calendar-date";
    dateLabel.textContent = String(date.getDate());
    cell.append(dateLabel);

    const tasks = dueTasksByDate.get(dateKey) ?? [];
    tasks.forEach((task) => {
      const item = document.createElement("div");
      item.className = "calendar-item";
      item.classList.toggle("completed", task.completed);
      item.style.setProperty("--project-color", task.color);
      const title = document.createElement("strong");
      title.textContent = task.title;

      const meta = document.createElement("div");
      meta.className = "calendar-item-meta";
      const client = document.createElement("span");
      client.className = "calendar-client-chip";
      client.textContent = task.clientName || "No client";
      const projectName = document.createElement("span");
      projectName.className = "calendar-project-name";
      projectName.textContent = task.projectName;
      meta.append(client, projectName);

      item.append(title, meta);
      item.addEventListener("click", () => {
        onTaskSelect(task);
      });
      cell.append(item);
      itemCount += 1;
    });

    container.append(cell);
  });

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
  preferences: CalendarRangePreferences,
  onTaskSelect: (task: CalendarTask) => void,
): number {
  calendarMonthLabel.textContent = `${RANGE_CALENDAR_YEAR}`;
  calendarGrid.className = "calendar-range-grid";
  calendarGrid.style.setProperty("--calendar-range-columns", String(preferences.columns));
  let itemCount = 0;

  for (let month = preferences.startMonth; month <= preferences.endMonth; month += 1) {
    const monthSection = document.createElement("section");
    monthSection.className = "calendar-month-panel";

    const monthTitle = document.createElement("h3");
    monthTitle.textContent = `${RANGE_CALENDAR_YEAR}.${String(month).padStart(2, "0")}`;
    monthSection.append(monthTitle);
    appendWeekdays(monthSection);

    const monthGrid = document.createElement("div");
    monthGrid.className = "calendar-grid compact-calendar-grid";
    itemCount += appendMonthGrid({
      monthDate: new Date(RANGE_CALENDAR_YEAR, month - 1, 1),
      dueTasksByDate,
      container: monthGrid,
      onTaskSelect,
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

export function renderCalendarView(state: AppState, options: CalendarViewOptions): void {
  const preferences = normalizeCalendarRangePreferences(options.calendarRangePreferences);
  options.onCalendarRangePreferencesChange(preferences);
  renderRangeControls(preferences);
  renderCalendarFilters(state, options.selectedProjectIds, options.onSelectedProjectIdsChange);

  const dueTasksByDate = getDueTasksByDate(state, options.selectedProjectIds);
  calendarGrid.innerHTML = "";
  calendarRangeControls.hidden = false;
  const itemCount = renderRangeCalendar(dueTasksByDate, preferences, options.onTaskSelect);

  calendarEmptyState.hidden = itemCount > 0;
}
