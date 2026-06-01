export type CalendarRangePreferences = {
  startMonth: number;
  endMonth: number;
  columns: number;
};

export function getDefaultCalendarRangePreferences(): CalendarRangePreferences {
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
  const defaultPreferences = getDefaultCalendarRangePreferences();
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
