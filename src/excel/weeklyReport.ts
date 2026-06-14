import ExcelJS from "exceljs";
import type { AppState, WorkLog } from "../types";
import { formatDisplayDate, toDateKey } from "../utils/calendar";
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
const REPORT_AUTHOR = "우종우";

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
  return item.clientName ? `${item.clientName} / ${item.projectName}` : item.projectName;
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
      contents.forEach((content) => {
        content.split("\n").forEach((line) => {
          if (!line.trim()) {
            lines.push(line);
            return;
          }
          lines.push(line.trimStart().startsWith("- ") ? line : `- ${line}`);
        });
      });
    });
    richText.push({ text: lines.join("\n") });
  });

  return { richText };
}

async function fetchWeeklyReportTemplate(): Promise<ArrayBuffer> {
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) {
    throw new Error(`Failed to load weekly report template: ${response.status}`);
  }

  return response.arrayBuffer();
}

function getTemplateWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const worksheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME) ?? workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Weekly report template does not contain a worksheet.");
  }

  return worksheet;
}

// ExcelJS lacks a worksheet clone; copy the template's model and re-apply merges
// (merges are not carried over by the model assignment).
async function addTemplatedWorksheet(
  workbook: ExcelJS.Workbook,
  templateBuffer: ArrayBuffer,
  sheetName: string,
): Promise<ExcelJS.Worksheet> {
  const templateWorkbook = new ExcelJS.Workbook();
  await templateWorkbook.xlsx.load(templateBuffer);
  const templateSheet = getTemplateWorksheet(templateWorkbook);

  const worksheet = workbook.addWorksheet(sheetName);
  const model = templateSheet.model;
  const merges = Array.isArray(model.merges) ? model.merges.slice() : [];
  worksheet.model = { ...model, name: sheetName, merges: [] };

  // The worksheet model setter drops the styles of merge-slave cells, which wipes
  // the bottom/right borders of every merged block. Re-copy each cell's style from
  // the template to restore them.
  const { top, left, bottom, right } = templateSheet.dimensions;
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      worksheet.getCell(row, col).style = templateSheet.getCell(row, col).style;
    }
  }

  // mergeCellsWithoutStyle preserves the per-cell styles re-applied above
  // (plain mergeCells would overwrite slaves with the master cell's style).
  merges.forEach((range) => worksheet.mergeCellsWithoutStyle(range));

  return worksheet;
}

// Mondays of every week that belongs to the given date's month (week = month of its Monday).
function getMonthlyWeekMondays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();

  let monday = getWeekdays(new Date(year, month, 1))[0];
  if (monday.getFullYear() !== year || monday.getMonth() !== month) {
    monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  }

  const mondays: Date[] = [];
  while (monday.getFullYear() === year && monday.getMonth() === month) {
    mondays.push(monday);
    monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  }

  return mondays;
}

function getWorkLogBucketKeys(workLog: WorkLog, buckets: Map<string, Record<WeeklySectionKey, WeeklyItem[]>>): string[] {
  if (workLog.type !== "계획" || !workLog.endDate) {
    return buckets.has(workLog.date) ? [workLog.date] : [];
  }

  return Array.from(buckets.keys()).filter((dateKey) => workLog.date <= dateKey && dateKey <= workLog.endDate!);
}

function fillWeeklyBuckets(state: AppState, date: Date): Map<string, Record<WeeklySectionKey, WeeklyItem[]>> {
  const buckets = createWeeklyBuckets(date);

  state.workLogs.forEach((workLog) => {
    const bucketKeys = getWorkLogBucketKeys(workLog, buckets);
    if (bucketKeys.length === 0) {
      return;
    }

    const project = state.projects.find((item) => item.id === workLog.projectId);
    const linkedTask = workLog.taskId ? project?.tasks.find((task) => task.id === workLog.taskId) : undefined;
    const item: WeeklyItem = {
      clientName: project?.clientName ?? "",
      projectName: project?.name ?? "Unknown",
      taskTitle: linkedTask?.title ?? "",
      content: workLog.content,
    };

    bucketKeys.forEach((dateKey) => {
      const bucket = buckets.get(dateKey)!;
      if (workLog.type === "계획") {
        bucket.plan.push(item);
      }

      if (workLog.type === "수행") {
        bucket.done.push(item);
      }
    });
  });

  return buckets;
}

function setCellValue(worksheet: ExcelJS.Worksheet, address: string, value: ExcelJS.CellValue): void {
  worksheet.getCell(address).value = value;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getWeeklyReportFileName(date: Date): string {
  const month = `${date.getFullYear()}.${pad2(date.getMonth() + 1)}`;
  const today = new Date();
  const exportStamp = `${pad2(today.getMonth() + 1)}${pad2(today.getDate())}`;

  return `업무일지_${month}_${REPORT_AUTHOR}_${exportStamp}.xlsx`;
}

function fillWeeklyWorksheet(
  worksheet: ExcelJS.Worksheet,
  state: AppState,
  weekMonday: Date,
  exportDateKey: string,
): void {
  const weekdays = getWeekdays(weekMonday);
  const buckets = fillWeeklyBuckets(state, weekMonday);
  const weekLabel = getWeekOfMonthLabel(weekMonday);

  setCellValue(worksheet, TITLE_CELL, `${weekLabel} 주간업무 리포트`);
  setCellValue(worksheet, REPORT_DATE_CELL, formatDisplayDate(exportDateKey));

  weekdays.forEach((weekday, index) => {
    const dateKey = toDateKey(weekday);
    const dayBuckets = buckets.get(dateKey)!;

    setCellValue(worksheet, PLAN_CELLS[index], formatGroupedItems(dayBuckets.plan));
    setCellValue(worksheet, DONE_CELLS[index], formatGroupedItems(dayBuckets.done));
  });
}

export async function createWeeklyReportWorkbook(state: AppState, date: Date): Promise<ExcelJS.Workbook> {
  const templateBuffer = await fetchWeeklyReportTemplate();
  const workbook = new ExcelJS.Workbook();
  const exportDateKey = toDateKey(new Date());

  for (const weekMonday of getMonthlyWeekMondays(date)) {
    const sheetName = getWeekOfMonthLabel(weekMonday);
    const worksheet = await addTemplatedWorksheet(workbook, templateBuffer, sheetName);
    fillWeeklyWorksheet(worksheet, state, weekMonday, exportDateKey);
  }

  return workbook;
}
