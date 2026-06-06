/// <reference types="vite/client" />

import type { AppState } from "./types";

type OpenTodoWorkspaceResult =
  | {
      canceled: true;
    }
  | {
      canceled: false;
      workspacePath: string;
      state: AppState;
    };

type SaveTodoWorkspaceResult = {
  canceled: boolean;
  workspacePath?: string;
};

type DefaultTodoWorkspaceResult =
  | {
      found: false;
      workspacePath: string;
    }
  | {
      found: true;
      workspacePath: string;
      state: AppState;
    };

type TodoFileMenuCommand = "open-project" | "save-project" | "save-project-as";

type RecentWorkspaceEntry = {
  path: string;
  name: string;
  exists: boolean;
};

type RecentWorkspacesResult = {
  recents: RecentWorkspaceEntry[];
};

declare global {
  interface Window {
    hiusTodoFile?: {
      openDefaultWorkspace: () => Promise<DefaultTodoWorkspaceResult>;
      openWorkspace: () => Promise<OpenTodoWorkspaceResult>;
      openWorkspacePath: (workspacePath: string) => Promise<OpenTodoWorkspaceResult>;
      listRecents: () => Promise<RecentWorkspacesResult>;
      removeRecent: (workspacePath: string) => Promise<RecentWorkspacesResult>;
      saveWorkspace: (state: AppState, workspacePath?: string) => Promise<SaveTodoWorkspaceResult>;
      saveWorkspaceAs: (state: AppState) => Promise<SaveTodoWorkspaceResult>;
      setDirty: (isDirty: boolean) => void;
      onMenuCommand: (callback: (command: TodoFileMenuCommand) => void) => () => void;
      onSaveRequest: (callback: (requestId: string, saveAs: boolean) => Promise<boolean>) => () => void;
    };
  }
}
