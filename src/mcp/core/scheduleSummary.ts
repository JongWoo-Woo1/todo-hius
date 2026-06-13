// Human-readable schedule summaries. No LLM calls — pure formatting of the structured
// week/today schedule context into text that is easy to read in a chat response.

import { getTodayScheduleContext, getWeekScheduleContext } from "./workspaceQueries";
import type {
  AppState,
  ScheduleEventItem,
  ScheduleTaskItem,
  ScheduleWorkLogItem,
  TodayScheduleContext,
  WeekScheduleContext,
} from "./mcpTypes";

function section(title: string, lines: string[]): string {
  if (lines.length === 0) {
    return `■ ${title} (0)\n- 없음`;
  }

  return `■ ${title} (${lines.length})\n${lines.join("\n")}`;
}

function taskLine(task: ScheduleTaskItem): string {
  const due = task.dueDate ?? "마감일 없음";
  const done = task.completed ? " ✓" : "";
  return `- ${due}  [${task.status}]${done}  ${task.title} — ${task.projectName}`;
}

function eventLine(event: ScheduleEventItem): string {
  const range = event.endDate && event.endDate !== event.startDate ? `${event.startDate}~${event.endDate}` : event.startDate;
  return `- ${range}  ${event.title} — ${event.projectName}`;
}

function workLogLine(workLog: ScheduleWorkLogItem): string {
  const range = workLog.endDate && workLog.endDate !== workLog.date ? `${workLog.date}~${workLog.endDate}` : workLog.date;
  const linkedTask = workLog.taskTitle ? ` (${workLog.taskTitle})` : "";
  return `- ${range}  [${workLog.type}]  ${workLog.content}${linkedTask} — ${workLog.projectName}`;
}

export function formatWeekScheduleContext(context: WeekScheduleContext): string {
  return [
    `[이번 주 일정] ${context.weekStart} ~ ${context.weekEnd}`,
    "",
    section("마감 예정 Task", context.tasks.map(taskLine)),
    "",
    section("일정/이벤트", context.events.map(eventLine)),
    "",
    section("작업 기록", context.workLogs.map(workLogLine)),
  ].join("\n");
}

export function formatTodayScheduleContext(context: TodayScheduleContext): string {
  return [
    `[오늘 일정] ${context.date}`,
    "",
    section("오늘 마감 Task", context.tasksDueToday.map(taskLine)),
    "",
    section("지난 미완료 Task", context.overdueTasks.map(taskLine)),
    "",
    section("일정/이벤트", context.events.map(eventLine)),
    "",
    section("작업 기록", context.workLogs.map(workLogLine)),
  ].join("\n");
}

// Build a readable summary of the week containing weekDate.
export function summarizeWeek(state: AppState, weekDate: Date): string {
  return formatWeekScheduleContext(getWeekScheduleContext(state, weekDate));
}

// Build a readable summary of a single day.
export function summarizeToday(state: AppState, today: Date): string {
  return formatTodayScheduleContext(getTodayScheduleContext(state, today));
}
