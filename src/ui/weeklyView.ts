import { getProjectById, getTodoByProject } from "../state/selectors";
import type { AppState } from "../types";
import { toDateKey } from "../utils/calendar";
import { getWeekRangeLabel, getWeekdays } from "../utils/week";
import { weeklyEmptyState, weeklyGrid, weeklyRangeLabel } from "./dom";

type WeeklyItem = {
  id?: string;
  projectId?: string;
  todoId?: string;
  clientName: string;
  projectName: string;
  todoTitle?: string;
  content: string;
  color: string;
  source: "todo" | "workLog";
};

const WEEKLY_SECTIONS = [
  { key: "plan", title: "업무 계획" },
  { key: "done", title: "업무 일지" },
] as const;

function createWeeklyBuckets(visibleWeekDate: Date): Map<string, Record<(typeof WEEKLY_SECTIONS)[number]["key"], WeeklyItem[]>> {
  const buckets = new Map<string, Record<(typeof WEEKLY_SECTIONS)[number]["key"], WeeklyItem[]>>();

  getWeekdays(visibleWeekDate).forEach((date) => {
    buckets.set(toDateKey(date), {
      plan: [],
      done: [],
    });
  });

  return buckets;
}

function renderWeeklyItem(item: WeeklyItem): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-item";
  wrapper.classList.toggle("todo-source", item.source === "todo");
  wrapper.style.setProperty("--project-color", item.color);

  const header = document.createElement("div");
  header.className = "weekly-item-header";

  const meta = document.createElement("div");
  meta.className = "weekly-item-meta";
  const client = document.createElement("span");
  client.className = "weekly-client-chip";
  client.textContent = item.clientName || "No client";
  const projectName = document.createElement("span");
  projectName.className = "weekly-project-name";
  projectName.textContent = item.projectName;
  meta.append(client, projectName);

  if (item.todoTitle) {
    const linkedTask = document.createElement("p");
    linkedTask.className = "weekly-linked-title";
    linkedTask.textContent = item.todoTitle;
    header.append(meta, linkedTask);
  } else {
    header.append(meta);
  }

  const content = document.createElement("p");
  content.className = "weekly-item-content";
  content.textContent = item.content;
  wrapper.append(header, content);

  return wrapper;
}

function renderWeeklyItems(items: WeeklyItem[]): HTMLElement {
  const body = document.createElement("div");
  body.className = "weekly-table-cell-body";
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "weekly-empty";
    empty.textContent = "No items yet.";
    body.append(empty);
    return body;
  }

  items.forEach((item) => {
    body.append(renderWeeklyItem(item));
  });

  return body;
}

export function renderWeeklyView(state: AppState, visibleWeekDate: Date): void {
  weeklyRangeLabel.textContent = getWeekRangeLabel(visibleWeekDate);
  weeklyGrid.innerHTML = "";

  const buckets = createWeeklyBuckets(visibleWeekDate);
  let weeklyItemCount = 0;

  state.projects.forEach((project) => {
    project.todos.forEach((todo) => {
      if (!todo.dueDate || !buckets.has(todo.dueDate)) {
        return;
      }

      buckets.get(todo.dueDate)!.plan.push({
        projectId: project.id,
        todoId: todo.id,
        clientName: project.clientName,
        projectName: project.name,
        todoTitle: todo.title,
        content: todo.title,
        color: project.color,
        source: "todo",
      });
      weeklyItemCount += 1;
    });
  });

  state.workLogs.forEach((workLog) => {
    const bucket = buckets.get(workLog.date);
    if (!bucket) {
      return;
    }

    const project = getProjectById(state, workLog.projectId);
    const linkedTodo = getTodoByProject(project, workLog.todoId);
    const clientName = project?.clientName ?? "";
    const projectName = project?.name ?? "Unknown";
    const color = project?.color ?? "#94a3b8";
    const item: WeeklyItem = {
      id: workLog.id,
      projectId: workLog.projectId,
      todoId: workLog.todoId,
      clientName,
      projectName,
      todoTitle: linkedTodo?.title,
      content: workLog.content,
      color,
      source: "workLog",
    };

    if (workLog.type === "계획") {
      bucket.plan.push(item);
    } else if (workLog.type === "수행") {
      bucket.done.push(item);
    } else {
      return;
    }
    weeklyItemCount += 1;
  });

  const weekdays = getWeekdays(visibleWeekDate);
  const table = document.createElement("table");
  table.className = "weekly-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const sectionHeader = document.createElement("th");
  sectionHeader.scope = "col";
  sectionHeader.textContent = "구분";
  headerRow.append(sectionHeader);

  weekdays.forEach((date) => {
    const dateKey = toDateKey(date);
    const th = document.createElement("th");
    th.scope = "col";
    th.innerHTML = `
      <span>${date.toLocaleDateString("en-US", { weekday: "short" })}</span>
      <strong>${dateKey}</strong>
    `;
    headerRow.append(th);
  });

  thead.append(headerRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  WEEKLY_SECTIONS.forEach((section) => {
    const row = document.createElement("tr");
    row.dataset.weeklySection = section.key;

    const rowHeader = document.createElement("th");
    rowHeader.scope = "row";
    rowHeader.textContent = section.title;
    row.append(rowHeader);

    weekdays.forEach((date) => {
      const dateKey = toDateKey(date);
      const dayBuckets = buckets.get(dateKey)!;
      const cell = document.createElement("td");
      cell.append(renderWeeklyItems(dayBuckets[section.key]));
      row.append(cell);
    });

    tbody.append(row);
  });
  table.append(tbody);
  weeklyGrid.append(table);

  weeklyEmptyState.hidden = weeklyItemCount > 0;
}
