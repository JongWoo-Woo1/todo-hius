import { getDefaultCalendarRangePreferences, type CalendarRangePreferences } from "../state/calendarPreferences";
import type { WorkLogType } from "../types";

export type AppView = "projects" | "ledger" | "weekly" | "calendar";

export type UiState = {
  selectedTodoId: string | null;
  editingTodoId: string | null;
  isProjectInfoEditing: boolean;
  isProjectNameEditing: boolean;
  currentView: AppView;
  visibleWeekDate: Date;
  selectedCalendarProjectIds: Set<string> | null;
  selectedModalTodoId: string | null;
  isModalTodoEditing: boolean;
  selectedModalProjectId: string | null;
  draggedProjectId: string | null;
  calendarRangePreferences: CalendarRangePreferences;
  expandedProjectWorkLogId: string | null;
  expandedTodoWorkLogIds: Set<string>;
  selectedWorkLogId: string | null;
  isWorkLogEditing: boolean;
  isWorkLogCreating: boolean;
  workLogCreateDate: string | null;
  workLogCreateType: WorkLogType | null;
};

export const uiState: UiState = {
  selectedTodoId: null,
  editingTodoId: null,
  isProjectInfoEditing: false,
  isProjectNameEditing: false,
  currentView: "calendar",
  visibleWeekDate: new Date(),
  selectedCalendarProjectIds: null,
  selectedModalTodoId: null,
  isModalTodoEditing: false,
  selectedModalProjectId: null,
  draggedProjectId: null,
  calendarRangePreferences: getDefaultCalendarRangePreferences(),
  expandedProjectWorkLogId: null,
  expandedTodoWorkLogIds: new Set<string>(),
  selectedWorkLogId: null,
  isWorkLogEditing: false,
  isWorkLogCreating: false,
  workLogCreateDate: null,
  workLogCreateType: null,
};
