// Shared types for the read-only MCP layer over a `.todo` workspace.
//
// These wrap the app's existing AppState/domain types (src/types.ts) into smaller,
// MCP-friendly shapes for tool responses. Nothing here depends on Electron.

import type { AppState, Project, ProjectEvent, Task, WorkLog } from "../../types";

export type { AppState, Project, ProjectEvent, Task, WorkLog };

export type ProjectSummary = {
  id: string;
  name: string;
  clientName: string;
  projectNumber: string;
  taskCount: number;
  openTaskCount: number;
  completedTaskCount: number;
};

export type TaskSearchHit = {
  projectId: string;
  projectName: string;
  taskId: string;
  title: string;
  status: string;
  dueDate: string | null;
  completed: boolean;
};

export type ScheduleTaskItem = {
  projectId: string;
  projectName: string;
  taskId: string;
  title: string;
  status: string;
  dueDate: string | null;
  completed: boolean;
};

export type ScheduleEventItem = {
  projectId: string;
  projectName: string;
  eventId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  content: string;
};

export type ScheduleWorkLogItem = {
  projectId: string;
  projectName: string;
  workLogId: string;
  date: string;
  endDate: string | null;
  type: string;
  content: string;
  taskTitle: string | null;
};

export type WeekScheduleContext = {
  weekStart: string;
  weekEnd: string;
  label: string;
  tasks: ScheduleTaskItem[];
  events: ScheduleEventItem[];
  workLogs: ScheduleWorkLogItem[];
};

export type TodayScheduleContext = {
  date: string;
  tasksDueToday: ScheduleTaskItem[];
  overdueTasks: ScheduleTaskItem[];
  events: ScheduleEventItem[];
  workLogs: ScheduleWorkLogItem[];
};

export type ProjectDetail = {
  project: Project;
  tasks: Task[];
  events: ProjectEvent[];
  workLogs: WorkLog[];
};
