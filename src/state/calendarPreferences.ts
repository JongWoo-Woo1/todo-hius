export type CalendarRangePreferences = {
  startMonth: number;
  endMonth: number;
  columns: number;
};

const CALENDAR_RANGE_PREFERENCES_KEY = "project-calendar-range-preferences";

const DEFAULT_PREFERENCES: CalendarRangePreferences = {
  startMonth: 1,
  endMonth: 12,
  columns: 4,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeCalendarRangePreferences(
  preferences: Partial<CalendarRangePreferences>,
): CalendarRangePreferences {
  const startMonth = clamp(preferences.startMonth ?? DEFAULT_PREFERENCES.startMonth, 1, 12);
  const endMonth = clamp(preferences.endMonth ?? DEFAULT_PREFERENCES.endMonth, startMonth, 12);
  const monthCount = endMonth - startMonth + 1;
  const columns = clamp(preferences.columns ?? DEFAULT_PREFERENCES.columns, 1, Math.min(4, monthCount));

  return {
    startMonth,
    endMonth,
    columns,
  };
}

export function loadCalendarRangePreferences(): CalendarRangePreferences {
  const rawPreferences = localStorage.getItem(CALENDAR_RANGE_PREFERENCES_KEY);
  if (!rawPreferences) {
    return DEFAULT_PREFERENCES;
  }

  try {
    return normalizeCalendarRangePreferences(JSON.parse(rawPreferences) as Partial<CalendarRangePreferences>);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveCalendarRangePreferences(preferences: CalendarRangePreferences): void {
  localStorage.setItem(CALENDAR_RANGE_PREFERENCES_KEY, JSON.stringify(normalizeCalendarRangePreferences(preferences)));
}
