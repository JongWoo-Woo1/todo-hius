/// <reference types="vite/client" />

import type { AppState } from "./types";
import type { DevReloadSnapshot } from "./platform/todoFileClient";

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
      getStartupWorkspacePath: () => Promise<string | null>;
      listRecents: () => Promise<RecentWorkspacesResult>;
      removeRecent: (workspacePath: string) => Promise<RecentWorkspacesResult>;
      saveWorkspace: (state: AppState, workspacePath?: string) => Promise<SaveTodoWorkspaceResult>;
      saveWorkspaceAs: (state: AppState) => Promise<SaveTodoWorkspaceResult>;
      setDirty: (isDirty: boolean) => void;
      publishAppState: (state: AppState) => void;
      getLatestAppState: () => Promise<AppState | null>;
      onAppStateChange: (callback: (state: AppState) => void) => () => void;
      onDirtyChange: (callback: (isDirty: boolean) => void) => () => void;
      openWorkspaceWindow: (windowKey: string) => Promise<string[]>;
      listWorkspaceWindows: () => Promise<string[]>;
      onWorkspaceWindowsChange: (callback: (windowKeys: string[]) => void) => () => void;
      onMenuCommand: (callback: (command: TodoFileMenuCommand) => void) => () => void;
      onOpenWorkspacePathRequest: (callback: (workspacePath: string) => void) => () => void;
      onSaveRequest: (callback: (requestId: string, saveAs: boolean) => Promise<boolean>) => () => void;
      publishDevReloadSnapshot: (snapshot: DevReloadSnapshot) => void;
      getDevReloadSnapshot: () => Promise<DevReloadSnapshot | null>;
    };
    hiusTodoAi?: {
      onAiActionRequest: (
        callback: (requestId: string, action: string, payload: unknown) => void,
      ) => () => void;
      sendAiActionResult: (requestId: string, result: unknown) => void;
    };
  }
}
