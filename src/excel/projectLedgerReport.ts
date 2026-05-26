import ExcelJS from "exceljs";
import type { AppState } from "../types";
import { formatProjectPeriod } from "../utils/project";
import { formatProgressPercent } from "../utils/task";

const LEDGER_HEADERS = [
  "업체명",
  "프로젝트 번호",
  "프로젝트명",
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

  state.projects.forEach((project) => {
    project.todos.forEach((todo) => {
      worksheet.addRow([
        project.clientName,
        project.projectNumber ?? "",
        project.name,
        formatProjectPeriod(project),
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

  return workbook;
}
