# Project To Do

Vite + TypeScript + pure DOM 기반의 회사 프로젝트 Todo 관리 앱입니다.

프로젝트별 업무를 관리하고, 모든 프로젝트의 일정과 업무 현황을 Calendar, Weekly, Ledger View에서 확인할 수 있습니다. 데이터는 브라우저 `localStorage`에 저장됩니다.

## Main Features

- 프로젝트별 Todo 관리
- 프로젝트 생성, 삭제, 이름 수정
  - 개별 Project 화면에서 프로젝트 이름 클릭 후 수정
- 프로젝트 색상 변경
- 왼쪽 Nav에서 프로젝트 drag and drop 순서 변경
- JSON 백업 파일 Export
- JSON 백업 파일 Import / Restore
- 현재 `sampleProjects.ts` 데이터로 초기화
- Todo 생성, 삭제, 완료 체크
- 지연 업무 표시
- Todo 상세 정보 수정:
  - Todo 카드 선택 시 카드 내부에서 상세 정보 확인, 다시 선택 시 요약 상태로 접기
  - 수정 버튼을 눌러 상세 입력 폼 전환
  - 업무명
  - 내부 목표 완료일
  - 공수
  - 진행상태
  - 진척률
  - 우선순위
  - 담당자 Comment
  - 관리자 Comment
  - 이슈/리스크
  - 메모
- Project Info 수정:
  - 기본은 읽기 모드로 표시
  - 수정 버튼을 눌러 입력 폼 전환
  - 업체명
  - 프로젝트 번호
  - 프로젝트 기간 텍스트
  - 시작일
  - 종료일
- Calendar View:
  - 모든 프로젝트의 Todo 일정을 여러 달 Calendar에서 확인
  - 프로젝트별 색상 구분
  - 프로젝트 체크박스로 원하는 프로젝트만 표시
  - Calendar 일정 클릭 시 상세 팝업에서 Todo 확인과 수정
  - 상세 팝업에서 관련 Project 화면으로 이동
  - 2026년 월 범위 Calendar를 기본 화면으로 표시
  - 월 범위 Calendar 기본값은 현재 월부터 3개월, 1 column
  - 월 범위와 column 설정은 앱을 사용하는 동안 유지되고, 새로 시작하면 현재 월 기준 기본값으로 초기화
- Weekly View:
  - 월요일~금요일 기준 주간업무 리포트 확인
  - 월~금 업무 계획/업무 일지 영역은 같은 placeholder 크기로 표시
  - Todo due date 기준 업무 계획 자동 표시
  - 업무 계획, 업무 일지 WorkLog 추가
  - WorkLog를 Project/Todo와 연결해서 Project 화면과 함께 확인
  - WorkLog 삭제
  - 이전 주 / 다음 주 이동
  - Template 기반 주간업무 리포트 `.xlsx` 파일 다운로드
- Ledger View:
  - 모든 프로젝트와 모든 Todo를 하나의 표로 확인
  - 업체 기준 내림차순 정렬
  - 같은 업체와 프로젝트 정보는 병합된 셀로 표시
  - 상태, 업체명, 완료 업무 숨기기, 지연 업무만 보기 필터
  - 행 클릭 시 해당 Project와 Todo 상세 편집 화면으로 이동
  - 회사 원장 양식에 맞춰 병합 셀이 적용된 프로젝트 원장 `.xlsx` 파일 다운로드

## Views

### Project

프로젝트 상세 화면입니다.

왼쪽 프로젝트 목록에서 프로젝트를 클릭하면 진입합니다. 프로젝트 기본 정보, 색상, Todo 목록을 관리할 수 있습니다. Todo 카드를 선택하면 카드가 펼쳐져 상세 정보가 보이고, 수정 버튼을 누르면 해당 카드 안에서 입력 폼으로 전환됩니다.

Project 화면에서는 해당 Project에 연결된 Weekly Logs를 함께 확인할 수 있습니다. Todo에 연결된 WorkLog는 펼쳐진 Todo 카드 안에서도 바로 보입니다.

### Calendar

전체 프로젝트 일정 화면입니다.

앱을 처음 열면 Calendar가 기본으로 표시됩니다. Calendar는 여러 달을 한 번에 보는 월 범위 화면으로 동작하며, 시작 월, 종료 월, column 수를 조정할 수 있습니다.

### Weekly

주간업무 리포트 화면입니다.

월요일~금요일 기준으로 업무 계획과 업무 일지를 확인합니다. Todo의 due date는 업무 계획에 자동으로 표시되고, WorkLog form으로 계획/수행 기록을 직접 추가할 수 있습니다.

현재 보고 있는 주차 기준으로 주간업무 리포트 Excel 파일을 다운로드할 수 있습니다. Weekly Report Export는 `public/templates/weekly-report-template.xlsx` 서식을 불러와 값만 채우고, sheet 이름을 `5월 4주차` 같은 월/주차 형식으로 설정합니다.

WorkLog는 Project와 선택적으로 Todo에 연결됩니다. Weekly 항목의 Open task 버튼을 누르면 연결된 Project/Todo 화면으로 이동합니다.

### Ledger

전체 업무 원장 화면입니다.

모든 프로젝트의 Todo를 회사 프로젝트 관리표처럼 하나의 table에서 확인합니다.

## Folder Structure

- `src/`: TypeScript source code
- `src/styles.css`: app styling loaded by Vite
- `src/state/`: app state, migration, localStorage persistence
- `src/ui/`: DOM references and rendering
- `src/data/`: sample project data
- `src/utils/`: shared helpers

## Main Modules

- `src/main.ts`: app entry point and form events
- `src/styles.css`: app styling
- `src/vite-env.d.ts`: Vite client type declarations for CSS and asset imports
- `src/data/sampleProjects.ts`: initial demo projects for an empty browser state
- `src/state/store.ts`: project, todo, and work log state changes
- `src/state/storage.ts`: localStorage raw read/write wrapper
- `src/state/calendarPreferences.ts`: Calendar range preference storage
- `src/excel/projectLedgerReport.ts`: Project Ledger Excel workbook creation
- `src/excel/weeklyReport.ts`: Weekly Report Excel workbook creation
- `src/excel/downloadWorkbook.ts`: browser `.xlsx` download helper
- `src/ui/render.ts`: Project, Ledger, Weekly, and Calendar rendering
- `src/ui/dom.ts`: shared DOM element lookups
- `src/utils/task.ts`: task progress and overdue helpers
- `src/utils/week.ts`: Monday-Friday weekly date helpers
- `src/types.ts`: shared TypeScript types

## Scripts

- `npm run dev`: start the Vite development server
- `npm run dev:electron`: start Vite, watch the Electron main process, and relaunch Electron during development
- `npm run build`: build the Vite web assets and Electron main process
- `npm run build:web`: build only the Vite web assets
- `npm run build:electron`: build only the Electron main process
- `npm run preview`: preview the production build
- `npm run typecheck`: check TypeScript without emitting files

`src/` is the source of truth. Vite loads `src/main.ts` directly during development and emits optimized production files into `dist/` during build.

## Electron Development

The `electron` branch adds a desktop shell around the existing Vite + TypeScript + pure DOM app.

- Electron main process source lives in `electron/main.ts`.
- Electron build output is emitted to `dist-electron/`.
- `npm run dev:electron` runs Vite with hot reload and restarts Electron when the main process changes.
- The app still uses the existing browser UI and localStorage workflow.

## Project History

- See `HISTORY.md` for the chronological development history.
- See `AGENTS.md` for Codex working rules, validation, and version control rules.
