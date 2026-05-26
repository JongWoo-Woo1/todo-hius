import ExcelJS from "exceljs";
import type { AppState } from "../types";
import { toDateKey } from "../utils/calendar";
import { getWeekdays } from "../utils/week";

type WeeklySectionKey = "plan" | "done";

type WeeklyItem = {
  projectName: string;
  content: string;
};

const TEMPLATE_URL = "/templates/weekly-report-template.xlsx";
const TEMPLATE_SHEET_NAME = "3주차";
const PLAN_CELLS = ["C7", "I7", "O7", "U7", "AA7"] as const;
const DONE_CELLS = ["C19", "I19", "O19", "U19", "AA19"] as const;

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

function formatGroupedItems(items: WeeklyItem[]): string {
  const groupedItems = new Map<string, string[]>();

  items.forEach((item) => {
    const projectItems = groupedItems.get(item.projectName) ?? [];
    projectItems.push(item.content);
    groupedItems.set(item.projectName, projectItems);
  });

  return Array.from(groupedItems.entries())
    .map(([projectName, contents]) => `${projectName}\n${contents.map((content) => `- ${content}`).join("\n")}`)
    .join("\n\n");
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
        projectName: project.name,
        content: todo.title,
      });
    });
  });

  state.workLogs.forEach((workLog) => {
    const bucket = buckets.get(workLog.date);
    if (!bucket) {
      return;
    }

    const project = state.projects.find((item) => item.id === workLog.projectId);
    const item: WeeklyItem = {
      projectName: project?.name ?? "Unknown",
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

function setCellValue(worksheet: ExcelJS.Worksheet, address: string, value: string): void {
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

  setCellValue(worksheet, "B2", `${weekLabel} 주간업무 리포트`);
  setCellValue(worksheet, "B5", "업무 계획");
  setCellValue(worksheet, "B7", "업무 내용");
  setCellValue(worksheet, "B17", "업무 일지");
  setCellValue(worksheet, "B19", "업무 내용");

  weekdays.forEach((weekday, index) => {
    const dateKey = toDateKey(weekday);
    const dayBuckets = buckets.get(dateKey)!;

    setCellValue(worksheet, PLAN_CELLS[index], formatGroupedItems(dayBuckets.plan));
    setCellValue(worksheet, DONE_CELLS[index], formatGroupedItems(dayBuckets.done));
  });

  return workbook;
}
