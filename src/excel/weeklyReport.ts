import ExcelJS from "exceljs";
import type { AppState } from "../types";
import { toDateKey } from "../utils/calendar";
import { getWeekdays } from "../utils/week";

type WeeklySectionKey = "plan" | "done";

type WeeklyItem = {
  projectName: string;
  content: string;
};

const DAY_BLOCKS = [
  { start: 3, end: 7 },
  { start: 8, end: 12 },
  { start: 13, end: 17 },
  { start: 18, end: 22 },
  { start: 23, end: 27 },
] as const;

const REPORT_START_COLUMN = 2;
const REPORT_END_COLUMN = 27;

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

function applyThinBorder(cell: ExcelJS.Cell): void {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

function styleReportRange(worksheet: ExcelJS.Worksheet): void {
  for (let rowNumber = 2; rowNumber <= 48; rowNumber += 1) {
    for (let columnNumber = REPORT_START_COLUMN; columnNumber <= REPORT_END_COLUMN; columnNumber += 1) {
      const cell = worksheet.getCell(rowNumber, columnNumber);
      const existingFont = cell.font ?? {};
      applyThinBorder(cell);
      cell.font = {
        name: "Malgun Gothic",
        size: existingFont.size ?? 11,
        bold: existingFont.bold,
      };
      cell.alignment = {
        ...cell.alignment,
        vertical: cell.alignment?.vertical ?? "top",
        wrapText: true,
      };
    }
  }
}

function styleMergedHeader(cell: ExcelJS.Cell, fontSize: number): void {
  cell.font = { name: "Malgun Gothic", bold: true, size: fontSize };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
  };
}

function styleSectionHeader(cell: ExcelJS.Cell): void {
  cell.font = { name: "Malgun Gothic", bold: true, size: 16 };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" },
  };
}

function setSection(
  worksheet: ExcelJS.Worksheet,
  label: string,
  headerRows: [number, number],
  contentRows: [number, number],
  weekdays: Date[],
  buckets: Map<string, Record<WeeklySectionKey, WeeklyItem[]>>,
  sectionKey: WeeklySectionKey,
): void {
  worksheet.mergeCells(headerRows[0], REPORT_START_COLUMN, headerRows[1], REPORT_END_COLUMN);
  const sectionCell = worksheet.getCell(headerRows[0], REPORT_START_COLUMN);
  sectionCell.value = label;
  styleSectionHeader(sectionCell);

  worksheet.mergeCells(contentRows[0], REPORT_START_COLUMN, contentRows[1], REPORT_START_COLUMN);
  const labelCell = worksheet.getCell(contentRows[0], REPORT_START_COLUMN);
  labelCell.value = "업무 내용";
  labelCell.font = { name: "Malgun Gothic", bold: true, size: 11 };
  labelCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  weekdays.forEach((weekday, index) => {
    const block = DAY_BLOCKS[index];
    worksheet.mergeCells(contentRows[0], block.start, contentRows[1], block.end);

    const contentCell = worksheet.getCell(contentRows[0], block.start);
    const items = buckets.get(toDateKey(weekday))![sectionKey];
    contentCell.value = formatGroupedItems(items);
    contentCell.font = { name: "Malgun Gothic", size: 11 };
    contentCell.alignment = { vertical: "top", wrapText: true };
  });
}

export function getWeeklyReportFileDate(date: Date): string {
  return toDateKey(getWeekdays(date)[0]);
}

export function createWeeklyReportWorkbook(state: AppState, date: Date): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("주간업무 리포트");
  const weekdays = getWeekdays(date);
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

  worksheet.mergeCells(2, REPORT_START_COLUMN, 4, REPORT_END_COLUMN);
  const titleCell = worksheet.getCell(2, REPORT_START_COLUMN);
  titleCell.value = `${getWeekOfMonthLabel(date)} 주간업무 리포트`;
  styleMergedHeader(titleCell, 16);

  setSection(worksheet, "업무 계획", [5, 6], [7, 16], weekdays, buckets, "plan");
  setSection(worksheet, "업무 일지", [17, 18], [19, 48], weekdays, buckets, "done");

  worksheet.getColumn(1).width = 3;
  worksheet.getColumn(REPORT_START_COLUMN).width = 12;
  for (let columnNumber = 3; columnNumber <= REPORT_END_COLUMN; columnNumber += 1) {
    worksheet.getColumn(columnNumber).width = 7.5;
  }

  [2, 3, 4].forEach((rowNumber) => {
    worksheet.getRow(rowNumber).height = rowNumber === 3 ? 26 : 20;
  });
  [5, 6, 17, 18].forEach((rowNumber) => {
    worksheet.getRow(rowNumber).height = 22;
  });
  for (let rowNumber = 7; rowNumber <= 16; rowNumber += 1) {
    worksheet.getRow(rowNumber).height = 19;
  }
  for (let rowNumber = 19; rowNumber <= 48; rowNumber += 1) {
    worksheet.getRow(rowNumber).height = 19;
  }

  styleReportRange(worksheet);
  worksheet.views = [{ showGridLines: true }];

  return workbook;
}
