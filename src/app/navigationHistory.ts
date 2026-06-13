import { getState, setActiveProjectId } from "../state/store";
import { uiState, type AppView } from "./uiState";

// Per-window navigation history.
//
// Each renderer window loads this module in its own JS context, so the stack below is
// naturally scoped to a single BrowserWindow — the main window and child windows never
// share history. Nothing here is persisted to the `.todo` file; it only lives for the
// current window session.
//
// A snapshot stores the minimal "where am I" state. Recording is driven from render():
// on every render we capture the current snapshot and only push a new entry when the
// navigation *context* changed (the five context fields below). Plain re-renders, state
// sync, dirty changes and input edits leave those fields untouched, so they are ignored.
// visibleWeekDate is restored with each entry but does not by itself start a new entry.

type NavigationSnapshot = {
  currentView: AppView;
  activeProjectId: string | null;
  selectedTaskId: string | null;
  selectedModalProjectId: string | null;
  selectedModalTaskId: string | null;
  visibleWeekTime: number;
};

let entries: NavigationSnapshot[] = [];
let index = -1;
// Suppresses recording while we restore a snapshot (or run other internal updates), so
// back/forward does not append duplicate entries for the render it triggers.
let isSuppressed = false;
let renderer: (() => void) | null = null;

export function setNavigationRenderer(render: () => void): void {
  renderer = render;
}

function captureSnapshot(): NavigationSnapshot {
  return {
    currentView: uiState.currentView,
    activeProjectId: getState().activeProjectId,
    selectedTaskId: uiState.selectedTaskId,
    selectedModalProjectId: uiState.selectedModalProjectId,
    selectedModalTaskId: uiState.selectedModalTaskId,
    visibleWeekTime: uiState.visibleWeekDate.getTime(),
  };
}

function isSameContext(a: NavigationSnapshot, b: NavigationSnapshot): boolean {
  return (
    a.currentView === b.currentView &&
    a.activeProjectId === b.activeProjectId &&
    a.selectedTaskId === b.selectedTaskId &&
    a.selectedModalProjectId === b.selectedModalProjectId &&
    a.selectedModalTaskId === b.selectedModalTaskId
  );
}

// Called at the end of render(). No-op while suppressed or when the context is unchanged.
export function recordNavigation(): void {
  if (isSuppressed) {
    return;
  }

  const snapshot = captureSnapshot();
  const current = index >= 0 ? entries[index] : null;
  if (current && isSameContext(current, snapshot)) {
    // Same screen context (e.g. just moved the visible week): keep the volatile week
    // fresh on the current entry without creating a new history step.
    current.visibleWeekTime = snapshot.visibleWeekTime;
    return;
  }

  // A new context replaces any forward history (forward stack is dropped).
  entries = entries.slice(0, index + 1);
  entries.push(snapshot);
  index = entries.length - 1;
}

// Clear history and seed it with the current screen. Used when a workspace is opened or
// replaced, so stale entries that reference a previous workspace are not kept.
export function resetNavigationHistory(): void {
  entries = [];
  index = -1;
  recordNavigation();
}

// Run a state update without recording it as navigation (e.g. cross-window state sync).
export function runWithoutNavigationRecording(run: () => void): void {
  const previous = isSuppressed;
  isSuppressed = true;
  try {
    run();
  } finally {
    isSuppressed = previous;
  }
}

function restoreSnapshot(snapshot: NavigationSnapshot): void {
  isSuppressed = true;
  try {
    // Restore as much as is still valid. setActiveProjectId falls back to null if the
    // project no longer exists; stale task/modal ids are tolerated by the views (they
    // simply render nothing selected), so partial restores stay safe.
    setActiveProjectId(snapshot.activeProjectId);
    uiState.currentView = snapshot.currentView;
    uiState.selectedTaskId = snapshot.selectedTaskId;
    uiState.selectedModalProjectId = snapshot.selectedModalProjectId;
    uiState.selectedModalTaskId = snapshot.selectedModalTaskId;
    uiState.visibleWeekDate = new Date(snapshot.visibleWeekTime);
    // Leave any transient edit/create flags closed so the restored screen is clean.
    uiState.editingTaskId = null;
    uiState.isModalTaskEditing = false;
    renderer?.();
  } finally {
    isSuppressed = false;
  }
}

export function navigateBack(): boolean {
  if (index <= 0) {
    return false;
  }

  index -= 1;
  restoreSnapshot(entries[index]);
  return true;
}

export function navigateForward(): boolean {
  if (index < 0 || index >= entries.length - 1) {
    return false;
  }

  index += 1;
  restoreSnapshot(entries[index]);
  return true;
}
