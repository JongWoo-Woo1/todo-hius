import ExcelJS from "exceljs";
import type { AppState } from "../types";
import { getLedgerRows } from "../utils/ledger";

const LEDGER_HEADERS = [
  "고객사",
  "프로젝트 번호",
  "프로젝트",
  "프로젝트 기간",
  "내부 목표 완료일",
  "공수",
  "주요 추진내용",
  "진행상태",
  "진척률",
  "Comment 담당자",
  "Comment 관리자",
];

const TABLE_START_ROW = 2;
const TABLE_START_COLUMN = 2;
const HEADER_ROW_NUMBER = TABLE_START_ROW;
const DATA_START_ROW = TABLE_START_ROW + 1;
const TABLE_END_COLUMN = TABLE_START_COLUMN + LEDGER_HEADERS.length - 1;

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

function mergeRowsByKey(
  worksheet: ExcelJS.Worksheet,
  rows: ReturnType<typeof getLedgerRows>,
  columnNumber: number,
  getKey: (row: ReturnType<typeof getLedgerRows>[number]) => string,
): void {
  let groupStartIndex = 0;

  for (let index = 1; index <= rows.length; index += 1) {
    const previousKey = getKey(rows[groupStartIndex]);
    const currentKey = rows[index] ? getKey(rows[index]) : null;
    if (currentKey === previousKey) {
      continue;
    }

    const startRow = groupStartIndex + DATA_START_ROW;
    const endRow = index + DATA_START_ROW - 1;
    if (startRow < endRow) {
      worksheet.mergeCells(startRow, columnNumber, endRow, columnNumber);
      worksheet.getCell(startRow, columnNumber).alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
    }

    groupStartIndex = index;
  }
}

function formatLedgerDate(date: string | null | undefined): string {
  if (!date) {
    return "";
  }

  const [year, month, day] = date.split("-");
  if (!year || !month || !day) {
    return date;
  }

  return `${year.slice(-2)}-${month}-${day}`;
}

function applyTableCellStyle(
  cell: ExcelJS.Cell,
  alignment: Partial<ExcelJS.Alignment> = { horizontal: "left", vertical: "middle" },
): void {
  cell.font = { name: "맑은 고딕", size: 10 };
  cell.alignment = {
    ...alignment,
    wrapText: true,
  };
  cell.border = thinBorder;
}

function applyRowBorder(worksheet: ExcelJS.Worksheet, rowNumber: number): void {
  for (let columnNumber = TABLE_START_COLUMN; columnNumber <= TABLE_END_COLUMN; columnNumber += 1) {
    worksheet.getCell(rowNumber, columnNumber).border = thinBorder;
  }
}

export function createProjectLedgerWorkbook(state: AppState): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("프로젝트 원장");
  const rows = getLedgerRows(state);

  worksheet.views = [{ showGridLines: true }];
  worksheet.getColumn(1).width = 2.6;
  worksheet.getRow(1).height = 10;

  worksheet.columns = [
    { width: 2.6 },
    { width: 18 },
    { width: 14 },
    { width: 34 },
    { width: 22 },
    { width: 15 },
    { width: 11 },
    { width: 44 },
    { width: 9 },
    { width: 8 },
    { width: 26 },
    { width: 28 },
  ];

  const headerRow = worksheet.getRow(HEADER_ROW_NUMBER);
  headerRow.height = 28;
  LEDGER_HEADERS.forEach((header, index) => {
    const cell = headerRow.getCell(TABLE_START_COLUMN + index);
    cell.value = header;
    cell.font = { name: "맑은 고딕", bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9D9D9" },
    };
    cell.border = thinBorder;
  });

  rows.forEach(({ todo, clientName, projectNumber, projectName, projectPeriod }, index) => {
    const row = worksheet.getRow(DATA_START_ROW + index);
    row.height = 19;

    [
      clientName,
      projectNumber,
      projectName,
      projectPeriod,
      formatLedgerDate(todo.dueDate),
      todo.estimate ?? "",
      todo.title,
      todo.status,
      todo.progress,
      todo.workerComment ?? "",
      todo.managerComment ?? "",
    ].forEach((value, valueIndex) => {
      const columnNumber = TABLE_START_COLUMN + valueIndex;
      const cell = row.getCell(columnNumber);
      cell.value = value;
      applyTableCellStyle(cell);
    });
  });

  for (let rowNumber = DATA_START_ROW; rowNumber < DATA_START_ROW + rows.length; rowNumber += 1) {
    applyRowBorder(worksheet, rowNumber);

    [2, 3, 4, 5, 6, 7, 9, 10].forEach((columnNumber) => {
      worksheet.getCell(rowNumber, columnNumber).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    });

    [8, 11, 12].forEach((columnNumber) => {
      worksheet.getCell(rowNumber, columnNumber).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
    });
  }

  if (rows.length > 1) {
    mergeRowsByKey(worksheet, rows, 2, (row) => row.clientName);
    [3, 4, 5].forEach((columnNumber) => {
      mergeRowsByKey(worksheet, rows, columnNumber, (row) => row.project.id);
    });
  }

  return workbook;
}
