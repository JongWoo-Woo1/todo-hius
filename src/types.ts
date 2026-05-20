export type Todo = {
  id: string;
  title: string;
  dueDate: string | null;
  memo: string;
  completed: boolean;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  todos: Todo[];
};

export type AppState = {
  projects: Project[];
  activeProjectId: string | null;
};
