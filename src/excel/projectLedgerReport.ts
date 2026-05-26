import ExcelJS from "exceljs";
import type { AppState } from "../types";
import { getLedgerRows } from "../utils/ledger";
import { formatProgressPercent } from "../utils/task";

const LEDGER_HEADERS = [
  "업체",
  "프로젝트 번호",
  "프로젝트",
  "프로젝트 기간",
  "내부 목표 완료일",
  "공수",
  "주요 추진내용",
  "진행상태",
  "진척률",
  "우선순위",
  "이슈/리스크",
  "Comment 담당자",
  "Comment 관리자",
];

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

    const startRow = groupStartIndex + 3;
    const endRow = index + 2;
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

export function createProjectLedgerWorkbook(state: AppState): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("프로젝트 원장");

  worksheet.mergeCells(1, 1, 1, LEDGER_HEADERS.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = "프로젝트 원장";
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  const headerRow = worksheet.getRow(2);
  headerRow.values = LEDGER_HEADERS;
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
  });

  const rows = getLedgerRows(state);

  rows.forEach(({ todo, clientName, projectNumber, projectName, projectPeriod }) => {
    worksheet.addRow([
      clientName,
      projectNumber,
      projectName,
      projectPeriod,
      todo.dueDate ?? "",
      todo.estimate ?? "",
      todo.title,
      todo.status,
      formatProgressPercent(todo.progress),
      todo.priority ?? "",
      todo.issueRisk ?? "",
      todo.workerComment ?? "",
      todo.managerComment ?? "",
    ]);
  });

  worksheet.columns = [
    { width: 16 },
    { width: 16 },
    { width: 22 },
    { width: 20 },
    { width: 16 },
    { width: 10 },
    { width: 36 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 32 },
    { width: 32 },
    { width: 32 },
  ];

  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = {
        ...cell.alignment,
        vertical: "top",
        wrapText: true,
      };
    });
  });

  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 22;

  if (rows.length > 1) {
    mergeRowsByKey(worksheet, rows, 1, (row) => row.clientName);
    [2, 3, 4].forEach((columnNumber) => {
      mergeRowsByKey(worksheet, rows, columnNumber, (row) => row.project.id);
    });
  }

  return workbook;
}
