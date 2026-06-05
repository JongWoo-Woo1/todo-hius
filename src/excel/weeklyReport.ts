import ExcelJS from "exceljs";
import type { AppState } from "../types";
import { toDateKey } from "../utils/calendar";
import { getWeekdays } from "../utils/week";

type WeeklySectionKey = "plan" | "done";

type WeeklyItem = {
  clientName: string;
  projectName: string;
  taskTitle: string;
  content: string;
};

const TEMPLATE_URL = "/templates/weekly-report-template.xlsx";
const TEMPLATE_SHEET_NAME = "주차";
const TITLE_CELL = "B2";
const REPORT_DATE_CELL = "AE5";
const PLAN_CELLS = ["C10", "I10", "O10", "U10", "AA10"] as const;
const DONE_CELLS = ["C24", "I24", "O24", "U24", "AA24"] as const;

function createWeeklyBuckets(date: Date): Map<string, Record<WeeklySectionKey, WeeklyItem[]>> {
  const buckets = new Map<string, Record<WeeklySectionKey, WeeklyItem[]>>();

  getWeekdays(date).forEach((weekday) => {
    buckets.set(toDateKey(weekday), {
      plan: [],
      done: [],
    });
  });

  return buckets;
}

function getWeekOfMonthLabel(date: Date): string {
  const monday = getWeekdays(date)[0];
  const weekNumber = Math.ceil(monday.getDate() / 7);

  return `${monday.getMonth() + 1}월 ${weekNumber}주차`;
}

function formatGroupHeader(item: WeeklyItem): string {
  return item.clientName ? `${item.clientName}_${item.projectName}` : item.projectName;
}

function formatGroupedItems(items: WeeklyItem[]): ExcelJS.CellValue {
  const projectGroups = new Map<string, { header: string; tasks: Map<string, string[]> }>();

  items.forEach((item) => {
    const header = formatGroupHeader(item);
    let group = projectGroups.get(header);
    if (!group) {
      group = { header, tasks: new Map() };
      projectGroups.set(header, group);
    }

    const contents = group.tasks.get(item.taskTitle) ?? [];
    if (item.content) {
      contents.push(item.content);
    }
    group.tasks.set(item.taskTitle, contents);
  });

  if (projectGroups.size === 0) {
    return "";
  }

  const richText: ExcelJS.RichText[] = [];

  Array.from(projectGroups.values()).forEach((group, index) => {
    const separator = index === 0 ? "" : "\n\n";
    richText.push({ font: { bold: true }, text: `${separator}${group.header}\n` });

    const lines: string[] = [];
    group.tasks.forEach((contents, taskTitle) => {
      if (taskTitle) {
        lines.push(taskTitle);
      }
      contents.forEach((content) => lines.push(`- ${content}`));
    });
    richText.push({ text: lines.join("\n") });
  });

  return { richText };
}

async function loadWeeklyReportTemplate(): Promise<ExcelJS.Workbook> {
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) {
    throw new Error(`Failed to load weekly report template: ${response.status}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());

  return workbook;
}

function getTemplateWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const worksheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME) ?? workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Weekly report template does not contain a worksheet.");
  }

  return worksheet;
}

function fillWeeklyBuckets(state: AppState, date: Date): Map<string, Record<WeeklySectionKey, WeeklyItem[]>> {
  const buckets = createWeeklyBuckets(date);

  state.projects.forEach((project) => {
    project.todos.forEach((todo) => {
      if (!todo.dueDate || !buckets.has(todo.dueDate)) {
        return;
      }

      buckets.get(todo.dueDate)!.plan.push({
        clientName: project.clientName,
        projectName: project.name,
        taskTitle: todo.title,
        content: "",
      });
    });
  });

  state.workLogs.forEach((workLog) => {
    const bucket = buckets.get(workLog.date);
    if (!bucket) {
      return;
    }

    const project = state.projects.find((item) => item.id === workLog.projectId);
    const linkedTodo = workLog.todoId ? project?.todos.find((todo) => todo.id === workLog.todoId) : undefined;
    const item: WeeklyItem = {
      clientName: project?.clientName ?? "",
      projectName: project?.name ?? "Unknown",
      taskTitle: linkedTodo?.title ?? "",
      content: workLog.content,
    };

    if (workLog.type === "계획") {
      bucket.plan.push(item);
    }

    if (workLog.type === "수행") {
      bucket.done.push(item);
    }
  });

  return buckets;
}

function setCellValue(worksheet: ExcelJS.Worksheet, address: string, value: ExcelJS.CellValue): void {
  worksheet.getCell(address).value = value;
}

export function getWeeklyReportFileDate(date: Date): string {
  return toDateKey(getWeekdays(date)[0]);
}

export async function createWeeklyReportWorkbook(state: AppState, date: Date): Promise<ExcelJS.Workbook> {
  const workbook = await loadWeeklyReportTemplate();
  const worksheet = getTemplateWorksheet(workbook);
  const weekdays = getWeekdays(date);
  const buckets = fillWeeklyBuckets(state, date);
  const weekLabel = getWeekOfMonthLabel(date);

  worksheet.name = weekLabel;

  setCellValue(worksheet, TITLE_CELL, `${weekLabel} 주간업무 리포트`);
  setCellValue(worksheet, REPORT_DATE_CELL, toDateKey(new Date()));

  weekdays.forEach((weekday, index) => {
    const dateKey = toDateKey(weekday);
    const dayBuckets = buckets.get(dateKey)!;

    setCellValue(worksheet, PLAN_CELLS[index], formatGroupedItems(dayBuckets.plan));
    setCellValue(worksheet, DONE_CELLS[index], formatGroupedItems(dayBuckets.done));
  });

  return workbook;
}
