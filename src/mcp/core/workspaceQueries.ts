// Read-only queries over an AppState. Pure functions, no Electron, no mutation.

import { getProjectById, getProjectEvents, getProjectWorkLogs } from "../../state/selectors";
import { toDateKey } from "../../utils/calendar";
import { getWeekdays } from "../../utils/week";
import type {
  AppState,
  Project,
  ProjectDetail,
  ProjectEvent,
  ProjectSummary,
  ScheduleEventItem,
  ScheduleTaskItem,
  ScheduleWorkLogItem,
  Task,
  TaskSearchHit,
  TodayScheduleContext,
  WeekScheduleContext,
  WorkLog,
} from "./mcpTypes";

function projectNamesById(state: AppState): Map<string, string> {
  return new Map(state.projects.map((project) => [project.id, project.name]));
}

function findTaskTitle(project: Project | undefined, taskId: string | undefined): string | null {
  if (!project || !taskId) {
    return null;
  }

  const task = project.tasks.find((item) => item.id === taskId) ?? project.deletedTasks.find((item) => item.id === taskId);
  return task ? task.title : null;
}

function toProjectSummary(project: Project): ProjectSummary {
  const completedTaskCount = project.tasks.filter((task) => task.completed).length;
  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    projectNumber: project.projectNumber ?? "",
    taskCount: project.tasks.length,
    openTaskCount: project.tasks.length - completedTaskCount,
    completedTaskCount,
  };
}

function toScheduleTaskItem(project: Project, task: Task): ScheduleTaskItem {
  return {
    projectId: project.id,
    projectName: project.name,
    taskId: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate,
    completed: task.completed,
  };
}

function toScheduleEventItem(project: Project, event: ProjectEvent): ScheduleEventItem {
  return {
    projectId: project.id,
    projectName: project.name,
    eventId: event.id,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate ?? null,
    content: event.content,
  };
}

function toScheduleWorkLogItem(project: Project, workLog: WorkLog): ScheduleWorkLogItem {
  return {
    projectId: project.id,
    projectName: project.name,
    workLogId: workLog.id,
    date: workLog.date,
    endDate: workLog.endDate ?? null,
    type: workLog.type,
    content: workLog.content,
    taskTitle: findTaskTitle(project, workLog.taskId) ?? workLog.linkedTaskTitleSnapshot ?? null,
  };
}

// Inclusive [start, end] overlap test on YYYY-MM-DD keys (lexicographic == chronological).
function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && endA >= startB;
}

export function listProjects(state: AppState): ProjectSummary[] {
  return state.projects.map(toProjectSummary);
}

export function searchProjects(state: AppState, query: string): ProjectSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return listProjects(state);
  }

  return state.projects
    .filter((project) => {
      const haystack = [project.name, project.clientName, project.projectNumber ?? ""].join(" ").toLowerCase();
      return haystack.includes(needle);
    })
    .map(toProjectSummary);
}

export function searchTasks(state: AppState, query: string): TaskSearchHit[] {
  const needle = query.trim().toLowerCase();
  const hits: TaskSearchHit[] = [];

  for (const project of state.projects) {
    for (const task of project.tasks) {
      const haystack = [task.title, task.memo, task.status].join(" ").toLowerCase();
      if (!needle || haystack.includes(needle)) {
        hits.push({
          projectId: project.id,
          projectName: project.name,
          taskId: task.id,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate,
          completed: task.completed,
        });
      }
    }
  }

  return hits;
}

export function getTasksByProject(state: AppState, projectId: string): Task[] {
  return getProjectById(state, projectId)?.tasks ?? [];
}

export function getEventsByProject(state: AppState, projectId: string): ProjectEvent[] {
  return getProjectEvents(state, projectId);
}

export function getWorkLogsByProject(state: AppState, projectId: string): WorkLog[] {
  return getProjectWorkLogs(state, projectId);
}

export function getProjectDetail(state: AppState, projectId: string): ProjectDetail | null {
  const project = getProjectById(state, projectId);
  if (!project) {
    return null;
  }

  return {
    project,
    tasks: project.tasks,
    events: getProjectEvents(state, projectId),
    workLogs: getProjectWorkLogs(state, projectId),
  };
}

// Schedule context for the week containing weekDate. The window spans Monday..Sunday so
// weekend items are not missed, even though the app's Weekly view focuses on Mon-Fri.
export function getWeekScheduleContext(state: AppState, weekDate: Date): WeekScheduleContext {
  const weekdays = getWeekdays(weekDate);
  const monday = weekdays[0];
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const weekStart = toDateKey(monday);
  const weekEnd = toDateKey(sunday);

  const projectsById = new Map(state.projects.map((project) => [project.id, project]));
  const tasks: ScheduleTaskItem[] = [];
  const events: ScheduleEventItem[] = [];
  const workLogs: ScheduleWorkLogItem[] = [];

  for (const project of state.projects) {
    for (const task of project.tasks) {
      if (task.dueDate && task.dueDate >= weekStart && task.dueDate <= weekEnd) {
        tasks.push(toScheduleTaskItem(project, task));
      }
    }
  }

  for (const event of state.events) {
    const project = projectsById.get(event.projectId);
    if (project && rangesOverlap(event.startDate, event.endDate ?? event.startDate, weekStart, weekEnd)) {
      events.push(toScheduleEventItem(project, event));
    }
  }

  for (const workLog of state.workLogs) {
    const project = projectsById.get(workLog.projectId);
    if (project && rangesOverlap(workLog.date, workLog.endDate ?? workLog.date, weekStart, weekEnd)) {
      workLogs.push(toScheduleWorkLogItem(project, workLog));
    }
  }

  tasks.sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""));
  events.sort((left, right) => left.startDate.localeCompare(right.startDate));
  workLogs.sort((left, right) => left.date.localeCompare(right.date));

  return { weekStart, weekEnd, label: `${weekStart} ~ ${weekEnd}`, tasks, events, workLogs };
}

// Schedule context for a single day: tasks due today, still-open overdue tasks, events
// covering today, and work logs on today.
export function getTodayScheduleContext(state: AppState, today: Date): TodayScheduleContext {
  const dateKey = toDateKey(today);
  const projectsById = new Map(state.projects.map((project) => [project.id, project]));

  const tasksDueToday: ScheduleTaskItem[] = [];
  const overdueTasks: ScheduleTaskItem[] = [];
  const events: ScheduleEventItem[] = [];
  const workLogs: ScheduleWorkLogItem[] = [];

  for (const project of state.projects) {
    for (const task of project.tasks) {
      if (!task.dueDate) {
        continue;
      }

      if (task.dueDate === dateKey) {
        tasksDueToday.push(toScheduleTaskItem(project, task));
      } else if (task.dueDate < dateKey && !task.completed) {
        overdueTasks.push(toScheduleTaskItem(project, task));
      }
    }
  }

  for (const event of state.events) {
    const project = projectsById.get(event.projectId);
    if (project && event.startDate <= dateKey && (event.endDate ?? event.startDate) >= dateKey) {
      events.push(toScheduleEventItem(project, event));
    }
  }

  for (const workLog of state.workLogs) {
    const project = projectsById.get(workLog.projectId);
    if (project && workLog.date <= dateKey && (workLog.endDate ?? workLog.date) >= dateKey) {
      workLogs.push(toScheduleWorkLogItem(project, workLog));
    }
  }

  overdueTasks.sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""));

  return { date: dateKey, tasksDueToday, overdueTasks, events, workLogs };
}
