import { getState } from "../state/store";
import { uiState } from "./uiState";
import type { AiActionResult } from "./aiDto";
import {
  queryAppInfo,
  queryLiveProjectSearch,
  queryLiveProjects,
  queryLiveTasks,
  queryProjectSummary,
  queryTaskSummary,
  queryTodaySchedule,
  queryWeekSchedule,
} from "./aiLiveQueries";

export function getAppInfo(): AiActionResult {
  return queryAppInfo(getState(), uiState);
}

export function listLiveProjects(payload: Record<string, unknown>): AiActionResult {
  return queryLiveProjects(getState(), payload);
}

export function searchLiveProjects(payload: Record<string, unknown>): AiActionResult {
  return queryLiveProjectSearch(getState(), payload);
}

export function getProjectSummary(payload: Record<string, unknown>): AiActionResult {
  return queryProjectSummary(getState(), payload);
}

export function searchLiveTasks(payload: Record<string, unknown>): AiActionResult {
  return queryLiveTasks(getState(), payload);
}

export function getTaskSummary(payload: Record<string, unknown>): AiActionResult {
  return queryTaskSummary(getState(), payload);
}

export function getTodaySchedule(payload: Record<string, unknown>): AiActionResult {
  return queryTodaySchedule(getState(), payload);
}

export function getWeekSchedule(payload: Record<string, unknown>): AiActionResult {
  return queryWeekSchedule(getState(), payload);
}
