import type { AppView } from "../app/uiState";
import {
  calendarViewButton,
  calendarWorkspace,
  ledgerViewButton,
  ledgerWorkspace,
  projectWorkspace,
  weeklyViewButton,
  weeklyWorkspace,
} from "./dom";

// Toggles which workspace is visible and highlights the active nav button.
export function renderViewVisibility(currentView: AppView): void {
  projectWorkspace.hidden = currentView !== "projects";
  ledgerWorkspace.hidden = currentView !== "ledger";
  weeklyWorkspace.hidden = currentView !== "weekly";
  calendarWorkspace.hidden = currentView !== "calendar";
  ledgerViewButton.classList.toggle("active", currentView === "ledger");
  weeklyViewButton.classList.toggle("active", currentView === "weekly");
  calendarViewButton.classList.toggle("active", currentView === "calendar");
}
