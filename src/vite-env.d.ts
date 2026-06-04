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

declare global {
  interface Window {
    hiusTodoFile?: {
      openDefaultWorkspace: () => Promise<DefaultTodoWorkspaceResult>;
      openWorkspace: () => Promise<OpenTodoWorkspaceResult>;
      saveWorkspace: (state: AppState, workspacePath?: string) => Promise<SaveTodoWorkspaceResult>;
      saveWorkspaceAs: (state: AppState) => Promise<SaveTodoWorkspaceResult>;
      setDirty: (isDirty: boolean) => void;
      onMenuCommand: (callback: (command: TodoFileMenuCommand) => void) => () => void;
      onSaveRequest: (callback: (requestId: string, saveAs: boolean) => Promise<boolean>) => () => void;
    };
  }
}
