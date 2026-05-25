# Project To Do

Vite + TypeScript + pure DOM 기반의 회사 프로젝트 Todo 관리 앱입니다.

프로젝트별 업무를 관리하고, 모든 프로젝트의 일정을 Calendar와 Ledger에서 한 번에 확인할 수 있습니다. 데이터는 브라우저 `localStorage`에 저장됩니다.

## Main Features

- 프로젝트별 Todo 관리
- 프로젝트 생성, 삭제, 이름 수정
- 프로젝트 색상 변경
- 왼쪽 Nav에서 프로젝트 drag and drop 순서 변경
- Todo 생성, 삭제, 완료 체크
- Todo 상세 정보 수정:
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
  - 업체명
  - 프로젝트 번호
  - 프로젝트 기간 텍스트
  - 시작일
  - 종료일
- Calendar View:
  - 모든 프로젝트의 Todo 일정을 한 달 달력에서 확인
  - 프로젝트별 색상 구분
  - 프로젝트 체크박스로 원하는 프로젝트만 표시
  - 2026년 월 범위 Calendar 보기
  - 월 범위와 column 설정 캐싱
- Ledger View:
  - 모든 프로젝트와 모든 Todo를 하나의 표로 확인
  - 상태, 업체명, 완료 업무 숨기기 필터
  - 행 클릭 시 해당 Project와 Todo 상세 편집 화면으로 이동

## Views

### Project

프로젝트 상세 화면입니다.

프로젝트 기본 정보, 색상, Todo 목록, 선택한 Todo의 상세 정보를 수정할 수 있습니다.

### Ledger

전체 업무 원장 화면입니다.

모든 프로젝트의 Todo를 회사 프로젝트 관리표처럼 하나의 table에서 확인합니다.

### Calendar

전체 프로젝트 일정 화면입니다.

앱을 처음 열면 Calendar가 기본으로 표시됩니다. Calendar 버튼을 다시 누르면 2026년 월 범위 Calendar 모드로 전환됩니다.

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
- `src/data/sampleProjects.ts`: initial demo projects for an empty browser state
- `src/state/store.ts`: project and todo state changes
- `src/state/storage.ts`: localStorage raw read/write wrapper
- `src/state/calendarPreferences.ts`: Calendar range preference storage
- `src/ui/render.ts`: Project, Ledger, and Calendar rendering
- `src/ui/dom.ts`: shared DOM element lookups
- `src/types.ts`: shared TypeScript types

## Scripts

- `npm run dev`: start the Vite development server
- `npm run build`: build production assets with Vite
- `npm run preview`: preview the production build
- `npm run typecheck`: check TypeScript without emitting files

`src/` is the source of truth. Vite loads `src/main.ts` directly during development and emits optimized production files into `dist/` during build.

## Project History

- See `HISTORY.md` for the chronological development history.
- See `AGENTS.md` for Codex working rules, validation, and version control rules.
