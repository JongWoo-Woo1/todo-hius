import { toDateKey } from "../utils/calendar";

// Shared feed helpers used by the per-project Feed (projectMemoView)
// and the all-projects Feed (feedView). Pure, project-agnostic logic only.

const RECENT_FEED_BUSINESS_DAYS = 5;
const UPCOMING_FEED_BUSINESS_DAYS = 5;

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getBusinessDateKey(offsetDays: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  let remainingDays = Math.abs(offsetDays);
  const direction = offsetDays < 0 ? -1 : 1;
  while (remainingDays > 0) {
    date.setDate(date.getDate() + direction);
    if (isBusinessDay(date)) {
      remainingDays -= 1;
    }
  }

  return toDateKey(date);
}

function getRecentFeedCutoffKey(): string {
  return getBusinessDateKey(-RECENT_FEED_BUSINESS_DAYS);
}

function getUpcomingFeedCutoffKey(): string {
  return getBusinessDateKey(UPCOMING_FEED_BUSINESS_DAYS);
}

export function getContentPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157)}...`;
}

// Newest first; items without a date sort last; ties break by label.
export function compareFeedItems<T>(
  left: T,
  right: T,
  getDateKey: (item: T) => string | null,
  getLabel: (item: T) => string,
): number {
  const leftDateKey = getDateKey(left);
  const rightDateKey = getDateKey(right);

  if (!leftDateKey && !rightDateKey) {
    return getLabel(left).localeCompare(getLabel(right));
  }

  if (!leftDateKey) {
    return 1;
  }

  if (!rightDateKey) {
    return -1;
  }

  const dateDiff = rightDateKey.localeCompare(leftDateKey);
  if (dateDiff !== 0) {
    return dateDiff;
  }

  return getLabel(left).localeCompare(getLabel(right));
}

export type FeedWindowResult<T> = {
  visibleItems: T[];
  futureHiddenCount: number;
  pastHiddenCount: number;
};

// A feed item's date span. Single-day items use start === end.
// null means the item has no date and is treated as past.
export type FeedDateRange = { start: string; end: string } | null;

// Builds a date span from a start and an optional end, tolerating reversed
// inputs. A missing/empty start yields null (no date).
export function makeFeedDateRange(start: string | null | undefined, end?: string | null): FeedDateRange {
  if (!start) {
    return null;
  }

  const endKey = end ?? start;
  return start <= endKey ? { start, end: endKey } : { start: endKey, end: start };
}

// Splits feed items into a default window (-5 ~ +5 business days,
// capped at defaultVisibleCount), a future bucket, and a past bucket.
// An item belongs to the default window when its [start, end] span
// overlaps the window; future means the span starts after the window,
// past means it ends before the window (or has no date).
export function splitFeedByWindow<T>(
  items: T[],
  getDateRange: (item: T) => FeedDateRange,
  getKey: (item: T) => string,
  showFuture: boolean,
  showPast: boolean,
  defaultVisibleCount: number,
): FeedWindowResult<T> {
  const cutoffKey = getRecentFeedCutoffKey();
  const upcomingCutoffKey = getUpcomingFeedCutoffKey();

  const futureItems = items.filter((item) => {
    const range = getDateRange(item);
    return Boolean(range && range.start > upcomingCutoffKey);
  });
  const defaultItems = items
    .filter((item) => {
      const range = getDateRange(item);
      return Boolean(range && range.start <= upcomingCutoffKey && range.end >= cutoffKey);
    })
    .slice(0, defaultVisibleCount);

  const futureItemKeys = new Set(futureItems.map(getKey));
  const defaultItemKeys = new Set(defaultItems.map(getKey));
  const pastItems = items.filter((item) => {
    const key = getKey(item);
    return !futureItemKeys.has(key) && !defaultItemKeys.has(key);
  });
  const pastItemKeys = new Set(pastItems.map(getKey));

  return {
    visibleItems: items.filter((item) => {
      const key = getKey(item);
      return (
        defaultItemKeys.has(key) ||
        (showFuture && futureItemKeys.has(key)) ||
        (showPast && pastItemKeys.has(key))
      );
    }),
    futureHiddenCount: showFuture ? 0 : futureItems.length,
    pastHiddenCount: showPast ? 0 : pastItems.length,
  };
}
