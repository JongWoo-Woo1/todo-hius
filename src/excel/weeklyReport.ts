import ExcelJS from "exceljs";
import type { AppState } from "../types";
import { toDateKey } from "../utils/calendar";
import { getWeekRangeLabel, getWeekdays } from "../utils/week";

type WeeklySectionKey = "plan" | "done" | "note";

type WeeklyItem = {
  projectName: string;
  content: string;
};

const WEEKLY_SECTIONS: Array<{ key: WeeklySectionKey; title: string }> = [
  { key: "plan", title: "업무 계획" },
  { key: "done", title: "업무 내용" },
  { key: "note", title: "특이사항" },
];

function createWeeklyBuckets(date: Date): Map<string, Record<WeeklySectionKey, WeeklyItem[]>> {
  const buckets = new Map<string, Record<WeeklySectionKey, WeeklyItem[]>>();

  getWeekdays(date).forEach((weekday) => {
    buckets.set(toDateKey(weekday), {
      plan: [],
      done: [],
      note: [],
    });
  });

  return buckets;
}

function formatWeeklyItem(item: WeeklyItem): string {
  return `[${item.projectName}] ${item.content}`;
}

function applyBorder(cell: ExcelJS.Cell): void {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
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
    } else if (workLog.type === "수행") {
      bucket.done.push(item);
    } else {
      bucket.note.push(item);
    }
  });

  worksheet.mergeCells(1, 1, 1, 5);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = "주간업무 리포트";
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  worksheet.mergeCells(2, 1, 2, 5);
  const rangeCell = worksheet.getCell(2, 1);
  rangeCell.value = getWeekRangeLabel(date);
  rangeCell.font = { bold: true };
  rangeCell.alignment = { horizontal: "center", vertical: "middle" };

  const dayHeaderRow = worksheet.getRow(4);
  weekdays.forEach((weekday, index) => {
    const cell = dayHeaderRow.getCell(index + 1);
    cell.value = `${weekday.toLocaleDateString("en-US", { weekday: "long" })}\n${toDateKey(weekday)}`;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
  });

  WEEKLY_SECTIONS.forEach((section, sectionIndex) => {
    const labelRow = worksheet.getRow(5 + sectionIndex * 2);
    const contentRow = worksheet.getRow(6 + sectionIndex * 2);

    weekdays.forEach((weekday, dayIndex) => {
      const dateKey = toDateKey(weekday);
      const labelCell = labelRow.getCell(dayIndex + 1);
      const contentCell = contentRow.getCell(dayIndex + 1);
      const items = buckets.get(dateKey)![section.key];

      labelCell.value = section.title;
      labelCell.font = { bold: true };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: section.key === "note" ? "FFFFF7ED" : "FFF8FAFC" },
      };

      contentCell.value = items.length > 0 ? items.map(formatWeeklyItem).join("\n") : "";
      contentCell.alignment = { vertical: "top", wrapText: true };
    });
  });

  worksheet.columns = Array.from({ length: 5 }, () => ({ width: 34 }));

  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      applyBorder(cell);
      cell.alignment = {
        ...cell.alignment,
        vertical: cell.alignment?.vertical ?? "top",
        wrapText: true,
      };
    });
  });

  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 22;
  worksheet.getRow(4).height = 38;
  worksheet.getRow(6).height = 90;
  worksheet.getRow(8).height = 90;
  worksheet.getRow(10).height = 90;

  return workbook;
}
