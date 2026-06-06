import type { RecentWorkspaceEntry } from "../platform/todoFileClient";

export type StartupDialogOptions = {
  recents: RecentWorkspaceEntry[];
  onOpenRecent: (workspacePath: string) => void;
  onOpenOther: () => void;
  onNewProject: () => void;
  onRemoveRecent: (workspacePath: string) => void;
};

let overlay: HTMLElement | null = null;

export function closeStartupDialog(): void {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

export function openStartupDialog(options: StartupDialogOptions): void {
  closeStartupDialog();

  overlay = document.createElement("div");
  overlay.className = "startup-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const panel = document.createElement("div");
  panel.className = "startup-panel";

  const header = document.createElement("div");
  header.className = "startup-header";
  header.innerHTML = `
    <p class="eyebrow">HIUS Todo</p>
    <h2>프로젝트 열기</h2>
    <p class="startup-subtitle">최근 프로젝트를 선택하거나 새로 시작하세요.</p>
  `;
  panel.append(header);

  const recentsSection = document.createElement("div");
  recentsSection.className = "startup-recents";

  if (options.recents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "startup-empty";
    empty.textContent = "최근 연 프로젝트가 없습니다.";
    recentsSection.append(empty);
  } else {
    options.recents.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "startup-recent-row";
      row.classList.toggle("missing", !entry.exists);

      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "startup-recent-open";
      openButton.disabled = !entry.exists;
      openButton.innerHTML = `
        <span class="startup-recent-name"></span>
        <span class="startup-recent-path"></span>
      `;
      openButton.querySelector(".startup-recent-name")!.textContent =
        entry.name + (entry.exists ? "" : " (찾을 수 없음)");
      openButton.querySelector(".startup-recent-path")!.textContent = entry.path;
      openButton.title = entry.path;
      openButton.addEventListener("click", () => options.onOpenRecent(entry.path));

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "startup-recent-remove";
      removeButton.textContent = "✕";
      removeButton.title = "목록에서 제거";
      removeButton.setAttribute("aria-label", "목록에서 제거");
      removeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        options.onRemoveRecent(entry.path);
      });

      row.append(openButton, removeButton);
      recentsSection.append(row);
    });
  }
  panel.append(recentsSection);

  const actions = document.createElement("div");
  actions.className = "startup-actions";

  const openOther = document.createElement("button");
  openOther.type = "button";
  openOther.className = "quiet-button";
  openOther.textContent = "다른 .todo 열기…";
  openOther.addEventListener("click", options.onOpenOther);

  const newProject = document.createElement("button");
  newProject.type = "button";
  newProject.textContent = "새 프로젝트";
  newProject.addEventListener("click", options.onNewProject);

  actions.append(openOther, newProject);
  panel.append(actions);

  overlay.append(panel);
  document.body.append(overlay);
  newProject.focus();
}
