import type { AppView } from "../app/uiState";
import {
  calendarViewButton,
  calendarWindowButton,
  calendarWorkspace,
  feedViewButton,
  feedWindowButton,
  feedWorkspace,
  ledgerViewButton,
  ledgerWindowButton,
  ledgerWorkspace,
  projectWorkspace,
  weeklyViewButton,
  weeklyWindowButton,
  weeklyWorkspace,
} from "./dom";

// Toggles which workspace is visible and highlights the active nav button.
export function renderViewVisibility(currentView: AppView, openedWindowKeys: Set<string>): void {
  projectWorkspace.hidden = currentView !== "projects";
  ledgerWorkspace.hidden = currentView !== "ledger";
  weeklyWorkspace.hidden = currentView !== "weekly";
  calendarWorkspace.hidden = currentView !== "calendar";
  feedWorkspace.hidden = currentView !== "feed";
  ledgerViewButton.classList.toggle("active", currentView === "ledger");
  weeklyViewButton.classList.toggle("active", currentView === "weekly");
  calendarViewButton.classList.toggle("active", currentView === "calendar");
  feedViewButton.classList.toggle("active", currentView === "feed");

  calendarWindowButton.classList.toggle("active", openedWindowKeys.has("view:calendar"));
  feedWindowButton.classList.toggle("active", openedWindowKeys.has("view:feed"));
  weeklyWindowButton.classList.toggle("active", openedWindowKeys.has("view:weekly"));
  ledgerWindowButton.classList.toggle("active", openedWindowKeys.has("view:ledger"));
}
