export type TaskStatus = "대기" | "진행중" | "미완" | "완료" | "보류";

export type TaskPriority = "낮음" | "보통" | "높음" | "최우선";

export type WorkLogType = "계획" | "수행";

export type Todo = {
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
  color: string;
  todos: Todo[];
};

export type WorkLog = {
  id: string;
  projectId: string;
  todoId?: string;
  date: string;
  type: WorkLogType;
  content: string;
};

export type AppState = {
  projects: Project[];
  activeProjectId: string | null;
  workLogs: WorkLog[];
};
