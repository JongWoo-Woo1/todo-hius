import { getDefaultCalendarRangePreferences, type CalendarRangePreferences } from "../state/calendarPreferences";
import type { WorkLogType } from "../types";
import { getDefaultVisibleWeekDate } from "../utils/week";

export type AppView = "projects" | "ledger" | "weekly" | "calendar";

export type UiState = {
  selectedTaskId: string | null;
  editingTaskId: string | null;
  isProjectInfoEditing: boolean;
  isProjectNameEditing: boolean;
  currentView: AppView;
  visibleWeekDate: Date;
  selectedCalendarProjectIds: Set<string> | null;
  selectedModalTaskId: string | null;
  isModalTaskEditing: boolean;
  selectedModalProjectId: string | null;
  draggedProjectId: string | null;
  calendarRangePreferences: CalendarRangePreferences;
  expandedProjectFutureFeedId: string | null;
  expandedProjectPastFeedId: string | null;
  expandedTaskWorkLogIds: Set<string>;
  expandedTaskTrashProjectId: string | null;
  selectedWorkLogId: string | null;
  isWorkLogEditing: boolean;
  isWorkLogCreating: boolean;
  workLogCreateDate: string | null;
  workLogCreateType: WorkLogType | null;
  selectedEventId: string | null;
  isEventEditing: boolean;
  isEventCreating: boolean;
  eventCreateDate: string | null;
  isCalendarTaskCreating: boolean;
};

export const uiState: UiState = {
  selectedTaskId: null,
  editingTaskId: null,
  isProjectInfoEditing: false,
  isProjectNameEditing: false,
  currentView: "calendar",
  visibleWeekDate: getDefaultVisibleWeekDate(),
  selectedCalendarProjectIds: null,
  selectedModalTaskId: null,
  isModalTaskEditing: false,
  selectedModalProjectId: null,
  draggedProjectId: null,
  calendarRangePreferences: getDefaultCalendarRangePreferences(),
  expandedProjectFutureFeedId: null,
  expandedProjectPastFeedId: null,
  expandedTaskWorkLogIds: new Set<string>(),
  expandedTaskTrashProjectId: null,
  selectedWorkLogId: null,
  isWorkLogEditing: false,
  isWorkLogCreating: false,
  workLogCreateDate: null,
  workLogCreateType: null,
  selectedEventId: null,
  isEventEditing: false,
  isEventCreating: false,
  eventCreateDate: null,
  isCalendarTaskCreating: false,
};
