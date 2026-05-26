export type CalendarRangePreferences = {
  startMonth: number;
  endMonth: number;
  columns: number;
};

const CALENDAR_RANGE_PREFERENCES_KEY = "project-calendar-range-preferences";

const LEGACY_DEFAULT_PREFERENCES: CalendarRangePreferences = {
  startMonth: 1,
  endMonth: 12,
  columns: 4,
};

function getDefaultPreferences(): CalendarRangePreferences {
  const startMonth = new Date().getMonth() + 1;

  return {
    startMonth,
    endMonth: Math.min(12, startMonth + 2),
    columns: 1,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeCalendarRangePreferences(
  preferences: Partial<CalendarRangePreferences>,
): CalendarRangePreferences {
  const defaultPreferences = getDefaultPreferences();
  const startMonth = clamp(preferences.startMonth ?? defaultPreferences.startMonth, 1, 12);
  const endMonth = clamp(preferences.endMonth ?? defaultPreferences.endMonth, startMonth, 12);
  const monthCount = endMonth - startMonth + 1;
  const columns = clamp(preferences.columns ?? defaultPreferences.columns, 1, Math.min(4, monthCount));

  return {
    startMonth,
    endMonth,
    columns,
  };
}

export function loadCalendarRangePreferences(): CalendarRangePreferences {
  const rawPreferences = localStorage.getItem(CALENDAR_RANGE_PREFERENCES_KEY);
  if (!rawPreferences) {
    return getDefaultPreferences();
  }

  try {
    const preferences = JSON.parse(rawPreferences) as Partial<CalendarRangePreferences>;
    if (
      preferences.startMonth === LEGACY_DEFAULT_PREFERENCES.startMonth &&
      preferences.endMonth === LEGACY_DEFAULT_PREFERENCES.endMonth &&
      preferences.columns === LEGACY_DEFAULT_PREFERENCES.columns
    ) {
      return getDefaultPreferences();
    }

    return normalizeCalendarRangePreferences(preferences);
  } catch {
    return getDefaultPreferences();
  }
}

export function saveCalendarRangePreferences(preferences: CalendarRangePreferences): void {
  localStorage.setItem(CALENDAR_RANGE_PREFERENCES_KEY, JSON.stringify(normalizeCalendarRangePreferences(preferences)));
}
