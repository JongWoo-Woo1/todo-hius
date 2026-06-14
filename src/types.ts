export type TaskStatus = "대기" | "진행중" | "검토대기" | "완료";

export type TaskPriority = "낮음" | "보통" | "높음" | "최우선";

export type WorkLogType = "계획" | "수행";

export type ProjectPeriodStatus = "대기" | "연도월";

export type AppSchemaVersion = 1 | 2;

export type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  estimate?: string;
  status: TaskStatus;
  progress: number;
  workerComment?: string;
  managerComment?: string;
  issueRisk?: string;
  priority?: TaskPriority;
  memo: string;
  completed: boolean;
};

export type Project = {
  id: string;
  name: string;
  clientName: string;
  projectNumber?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  periodText?: string;
  periodStatus?: ProjectPeriodStatus;
  periodStartMonth?: string | null;
  periodEndMonth?: string | null;
  hideFromLedger?: boolean;
  color: string;
  tasks: Task[];
  deletedTasks: Task[];
};

export type WorkLog = {
  id: string;
  projectId: string;
  taskId?: string;
  linkedTaskTitleSnapshot?: string;
  linkedTaskDeleted?: boolean;
  date: string;
  // End of the planned range. Only meaningful for "계획" logs; "수행" stays single-day (null).
  endDate?: string | null;
  type: WorkLogType;
  content: string;
};

export type ProjectEvent = {
  id: string;
  projectId: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  content: string;
  taskId?: string;
};

export type AppState = {
  schemaVersion: AppSchemaVersion;
  projects: Project[];
  activeProjectId: string | null;
  workLogs: WorkLog[];
  events: ProjectEvent[];
};
