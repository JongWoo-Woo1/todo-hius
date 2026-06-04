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

declare global {
  interface Window {
    hiusTodoFile?: {
      openWorkspace: () => Promise<OpenTodoWorkspaceResult>;
      saveWorkspace: (state: AppState, workspacePath?: string) => Promise<SaveTodoWorkspaceResult>;
    };
  }
}
