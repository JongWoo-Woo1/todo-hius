import { STORAGE_KEY } from "../constants";
import type { AppState } from "../types";

export function loadRawState(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function saveRawState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
